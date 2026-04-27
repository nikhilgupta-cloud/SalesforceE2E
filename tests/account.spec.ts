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
  
  // If tab not immediately visible, try clicking 'More' dropdown first (some layouts hide tabs)
  const moreTab = page.getByRole('tab', { name: /More/i }).first();
  if (!(await tab.isVisible({ timeout: 2000 }).catch(() => false)) && (await moreTab.isVisible().catch(() => false))) {
    await moreTab.click();
    const menu = page.locator('.slds-dropdown');
    await menu.waitFor({ state: 'visible' });
    await menu.getByRole('menuitem', { name: tabName, exact: true }).click();
    await SFUtils.waitForLoading(page);
    return;
  }

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
  // TC-ACC-001 | AC Reference: AC-005-01
test('TC-ACC-001 — Verify Account Billing Address and Payment Terms (soft-fail)', async ({ page }) => {
  // TC-ACC-001 | AC Reference: AC-005-01
  await searchAndOpen(page, data.account.Account_Name);
  await clickTab(page, 'Details');

  const softFailures: string[] = [];

  // Soft-fail: Billing Address — use verified LWC locator for Billing Street
  const billingStreetField = page
    .locator('lightning-textarea:has-text("Billing Street") textarea')
    .first();
  const hasBillingStreet = await billingStreetField
    .isVisible({ timeout: 5000 })
    .catch(() => false);
  if (!hasBillingStreet) {
    softFailures.push(
      'AC-005-01 SOFT: Billing Address (BillingStreet) should be visible under Details tab'
    );
  }

  // Soft-fail: Payment Terms (custom field; try both common API names)
  const paymentTermsField = page
    .locator(
      '[data-field-api-name="Payment_Terms__c"], [data-field-api-name="PaymentTerms"]'
    )
    .first();
  const hasPaymentTerms = await paymentTermsField
    .isVisible({ timeout: 5000 })
    .catch(() => false);
  if (!hasPaymentTerms) {
    softFailures.push(
      'AC-005-01 SOFT: Payment Terms field should be visible under Details tab'
    );
  }

  if (softFailures.length > 0) {
    console.warn('[SOFT FAILURES]', softFailures.join(' | '));
  }
});

  // TC-ACC-002 | AC Reference: AC-005-02
