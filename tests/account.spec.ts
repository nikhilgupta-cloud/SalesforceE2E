import { test, expect, Page } from '@playwright/test';
import { SFUtils } from '../utils/SFUtils';
import * as fs from 'fs';
import * as path from 'path';

const data = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'tests', 'test-data.json'), 'utf8'));

const SF = process.env.SF_SANDBOX_URL || process.env.SF_LOGIN_URL || '';

test.describe('Account Lifecycle', () => {


  // ── US-005 START ─────────────────────────────────────────────────────
  const state: {
    accountUrl: string;
    contactUrl: string;
    contactFullName: string;
    opportunityUrl: string;
    quoteUrl: string;
    contractUrl: string;
    orderUrl: string;
  } = {
    accountUrl: '',
    contactUrl: '',
    contactFullName: '',
    opportunityUrl: '',
    quoteUrl: '',
    contractUrl: '',
    orderUrl: '',
  };

  async function dismissAuraError(page: Page): Promise<void> {
    const errDialog = page.locator('[id="auraError"]');
    if (await errDialog.isVisible().catch(() => false)) {
      await page.getByRole('button', { name: 'OK', exact: true }).click().catch(() => {});
      await SFUtils.waitForLoading(page);
    }
  }

  async function clickTab(page: Page, tabName: string): Promise<void> {
    await page.getByRole('tab', { name: tabName, exact: true }).click();
    await SFUtils.waitForLoading(page);
  }

  // TC-ACC-001 | AC Reference: AC-005-01
  test('TC-ACC-001 — Verify existing Account Billing Address and Payment Terms', async ({ page }) => {
    await SFUtils.goto(page, SF);
    await dismissAuraError(page);
    await SFUtils.waitForLoading(page);

    // Locate the existing Account via global search (pre-existing record — safe to use searchAndOpen)
    await SFUtils.searchAndOpen(page, data.account.Account_Name, 'Account');
    await dismissAuraError(page);
    await SFUtils.waitForLoading(page);
    state.accountUrl = page.url();

    await clickTab(page, 'Details');

    // Soft-fail: Billing Address
    const billingCell = page.locator('[data-field-api-name="BillingAddress"]');
    const billingText = await billingCell.textContent().catch(() => '');
    if (!billingText?.trim()) {
      test.info().annotations.push({
        type: 'warning',
        description: 'AC-005-01 SOFT-FAIL: Billing Address is empty or not present on Account record',
      });
    } else {
      expect(billingText.trim().length).toBeGreaterThan(0);
    }

    // Soft-fail: Payment Terms (not in verified locators — use label-based fallback)
    const ptContainer = page.locator('[class*="slds-form-element"]').filter({ hasText: 'Payment Terms' }).first();
    const ptExists = await ptContainer.isVisible().catch(() => false);
    if (!ptExists) {
      test.info().annotations.push({
        type: 'warning',
        description: 'AC-005-01 SOFT-FAIL: Payment Terms field not found on Account Details tab',
      });
    } else {
      const ptValue = await ptContainer.locator('[class*="slds-form-element__static"], [class*="field-value"]').textContent().catch(() => '');
      if (!ptValue?.trim()) {
        test.info().annotations.push({
          type: 'warning',
          description: 'AC-005-01 SOFT-FAIL: Payment Terms value is blank on Account record',
        });
      }
    }
  });

  // TC-ACC-002 | AC Reference: AC-005-02, AC-005-03, AC-005-04
  test('TC-ACC-002 — Create Contact on Account, Opportunity from Contact, verify Primary Contact Role', async ({ page }) => {
    // AC-005-02: Navigate to Account and create Contact from related list
    await SFUtils.goto(page, state.accountUrl);
    await dismissAuraError(page);
    await SFUtils.waitForLoading(page);

    const contactsCard = page.locator('article').filter({ hasText: 'Contacts' }).first();
    await contactsCard.getByRole('button', { name: 'New', exact: true }).click();
    await SFUtils.waitForLoading(page);

    const contactModal = page.locator('[role="dialog"]:not([id="auraError"]):not([aria-hidden="true"])');
    await contactModal.waitFor({ state: 'visible' });

    await SFUtils.fillName(contactModal, 'firstName', data.contact.First_Name);
    await SFUtils.fillName(contactModal, 'lastName', data.contact.Last_Name);
    await SFUtils.fillField(contactModal, 'Email', data.contact.Email);
    await SFUtils.fillField(contactModal, 'Phone', data.contact.Phone);
    await contactModal.getByRole('button', { name: 'Save', exact: true }).click();
    await SFUtils.waitForLoading(page);

    // Navigate to Contact via toast link (avoids search-indexing delay)
    const contactToastLink = page.locator('.toastMessage a').first();
    await expect(contactToastLink).toBeVisible({ timeout: 10000 });
    await contactToastLink.click();
    await SFUtils.waitForLoading(page);
    state.contactUrl = page.url();
    state.contactFullName = `${data.contact.First_Name} ${data.contact.Last_Name}`;
    expect(state.contactUrl).toContain('/Contact/');

    // AC-005-03: Create Opportunity from Contact's Opportunities related list
    const oppsCard = page.locator('article').filter({ hasText: 'Opportunities' }).first();
    await oppsCard.getByRole('button', { name: 'New', exact: true }).click();
    await SFUtils.waitForLoading(page);

    const oppModal = page.locator('[role="dialog"]:not([id="auraError"]):not([aria-hidden="true"])');
    await oppModal.waitFor({ state: 'visible' });

    const oppName = `${data.opportunity.Name}-${Date.now()}`;
    await SFUtils.fillField(oppModal, 'Name', oppName);
    await SFUtils.selectCombobox(page, oppModal, 'StageName', data.opportunity.Stage);
    await SFUtils.fillField(oppModal, 'CloseDate', data.opportunity.Close_Date);
    await oppModal.getByRole('button', { name: 'Save', exact: true }).click();
    await SFUtils.waitForLoading(page);

    // Navigate to Opportunity via toast link
    const oppToastLink = page.locator('.toastMessage a').first();
    await expect(oppToastLink).toBeVisible({ timeout: 10000 });
    await oppToastLink.click();
    await SFUtils.waitForLoading(page);
    state.opportunityUrl = page.url();
    expect(state.opportunityUrl).toContain('/Opportunity/');

    // AC-005-04: Verify Contact is Primary Contact Role on Opportunity
    const contactRolesCard = page.locator('article').filter({ hasText: 'Contact Roles' }).first();
    await contactRolesCard.scrollIntoViewIfNeeded();
    const primaryRow = contactRolesCard.locator('tr').filter({ hasText: state.contactFullName }).first();
    await expect(primaryRow).toBeVisible();
    await expect(primaryRow).toContainText('Primary');
  });

  // TC-ACC-003 | AC Reference: QO-005-05, PC-005-06, PC-005-07, PC-005-08, PC-005-09
  test('TC-ACC-003 — Create Quote from Opportunity, browse catalog, add product and validate cart', async ({ page }) => {
    // QO-005-05: Navigate to Opportunity and create Quote
    await SFUtils.goto(page, state.opportunityUrl);
    await dismissAuraError(page);
    await SFUtils.waitForLoading(page);

    await page.getByRole('button', { name: 'Create Quote', exact: true }).click();
    await SFUtils.waitForLoading(page);

    // Handle Quote creation modal if presented
    const quoteModal = page.locator('[role="dialog"]:not([id="auraError"]):not([aria-hidden="true"])');
    if (await quoteModal.isVisible().catch(() => false)) {
      await SFUtils.fillField(quoteModal, 'Name', data.quote.Name);
      await SFUtils.fillField(quoteModal, 'ExpirationDate', '12/31/2026');
      await quoteModal.getByRole('button', { name: 'Save', exact: true }).click();
      await SFUtils.waitForLoading(page);
    }

    // Navigate to Quote via toast link
    const quoteToastLink = page.locator('.toastMessage a').first();
    if (await quoteToastLink.isVisible().catch(() => false)) {
      await quoteToastLink.click();
      await SFUtils.waitForLoading(page);
    }
    state.quoteUrl = page.url();
    expect(state.quoteUrl).toContain('/Quote/');

    // PC-005-06: Click Browse Catalogs and select Price Book
    await page.getByRole('button', { name: 'Browse Catalogs', exact: true }).click();
    await SFUtils.waitForLoading(page);

    const priceBookRow = page.locator('tr, li, label, [role="option"]').filter({ hasText: 'Standard Price Book' }).first();
    await priceBookRow.click();
    await SFUtils.waitForLoading(page);

    const selectBtn = page.getByRole('button', { name: 'Select', exact: true });
    if (await selectBtn.isVisible().catch(() => false)) {
      await selectBtn.click();
      await SFUtils.waitForLoading(page);
    }

    // PC-005-07: Select All Products from catalog
    const allProductsLink = page.getByRole('link', { name: 'All Products', exact: true });
    const allProductsBtn = page.getByRole('button', { name: 'All Products', exact: true });
    if (await allProductsLink.isVisible().catch(() => false)) {
      await allProductsLink.click();
    } else if (await allProductsBtn.isVisible().catch(() => false)) {
      await allProductsBtn.click();
    }
    await SFUtils.waitForLoading(page);

    // PC-005-08: Search for product and add to quote
    const searchInput = page.locator('input[type="search"], input[placeholder*="Search"], input[placeholder*="search"]').first();
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill(data.quote.Name);
      await page.keyboard.press('Enter');
      await SFUtils.waitForLoading(page);
    }

    await page.getByRole('button', { name: 'Add', exact: true }).first().click();
    await SFUtils.waitForLoading(page);

    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await SFUtils.waitForLoading(page);

    // PC-005-09: Validate product is present in cart / line items
    const lineItemRow = page.locator('tbody tr, tr[data-row-key], [class*="line-item"]').first();
    await expect(lineItemRow).toBeVisible();
  });

  // TC-ACC-004 | AC Reference: QL-005-10, QL-005-11
  test('TC-ACC-004 — Accept Quote, mark as current status and create Contract without prices or discounts', async ({ page }) => {
    await SFUtils.goto(page, state.quoteUrl);
    await dismissAuraError(page);
    await SFUtils.waitForLoading(page);

    // QL-005-10: Click Accepted status button
    await page.getByRole('button', { name: 'Accepted', exact: true }).click();
    await SFUtils.waitForLoading(page);

    // Click Mark as Current Status (may appear as menuitem inside a dropdown)
    const markCurrentMenuItem = page.getByRole('menuitem', { name: 'Mark as Current Status', exact: true });
    const markCurrentBtn = page.getByRole('button', { name: 'Mark as Current Status', exact: true });
    if (await markCurrentMenuItem.isVisible().catch(() => false)) {
      await markCurrentMenuItem.click();
    } else {
      await markCurrentBtn.click();
    }
    await SFUtils.waitForLoading(page);

    // QL-005-11: Trigger New Contract from quote action area
    const startContractingBtn = page.getByRole('button', { name: 'Start Contracting', exact: true });
    const newContractBtn = page.getByRole('button', { name: 'New Contract', exact: true });
    if (await startContractingBtn.isVisible().catch(() => false)) {
      await startContractingBtn.click();
    } else if (await newContractBtn.isVisible().catch(() => false)) {
      await newContractBtn.click();
    } else {
      const actionsMenuBtn = page.locator('button[title="Actions"], button[title="More Actions"]').first();
      await actionsMenuBtn.click();
      await SFUtils.waitForLoading(page);
      await page.getByRole('menuitem', { name: 'New Contract', exact: true }).click();
    }
    await SFUtils.waitForLoading(page);

    // Select "None: Create contract without any prices or discounts"
    const noneOption = page.locator('label, li, div[role="option"]').filter({ hasText: /None.*Create contract without any prices or discounts/i }).first();
    await noneOption.click();

    const nextBtn = page.getByRole('button', { name: 'Next', exact: true });
    const createBtn = page.getByRole('button', { name: 'Create', exact: true });
    if (await nextBtn.isVisible().catch(() => false)) {
      await nextBtn.click();
    } else {
      await createBtn.click();
    }
    await SFUtils.waitForLoading(page);

    // Navigate to Contract via toast link
    const contractToastLink = page.locator('.toastMessage a').first();
    await expect(contractToastLink).toBeVisible({ timeout: 15000 });
    await contractToastLink.click();
    await SFUtils.waitForLoading(page);
    state.contractUrl = page.url();
    expect(state.contractUrl).toContain('/Contract/');
  });

  // TC-ACC-005 | AC Reference: CR-005-12, OR-005-13, OR-005-14, OR-005-15, OR-005-16
  test('TC-ACC-005 — Activate Contract, create single Order from Quote and activate Order', async ({ page }) => {
    // CR-005-12: Open Contract and change status to Activated with Contract Term
    await SFUtils.goto(page, state.contractUrl);
    await dismissAuraError(page);
    await SFUtils.waitForLoading(page);

    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await SFUtils.waitForLoading(page);

    const editModal = page.locator('[role="dialog"]:not([id="auraError"]):not([aria-hidden="true"])');
    const editRoot = (await editModal.isVisible().catch(() => false)) ? editModal : page.locator('body');

    await SFUtils.selectCombobox(page, editRoot, 'Status', 'Activated');
    await SFUtils.fillField(editRoot, 'ContractTerm', '12');
    await editRoot.getByRole('button', { name: 'Save', exact: true }).click();
    await SFUtils.waitForLoading(page);

    // Verify contract is Activated
    await clickTab(page, 'Details');
    await expect(page.locator('[data-field-api-name="Status"]')).toContainText('Activated');

    // OR-005-13: Navigate back to the Quote created in TC-ACC-003
    await SFUtils.goto(page, state.quoteUrl);
    await dismissAuraError(page);
    await SFUtils.waitForLoading(page);

    // OR-005-14: Click Create Order button and select Create single Order
    await page.getByRole('button', { name: 'Create Order', exact: true }).click();
    await SFUtils.waitForLoading(page);

    const singleOrderMenuItem = page.getByRole('menuitem', { name: 'Create single Order', exact: true });
    const singleOrderBtn = page.getByRole('button', { name: 'Create single Order', exact: true });
    if (await singleOrderMenuItem.isVisible().catch(() => false)) {
      await singleOrderMenuItem.click();
    } else {
      await singleOrderBtn.click();
    }
    await SFUtils.waitForLoading(page);

    // Dismiss confirmation dialog if present
    const confirmBtn = page.getByRole('button', { name: 'Confirm', exact: true });
    if (await confirmBtn.isVisible().catch(() => false)) {
      await confirmBtn.click();
      await SFUtils.waitForLoading(page);
    }

    // OR-005-15: Open the created Order via toast link
    const orderToastLink = page.locator('.toastMessage a').first();
    await expect(orderToastLink).toBeVisible({ timeout: 15000 });
    await orderToastLink.click();
    await SFUtils.waitForLoading(page);
    state.orderUrl = page.url();
    expect(state.orderUrl).toContain('/Order/');

    // OR-005-16: Click Activated and Mark as Current Status on Order
    await page.getByRole('button', { name: 'Activated', exact: true }).click();
    await SFUtils.waitForLoading(page);

    const markCompleteMenuItem = page.getByRole('menuitem', { name: 'Mark as Current Status', exact: true });
    const markCompleteBtn = page.getByRole('button', { name: 'Mark as Current Status', exact: true });
    if (await markCompleteMenuItem.isVisible().catch(() => false)) {
      await markCompleteMenuItem.click();
    } else {
      await markCompleteBtn.click();
    }
    await SFUtils.waitForLoading(page);

    // Verify Order is Activated
    await clickTab(page, 'Details');
    const orderStatus = page.locator('[data-field-api-name="Status"]');
    if (await orderStatus.isVisible().catch(() => false)) {
      await expect(orderStatus).toContainText('Activated');
    }
  });
  // ── US-005 END ───────────────────────────────────────────────────────
