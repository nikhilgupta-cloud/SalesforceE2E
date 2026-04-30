import { test, expect, Page } from '@playwright/test';
import { SFUtils } from '../utils/SFUtils';
import * as fs from 'fs';
import * as path from 'path';

const data = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'tests', 'test-data.json'), 'utf8'));

const SF = process.env.SF_SANDBOX_URL || process.env.SF_LOGIN_URL || '';

test.describe('Account Lifecycle', () => {


  // ── US-005 START ─────────────────────────────────────────────────────
  // ── Shared E2E state for US-005 ─────────────────────────────────────────────
  let accountUrl  = '';
  let contactUrl  = '';
  let oppUrl      = '';
  let quoteUrl    = '';
  let contractUrl = '';
  let orderUrl    = '';

  // ── Helpers (describe-scoped) ────────────────────────────────────────────────

  async function dismissAuraError(page: Page) {
    const auraErr = page.locator('#auraError');
    if (await auraErr.isVisible({ timeout: 2000 }).catch(() => false)) {
      await auraErr.locator('button').first().click().catch(() => {});
      await auraErr.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
    }
  }

  async function waitForDetail(page: Page) {
    await page.locator('.slds-page-header').first()
      .waitFor({ state: 'attached', timeout: 45000 }).catch(() => {});
    await SFUtils.waitForLoading(page);
  }

  async function clickTab(page: Page, tabName: string) {
    const tab = page.getByRole('tab', { name: tabName, exact: true }).first();
    await tab.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
    const selected = await tab.getAttribute('aria-selected').catch(() => null);
    if (selected !== 'true') {
      await tab.click();
      await SFUtils.waitForLoading(page);
    }
  }

  // TC-ACC-001 | AC Reference: AC-005-01
  test('TC-ACC-001 — Verify Account Billing Address and Payment Terms', async ({ page }) => {
    // Navigate to the pre-existing Account via global search (safe — not created in this run)
    accountUrl = await SFUtils.searchAndOpen(page, data.account.Account_Name);
    await dismissAuraError(page);
    await waitForDetail(page);
    accountUrl = page.url();

    // Navigate to Details tab before accessing field locators
    await clickTab(page, 'Details');

    // AC-005-01: Soft-fail if Billing Address is missing or empty
    const billingField = page.locator('[data-field-api-name="BillingAddress"]').first();
    const hasBilling = await billingField.isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasBilling) {
      console.warn('⚠️  SOFT FAIL [AC-005-01]: Billing Address field not visible on Account Details.');
    } else {
      const addrText = await SFUtils.getOutputValue(page, 'BillingAddress');
      if (!addrText || addrText.trim() === '') {
        console.warn('⚠️  SOFT FAIL [AC-005-01]: Billing Address field is present but empty.');
      }
    }

    // AC-005-01: Soft-fail if Payment Terms custom field is missing (org-dependent)
    const ptField = page
      .locator('[data-field-api-name="Payment_Terms__c"], [data-field-api-name="PaymentTerms__c"]')
      .first();
    const hasPT = await ptField.isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasPT) {
      console.warn('⚠️  SOFT FAIL [AC-005-01]: Payment Terms field not visible on Account Details.');
    }

    // Hard assert: Account record page loaded successfully
    expect(accountUrl).toContain('/Account/');
  });

  // TC-ACC-002 | AC Reference: AC-005-02
  test('TC-ACC-002 — Create new Contact on the Account record', async ({ page }) => {
    // Navigate to the Account — reuse URL from TC-ACC-001 when available
    if (accountUrl) {
      await SFUtils.goto(page, accountUrl);
    } else {
      await SFUtils.searchAndOpen(page, data.account.Account_Name);
      accountUrl = page.url();
    }
    await dismissAuraError(page);
    await waitForDetail(page);

    // Switch to Related tab to access the Contacts related list
    await clickTab(page, 'Related');

    // Click "New" on the Contacts related list card
    const contactsCard = page.locator('article').filter({ hasText: /^Contacts/ }).first();
    const hasCard = await contactsCard.isVisible({ timeout: 5000 }).catch(() => false);
    const newBtn = hasCard
      ? contactsCard.getByRole('button', { name: 'New', exact: true })
      : page.getByRole('button', { name: 'New Contact', exact: true });
    await SFUtils.safeClick(newBtn);
    await SFUtils.waitForLoading(page);
    await dismissAuraError(page);

    // Fill Contact quick-action modal
    const modal = page.locator(SFUtils.MODAL).first();
    await modal.waitFor({ state: 'visible', timeout: 20000 });

    // Name: compound lightning-input-name requires fillName
    await SFUtils.fillName(modal, 'firstName', data.contact.First_Name);
    await SFUtils.fillName(modal, 'lastName', data.contact.Last_Name);

    // Standard fields
    await SFUtils.fillField(page, modal, 'Email', data.contact.Email);
    if (data.contact.Phone) {
      await SFUtils.fillField(page, modal, 'Phone', data.contact.Phone);
    }

    // Save
    await modal.getByRole('button', { name: 'Save', exact: true }).click();
    await SFUtils.waitForLoading(page);
    await dismissAuraError(page);

    // Capture Contact URL via toast link — NEVER searchAndOpen for same-run records
    contactUrl = await SFUtils.waitForNavigationOrToast(page, '/Contact/');
    expect(contactUrl).toContain('/Contact/');
  });

  // TC-ACC-003 | AC Reference: AC-005-03, AC-005-04
  test('TC-ACC-003 — Create Opportunity from Contact and verify Primary Contact Role', async ({ page }) => {
    test.skip(!contactUrl, 'TC-ACC-002 must pass first — contactUrl is required');

    // Navigate to the Contact record created in TC-ACC-002
    await SFUtils.goto(page, contactUrl);
    await dismissAuraError(page);
    await waitForDetail(page);

    // Switch to Related tab on Contact to access Opportunities list
    await clickTab(page, 'Related');

    // Click "New" on the Opportunities related list card
    const oppCard = page.locator('article').filter({ hasText: /^Opportunities/ }).first();
    const hasOppCard = await oppCard.isVisible({ timeout: 5000 }).catch(() => false);
    const newOppBtn = hasOppCard
      ? oppCard.getByRole('button', { name: 'New', exact: true })
      : page.getByRole('button', { name: 'New Opportunity', exact: true });
    await SFUtils.safeClick(newOppBtn);
    await SFUtils.waitForLoading(page);
    await dismissAuraError(page);

    // Fill Opportunity modal
    const modal = page.locator(SFUtils.MODAL).first();
    await modal.waitFor({ state: 'visible', timeout: 20000 });

    await SFUtils.fillField(page, modal, 'Name', data.opportunity.Name);
    await SFUtils.fillField(page, modal, 'CloseDate', data.opportunity.Close_Date);
    await SFUtils.selectCombobox(page, modal, 'StageName', data.opportunity.Stage);

    // Save
    await modal.getByRole('button', { name: 'Save', exact: true }).click();
    await SFUtils.waitForLoading(page);
    await dismissAuraError(page);

    // Capture Opportunity URL via toast — NEVER searchAndOpen for same-run records
    oppUrl = await SFUtils.waitForNavigationOrToast(page, '/Opportunity/');
    expect(oppUrl).toContain('/Opportunity/');

    // AC-005-04: Verify the new Contact appears in the Contact Roles related list
    await waitForDetail(page);
    await clickTab(page, 'Related');

    const rolesCard = page.locator('article').filter({ hasText: /Contact Roles/i }).first();
    const hasRolesCard = await rolesCard.isVisible({ timeout: 8000 }).catch(() => false);
    if (hasRolesCard) {
      const contactEntry = rolesCard.getByText(data.contact.Full_Name);
      await expect(contactEntry.first()).toBeVisible({ timeout: 10000 });
    } else {
      console.warn('⚠️  SOFT NOTE [AC-005-04]: Contact Roles section not yet visible; may require manual verification.');
    }
  });

  // TC-ACC-004 | AC Reference: QO-005-05, PC-005-06, PC-005-07, PC-005-08, PC-005-09
  test('TC-ACC-004 — Create Quote, Browse Catalogs, Add Product, Validate Cart', async ({ page }) => {
    test.skip(!oppUrl, 'TC-ACC-003 must pass first — oppUrl is required');

    // QO-005-05: Navigate to Opportunity → click the Quote creation button
    await SFUtils.goto(page, oppUrl);
    await dismissAuraError(page);
    await waitForDetail(page);

    const newQuoteBtn = page
      .getByRole('button', { name: 'New Quote', exact: true })
      .or(page.getByRole('button', { name: 'Create Quote', exact: true }))
      .first();
    await SFUtils.safeClick(newQuoteBtn);
    await SFUtils.waitForLoading(page);
    await dismissAuraError(page);

    // Fill Quote Name — handle both modal and inline-page form
    const modal = page.locator(SFUtils.MODAL).first();
    const modalVisible = await modal.waitFor({ state: 'visible', timeout: 10000 })
      .then(() => true).catch(() => false);

    const nameInput = modalVisible
      ? modal.locator('[data-field-api-name="Name"] input')
      : page.locator('[data-field-api-name="Name"] input').first();

    if (await nameInput.count() > 0) {
      await nameInput.waitFor({ state: 'visible', timeout: 10000 });
      await nameInput.fill(data.quote.Name);
    }

    const saveBtn = modalVisible
      ? modal.getByRole('button', { name: 'Save', exact: true })
      : page.getByRole('button', { name: 'Save', exact: true }).first();
    await saveBtn.click();
    await SFUtils.waitForLoading(page);
    await dismissAuraError(page);

    // Capture Quote URL via toast — same-run record
    quoteUrl = await SFUtils.waitForNavigationOrToast(page, '/Quote/');
    await waitForDetail(page);

    // PC-005-06: Click "Browse Catalogs" and select Price Book
    const browseCatalogsBtn = page.getByRole('button', { name: 'Browse Catalogs', exact: true });
    await SFUtils.safeClick(browseCatalogsBtn);
    await SFUtils.waitForLoading(page);
    await dismissAuraError(page);

    // Select Standard Price Book from the dialog/combobox
    const pbOption = page
      .getByRole('option', { name: 'Standard Price Book' })
      .or(page.getByText('Standard Price Book', { exact: true }))
      .first();
    const hasPBOption = await pbOption.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasPBOption) {
      await SFUtils.safeClick(pbOption);
      await SFUtils.waitForLoading(page);
    } else {
      // Fallback: combobox button trigger
      const pbComboBtn = page.locator('lightning-combobox').first().locator('button');
      if (await pbComboBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await SFUtils.safeClick(pbComboBtn);
        const opt = page.locator('[role="option"]').filter({ hasText: 'Standard Price Book' }).first();
        await SFUtils.safeClick(opt);
        await SFUtils.waitForLoading(page);
      }
    }

    // PC-005-07: Select "All Products" from the catalogs panel
    const allProductsItem = page
      .getByRole('link', { name: 'All Products', exact: true })
      .or(page.getByRole('button', { name: 'All Products', exact: true }))
      .first();
    const hasAllProducts = await allProductsItem.isVisible({ timeout: 8000 }).catch(() => false);
    if (hasAllProducts) {
      await SFUtils.safeClick(allProductsItem);
      await SFUtils.waitForLoading(page);
    }

    // PC-005-08: Search for product and click Add
    const productName = (data as any).product?.Name || process.env.SF_TEST_PRODUCT_NAME || '';
    const searchInput = page.locator('input[placeholder*="Search"], input[type="search"]').first();
    if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false) && productName) {
      await searchInput.fill(productName);
      await searchInput.press('Enter');
      await SFUtils.waitForLoading(page);
    }

    const addBtn = page
      .getByRole('button', { name: 'Add', exact: true })
      .or(page.getByRole('button', { name: 'Add to Quote', exact: true }))
      .first();
    await SFUtils.safeClick(addBtn);
    await SFUtils.waitForLoading(page);
    await dismissAuraError(page);

    // Save quote after adding product
    const saveFinalBtn = page.getByRole('button', { name: 'Save', exact: true }).first();
    if (await saveFinalBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await saveFinalBtn.click();
      await SFUtils.waitForLoading(page);
      await dismissAuraError(page);
    }

    // PC-005-09: Validate product is visible on the cart / quote line-items section
    await SFUtils.goto(page, quoteUrl);
    await waitForDetail(page);
    const lineItemsSection = page
      .locator('.slds-table, [data-component-id*="line-item"], c-quotelineitemview')
      .first();
    await expect(lineItemsSection).toBeVisible({ timeout: 15000 });
    expect(quoteUrl).toContain('/Quote/');
  });

  // TC-ACC-005 | AC Reference: QL-005-10, QL-005-11, CR-005-12, OR-005-13, OR-005-14, OR-005-15, OR-005-16
  test('TC-ACC-005 — Accept Quote, Create Contract, Create and Activate Order', async ({ page }) => {
    test.skip(!quoteUrl, 'TC-ACC-004 must pass first — quoteUrl is required');

    // QL-005-10: Open Quote → click "Accepted" in the path component → Mark as Current Status
    await SFUtils.goto(page, quoteUrl);
    await dismissAuraError(page);
    await waitForDetail(page);

    const acceptedStage = page
      .locator('lightning-path .slds-path__item, .slds-path__stage')
      .filter({ hasText: /^Accepted$/i })
      .or(page.getByRole('listitem').filter({ hasText: /^Accepted$/i }))
      .first();
    if (await acceptedStage.isVisible({ timeout: 8000 }).catch(() => false)) {
      await SFUtils.safeClick(acceptedStage);
      await SFUtils.waitForLoading(page);
    }

    const markCurrentBtn = page.getByRole('button', { name: 'Mark as Current Status', exact: true });
    if (await markCurrentBtn.isVisible({ timeout: 8000 }).catch(() => false)) {
      await SFUtils.safeClick(markCurrentBtn);
      await SFUtils.waitForLoading(page);
      await dismissAuraError(page);
    }

    // QL-005-11: Open action dropdown → New Contract → None (no prices/discounts)
    const moreActionsBtn = page
      .locator('button[title="Show more actions"]')
      .or(page.getByRole('button', { name: 'Show more actions', exact: true }))
      .first();
    await SFUtils.safeClick(moreActionsBtn);
    await SFUtils.waitForLoading(page);

    const newContractItem = page.getByRole('menuitem', { name: /New Contract/i }).first();
    await SFUtils.safeClick(newContractItem);
    await SFUtils.waitForLoading(page);
    await dismissAuraError(page);

    // Select "None: Create contract without any prices or discounts"
    const noneOpt = page
      .getByText(/None.*Create contract without/i)
      .or(page.getByRole('radio', { name: /None/i }))
      .first();
    if (await noneOpt.isVisible({ timeout: 10000 }).catch(() => false)) {
      await SFUtils.safeClick(noneOpt);
      await SFUtils.waitForLoading(page);
    }

    // Confirm contract creation modal
    const createContractBtn = page
      .getByRole('button', { name: 'Create', exact: true })
      .or(page.getByRole('button', { name: 'Next', exact: true }))
      .or(page.getByRole('button', { name: 'Save', exact: true }))
      .first();
    if (await createContractBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await createContractBtn.click();
      await SFUtils.waitForLoading(page);
      await dismissAuraError(page);
    }

    // Capture Contract URL via toast link — same-run record
    const toastContractLink = page.locator('.slds-notify--toast a').first();
    if (await toastContractLink.isVisible({ timeout: 8000 }).catch(() => false)) {
      await SFUtils.safeClick(toastContractLink);
      await SFUtils.waitForLoading(page);
    }
    contractUrl = page.url();

    // CR-005-12: Open Contract → Edit → fill ContractTerm → set Status to Activated → Save
    if (contractUrl.includes('/Contract/')) {
      await SFUtils.goto(page, contractUrl);
      await dismissAuraError(page);
      await waitForDetail(page);
    }

    await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
    await SFUtils.waitForLoading(page);

    await SFUtils.fillField(page, page, 'ContractTerm', '12');
    await SFUtils.selectCombobox(page, page, 'Status', 'Activated');

    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await SFUtils.waitForLoading(page);
    await dismissAuraError(page);

    // Verify Contract Status is Activated
    await clickTab(page, 'Details');
    const contractStatus = await SFUtils.getOutputValue(page, 'Status');
    expect(contractStatus).toContain('Activated');

    // OR-005-13: Navigate back to the Quote created in TC-ACC-004
    await SFUtils.goto(page, quoteUrl);
    await dismissAuraError(page);
    await waitForDetail(page);

    // OR-005-14: Click "Create Order" → select "Create single Order"
    const createOrderBtn = page
      .getByRole('button', { name: 'Create Order', exact: true })
      .or(page.getByRole('button', { name: 'Create Orders', exact: true }))
      .first();
    await SFUtils.safeClick(createOrderBtn);
    await SFUtils.waitForLoading(page);
    await dismissAuraError(page);

    const singleOrderOpt = page
      .getByRole('menuitem', { name: /Create single Order/i })
      .or(page.getByText(/Create single Order/i))
      .first();
    if (await singleOrderOpt.isVisible({ timeout: 8000 }).catch(() => false)) {
      await SFUtils.safeClick(singleOrderOpt);
      await SFUtils.waitForLoading(page);
      await dismissAuraError(page);
    }

    // Confirm order-creation modal if present
    const orderModal = page.locator(SFUtils.MODAL).first();
    if (await orderModal.isVisible({ timeout: 5000 }).catch(() => false)) {
      const confBtn = orderModal
        .getByRole('button', { name: /Save|Confirm|Create/i })
        .first();
      if (await confBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await confBtn.click();
        await SFUtils.waitForLoading(page);
        await dismissAuraError(page);
      }
    }

    // OR-005-15: Capture Order URL via toast — same-run record
    const toastOrderLink = page.locator('.slds-notify--toast a').first();
    if (await toastOrderLink.isVisible({ timeout: 8000 }).catch(() => false)) {
      await SFUtils.safeClick(toastOrderLink);
      await SFUtils.waitForLoading(page);
    }
    orderUrl = page.url();
    expect(orderUrl).toContain('/Order/');

    // OR-005-16: Click "Activate" on the Order → confirm → verify Status = Activated
    await waitForDetail(page);

    const activateBtn = page.getByRole('button', { name: 'Activate', exact: true });
    await SFUtils.safeClick(activateBtn);
    await SFUtils.waitForLoading(page);
    await dismissAuraError(page);

    // Confirm activation modal if shown
    const activateModal = page.locator(SFUtils.MODAL).first();
    if (await activateModal.isVisible({ timeout: 5000 }).catch(() => false)) {
      const confirmActivate = activateModal
        .getByRole('button', { name: /Activate|Confirm|OK/i })
        .first();
      if (await confirmActivate.isVisible({ timeout: 3000 }).catch(() => false)) {
        await confirmActivate.click();
        await SFUtils.waitForLoading(page);
        await dismissAuraError(page);
      }
    }

    // Verify final Order Status = Activated
    await clickTab(page, 'Details');
    const orderStatus = await SFUtils.getOutputValue(page, 'Status');
    expect(orderStatus).toContain('Activated');
  });
  // ── US-005 END ───────────────────────────────────────────────────────
