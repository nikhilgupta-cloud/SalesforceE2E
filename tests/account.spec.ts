/**
 * Account Tests — Salesforce CPQ (RCA)
 * Auth: auth/session.json
 *
 * AI-generated test blocks are inserted automatically when user stories are processed.
 * Run: npm run pipeline   |   Watch mode: npm run watch:stories
 */
import { test, type Page } from '@playwright/test';
import { SFUtils } from '../utils/SFUtils';
import { getTestData } from '../utils/test-data';
import * as dotenv from 'dotenv';
dotenv.config();

const SF    = process.env.SF_SANDBOX_URL!;
const MODAL = '[role="dialog"]:not([id="auraError"]):not([aria-hidden="true"])';
const data  = getTestData();

// ── Helpers ──────────────────────────────────────────────────────────────────

async function waitForDetail(page: Page) {
  // List-view pages keep .slds-page-header hidden (slds-hide); use attached so both list and detail pass
  await page.locator('.slds-page-header').first().waitFor({ state: 'attached', timeout: 45000 }).catch(() => {});
  await SFUtils.waitForLoading(page);
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
  const tab = page.getByRole('tab', { name: tabName, exact: true }).first();
  await tab.waitFor({ state: 'visible', timeout: 15000 });
  const isActive = await tab.getAttribute('aria-selected').catch(() => null);
  if (isActive !== 'true') {
    await tab.click();
    await SFUtils.waitForLoading(page);
  }
}

async function searchAndOpen(page: Page, name: string) {
  await SFUtils.searchAndOpen(page, name);
  await waitForDetail(page);
  await dismissAuraError(page);
}

// ── Suite ─────────────────────────────────────────────────────────────────────