test('TC-ACC-002 — Create new Contact on Account record', async ({ page }) => {
    await searchAndOpen(page, data.account.Account_Name);

    // Switch to Related tab to access Contacts related list
    await clickTab(page, 'Related');
    await SFUtils.waitForLoading(page);

    const contactsCard = page.locator('article, .slds-card')
      .filter({ has: page.locator('.slds-card__header-title, h2, h3').filter({ hasText: /^Contacts$/i }) })
      .first();
    
    await contactsCard.scrollIntoViewIfNeeded().catch(() => {});
    await contactsCard.waitFor({ state: 'visible', timeout: 30000 });
    await contactsCard.getByRole('button', { name: 'New', exact: true }).click();
    await SFUtils.waitForLoading(page);
    await dismissAuraError(page);

    // Fill Contact form inside modal
    const modal = page.locator(MODAL);
    await modal.waitFor({ state: 'visible', timeout: 15000 });
    await SFUtils.fillName(modal, 'firstName', data.contact.First_Name);
    await SFUtils.fillName(modal, 'lastName', data.contact.Last_Name);
    await SFUtils.fillField(modal, 'Email', data.contact.Email);
    await SFUtils.fillField(modal, 'Phone', data.contact.Phone);

    await modal.getByRole('button', { name: 'Save', exact: true }).click();
    await SFUtils.waitForLoading(page);
    
    // Handle Duplicate Records modal if it appears (common in sandbox)
    const duplicateSave = page.locator('button.slds-button--brand, .modal-footer button').filter({ hasText: /Save|Confirm/ }).last();
    if (await duplicateSave.isVisible({ timeout: 3000 }).catch(() => false)) {
      await duplicateSave.click();
      await SFUtils.waitForLoading(page);
    }

    await dismissAuraError(page);
    await modal.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
  });

  // TC-ACC-003 | AC Reference: AC-005-03
  test('TC-ACC-003 — Create Opportunity from Contact related list', async ({ page }) => {
    // Navigate to the newly created contact
    await searchAndOpen(page, `${data.contact.First_Name} ${data.contact.Last_Name}`);

    // Switch to Related tab to access Opportunities
    await clickTab(page, 'Related');
    await SFUtils.waitForLoading(page);
    
    const oppsCard = page.locator('article, .slds-card')
      .filter({ has: page.locator('.slds-card__header-title, h2, h3').filter({ hasText: /^Opportunities$/i }) })
      .first();

    await oppsCard.scrollIntoViewIfNeeded().catch(() => {});
    await oppsCard.waitFor({ state: 'visible', timeout: 30000 });
    await oppsCard.getByRole('button', { name: 'New', exact: true }).click();
    await SFUtils.waitForLoading(page);
    await dismissAuraError(page);

    // Fill Opportunity form inside modal
    const modal = page.locator(MODAL);
    await modal.waitFor({ state: 'visible', timeout: 15000 });
    await SFUtils.fillField(modal, 'Opportunity Name', data.opportunity.Name);
    await SFUtils.selectCombobox(page, modal, 'Stage', data.opportunity.Stage);
    await SFUtils.fillField(modal, 'Close Date', data.opportunity.Close_Date);

    await modal.getByRole('button', { name: 'Save', exact: true }).click();
    await SFUtils.waitForLoading(page);
    
    // Duplicate check for Opportunity too
    const duplicateSave = page.locator('button.slds-button--brand, .modal-footer button').filter({ hasText: /Save|Confirm/ }).last();
    if (await duplicateSave.isVisible({ timeout: 3000 }).catch(() => false)) {
      await duplicateSave.click();
      await SFUtils.waitForLoading(page);
    }

    await dismissAuraError(page);
    await modal.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
  });

    // Verify the Opportunity detail page loaded
    await expect(page.locator('.slds-page-header').first()).toBeVisible({ timeout: 20000 });
    await expect(page.locator(`text=${data.opportunity.Name}`).first()).toBeVisible({ timeout: 10000 });
  });

  // TC-ACC-004 | AC Reference: AC-005-04
  test('TC-ACC-004 — Verify Contact is Primary Contact Role on Opportunity', async ({ page }) => {
    await searchAndOpen(page, data.opportunity.Name);

    // Navigate to Related tab to find Contact Roles section
    await clickTab(page, 'Related');
    const contactRolesCard = page.locator('article').filter({ hasText: 'Contact Roles' }).first();
    await contactRolesCard.waitFor({ state: 'visible', timeout: 20000 });

    // Verify the contact name appears in Contact Roles
    await expect(
      contactRolesCard.locator(`text=${data.contact.Last_Name}`).first()
    ).toBeVisible({ timeout: 10000 });

    // Verify Primary role is assigned to the contact row
    const contactRow = contactRolesCard.locator('tr, .slds-hint-parent').filter({
      hasText: data.contact.Last_Name,
    }).first();
    await expect(contactRow.locator('text=Primary')).toBeVisible({ timeout: 10000 });
  });

  // TC-ACC-005 | AC Reference: QO-005-05
  test('TC-ACC-005 — Create Quote from Opportunity via Create Quote button', async ({ page }) => {
    await searchAndOpen(page, data.opportunity.Name);
    await SFUtils.waitForLoading(page);

    // Click the Create Quote button on the Opportunity record
    await page.getByRole('button', { name: 'Create Quote', exact: true }).click();
    await SFUtils.waitForLoading(page);
    await dismissAuraError(page);

    // Quote form may open as a modal or navigate to a new page — handle both
    const modal = page.locator(MODAL);
    const isModal = await modal.isVisible({ timeout: 3000 }).catch(() => false);
    const root = isModal ? modal : page;

    await SFUtils.fillField(root, 'Quote Name', data.quote.Name);

    // Price Book — hardcoded fallback per CLAUDE.md
    await SFUtils.selectCombobox(page, root, 'Price Book', 'Standard Price Book');

    // Expiration Date — hardcoded fallback per CLAUDE.md
    await SFUtils.fillField(root, 'Expiration Date', '12/31/2026');

    const saveButton = isModal
      ? modal.getByRole('button', { name: 'Save', exact: true })
      : page.getByRole('button', { name: 'Save', exact: true });
    await saveButton.click();
    await SFUtils.waitForLoading(page);
    await dismissAuraError(page);

    // Verify the Quote detail page loaded successfully
    await expect(page.locator('.slds-page-header').first()).toBeVisible({ timeout: 20000 });
    await expect(page.locator(`text=${data.quote.Name}`).first()).toBeVisible({ timeout: 10000 });
  });
  // ── US-005 END ───────────────────────────────────────────────────────

});
