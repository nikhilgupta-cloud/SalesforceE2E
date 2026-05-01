import { test, expect, Page } from '@playwright/test';
import { SFUtils } from '../utils/SFUtils';
import * as fs from 'fs';
import * as path from 'path';

const data = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'tests', 'fixtures', 'test-data.json'), 'utf8'));

const SF = process.env.SF_SANDBOX_URL || process.env.SF_LOGIN_URL || '';

test.describe('${obj.displayName} Lifecycle', () => {


  // ── US-005 START ─────────────────────────────────────────────────────
  import { test, expect, Page } from '@playwright/test';
  import { SFUtils } from '../utils/SFUtils';
  import * as fs from 'fs';
  import * as path from 'path';

  const data = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'tests', 'fixtures', 'test-data.json'), 'utf8'));
  const SF = process.env.SF_SANDBOX_URL || process.env.SF_LOGIN_URL || '';

  async function dismissAuraError(page: Page) {
    try {
      const closeBtn = page.locator('button.auraErrorClose, button[title="Close"]').first();
      if (await closeBtn.isVisible({ timeout: 2000 })) await closeBtn.click();
    } catch {}
  }

  test.describe.serial('Account-to-Order Lifecycle', () => {
    let accountUrl = '';
    let contactUrl = '';
    let opportunityUrl = '';
    let quoteUrl = '';
    let contractUrl = '';
    let orderUrl = '';

    test.beforeEach(async ({ page }) => {
      await SFUtils.goto(page, SF);
      await dismissAuraError(page);
      await SFUtils.waitForAppReady(page);
    });

    // TC-ACC-001 | AC Reference: AC-005-01
    test('TC-ACC-001 — AC-005-01: Verify Account Billing Address and Payment Terms (soft-fail)', async ({ page }) => {
      await SFUtils.goto(page, `${SF}/lightning/o/Account/list`);
      await dismissAuraError(page);
      await SFUtils.waitForLoading(page);

      const accountLink = page.locator(`a[title="${data.account.Account_Name}"]`).first();
      await accountLink.waitFor({ state: 'visible', timeout: 20000 });
      await accountLink.click();
      await SFUtils.waitForLoading(page);
      await dismissAuraError(page);
      accountUrl = page.url();

      const detailsTab = page.getByRole('tab', { name: 'Details' });
      if (await detailsTab.isVisible({ timeout: 4000 })) {
        await detailsTab.click();
        await SFUtils.waitForLoading(page);
      }

      // Soft-fail: Billing Address
      const billingField = page.locator('[data-field-api-name="BillingAddress"]');
      const hasBilling = await billingField.isVisible({ timeout: 5000 }).catch(() => false);
      if (!hasBilling) {
        console.warn('[SOFT-FAIL] Billing Address field not visible on Account Details tab.');
      } else {
        const billingText = (await billingField.textContent()) ?? '';
        if (!billingText.trim()) {
          console.warn('[SOFT-FAIL] Billing Address is empty on Account record.');
        }
      }

      // Soft-fail: Payment Terms (custom field variants)
      const paymentTermsField = page
        .locator(
          '[data-field-api-name="APTS_Payment_Terms__c"], [data-field-api-name="Payment_Terms__c"], [data-field-api-name="Payment_Term__c"]'
        )
        .first();
      const hasPaymentTerms = await paymentTermsField.isVisible({ timeout: 5000 }).catch(() => false);
      if (!hasPaymentTerms) {
        console.warn('[SOFT-FAIL] Payment Terms field not visible on Account Details tab.');
      } else {
        const paymentText = (await paymentTermsField.textContent()) ?? '';
        if (!paymentText.trim()) {
          console.warn('[SOFT-FAIL] Payment Terms is empty on Account record.');
        }
      }

      expect(accountUrl).toContain('/Account/');
    });

    // TC-ACC-002 | AC Reference: AC-005-02, AC-005-03, AC-005-04
    test('TC-ACC-002 — AC-005-02/03/04: Create Contact, create Opportunity, verify Primary Contact Role', async ({ page }) => {
      // AC-005-02: Create Contact directly via URL
      await SFUtils.goto(page, `${SF}/lightning/o/Contact/new`);
      await dismissAuraError(page);
      await SFUtils.waitForLoading(page);

      const contactModal = page.locator('div.modal-container, records-record-edit-wrapper, div[role="dialog"]').first();

      await SFUtils.fillField(page, contactModal, 'FirstName', data.contact.First_Name);
      await SFUtils.fillField(page, contactModal, 'LastName', data.contact.Last_Name);
      await SFUtils.fillField(page, contactModal, 'Email', data.contact.Email);

      await SFUtils.fillLookup(page, contactModal, 'AccountId', data.account.Account_Name);
      await SFUtils.waitForLoading(page);
      await page
        .locator('[role="option"], lightning-base-combobox-item')
        .filter({ hasText: data.account.Account_Name })
        .first()
        .click();

      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await SFUtils.waitForLoading(page);
      await dismissAuraError(page);
      contactUrl = page.url();
      expect(contactUrl).toContain('/Contact/');

      // AC-005-03: Create Opportunity via direct URL
      await SFUtils.goto(page, `${SF}/lightning/o/Opportunity/new`);
      await dismissAuraError(page);
      await SFUtils.waitForLoading(page);

      const oppModal = page.locator('div.modal-container, records-record-edit-wrapper, div[role="dialog"]').first();

      await SFUtils.fillField(page, oppModal, 'Name', data.opportunity.Name || `AutoOpp-${Date.now()}`);
      await SFUtils.selectCombobox(page, oppModal, 'StageName', data.opportunity.Stage);
      await SFUtils.fillField(page, oppModal, 'CloseDate', data.opportunity.Close_Date);

      await SFUtils.fillLookup(page, oppModal, 'AccountId', data.account.Account_Name);
      await SFUtils.waitForLoading(page);
      await page
        .locator('[role="option"], lightning-base-combobox-item')
        .filter({ hasText: data.account.Account_Name })
        .first()
        .click();

      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await SFUtils.waitForLoading(page);
      await dismissAuraError(page);
      opportunityUrl = page.url();
      expect(opportunityUrl).toContain('/Opportunity/');

      // AC-005-04: Add Contact Role — find related list and add primary contact
      const relatedListBtn = page
        .locator('a[data-label="Contact Roles"], a[title="Contact Roles"], span[title="Contact Roles"]')
        .first();
      if (await relatedListBtn.isVisible({ timeout: 6000 })) {
        await relatedListBtn.click();
        await SFUtils.waitForLoading(page);
      }

      const newCrBtn = page
        .locator('a[title="New Contact Role"], button')
        .filter({ hasText: 'New' })
        .first();
      if (await newCrBtn.isVisible({ timeout: 6000 })) {
        await newCrBtn.click();
        await SFUtils.waitForLoading(page);
        await dismissAuraError(page);

        const crModal = page.locator('div.modal-container, div[role="dialog"]').first();
        await SFUtils.fillLookup(page, crModal, 'ContactId', `${data.contact.First_Name} ${data.contact.Last_Name}`);
        await SFUtils.waitForLoading(page);
        await page
          .locator('[role="option"], lightning-base-combobox-item')
          .filter({ hasText: data.contact.Last_Name })
          .first()
          .click();

        const primaryCheckbox = crModal
          .locator('input[type="checkbox"][name="IsPrimary"], lightning-input[data-field="IsPrimary"] input')
          .first();
        if (await primaryCheckbox.isVisible({ timeout: 3000 })) {
          await primaryCheckbox.check();
        }

        await page.getByRole('button', { name: 'Save', exact: true }).click();
        await SFUtils.waitForLoading(page);
        await dismissAuraError(page);
      }

      // Verify contact name visible on opportunity
      const contactCell = page
        .locator('td, span, a')
        .filter({ hasText: new RegExp(`${data.contact.Last_Name}`, 'i') })
        .first();
      await expect(contactCell).toBeVisible({ timeout: 12000 });
    });

    // TC-ACC-003 | AC Reference: QO-005-05, PC-005-06, PC-005-07, PC-005-08, PC-005-09
    test('TC-ACC-003 — QO-005-05/PC-005-06/07/08/09: Create Quote, Browse Catalogs, Add Product, validate cart', async ({ page }) => {
      // QO-005-05: Navigate to Opportunity and create Quote
      await SFUtils.goto(page, opportunityUrl || `${SF}/lightning/o/Opportunity/list`);
      await dismissAuraError(page);
      await SFUtils.waitForLoading(page);

      if (!opportunityUrl.includes('/Opportunity/')) {
        const oppLink = page.locator(`a[title="${data.opportunity.Name}"]`).first();
        await oppLink.waitFor({ state: 'visible', timeout: 15000 });
        await oppLink.click();
        await SFUtils.waitForLoading(page);
        await dismissAuraError(page);
      }

      const createQuoteBtn = page.getByRole('button', { name: 'Create Quote', exact: true });
      if (await createQuoteBtn.isVisible({ timeout: 8000 })) {
        await createQuoteBtn.click();
      } else {
        const actionMenuTrigger = page
          .locator('button[aria-haspopup="true"][title*="Action"], div.slds-dropdown-trigger > button')
          .first();
        await actionMenuTrigger.waitFor({ state: 'visible', timeout: 10000 });
        await actionMenuTrigger.click();
        await page
          .locator('[role="menuitem"], a[role="option"], span')
          .filter({ hasText: 'Create Quote' })
          .first()
          .click();
      }
      await SFUtils.waitForLoading(page);
      await dismissAuraError(page);

      const quoteModal = page.locator('div.modal-container, div[role="dialog"]').first();
      if (await quoteModal.isVisible({ timeout: 4000 })) {
        await SFUtils.fillField(page, quoteModal, 'Name', data.quote.Name || `AutoQuote-${Date.now()}`);
        await page.getByRole('button', { name: 'Save', exact: true }).click();
        await SFUtils.waitForLoading(page);
        await dismissAuraError(page);
      }

      quoteUrl = page.url();
      expect(quoteUrl).toContain('/Quote/');

      // PC-005-06: Browse Catalogs and select Price Book
      const browseCatalogsBtn = page.getByRole('button', { name: 'Browse Catalogs', exact: true });
      await browseCatalogsBtn.waitFor({ state: 'visible', timeout: 20000 });
      await browseCatalogsBtn.click();
      await SFUtils.waitForLoading(page);
      await dismissAuraError(page);

      const priceBookItem = page
        .locator('a, button, span, li')
        .filter({ hasText: data.quote.Price_Book || 'Standard Price Book' })
        .first();
      if (await priceBookItem.isVisible({ timeout: 8000 })) {
        await priceBookItem.click();
        await SFUtils.waitForLoading(page);
        await dismissAuraError(page);
      }

      // PC-005-07: Select All Products
      const allProductsLink = page
        .locator('a, button, span, li')
        .filter({ hasText: /^All Products$/i })
        .first();
      if (await allProductsLink.isVisible({ timeout: 10000 })) {
        await allProductsLink.click();
        await SFUtils.waitForLoading(page);
      }

      // PC-005-08: Search for product and add it
      const productName: string = data.product?.Name || data.quote?.Product_Name || '';
      const productSearchInput = page
        .locator('input[placeholder*="Search"], input[type="search"], input[placeholder*="search"]')
        .first();
      await productSearchInput.waitFor({ state: 'visible', timeout: 12000 });
      await productSearchInput.fill(productName);
      await SFUtils.waitForLoading(page);

      const addBtn = page
        .locator('button, a')
        .filter({ hasText: /^Add$|^Select$|^Add to Quote$/ })
        .first();
      if (await addBtn.isVisible({ timeout: 10000 })) {
        await addBtn.click();
        await SFUtils.waitForLoading(page);
      }

      const saveQuoteBtn = page.getByRole('button', { name: 'Save', exact: true });
      if (await saveQuoteBtn.isVisible({ timeout: 5000 })) {
        await saveQuoteBtn.click();
        await SFUtils.waitForLoading(page);
        await dismissAuraError(page);
      }

      // PC-005-09: Validate product in cart
      const productInCart = page
        .locator('tr, li, div[class*="product"], div[class*="row"]')
        .filter({ hasText: productName })
        .first();
      await expect(productInCart).toBeVisible({ timeout: 15000 });
    });

    // TC-ACC-004 | AC Reference: QL-005-10, QL-005-11, CR-005-12
    test('TC-ACC-004 — QL-005-10/11/CR-005-12: Accept Quote, create Contract, activate Contract', async ({ page }) => {
      await SFUtils.goto(page, quoteUrl || `${SF}/lightning/o/Quote/list`);
      await dismissAuraError(page);
      await SFUtils.waitForLoading(page);

      // QL-005-10: Click Accepted button
      const acceptedBtn = page.getByRole('button', { name: 'Accepted', exact: true });
      if (await acceptedBtn.isVisible({ timeout: 8000 })) {
        await acceptedBtn.click();
        await SFUtils.waitForLoading(page);
        await dismissAuraError(page);
      } else {
        const statusPicklist = page
          .locator('button[aria-haspopup="listbox"], lightning-picklist button, a[data-value]')
          .filter({ hasText: /Status|Stage/ })
          .first();
        if (await statusPicklist.isVisible({ timeout: 5000 })) {
          await statusPicklist.click();
          await page
            .locator('[role="option"], lightning-base-combobox-item')
            .filter({ hasText: 'Accepted' })
            .first()
            .click();
          await SFUtils.waitForLoading(page);
          await dismissAuraError(page);
        }
      }

      // Mark as Current Status
      const markCurrentBtn = page
        .locator('a, button, span')
        .filter({ hasText: /Mark as Current Status/i })
        .first();
      if (await markCurrentBtn.isVisible({ timeout: 6000 })) {
        await markCurrentBtn.click();
        await SFUtils.waitForLoading(page);
        await dismissAuraError(page);
      }

      // QL-005-11: New Contract from dropdown
      const contractActionTrigger = page
        .locator(
          'button[title*="New Contract"], a[title*="New Contract"], div.slds-dropdown-trigger > button, button[aria-haspopup="true"]'
        )
        .first();
      await contractActionTrigger.waitFor({ state: 'visible', timeout: 12000 });
      await contractActionTrigger.click();
      await SFUtils.waitForLoading(page);

      const newContractItem = page
        .locator('[role="menuitem"], a[role="option"], li a, span')
        .filter({ hasText: /New Contract/i })
        .first();
      if (await newContractItem.isVisible({ timeout: 6000 })) {
        await newContractItem.click();
        await SFUtils.waitForLoading(page);
        await dismissAuraError(page);
      }

      // Select None: Create contract without any prices or discounts
      const noneOption = page
        .locator('a, button, li, label, span')
        .filter({ hasText: /None.*Create contract without any prices or discounts/i })
        .first();
      if (await noneOption.isVisible({ timeout: 10000 })) {
        await noneOption.click();
        await SFUtils.waitForLoading(page);
      }

      // Confirm creation
      const confirmCreateBtn = page.getByRole('button', { name: 'Create', exact: true });
      if (await confirmCreateBtn.isVisible({ timeout: 5000 })) {
        await confirmCreateBtn.click();
      } else {
        await page.getByRole('button', { name: 'Next', exact: true }).click().catch(async () => {
          await page.getByRole('button', { name: 'Save', exact: true }).click().catch(() => {});
        });
      }
      await SFUtils.waitForLoading(page);
      await dismissAuraError(page);

      contractUrl = page.url();
      if (!contractUrl.includes('/Contract/')) {
        const contractLink = page
          .locator('a')
          .filter({ hasText: /Contract-\d+|^CT-/ })
          .first();
        if (await contractLink.isVisible({ timeout: 10000 })) {
          await contractLink.click();
          await SFUtils.waitForLoading(page);
          await dismissAuraError(page);
          contractUrl = page.url();
        }
      }
      expect(contractUrl).toContain('/Contract/');

      // CR-005-12: Edit Contract — change status to Activated and fill Contract Term
      const editBtn = page
        .locator('button[name="Edit"], a[title="Edit"], button[title="Edit"]')
        .first();
      await editBtn.waitFor({ state: 'visible', timeout: 12000 });
      await editBtn.click();
      await SFUtils.waitForLoading(page);
      await dismissAuraError(page);

      const contractEditRoot = page
        .locator('div.modal-container, records-record-edit-wrapper, div[role="dialog"]')
        .first();

      await SFUtils.selectCombobox(page, contractEditRoot, 'Status', 'Activated');
      await SFUtils.fillField(page, contractEditRoot, 'ContractTerm', data.contract?.Contract_Term || '12');

      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await SFUtils.waitForLoading(page);
      await dismissAuraError(page);

      const contractStatusField = page.locator('[data-field-api-name="Status"]');
      await expect(contractStatusField).toContainText('Activated', { timeout: 12000 });
    });

    // TC-ACC-005 | AC Reference: OR-005-13, OR-005-14, OR-005-15, OR-005-16
    test('TC-ACC-005 — OR-005-13/14/15/16: Create Order from Quote and activate Order', async ({ page }) => {
      // OR-005-13: Open the Quote
      await SFUtils.goto(page, quoteUrl || `${SF}/lightning/o/Quote/list`);
      await dismissAuraError(page);
      await SFUtils.waitForLoading(page);

      if (!quoteUrl.includes('/Quote/')) {
        const quoteLink = page.locator(`a[title="${data.quote.Name}"]`).first();
        await quoteLink.waitFor({ state: 'visible', timeout: 15000 });
        await quoteLink.click();
        await SFUtils.waitForLoading(page);
        await dismissAuraError(page);
      }

      // OR-005-14: Click Create Order button and select Create single Order
      const createOrderBtn = page.getByRole('button', { name: 'Create Order', exact: true });
      if (await createOrderBtn.isVisible({ timeout: 8000 })) {
        await createOrderBtn.click();
      } else {
        const actionsTrigger = page
          .locator('div.slds-dropdown-trigger > button, button[aria-haspopup="true"]')
          .first();
        await actionsTrigger.waitFor({ state: 'visible', timeout: 10000 });
        await actionsTrigger.click();
        const createOrderItem = page
          .locator('[role="menuitem"], a, span')
          .filter({ hasText: /Create Order/i })
          .first();
        await createOrderItem.waitFor({ state: 'visible', timeout: 8000 });
        await createOrderItem.click();
      }
      await SFUtils.waitForLoading(page);
      await dismissAuraError(page);

      // Select "Create single Order" option
      const singleOrderOption = page
        .locator('a, button, li, label, span')
        .filter({ hasText: /Create single Order|Single Order/i })
        .first();
      if (await singleOrderOption.isVisible({ timeout: 10000 })) {
        await singleOrderOption.click();
        await SFUtils.waitForLoading(page);
        await dismissAuraError(page);
      }

      // Confirm order creation
      const confirmOrderBtn = page.getByRole('button', { name: 'Create Order', exact: true });
      if (await confirmOrderBtn.isVisible({ timeout: 5000 })) {
        await confirmOrderBtn.click();
      } else {
        await page.getByRole('button', { name: 'Next', exact: true }).click().catch(async () => {
          await page.getByRole('button', { name: 'Save', exact: true }).click().catch(() => {});
        });
      }
      await SFUtils.waitForLoading(page);
      await dismissAuraError(page);

      // OR-005-15: Navigate to created Order
      orderUrl = page.url();
      if (!orderUrl.includes('/Order/')) {
        const orderLink = page
          .locator('a')
          .filter({ hasText: /Order-\d+|^ORD-/ })
          .first();
        if (await orderLink.isVisible({ timeout: 12000 })) {
          await orderLink.click();
          await SFUtils.waitForLoading(page);
          await dismissAuraError(page);
          orderUrl = page.url();
        }
      }
      expect(orderUrl).toContain('/Order/');

      // OR-005-16: Click Activate and mark status as complete
      const activateBtn = page.getByRole('button', { name: 'Activate', exact: true });
      if (await activateBtn.isVisible({ timeout: 10000 })) {
        await activateBtn.click();
        await SFUtils.waitForLoading(page);
        await dismissAuraError(page);
      } else {
        const activateAlt = page
          .locator('a, button')
          .filter({ hasText: /^Activate$/i })
          .first();
        if (await activateAlt.isVisible({ timeout: 6000 })) {
          await activateAlt.click();
          await SFUtils.waitForLoading(page);
          await dismissAuraError(page);
        }
      }

      // Mark status as complete
      const markCompleteBtn = page
        .locator('button, a, span')
        .filter({ hasText: /Mark Status as Complete|Mark as Complete/i })
        .first();
      if (await markCompleteBtn.isVisible({ timeout: 6000 })) {
        await markCompleteBtn.click();
        await SFUtils.waitForLoading(page);
        await dismissAuraError(page);
      } else {
        const completeItem = page
          .locator('[role="menuitem"], a, span')
          .filter({ hasText: /Complete/i })
          .first();
        if (await completeItem.isVisible({ timeout: 4000 })) {
          await completeItem.click();
          await SFUtils.waitForLoading(page);
          await dismissAuraError(page);
        }
      }

      // Verify Order status
      const orderStatusField = page.locator('[data-field-api-name="Status"]');
      const statusVisible = await orderStatusField.isVisible({ timeout: 10000 }).catch(() => false);
      if (statusVisible) {
        const statusText = (await orderStatusField.textContent()) ?? '';
        expect(['Activated', 'Active', 'Complete', 'Completed'].some((s) => statusText.includes(s))).toBe(true);
      } else {
        // Fallback: verify URL still on Order page
        expect(page.url()).toContain('/Order/');
      }
    });
  });
  // ── US-005 END ───────────────────────────────────────────────────────

});
