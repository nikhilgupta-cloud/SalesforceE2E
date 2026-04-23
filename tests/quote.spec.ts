/**
 * Quote Tests — Salesforce CPQ (RCA)
 * Auth: auth/session.json
 */
import { test, type Page } from '@playwright/test';
import * as dotenv from 'dotenv';
import { getTestData } from '../utils/test-data';
dotenv.config();

const SF = process.env.SF_SANDBOX_URL!;
const data = getTestData();

const MODAL = '[role="dialog"]:not([id="auraError"]):not([aria-hidden="true"])';

// Existing account from test-data.json
const EXISTING_ACCOUNT = data.account.Account_Name;

// Optional: set SF_TEST_OPP_PATH in .env to skip Opportunity creation entirely.
// e.g. SF_TEST_OPP_PATH=/lightning/r/Opportunity/006xxxxxxxxxxxxxxx/view
const EXISTING_OPP_PATH = process.env.SF_TEST_OPP_PATH || '';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function goTo(page: Page, path: string) {
  await page.goto(`${SF}${path}`, { waitUntil: 'domcontentloaded' });
  await page.locator('lightning-app, .slds-page-header, .desktop').first()
    .waitFor({ state: 'attached', timeout: 30000 }).catch(() => {});
  // Dismiss any stale modal left over from a prior test
  await page.locator(MODAL).waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
}

async function waitForDetail(page: Page) {
  await page.locator('.slds-page-header').first().waitFor({ state: 'visible', timeout: 45000 });
}

async function dismissAuraError(page: Page) {
  const auraErr = page.locator('#auraError');
  if (await auraErr.isVisible({ timeout: 2000 }).catch(() => false)) {
    await auraErr.locator('button').first().click().catch(() => {});
    await auraErr.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
  }
}

async function clickTab(page: Page, tabName: string) {
  // Salesforce record pages render Details / Related / Activity as role="tab".
  // Always call this before accessing fields that live on a specific tab.
  const tab = page.getByRole('tab', { name: tabName, exact: true }).first();
  await tab.waitFor({ state: 'visible', timeout: 15000 });
  const isActive = await tab.getAttribute('aria-selected').catch(() => null);
  if (isActive !== 'true') {
    await tab.click();
    await page.locator('.slds-spinner').first()
      .waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
  }
}

/**
 * Create a fresh Opportunity under the given existing account.
 * Used as a fallback when SF_TEST_OPP_PATH is not set in .env.
 */
async function createOpportunity(page: Page, accountName: string): Promise<string> {
  const oppName = `AutoOppForQuote-${Date.now()}`;

  await goTo(page, '/lightning/o/Opportunity/new');
  await dismissAuraError(page);
  const oppModal = page.locator(MODAL).first();
  await oppModal.waitFor({ state: 'visible', timeout: 30000 });

  const oppNameField = oppModal.locator('[data-field-api-name="Name"] input');
  await oppNameField.waitFor({ state: 'visible', timeout: 15000 });
  await oppNameField.fill(oppName);

  const accLookupInput = oppModal.locator('lightning-lookup').filter({ hasText: /Account Name/i }).locator('input');
  await accLookupInput.fill(accountName);
  const accOption = page.locator('[role="option"]').filter({ hasText: accountName }).first();
  await accOption.waitFor({ state: 'visible', timeout: 15000 });
  await accOption.click();

  const closeDateField = oppModal.locator('[data-field-api-name="CloseDate"] input');
  await closeDateField.waitFor({ state: 'visible', timeout: 10000 });
  await closeDateField.fill('2026-12-31');
  await closeDateField.press('Tab');

  const amountField = oppModal.locator('[data-field-api-name="Amount"] input');
  if (await amountField.count() > 0) await amountField.fill('50000');

  const stageTrigger = oppModal.locator('lightning-combobox').filter({ hasText: /Stage/i }).locator('button').first();
  await stageTrigger.click({ force: true });
  const stageOption = page.locator('[role="option"]').filter({ hasText: /Prospecting/i }).last();
  await stageOption.waitFor({ state: 'visible', timeout: 10000 });
  await stageOption.click();

  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await waitForDetail(page);

  return page.url().replace(SF, '');
}

/**
 * Navigate to oppPath, click New Quote, fill name, save.
 * After this function the page is on the Quote detail page.
 */
async function createQuoteOnOpp(page: Page, oppPath: string): Promise<void> {
  await goTo(page, oppPath);
  await dismissAuraError(page);
  await waitForDetail(page);

  const newQuoteBtn = page.getByRole('button', { name: 'New Quote', exact: true });
  await newQuoteBtn.waitFor({ state: 'visible', timeout: 30000 });
  await newQuoteBtn.click();
  await dismissAuraError(page);

  const quoteModal = page.locator(MODAL).first();
  const modalVisible = await quoteModal.waitFor({ state: 'visible', timeout: 10000 })
    .then(() => true).catch(() => false);

  const nameField = modalVisible
    ? quoteModal.locator('[data-field-api-name="Name"] input')
    : page.locator('[data-field-api-name="Name"] input').first();

  if (await nameField.count() > 0) {
    await nameField.waitFor({ state: 'visible', timeout: 15000 });
    await nameField.fill(`AutoQuote-${Date.now()}`);
  }

  const saveBtn = modalVisible
    ? quoteModal.getByRole('button', { name: 'Save', exact: true })
    : page.getByRole('button', { name: 'Save', exact: true }).first();

  await saveBtn.click();
  await waitForDetail(page);
  await dismissAuraError(page);
}

// ── Suite ─────────────────────────────────────────────────────────────────────

test.describe('Quote Tests', () => {

  // ONE Quote shared across all tests — tests are sequential, state carries forward.
  // TC-003 sets Execution Status → TC-004 depends on that state.
  let quoteRelPath = '';

  // ── Setup: resolve Opportunity, then create ONE Quote for the suite ───────
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: 'auth/session.json' });
    const page    = await context.newPage();
    try {
      // Use existing Opportunity if configured; otherwise create one under Autotest1
      const oppPath = EXISTING_OPP_PATH || await createOpportunity(page, EXISTING_ACCOUNT);

      // Create the single Quote for this suite run
      await createQuoteOnOpp(page, oppPath);
      quoteRelPath = page.url().replace(SF, '');
    } finally {
      await context.close();
    }
  });

  // ── Navigate to the shared Quote before each test — no re-creation ────────
  test.beforeEach(async ({ page }) => {
    await goTo(page, quoteRelPath);
    await waitForDetail(page);
    await dismissAuraError(page);
  });

  // AI-generated tests will be inserted here automatically when user stories are processed.
  // Run: npm run pipeline

});