test.describe('Account Tests', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    // Start at Home or any stable page before searching
    await SFUtils.goto(page, `${SF}/lightning/page/home`);
    await dismissAuraError(page);
  });

  // ── US-005 START ─────────────────────────────────────────────────────
  // ── Shared state across serial tests ─────────────────────────────────────
  const resolvedAccountName: string = data.account.Account_Name;
  let createdContactFirstName: string;
  let createdContactLastName: string;
  let createdContactName: string;
  let createdOpportunityName: string;

  // TC-ACC-001 | AC Reference: AC-005-01
  test('TC-ACC-001 — Verify Account Billing Address and Payment Terms under Details tab (soft-fail)', async ({ page }) => {
    await searchAndOpen(page, resolvedAccountName);
    await clickTab(page, 'Details');

    // Read a view-mode field container and return trimmed value text
    const readFieldOutput = async (labelText: string): Promise<string> => {
      const container = page
        .locator('records-record-layout-item, force-record-layout-item')
        .filter({ hasText: new RegExp(labelText, 'i') })
        .first();
      const raw = await container.textContent({ timeout: 5000 }).catch(() => '');
      return (raw ?? '').replace(new RegExp(labelText, 'i'), '').trim();
    };

    // AC-005-01: Billing Address — soft-fail
    const billingAddress = await readFieldOutput('Billing Address');
    if (!billingAddress) {
      console.warn('[SOFT-FAIL][AC-005-01] Billing Address is empty or not populated on Account.');
    }

    // AC-005-01: Payment Terms — soft-fail
    const paymentTerms = await readFieldOutput('Payment Terms');
    if (!paymentTerms) {
      console.warn('[SOFT-FAIL][AC-005-01] Payment Terms is empty or not populated on Account.');
    }
  });

  // TC-ACC-002 | AC Reference: AC-005-02
  test('TC-ACC-002 — Create new Contact on Account record via Contacts related list', async ({ page }) => {
    const ts = Date.now();
    createdContactFirstName = data.contact.First_Name;
    createdContactLastName  = data.contact.Last_Name;
    createdContactName      = `${createdContactFirstName} ${createdContactLastName}`;

    await searchAndOpen(page, resolvedAccountName);
    await clickTab(page, 'Related');
    await SFUtils.waitForLoading(page);

    // Locate Contacts related list — use force- prefix (Salesforce LWC component name)
    const contactsRelatedList = page
      .locator('force-related-list-single-container, force-related-list-card, article')
      .filter({ hasText: /^Contacts/ })
      .first();
    await contactsRelatedList.waitFor({ state: 'visible', timeout: 30000 });

    // AC-005-02: skip creation if contact already exists
    const existingContact = contactsRelatedList.getByRole('link', { name: createdContactName, exact: false }).first();
    if (await existingContact.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log(`[SKIP] "${createdContactName}" already exists — skipping creation.`);
      await existingContact.click();
      await SFUtils.waitForLoading(page);
      await waitForDetail(page);
      return;
    }

    await contactsRelatedList.getByRole('button', { name: 'New', exact: true }).click();
    await SFUtils.waitForLoading(page);

    const modal = page.locator(MODAL);
    await modal.waitFor({ state: 'visible', timeout: 15000 });

    await SFUtils.fillName(modal, 'firstName', createdContactFirstName);
    await SFUtils.fillName(modal, 'lastName', createdContactLastName);

    await modal.getByRole('button', { name: 'Save', exact: true }).click();
    await SFUtils.waitForLoading(page);
    await dismissAuraError(page);

    // Verify Contact is now visible in the Account's Contacts related list
    await page
      .getByRole('link', { name: createdContactName, exact: false })
      .first()
      .waitFor({ state: 'visible', timeout: 20000 });
  });

  // TC-ACC-003 | AC Reference: AC-005-03
  test('TC-ACC-003 — Create Opportunity from Contact record via Opportunities related list', async ({ page }) => {
    const ts = Date.now();
    createdOpportunityName = data.opportunity.Name;
    const closeDate        = data.opportunity.Close_Date;
    const stage            = data.opportunity.Stage;

    await searchAndOpen(page, createdContactName);
    await clickTab(page, 'Related');
    await SFUtils.waitForLoading(page);

    // Locate Opportunities related list and click New
    const oppsRelatedList = page
      .locator('records-related-list-single-container, article')
      .filter({ hasText: 'Opportunities' })
      .first();
    
    await oppsRelatedList.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(1000);

    const newBtn = oppsRelatedList.getByRole('button', { name: 'New', exact: true });
    await newBtn.waitFor({ state: 'visible', timeout: 15000 });
    await newBtn.click().catch(async () => {
        await oppsRelatedList.locator('.slds-card__header-link, h2').first().click().catch(() => {});
        await newBtn.click();
    });
    await SFUtils.waitForLoading(page);

    const modal = page.locator(MODAL);
    await modal.waitFor({ state: 'visible', timeout: 15000 });

    await SFUtils.fillField(modal, 'Name', createdOpportunityName);
    await SFUtils.fillField(modal, 'CloseDate', closeDate);
    await SFUtils.selectCombobox(page, modal, 'StageName', stage);

    await modal.getByRole('button', { name: 'Save', exact: true }).click();
    await SFUtils.waitForLoading(page);
    await dismissAuraError(page);

    // Verify Opportunity record detail page opened with correct name
    await waitForDetail(page);
    await page
      .getByRole('heading', { name: createdOpportunityName, exact: false })
      .first()
      .waitFor({ state: 'visible', timeout: 20000 });
  });

  // TC-ACC-004 | AC Reference: AC-005-04
  test('TC-ACC-004 — Verify Contact is assigned as Primary Contact Role on Opportunity', async ({ page }) => {
    await searchAndOpen(page, createdOpportunityName);
    await clickTab(page, 'Related');
    await SFUtils.waitForLoading(page);

    // Locate Contact Roles related list
    const contactRolesSection = page
      .locator('records-related-list-single-container, article')
      .filter({ hasText: 'Contact Roles' })
      .first();
    await contactRolesSection.waitFor({ state: 'visible', timeout: 20000 });

    // Hard assertion: Contact MUST appear in Contact Roles
    await contactRolesSection
      .getByRole('link', { name: createdContactName, exact: false })
      .first()
      .waitFor({ state: 'visible', timeout: 15000 });

    // Hard assertion: Contact MUST be marked Primary
    const contactRow = contactRolesSection
      .getByRole('row')
      .filter({ hasText: createdContactName })
      .first();

    // Salesforce renders Primary = true as a check icon or "True" text in the cell
    const isPrimaryIcon = await contactRow
      .locator('lightning-icon[icon-name="utility:check"], [title="True"], abbr[title="True"]')
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (!isPrimaryIcon) {
      // Fallback: inspect raw cell text for a truthy indicator
      console.warn('[AC-005-04] Primary icon not found via icon locator — attempting text fallback.');
      const rowText = (await contactRow.textContent({ timeout: 5000 }).catch(() => '')) ?? '';
      if (!rowText.toLowerCase().includes('true')) {
        throw new Error(
          `[AC-005-04] Contact "${createdContactName}" is NOT marked as Primary Contact Role ` +
          `on Opportunity "${createdOpportunityName}". Primary indicator absent from row.`
        );
      }
    }
  });
  // ── US-005 END ───────────────────────────────────────────────────────

});
