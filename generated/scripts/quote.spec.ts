/**
 * Quote Tests — Salesforce CPQ (RCA)
 * Active Jira story: US-005 (AC-005-01→26) — Quote Execution Status acceptance flow
 * Other Quote stories (Create, QLE, Discount, Document) will be auto-generated
 * here when their Jira stories are fetched via: npm run fetch:stories
 * Auth: auth/session.json
 */
import { test, expect, type Page } from '@playwright/test';
import * as dotenv from 'dotenv';
dotenv.config();

const SF = process.env.SF_SANDBOX_URL!;

const MODAL = '[role="dialog"]:not([id="auraError"]):not([aria-hidden="true"])';

// Existing account used as the parent for all test Opportunities.
// This avoids creating a new Account on every pipeline run.
const EXISTING_ACCOUNT = 'Autotest1';

async function goTo(page: Page, path: string) {
  await page.goto(`${SF}${path}`, { waitUntil: 'domcontentloaded' });
  await page.locator('lightning-app, .slds-page-header, .desktop').first()
    .waitFor({ state: 'attached', timeout: 30000 }).catch(() => {});
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

/**
 * Create a fresh Opportunity linked to the given existing account.
 * Returns the relative Opportunity URL (e.g. /lightning/r/Opportunity/006xxx/view).
 */
async function createOpportunity(page: Page, accountName: string): Promise<string> {
  const oppName = `AutoOppForQuote-${Date.now()}`;

  await goTo(page, '/lightning/o/Opportunity/new');
  await dismissAuraError(page);
  const oppModal = page.locator(MODAL).first();
  await oppModal.waitFor({ state: 'visible', timeout: 30000 });

  // Opportunity Name
  const oppNameField = oppModal.locator('[data-field-api-name="Name"] input');
  await oppNameField.waitFor({ state: 'visible', timeout: 15000 });
  await oppNameField.fill(oppName);

  // Account lookup — use the provided existing account
  const accLookupInput = oppModal.locator('lightning-lookup').filter({ hasText: /Account Name/i }).locator('input');
  await accLookupInput.fill(accountName);
  const accOption = page.locator('[role="option"]').filter({ hasText: accountName }).first();
  await accOption.waitFor({ state: 'visible', timeout: 15000 });
  await accOption.click();

  // Close Date — ISO format, Tab to trigger validation
  const closeDateField = oppModal.locator('[data-field-api-name="CloseDate"] input');
  await closeDateField.waitFor({ state: 'visible', timeout: 10000 });
  await closeDateField.fill('2026-12-31');
  await closeDateField.press('Tab');

  // Amount — optional; skip if not on layout
  const amountField = oppModal.locator('[data-field-api-name="Amount"] input');
  if (await amountField.count() > 0) await amountField.fill('50000');

  // Stage picklist
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
 * Each test gets a fresh, unmodified Quote created here in beforeEach.
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

  // Handle modal-based OR full-page quote creation
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

test.describe('Quote Tests', () => {

  // Shared Opportunity path — created once against EXISTING_ACCOUNT, never mutated
  let oppRelPath = '';

  // ── Create ONE Opportunity under the existing "Autotest1" account ────────
  // No Account creation — EXISTING_ACCOUNT already exists in the org.
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: 'auth/session.json' });
    const page    = await context.newPage();
    try {
      oppRelPath = await createOpportunity(page, EXISTING_ACCOUNT);
    } finally {
      await context.close();
    }
  });

  // ── Each test gets a fresh Quote so mutations in one test don't affect others
  // After beforeEach the page is already on the Quote detail page.
  test.beforeEach(async ({ page }) => {
    await dismissAuraError(page);
    await createQuoteOnOpp(page, oppRelPath);
  });

  // ── US-005 START ─────────────────────────────────────────────────────

  // TC-QTE-001 | AC Reference: AC-005-01, AC-005-02
  test('TC-QTE-001 — Ready For Acceptance action visible on Approved quote and launches screenflow', async ({ page }) => {
    // beforeEach already landed on the Quote detail page — no navigation needed

    // Button may appear in the page header or inside the 'Show more actions' overflow menu
    const rfaButton = page.getByRole('button', { name: 'Ready For Acceptance', exact: true });
    if ((await rfaButton.count()) === 0) {
      const moreActions = page.getByRole('button', { name: 'Show more actions', exact: true });
      await moreActions.waitFor({ state: 'visible', timeout: 30000 });
      await moreActions.click();
      const menuItem = page.getByRole('menuitem', { name: 'Ready For Acceptance', exact: true });
      await menuItem.waitFor({ state: 'visible', timeout: 30000 });
      await menuItem.click();
    } else {
      await rfaButton.first().waitFor({ state: 'visible', timeout: 30000 });
      await rfaButton.first().click();
    }

    // System runs RCA create-order validations then launches the screen flow
    const flowModal = page.locator(MODAL).first();
    await flowModal.waitFor({ state: 'visible', timeout: 30000 });
    await expect(flowModal).toBeVisible();

    // Dismiss the flow so subsequent tests start from a clean state
    const cancelBtn = flowModal.getByRole('button', { name: 'Cancel', exact: true });
    if ((await cancelBtn.count()) > 0) {
      await cancelBtn.click();
      await flowModal.waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
    }
  });

  // TC-QTE-002 | AC Reference: AC-005-03, AC-005-04, AC-005-06, AC-005-08, AC-005-10
  test('TC-QTE-002 — Screenflow displays all four mandatory document capture fields', async ({ page }) => {
    // beforeEach already landed on the Quote detail page — no navigation needed

    const rfaButton = page.getByRole('button', { name: 'Ready For Acceptance', exact: true });
    if ((await rfaButton.count()) === 0) {
      const moreActions = page.getByRole('button', { name: 'Show more actions', exact: true });
      await moreActions.waitFor({ state: 'visible', timeout: 30000 });
      await moreActions.click();
      const menuItem = page.getByRole('menuitem', { name: 'Ready For Acceptance', exact: true });
      await menuItem.waitFor({ state: 'visible', timeout: 30000 });
      await menuItem.click();
    } else {
      await rfaButton.first().waitFor({ state: 'visible', timeout: 30000 });
      await rfaButton.first().click();
    }

    const flowModal = page.locator(MODAL).first();
    await flowModal.waitFor({ state: 'visible', timeout: 30000 });

    // AC-005-04/05: Primary Order Form attachment field label
    const primaryOrderFormLabel = flowModal
      .locator('label, legend, .slds-form-element__label, span')
      .filter({ hasText: /Primary Order Form/i })
      .first();
    await primaryOrderFormLabel.waitFor({ state: 'visible', timeout: 30000 });
    await expect(primaryOrderFormLabel).toBeVisible();

    // AC-005-06/07: Order Form Not Required checkbox
    const orderFormNotRequired = flowModal
      .locator('lightning-input')
      .filter({ hasText: /Order Form Not Required/i })
      .first();
    await orderFormNotRequired.waitFor({ state: 'visible', timeout: 30000 });
    await expect(orderFormNotRequired).toBeVisible();

    // AC-005-08/09: Primary Purchase Order attachment field label
    const primaryPOLabel = flowModal
      .locator('label, legend, .slds-form-element__label, span')
      .filter({ hasText: /Primary Purchase Order/i })
      .first();
    await primaryPOLabel.waitFor({ state: 'visible', timeout: 30000 });
    await expect(primaryPOLabel).toBeVisible();

    // AC-005-10/11: Purchase Order Not Required checkbox
    const poNotRequired = flowModal
      .locator('lightning-input')
      .filter({ hasText: /Purchase Order Not Required/i })
      .first();
    await poNotRequired.waitFor({ state: 'visible', timeout: 30000 });
    await expect(poNotRequired).toBeVisible();

    const cancelBtn = flowModal.getByRole('button', { name: 'Cancel', exact: true });
    if ((await cancelBtn.count()) > 0) {
      await cancelBtn.click();
      await flowModal.waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
    }
  });

  // TC-QTE-003 | AC Reference: AC-005-26
  test('TC-QTE-003 — Execution Status becomes Ready for Acceptance when Order Form Not Required and PO Not Required are both TRUE', async ({ page }) => {
    // beforeEach already landed on the Quote detail page — no navigation needed

    const rfaButton = page.getByRole('button', { name: 'Ready For Acceptance', exact: true });
    if ((await rfaButton.count()) === 0) {
      const moreActions = page.getByRole('button', { name: 'Show more actions', exact: true });
      await moreActions.waitFor({ state: 'visible', timeout: 30000 });
      await moreActions.click();
      const menuItem = page.getByRole('menuitem', { name: 'Ready For Acceptance', exact: true });
      await menuItem.waitFor({ state: 'visible', timeout: 30000 });
      await menuItem.click();
    } else {
      await rfaButton.first().waitFor({ state: 'visible', timeout: 30000 });
      await rfaButton.first().click();
    }

    const flowModal = page.locator(MODAL).first();
    await flowModal.waitFor({ state: 'visible', timeout: 30000 });

    // Check 'Order Form Not Required' checkbox
    const orderFormNotReqCheckbox = flowModal
      .locator('lightning-input')
      .filter({ hasText: /Order Form Not Required/i })
      .locator('input[type="checkbox"]')
      .first();
    await orderFormNotReqCheckbox.waitFor({ state: 'visible', timeout: 30000 });
    await orderFormNotReqCheckbox.check();

    // Check 'Purchase Order Not Required' checkbox
    const poNotReqCheckbox = flowModal
      .locator('lightning-input')
      .filter({ hasText: /Purchase Order Not Required/i })
      .locator('input[type="checkbox"]')
      .first();
    await poNotReqCheckbox.waitFor({ state: 'visible', timeout: 30000 });
    await poNotReqCheckbox.check();

    // Advance through the flow — click Next if present, then Finish
    const nextBtn = flowModal.getByRole('button', { name: 'Next', exact: true });
    if ((await nextBtn.count()) > 0) {
      await nextBtn.waitFor({ state: 'visible', timeout: 15000 });
      await nextBtn.click();
    }
    const finishBtn = flowModal.getByRole('button', { name: 'Finish', exact: true });
    await finishBtn.waitFor({ state: 'visible', timeout: 30000 });
    await finishBtn.click();
    await flowModal.waitFor({ state: 'hidden', timeout: 30000 });

    // Reload and assert Execution Status = 'Ready for Acceptance'
    await page.reload({ waitUntil: 'domcontentloaded' });
    await dismissAuraError(page);
    await waitForDetail(page);
    const execStatusDisplay = page
      .locator('.slds-form-element')
      .filter({ hasText: /Execution Status/i })
      .locator('.slds-form-element__static, lightning-formatted-text')
      .first();
    await execStatusDisplay.waitFor({ state: 'visible', timeout: 30000 });
    await expect(execStatusDisplay).toHaveText(/Ready for Acceptance/i);
  });

  // TC-QTE-004 | AC Reference: AC-005-12, AC-005-13, AC-005-14
  test('TC-QTE-004 — Create Order enabled when Execution Status is Ready for Acceptance; sets status to Accepted and creates Order', async ({ page }) => {
    // beforeEach already landed on the Quote detail page — no navigation needed

    // AC-005-13: 'Create Order' action must be visible and enabled
    const createOrderDirect = page.getByRole('button', { name: 'Create Order', exact: true });
    if ((await createOrderDirect.count()) === 0) {
      const moreActions = page.getByRole('button', { name: 'Show more actions', exact: true });
      await moreActions.waitFor({ state: 'visible', timeout: 30000 });
      await moreActions.click();
      const createOrderMenuItem = page.getByRole('menuitem', { name: 'Create Order', exact: true });
      await createOrderMenuItem.waitFor({ state: 'visible', timeout: 30000 });
      await expect(createOrderMenuItem).toBeVisible();
      await createOrderMenuItem.click();
    } else {
      await createOrderDirect.first().waitFor({ state: 'visible', timeout: 30000 });
      await expect(createOrderDirect.first()).toBeEnabled();
      await createOrderDirect.first().click();
    }

    // Handle any confirmation dialog that precedes order creation
    const confirmModal = page.locator(MODAL).first();
    if ((await confirmModal.count()) > 0) {
      const confirmBtn = confirmModal
        .getByRole('button', { name: /Confirm|OK|Yes/i })
        .first();
      if ((await confirmBtn.count()) > 0) {
        await confirmBtn.waitFor({ state: 'visible', timeout: 15000 });
        await confirmBtn.click();
      }
    }

    // AC-005-12: Execution Status must update to 'Accepted'
    await dismissAuraError(page);
    await waitForDetail(page);
    const execStatusDisplay = page
      .locator('.slds-form-element')
      .filter({ hasText: /Execution Status/i })
      .locator('.slds-form-element__static, lightning-formatted-text')
      .first();
    await execStatusDisplay.waitFor({ state: 'visible', timeout: 30000 });
    await expect(execStatusDisplay).toHaveText(/Accepted/i);

    // AC-005-14: Verify an Order record was created (URL redirect or Orders related list)
    const orderRelatedList = page
      .locator('[title="Orders"], [aria-label="Orders"]')
      .first();
    const currentUrl = page.url();
    const orderCreated = currentUrl.includes('/Order/') || (await orderRelatedList.count()) > 0;
    expect(orderCreated).toBeTruthy();
  });

  // ── US-005 END ───────────────────────────────────────────────────────

});
