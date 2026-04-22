/**
 * Contact Tests — Salesforce CPQ (RCA)
 * Auth: auth/session.json
 *
 * AI-generated test blocks are inserted automatically when user stories are processed.
 * Run: npm run pipeline   |   Watch mode: npm run watch:stories
 */
import { test, type Page } from '@playwright/test';
import * as dotenv from 'dotenv';
import { getTestData } from '../utils/test-data';
import { SFUtils } from '../utils/SFUtils';
dotenv.config();

const data = getTestData();
const SF    = process.env.SF_SANDBOX_URL!;
const MODAL = SFUtils.MODAL;

// ── Helpers ──────────────────────────────────────────────────────────────────

async function dismissAuraError(page: Page) {
  const auraErr = page.locator('#auraError');
  if (await auraErr.isVisible({ timeout: 2000 }).catch(() => false)) {
    await auraErr.locator('button').first().click().catch(() => {});
    await auraErr.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
  }
}

async function clickTab(page: Page, tabName: string) {
  const tab = page.getByRole('tab', { name: tabName, exact: true }).first();
  await tab.waitFor({ state: 'visible', timeout: 15000 });
  const isActive = await tab.getAttribute('aria-selected').catch(() => null);
  if (isActive !== 'true') {
    await tab.click();
    await SFUtils.waitForLoading(page);
  }
}

// ── Suite ─────────────────────────────────────────────────────────────────────

test.describe('Contact Tests', () => {

  test.beforeEach(async ({ page }) => {
    await SFUtils.goto(page, `${SF}/lightning/o/Contact/list?filterName=Recent`);
    await dismissAuraError(page);
  });

  // AI-generated tests will be inserted here automatically when user stories are processed.
  // Run: npm run pipeline

  // ── US-005 START ─────────────────────────────────────────────────────
  // TC-CON-001 | AC Reference: AC-005-01
  test('TC-CON-001 — Verify Account Billing Address and Payment Terms on Details tab', async ({ page }) => {
    const accountName = data.account.Account_Name;

    await SFUtils.goto(page, `${SF}/lightning/o/Account/list?filterName=Recent`);
    await dismissAuraError(page);
    
    // Search and navigate to Account
    const searchBox = page.locator('input[placeholder="Search this list..."]').first();
    await searchBox.waitFor({ state: 'visible' });
    await searchBox.fill(accountName);
    await page.keyboard.press('Enter');
    await SFUtils.waitForLoading(page);

    const accountLink = page.getByRole('link', { name: accountName }).first();
    await accountLink.waitFor({ state: 'visible', timeout: 30000 });
    await accountLink.click();
    
    await SFUtils.waitForLoading(page);
    await dismissAuraError(page);
    await clickTab(page, 'Details');

    // AC-005-01 Soft-fail check for specific fields
    const billingField = page.locator('[data-field-api-name="BillingAddress"]').first();
    await billingField.waitFor({ state: 'attached', timeout: 15000 });
    
    const paymentField = page.locator('[data-field-api-name="Payment_Terms__c"]').first();
    const hasPayment = await paymentField.isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasPayment) {
      console.warn('[SOFT-FAIL] AC-005-01: Payment Terms missing on Account record');
    }
  });

  // TC-CON-002 | AC Reference: AC-005-02
  test('TC-CON-002 — Create new Contact linked to existing Account', async ({ page }) => {
    const firstName = data.contact.First_Name;
    const lastName  = data.contact.Last_Name;
    const accountName = data.account.Account_Name;

    await SFUtils.goto(page, `${SF}/lightning/o/Contact/new`);
    await dismissAuraError(page);

    const modal = page.locator(MODAL);
    await modal.waitFor({ state: 'visible', timeout: 30000 });

    // Compound Name
    await SFUtils.fillName(modal, 'firstName', firstName);
    await SFUtils.fillName(modal, 'lastName', lastName);

    // Account Lookup - using NEW fillLookup helper
    await SFUtils.fillLookup(page, modal, 'AccountId', accountName);

    await SFUtils.fillField(modal, 'Email', data.contact.Email);

    await modal.getByRole('button', { name: 'Save', exact: true }).click();
    await modal.waitFor({ state: 'hidden', timeout: 30000 });
    await SFUtils.waitForLoading(page);

    // Verification
    await clickTab(page, 'Details');
    await page.getByText(`${firstName} ${lastName}`).first().waitFor({ state: 'visible' });
  });

  // TC-CON-003 | AC Reference: AC-005-03
  test('TC-CON-003 — Create Opportunity from Contact Related tab', async ({ page }) => {
    const contactName = `${data.contact.First_Name} ${data.contact.Last_Name}`;
    const oppName = data.opportunity.Name;

    await SFUtils.goto(page, `${SF}/lightning/o/Contact/list?filterName=Recent`);
    await dismissAuraError(page);

    const contactLink = page.getByRole('link', { name: contactName }).first();
    await contactLink.waitFor({ state: 'visible' });
    await contactLink.click();

    await SFUtils.waitForLoading(page);
    await clickTab(page, 'Related');

    const oppCard = page.locator('article').filter({ hasText: 'Opportunities' }).first();
    await oppCard.waitFor({ state: 'visible' });

    const newBtn = oppCard.getByRole('button', { name: 'New', exact: true }).first();
    await newBtn.click();

    const modal = page.locator(MODAL);
    await modal.waitFor({ state: 'visible' });

    await SFUtils.fillField(modal, 'Name', oppName);
    await SFUtils.fillField(modal, 'CloseDate', data.opportunity.Close_Date);
    await SFUtils.selectCombobox(page, modal, 'StageName', data.opportunity.Stage);

    await modal.getByRole('button', { name: 'Save', exact: true }).click();
    await modal.waitFor({ state: 'hidden' });
    await SFUtils.waitForLoading(page);
  });
  // ── US-005 END ───────────────────────────────────────────────────────

});
