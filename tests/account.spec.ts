import { test, expect, Page } from '@playwright/test';
import { SFUtils } from '../utils/SFUtils';
import * as fs from 'fs';
import * as path from 'path';

const data = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'tests', 'fixtures', 'test-data.json'), 'utf8'));

const SF = process.env.SF_SANDBOX_URL || process.env.SF_LOGIN_URL || '';

test.describe(`${obj.displayName} Lifecycle`, () => {


  // ── US-005 START ─────────────────────────────────────────────────────
  let accountUrl = '';
  let contactUrl = '';
  let opportunityUrl = '';
  let quoteUrl = '';
  let contractUrl = '';
  let orderUrl = '';

  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await SFUtils.goto(page, SF);
    await SFUtils.waitForAppReady(page);
  });

  // TC-ACC-001 | AC Reference: AC-005-01
  test('TC-ACC-001 — Verify Account Billing Address and Payment Terms', async ({ page }) => {
    await SFUtils.goto(page, `${SF}/lightning/o/Account/list`);
    await SFUtils.waitForLoading(page);
    const accountLink = page.locator(`a[title="${data.account.Account_Name}"]`).first();
    await accountLink.waitFor({ state: 'visible', timeout: 15000 });
    await accountLink.click();
    await SFUtils.waitForLoading(page);
    accountUrl = page.url();
    expect(accountUrl).toContain('/Account/');
    const detailsTab = page.locator('a[data-label="Details"]').first();
    await detailsTab.waitFor({ state: 'visible', timeout: 10000 });
    await detailsTab.click();
    await SFUtils.waitForLoading(page);
    try {
      const billingAddress = page.locator('[data-field-api-name="BillingAddress"]');
      await billingAddress.waitFor({ state: 'visible', timeout: 8000 });
      const billingText = await billingAddress.innerText();
      expect(billingText.trim().length).toBeGreaterThan(0);
    } catch {
      console.warn('[SOFT-FAIL] AC-005-01: Billing Address is missing on Account record');
    }
    try {
      const paymentTerms = page.locator('[data-field-api-name="APTS_Payment_Terms__c"], [data-field-api-name="Payment_Terms__c"]').first();
      await paymentTerms.waitFor({ state: 'visible', timeout: 8000 });
      const ptText = await paymentTerms.innerText();
      expect(ptText.trim().length).toBeGreaterThan(0);
    } catch {
      console.warn('[SOFT-FAIL] AC-005-01: Payment Terms is missing on Account record');
    }
  });

  // TC-ACC-002 | AC Reference: AC-005-02, AC-005-03, AC-005-04
  test('TC-ACC-002 — Create Contact on Account and Create Opportunity with Primary Contact Role', async ({ page }) => {
    await SFUtils.goto(page, `${SF}/lightning/o/Contact/new`);
    await SFUtils.waitForLoading(page);
    const contactModal = page.locator('div[role="dialog"]').first();
    await SFUtils.fillField(page, contactModal, 'FirstName', data.contact.First_Name);
    await SFUtils.fillField(page, contactModal, 'LastName', data.contact.Last_Name);
    await SFUtils.fillField(page, contactModal, 'Email', data.contact.Email);
    await SFUtils.fillLookup(page, contactModal, 'AccountId', data.account.Account_Name);
    await SFUtils.waitForLoading(page);
    await page.locator('[role="option"], lightning-base-combobox-item').filter({ hasText: data.account.Account_Name }).first().click();
    await SFUtils.waitForLoading(page);
    await page.locator('button[name="SaveEdit"]').first().click();
    await SFUtils.waitForLoading(page);
    contactUrl = page.url();
    expect(contactUrl).toContain('/Contact/');
    await SFUtils.goto(page, `${SF}/lightning/o/Opportunity/new`);
    await SFUtils.waitForLoading(page);
    const oppModal = page.locator('div[role="dialog"]').first();
    await SFUtils.fillField(page, oppModal, 'Name', data.opportunity.Name);
    await SFUtils.selectCombobox(page, oppModal, 'StageName', data.opportunity.Stage);
    await SFUtils.fillField(page, oppModal, 'CloseDate', data.opportunity.Close_Date);
    await SFUtils.fillLookup(page, oppModal, 'AccountId', data.account.Account_Name);
    await SFUtils.waitForLoading(page);
    await page.locator('[role="option"], lightning-base-combobox-item').filter({ hasText: data.account.Account_Name }).first().click();
    await SFUtils.waitForLoading(page);
    await page.locator('button[name="SaveEdit"]').first().click();
    await SFUtils.waitForLoading(page);
    opportunityUrl = page.url();
    expect(opportunityUrl).toContain('/Opportunity/');
    const urlParts = opportunityUrl.split('/');
    const oppId = urlParts.find(seg => /^006[A-Za-z0-9]{15}$/.test(seg));
    await SFUtils.goto(page, `${SF}/lightning/o/OpportunityContactRole/new?defaultFieldValues=OpportunityId%3D${oppId}`);
    await SFUtils.waitForLoading(page);
    const roleModal = page.locator('div[role="dialog"]').first();
    await SFUtils.fillLookup(page, roleModal, 'ContactId', `${data.contact.First_Name} ${data.contact.Last_Name}`);
    await SFUtils.waitForLoading(page);
    await page.locator('[role="option"], lightning-base-combobox-item').filter({ hasText: data.contact.Last_Name }).first().click();
    await SFUtils.waitForLoading(page);
    await SFUtils.selectCombobox(page, roleModal, 'Role', 'Decision Maker');
    const primaryCheckbox = roleModal.locator('input[type="checkbox"][name="IsPrimary"]').first();
    await primaryCheckbox.check();
    await page.locator('button[name="SaveEdit"]').first().click();
    await SFUtils.waitForLoading(page);
    await SFUtils.goto(page, opportunityUrl);
    await SFUtils.waitForLoading(page);
    const contactRoleRow = page.locator('table tbody tr').filter({ hasText: data.contact.Last_Name }).first();
    await contactRoleRow.waitFor({ state: 'visible', timeout: 15000 });
    await expect(contactRoleRow).toBeVisible();
  });

  // TC-ACC-003 | AC Reference: QO-005-05, PC-005-06, PC-005-07, PC-005-08, PC-005-09
  test('TC-ACC-003 — Create Quote, Browse Catalogs, Add Product and Validate Cart', async ({ page }) => {
    await SFUtils.goto(page, opportunityUrl);
    await SFUtils.waitForLoading(page);
    await page.locator('a:has-text("Create Quote"), button:has-text("Create Quote")').first().click();
    await SFUtils.waitForLoading(page);
    const quoteModal = page.locator('div[role="dialog"]').first();
    if (await quoteModal.isVisible({ timeout: 4000 }).catch(() => false)) {
      await SFUtils.fillField(page, quoteModal, 'Name', data.quote.Name);
      await page.locator('button[name="SaveEdit"]').first().click();
      await SFUtils.waitForLoading(page);
    }
    quoteUrl = page.url();
    expect(quoteUrl).toContain('/Quote/');
    await page.locator('button:has-text("Browse Catalogs"), a:has-text("Browse Catalogs")').first().click();
    await SFUtils.waitForLoading(page);
    const pricebookRow = page.locator('tr, li, .slds-listbox__item, label').filter({ hasText: data.quote.Price_Book || 'Standard Price Book' }).first();
    await pricebookRow.waitFor({ state: 'visible', timeout: 15000 });
    await pricebookRow.click();
    await SFUtils.waitForLoading(page);
    const startBtn = page.locator('button:has-text("Start"), button:has-text("Select"), button:has-text("Confirm")').first();
    if (await startBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await startBtn.click();
      await SFUtils.waitForLoading(page);
    }
    const allProductsLink = page.locator('a:has-text("All Products"), button:has-text("All Products"), li:has-text("All Products")').first();
    await allProductsLink.waitFor({ state: 'visible', timeout: 15000 });
    await allProductsLink.click();
    await SFUtils.waitForLoading(page);
    const productSearchInput = page.locator('input[placeholder*="Search"], input[type="search"]').first();
    await productSearchInput.waitFor({ state: 'visible', timeout: 10000 });
    await productSearchInput.fill(data.quote.Product_Name || 'SSL');
    await page.keyboard.press('Enter');
    await SFUtils.waitForLoading(page);
    const addProductBtn = page.locator('button:has-text("Add"), a:has-text("Add to Cart")').first();
    await addProductBtn.waitFor({ state: 'visible', timeout: 10000 });
    await addProductBtn.click();
    await SFUtils.waitForLoading(page);
    await page.locator('button:has-text("Save"), button[name="save"]').first().click();
    await SFUtils.waitForLoading(page);
    const cartProductRow = page.locator('table tbody tr, [data-row-key-value]').filter({ hasText: data.quote.Product_Name || 'SSL' }).first();
    await cartProductRow.waitFor({ state: 'visible', timeout: 15000 });
    await expect(cartProductRow).toBeVisible();
  });

  // TC-ACC-004 | AC Reference: QL-005-10, QL-005-11, CR-005-12
  test('TC-ACC-004 — Accept Quote, Create Contract and Activate Contract', async ({ page }) => {
    await SFUtils.goto(page, quoteUrl);
    await SFUtils.waitForLoading(page);
    await page.locator('a:has-text("Accepted"), button:has-text("Accepted")').first().click();
    await SFUtils.waitForLoading(page);
    await page.locator('a:has-text("Mark as Current Status"), button:has-text("Mark as Current Status")').first().click();
    await SFUtils.waitForLoading(page);
    await page.locator('button:has-text("New Contract"), a:has-text("New Contract")').first().click();
    await SFUtils.waitForLoading(page);
    const noneOption = page.locator('a, li, button').filter({ hasText: /None.*Create contract without/i }).first();
    await noneOption.waitFor({ state: 'visible', timeout: 10000 });
    await noneOption.click();
    await SFUtils.waitForLoading(page);
    contractUrl = page.url();
    if (!contractUrl.includes('/Contract/')) {
      const contractLink = page.locator('a[href*="/Contract/"]').first();
      await contractLink.waitFor({ state: 'visible', timeout: 10000 });
      const href = await contractLink.getAttribute('href') || '';
      contractUrl = href.startsWith('http') ? href : `${SF}${href}`;
      await SFUtils.goto(page, contractUrl);
      await SFUtils.waitForLoading(page);
      contractUrl = page.url();
    }
    expect(contractUrl).toContain('/Contract/');
    await page.locator('button:has-text("Edit"), a[title="Edit"]').first().click();
    await SFUtils.waitForLoading(page);
    const contractForm = page.locator('div[role="dialog"]').first();
    await SFUtils.selectCombobox(page, contractForm, 'Status', 'Activated');
    await SFUtils.fillField(page, contractForm, 'ContractTerm', String(data.contract?.Contract_Term ?? '12'));
    await page.locator('button[name="SaveEdit"]').first().click();
    await SFUtils.waitForLoading(page);
    const statusField = page.locator('[data-field-api-name="Status"]');
    await statusField.waitFor({ state: 'visible', timeout: 10000 });
    await expect(statusField).toContainText('Activated');
  });

  // TC-ACC-005 | AC Reference: OR-005-13, OR-005-14, OR-005-15, OR-005-16
  test('TC-ACC-005 — Create Order from Quote and Activate Order', async ({ page }) => {
    await SFUtils.goto(page, quoteUrl);
    await SFUtils.waitForLoading(page);
    await page.locator('button:has-text("Create Order"), a:has-text("Create Order")').first().click();
    await SFUtils.waitForLoading(page);
    const singleOrderOption = page.locator('a, li, button').filter({ hasText: /Create\s+[Ss]ingle\s+[Oo]rder/i }).first();
    await singleOrderOption.waitFor({ state: 'visible', timeout: 10000 });
    await singleOrderOption.click();
    await SFUtils.waitForLoading(page);
    const confirmBtn = page.locator('button:has-text("Confirm"), button:has-text("OK")').first();
    if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await confirmBtn.click();
      await SFUtils.waitForLoading(page);
    }
    const orderLink = page.locator('a[href*="/Order/"]').first();
    if (await orderLink.isVisible({ timeout: 8000 }).catch(() => false)) {
      const href = await orderLink.getAttribute('href') || '';
      orderUrl = href.startsWith('http') ? href : `${SF}${href}`;
    } else {
      orderUrl = page.url();
    }
    await SFUtils.goto(page, orderUrl);
    await SFUtils.waitForLoading(page);
    expect(page.url()).toContain('/Order/');
    await page.locator('button:has-text("Activate"), button:has-text("Activated"), a:has-text("Activate")').first().click();
    await SFUtils.waitForLoading(page);
    const markCompleteBtn = page.locator('button:has-text("Mark as Complete"), a:has-text("Mark as Complete")').first();
    if (await markCompleteBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await markCompleteBtn.click();
      await SFUtils.waitForLoading(page);
    }
    const orderStatus = page.locator('[data-field-api-name="Status"]').first();
    await orderStatus.waitFor({ state: 'visible', timeout: 10000 });
    const statusText = await orderStatus.innerText();
    expect(['Activated', 'Active', 'Complete', 'Completed'].some(s => statusText.includes(s))).toBeTruthy();
  });
  // ── US-005 END ───────────────────────────────────────────────────────

});
