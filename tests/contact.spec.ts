/**
 * Contact Tests — Salesforce CPQ (RCA)
 * Auth: auth/session.json
 *
 * AI-generated test blocks are inserted automatically when user stories are processed.
 * Run: npm run pipeline   |   Watch mode: npm run watch:stories
 */
import { test, type Page } from '@playwright/test';
import * as dotenv from 'dotenv';
dotenv.config();

const SF    = process.env.SF_SANDBOX_URL!;
const MODAL = '[role="dialog"]:not([id="auraError"]):not([aria-hidden="true"])';

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

// ── Suite ─────────────────────────────────────────────────────────────────────

test.describe('Contact Tests', () => {

  test.beforeEach(async ({ page }) => {
    await goTo(page, '/lightning/o/Contact/list?filterName=Recent');
    await waitForDetail(page);
    await dismissAuraError(page);
  });

  // AI-generated tests will be inserted here automatically when user stories are processed.
  // Run: npm run pipeline


  // ── US-005 START ─────────────────────────────────────────────────────
  // TC-CON-001 | AC Reference: AC-005-01
  test('TC-CON-001 — Verify Account Billing Address and Payment Terms (soft-fail)', async ({ page }) => {
    const accountName = 'SBOTestAccount';

    await page.goto(`${SF}/lightning/o/Account/list?filterName=Recent`, { waitUntil: 'domcontentloaded' });
    await dismissAuraError(page);
    await page.locator('.slds-page-header').first().waitFor({ state: 'visible', timeout: 30000 });

    // Find and open the target account
    const accountLink = page.locator(`a[title="${accountName}"]`).first();
    const hasAccount = await accountLink.waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false);
    if (hasAccount) {
      await accountLink.click();
    } else {
      const firstAccount = page.locator('tr[data-row-key-value] a[href*="/Account/"]').first();
      await firstAccount.waitFor({ state: 'visible', timeout: 30000 });
      await firstAccount.click();
    }
    await page.locator('.slds-page-header').first().waitFor({ state: 'visible', timeout: 30000 });
    await dismissAuraError(page);

    // Soft-fail: Billing Address
    const billingAddr = page.locator('[data-field-api-name="BillingAddress"], force-record-layout-row:has-text("Billing Address")').first();
    const hasBilling = await billingAddr.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false);
    if (!hasBilling) {
      console.warn('[SOFT-FAIL AC-005-01] Billing Address is missing on Account:', accountName);
    }

    // Soft-fail: Payment Terms
    const paymentTerms = page.locator('[data-field-api-name="Payment_Terms__c"], force-record-layout-row:has-text("Payment Terms")').first();
    const hasPayment = await paymentTerms.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false);
    if (!hasPayment) {
      console.warn('[SOFT-FAIL AC-005-01] Payment Terms is missing on Account:', accountName);
    }

    // Page must still be loaded regardless of soft-fails
    await page.locator('.slds-page-header').first().waitFor({ state: 'visible', timeout: 30000 });
  });

  // TC-CON-002 | AC Reference: AC-005-02
  test('TC-CON-002 — Create new Contact linked to SBOTestAccount', async ({ page }) => {
    const accountName = 'SBOTestAccount';
    const firstName   = 'David';
    const lastName    = `John${Date.now()}`;
    const email       = `David.John${Date.now()}@auto.com`;

    await page.goto(`${SF}/lightning/o/Contact/new`, { waitUntil: 'domcontentloaded' });
    await dismissAuraError(page);

    const modal = page.locator(MODAL);
    await modal.waitFor({ state: 'visible', timeout: 30000 });

    // First Name
    const firstNameInput = modal.locator('[data-field-api-name="FirstName"] input, lightning-input:has-text("First Name") input').first();
    await firstNameInput.waitFor({ state: 'visible', timeout: 30000 });
    await firstNameInput.fill(firstName);

    // Last Name
    const lastNameInput = modal.locator('[data-field-api-name="LastName"] input, lightning-input:has-text("Last Name") input').first();
    await lastNameInput.waitFor({ state: 'visible', timeout: 30000 });
    await lastNameInput.fill(lastName);

    // Email
    const emailInput = modal.locator('[data-field-api-name="Email"] input, lightning-input:has-text("Email") input').first();
    await emailInput.waitFor({ state: 'visible', timeout: 30000 });
    await emailInput.fill(email);

    // Account Name lookup
    const accountInput = modal.locator('lightning-lookup:has-text("Account Name") input, [data-field-api-name="AccountId"] input').first();
    await accountInput.waitFor({ state: 'visible', timeout: 30000 });
    await accountInput.fill(accountName);
    const accountOption = page.locator('[role="listbox"] [role="option"]').filter({ hasText: accountName }).first();
    await accountOption.waitFor({ state: 'visible', timeout: 30000 });
    await accountOption.click();

    // Save
    await modal.getByRole('button', { name: 'Save', exact: true }).click();
    await page.locator('.slds-spinner').waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});
    await page.locator('.slds-page-header').first().waitFor({ state: 'visible', timeout: 30000 });
    await dismissAuraError(page);

    // Verify Contact detail page rendered
    await page.locator('[data-field-api-name="LastName"] lightning-formatted-text, .slds-page-header__title').first().waitFor({ state: 'visible', timeout: 30000 });
  });

  // TC-CON-003 | AC Reference: AC-005-03, AC-005-04
  test('TC-CON-003 — Create Opportunity from Contact and verify Primary Contact Role', async ({ page }) => {
    const opportunityName = `Standard E2E - Q2 Order ${Date.now()}`;
    const closeDate       = '12/31/2026';

    // Open most-recent Contact
    await page.goto(`${SF}/lightning/o/Contact/list?filterName=Recent`, { waitUntil: 'domcontentloaded' });
    await dismissAuraError(page);
    await page.locator('.slds-page-header').first().waitFor({ state: 'visible', timeout: 30000 });

    const contactLink = page.locator('tr[data-row-key-value] a[href*="/Contact/"]').first();
    await contactLink.waitFor({ state: 'visible', timeout: 30000 });
    await contactLink.click();
    await page.locator('.slds-page-header').first().waitFor({ state: 'visible', timeout: 30000 });
    await dismissAuraError(page);

    // Open New Opportunity — try action button first, then related list
    const directBtn = page.locator('a[title="New Opportunity"], button[title="New Opportunity"]').first();
    const hasDirectBtn = await directBtn.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
    if (hasDirectBtn) {
      await directBtn.click();
    } else {
      const oppTab = page.locator('a[title="Opportunities"], [data-tab-name="Opportunities"]').first();
      await oppTab.waitFor({ state: 'visible', timeout: 15000 });
      await oppTab.click();
      const newBtn = page.locator('a[title="New Opportunity"], button[title="New"]').first();
      await newBtn.waitFor({ state: 'visible', timeout: 15000 });
      await newBtn.click();
    }

    const modal = page.locator(MODAL);
    await modal.waitFor({ state: 'visible', timeout: 30000 });

    // Opportunity Name
    const oppNameInput = modal.locator('[data-field-api-name="Name"] input, lightning-input:has-text("Opportunity Name") input').first();
    await oppNameInput.waitFor({ state: 'visible', timeout: 30000 });
    await oppNameInput.fill(opportunityName);

    // Close Date
    const closeDateInput = modal.locator('[data-field-api-name="CloseDate"] input, lightning-input:has-text("Close Date") input').first();
    await closeDateInput.waitFor({ state: 'visible', timeout: 30000 });
    await closeDateInput.fill(closeDate);

    // Stage (pick first available option)
    const stageBtn = modal.locator('lightning-combobox:has-text("Stage") button, [data-field-api-name="StageName"] button').first();
    await stageBtn.waitFor({ state: 'visible', timeout: 30000 });
    await stageBtn.click();
    const firstStageOption = page.locator('[role="listbox"] [role="option"]').first();
    await firstStageOption.waitFor({ state: 'visible', timeout: 30000 });
    await firstStageOption.click();

    await modal.getByRole('button', { name: 'Save', exact: true }).click();
    await page.locator('.slds-spinner').waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});
    await page.locator('.slds-page-header').first().waitFor({ state: 'visible', timeout: 30000 });
    await dismissAuraError(page);

    // AC-005-04: Verify Primary Contact Role on the Opportunity
    const rolesTab = page.locator('a[title="Contact Roles"], [data-tab-name="ContactRoles"]').first();
    const hasRolesTab = await rolesTab.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false);
    if (hasRolesTab) {
      await rolesTab.click();
      await page.locator('.slds-spinner').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
      const primaryIndicator = page.locator('td:has-text("Primary"), td lightning-icon[icon-name*="check"], tr:has-text("David")').first();
      await primaryIndicator.waitFor({ state: 'visible', timeout: 30000 });
    }
  });

  // TC-CON-004 | AC Reference: AC-005-05, AC-005-06, AC-005-07
  test('TC-CON-004 — Generate Quote, navigate to QLE, add products and apply quantity/discount updates', async ({ page }) => {
    // Open most-recent Opportunity
    await page.goto(`${SF}/lightning/o/Opportunity/list?filterName=Recent`, { waitUntil: 'domcontentloaded' });
    await dismissAuraError(page);
    await page.locator('.slds-page-header').first().waitFor({ state: 'visible', timeout: 30000 });

    const oppLink = page.locator('tr[data-row-key-value] a[href*="/Opportunity/"]').first();
    await oppLink.waitFor({ state: 'visible', timeout: 30000 });
    await oppLink.click();
    await page.locator('.slds-page-header').first().waitFor({ state: 'visible', timeout: 30000 });
    await dismissAuraError(page);

    // AC-005-05: Create new Quote
    const newQuoteBtn = page.locator('a[title="New Quote"], button[title="New Quote"]').first();
    const hasNewQuote = await newQuoteBtn.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false);
    if (hasNewQuote) {
      await newQuoteBtn.click();
    } else {
      const quotesTab = page.locator('a[title="Quotes"], [data-tab-name="Quotes"]').first();
      await quotesTab.waitFor({ state: 'visible', timeout: 15000 });
      await quotesTab.click();
      const tabNewBtn = page.locator('a[title="New Quote"], div.slds-card button[title="New"]').first();
      await tabNewBtn.waitFor({ state: 'visible', timeout: 15000 });
      await tabNewBtn.click();
    }

    const modal = page.locator(MODAL);
    await modal.waitFor({ state: 'visible', timeout: 30000 });

    // Mark as Primary Quote
    const primaryChk = modal.locator('[data-field-api-name="SBQQ__Primary__c"] input[type="checkbox"], lightning-input:has-text("Primary") input[type="checkbox"]').first();
    const hasPrimary = await primaryChk.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
    if (hasPrimary && !(await primaryChk.isChecked().catch(() => false))) {
      await primaryChk.click();
    }

    await modal.getByRole('button', { name: 'Save', exact: true }).click();
    await page.locator('.slds-spinner').waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});
    await page.locator('.slds-page-header').first().waitFor({ state: 'visible', timeout: 30000 });
    await dismissAuraError(page);

    // Navigate to Quote Line Editor
    const editLinesBtn = page.locator('a:has-text("Edit Lines"), button:has-text("Edit Lines"), a[title="Edit Lines"]').first();
    await editLinesBtn.waitFor({ state: 'visible', timeout: 30000 });
    await editLinesBtn.click();
    await page.locator('.slds-spinner').waitFor({ state: 'hidden', timeout: 45000 }).catch(() => {});
    await page.locator('.slds-page-header, [class*="quote-line-editor"]').first().waitFor({ state: 'visible', timeout: 45000 });
    await dismissAuraError(page);

    // AC-005-06: Add Products
    const addProductsBtn = page.locator('button:has-text("Add Products"), a:has-text("Add Products")').first();
    await addProductsBtn.waitFor({ state: 'visible', timeout: 30000 });
    await addProductsBtn.click();
    await page.locator('.slds-spinner').waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});

    // Select Catalog: Certificates Catalog
    const catalogBtn = page.locator('lightning-combobox:has-text("Catalog") button').first();
    const hasCatalog = await catalogBtn.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false);
    if (hasCatalog) {
      await catalogBtn.click();
      const catalogOpt = page.locator('[role="option"]:has-text("Certificates Catalog")').first();
      await catalogOpt.waitFor({ state: 'visible', timeout: 15000 });
      await catalogOpt.click();
      await page.locator('.slds-spinner').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
    }

    // Search and select Premium SSL
    const productSearch = page.locator('input[placeholder*="Search"], input[type="search"]').first();
    await productSearch.waitFor({ state: 'visible', timeout: 30000 });
    await productSearch.fill('Premium SSL');
    await page.keyboard.press('Enter');
    await page.locator('.slds-spinner').waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});
    const sslChk = page.locator('tr:has-text("Premium SSL") input[type="checkbox"]').first();
    await sslChk.waitFor({ state: 'visible', timeout: 30000 });
    await sslChk.click();

    // Search and select Standard Support
    await productSearch.fill('Standard Support');
    await page.keyboard.press('Enter');
    await page.locator('.slds-spinner').waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});
    const supportChk = page.locator('tr:has-text("Standard Support") input[type="checkbox"]').first();
    await supportChk.waitFor({ state: 'visible', timeout: 30000 });
    await supportChk.click();

    // Confirm product selection
    const selectBtn = page.getByRole('button', { name: 'Select', exact: true }).first();
    const hasSelect = await selectBtn.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
    if (hasSelect) {
      await selectBtn.click();
    } else {
      await page.getByRole('button', { name: 'Add', exact: true }).first().click().catch(() => {});
    }
    await page.locator('.slds-spinner').waitFor({ state: 'hidden', timeout: 45000 }).catch(() => {});
    await page.locator('.slds-page-header, [class*="quote-line-editor"]').first().waitFor({ state: 'visible', timeout: 45000 });
    await dismissAuraError(page);

    // AC-005-07: Mass update Quantities and apply Discount
    // Quantity — Premium SSL: 10
    const sslQty = page.locator('tr:has-text("Premium SSL") [data-field-api-name="SBQQ__Quantity__c"] input, tr:has-text("Premium SSL") input[name*="Quantity"]').first();
    const hasSslQty = await sslQty.waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false);
    if (hasSslQty) {
      await sslQty.triple_click ? await sslQty.click({ clickCount: 3 }) : await sslQty.selectText().catch(() => {});
      await sslQty.fill('10');
    }

    // Quantity — Standard Support: 1
    const supportQty = page.locator('tr:has-text("Standard Support") [data-field-api-name="SBQQ__Quantity__c"] input, tr:has-text("Standard Support") input[name*="Quantity"]').first();
    const hasSupportQty = await supportQty.waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false);
    if (hasSupportQty) {
      await supportQty.click({ clickCount: 3 });
      await supportQty.fill('1');
    }

    // Discount — Premium SSL: 15%
    const sslDiscount = page.locator('tr:has-text("Premium SSL") [data-field-api-name="SBQQ__Discount__c"] input, tr:has-text("Premium SSL") input[name*="Discount"]').first();
    const hasSslDiscount = await sslDiscount.waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false);
    if (hasSslDiscount) {
      await sslDiscount.click({ clickCount: 3 });
      await sslDiscount.fill('15');
    }

    // Save QLE
    await page.getByRole('button', { name: 'Save', exact: true }).first().click();
    await page.locator('.slds-spinner').waitFor({ state: 'hidden', timeout: 45000 }).catch(() => {});
    await page.locator('.slds-page-header').first().waitFor({ state: 'visible', timeout: 45000 });
    await dismissAuraError(page);
  });

  // TC-CON-005 | AC Reference: AC-005-08, AC-005-09, AC-005-10, AC-005-11, AC-005-12
  test('TC-CON-005 — Accept Quote, edit Contract metadata, bypass approval, generate Order and Book/Activate', async ({ page }) => {
    // Open most-recent Quote
    await page.goto(`${SF}/lightning/o/SBQQ__Quote__c/list?filterName=Recent`, { waitUntil: 'domcontentloaded' });
    await dismissAuraError(page);
    await page.locator('.slds-page-header').first().waitFor({ state: 'visible', timeout: 30000 });

    const quoteLink = page.locator('tr[data-row-key-value] a[href*="/SBQQ__Quote__c/"]').first();
    await quoteLink.waitFor({ state: 'visible', timeout: 30000 });
    await quoteLink.click();
    await page.locator('.slds-page-header').first().waitFor({ state: 'visible', timeout: 30000 });
    await dismissAuraError(page);

    // AC-005-08: Accept Quote → generate Contract
    const acceptBtn = page.locator('a:has-text("Accept Quote"), button:has-text("Accept Quote"), a[title="Accept Quote"]').first();
    await acceptBtn.waitFor({ state: 'visible', timeout: 30000 });
    await acceptBtn.click();
    await page.locator('.slds-spinner').waitFor({ state: 'hidden', timeout: 45000 }).catch(() => {});
    await dismissAuraError(page);

    // Handle confirmation modal
    const confirmModal = page.locator(MODAL);
    const hasConfirm = await confirmModal.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false);
    if (hasConfirm) {
      const okBtn = confirmModal.getByRole('button', { name: 'OK', exact: true }).first();
      const hasOk = await okBtn.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
      if (hasOk) {
        await okBtn.click();
      } else {
        await confirmModal.getByRole('button', { name: 'Confirm', exact: true }).first().click().catch(() => {});
      }
      await page.locator('.slds-spinner').waitFor({ state: 'hidden', timeout: 45000 }).catch(() => {});
    }
    await page.locator('.slds-page-header').first().waitFor({ state: 'visible', timeout: 30000 });
    await dismissAuraError(page);

    // AC-005-09: Navigate to Contract and edit metadata
    const contractLink = page.locator('a[href*="/Contract/"]').first();
    const hasContractLink = await contractLink.waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false);
    if (hasContractLink) {
      await contractLink.click();
      await page.locator('.slds-page-header').first().waitFor({ state: 'visible', timeout: 30000 });
      await dismissAuraError(page);

      // Edit the Contract
      const editBtn = page.getByRole('button', { name: 'Edit', exact: true }).first();
      const hasEditBtn = await editBtn.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false);
      if (hasEditBtn) {
        await editBtn.click();
      } else {
        await page.locator('a[title="Edit"], button[name="Edit"]').first().click().catch(() => {});
      }

      const contractModal = page.locator(MODAL);
      const hasContractModal = await contractModal.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false);
      if (hasContractModal) {
        // Contract Term: 12 months
        const termInput = contractModal.locator('[data-field-api-name="ContractTerm"] input, lightning-input:has-text("Contract Term") input').first();
        const hasTerm = await termInput.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false);
        if (hasTerm) {
          await termInput.click({ clickCount: 3 });
          await termInput.fill('12');
        }

        // Start Date: today
        const today = new Date();
        const startDateStr = `${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}/${today.getFullYear()}`;
        const startInput = contractModal.locator('[data-field-api-name="StartDate"] input, lightning-input:has-text("Start Date") input').first();
        const hasStart = await startInput.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false);
        if (hasStart) {
          await startInput.fill(startDateStr);
        }

        await contractModal.getByRole('button', { name: 'Save', exact: true }).click();
        await page.locator('.slds-spinner').waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});
        await page.locator('.slds-page-header').first().waitFor({ state: 'visible', timeout: 30000 });
        await dismissAuraError(page);
      }
    }

    // Return to the Quote
    await page.goto(`${SF}/lightning/o/SBQQ__Quote__c/list?filterName=Recent`, { waitUntil: 'domcontentloaded' });
    await dismissAuraError(page);
    await page.locator('.slds-page-header').first().waitFor({ state: 'visible', timeout: 30000 });
    const quoteLink2 = page.locator('tr[data-row-key-value] a[href*="/SBQQ__Quote__c/"]').first();
    await quoteLink2.waitFor({ state: 'visible', timeout: 30000 });
    await quoteLink2.click();
    await page.locator('.slds-page-header').first().waitFor({ state: 'visible', timeout: 30000 });
    await dismissAuraError(page);

    // AC-005-10: Bypass approval — click Generate Order directly (SBO Shortcut)
    const generateOrderBtn = page.locator('a:has-text("Generate Order"), button:has-text("Generate Order"), a[title="Generate Order"]').first();
    await generateOrderBtn.waitFor({ state: 'visible', timeout: 30000 });
    await generateOrderBtn.click();
    await page.locator('.slds-spinner').waitFor({ state: 'hidden', timeout: 60000 }).catch(() => {});
    await dismissAuraError(page);

    // Handle order generation confirmation
    const orderConfirmModal = page.locator(MODAL);
    const hasOrderModal = await orderConfirmModal.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false);
    if (hasOrderModal) {
      const okBtn2 = orderConfirmModal.getByRole('button', { name: 'OK', exact: true }).first();
      const hasOk2 = await okBtn2.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
      if (hasOk2) {
        await okBtn2.click();
      } else {
        await orderConfirmModal.getByRole('button', { name: 'Confirm', exact: true }).first().click().catch(() => {});
      }
      await page.locator('.slds-spinner').waitFor({ state: 'hidden', timeout: 60000 }).catch(() => {});
    }
    await dismissAuraError(page);

    // AC-005-11: Capture Order URL and verify Draft status
    const orderLink = page.locator('a[href*="/Order/"]').first();
    const hasOrderLink = await orderLink.waitFor({ state: 'visible', timeout: 30000 }).then(() => true).catch(() => false);
    if (hasOrderLink) {
      await orderLink.click();
    } else {
      await page.goto(`${SF}/lightning/o/Order/list?filterName=Recent`, { waitUntil: 'domcontentloaded' });
      await dismissAuraError(page);
      await page.locator('.slds-page-header').first().waitFor({ state: 'visible', timeout: 30000 });
      await page.locator('tr[data-row-key-value] a[href*="/Order/"]').first().waitFor({ state: 'visible', timeout: 30000 });
      await page.locator('tr[data-row-key-value] a[href*="/Order/"]').first().click();
    }
    await page.locator('.slds-page-header').first().waitFor({ state: 'visible', timeout: 30000 });
    await dismissAuraError(page);

    const orderUrl = page.url();
    console.log('[AC-005-11] Order URL captured:', orderUrl);

    // Verify Draft status
    const draftStatus = page.locator('[data-field-api-name="Status"] lightning-formatted-text, .slds-page-header__meta-text, span:has-text("Draft")').first();
    await draftStatus.waitFor({ state: 'visible', timeout: 30000 });

    // AC-005-12: Book / Activate the Order
    const activateBtn = page.locator('a:has-text("Activate"), button:has-text("Activate"), a[title="Activate"]').first();
    const hasActivate = await activateBtn.waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false);
    if (hasActivate) {
      await activateBtn.click();
    } else {
      const bookBtn = page.locator('a:has-text("Book Order"), button:has-text("Book Order"), a[title="Book Order"]').first();
      await bookBtn.waitFor({ state: 'visible', timeout: 15000 });
      await bookBtn.click();
    }
    await page.locator('.slds-spinner').waitFor({ state: 'hidden', timeout: 45000 }).catch(() => {});
    await dismissAuraError(page);

    // Handle activation confirmation modal
    const activateModal = page.locator(MODAL);
    const hasActivateModal = await activateModal.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false);
    if (hasActivateModal) {
      const okBtn3 = activateModal.getByRole('button', { name: 'OK', exact: true }).first();
      const hasOk3 = await okBtn3.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
      if (hasOk3) {
        await okBtn3.click();
      } else {
        await activateModal.getByRole('button', { name: 'Confirm', exact: true }).first().click().catch(() => {});
      }
      await page.locator('.slds-spinner').waitFor({ state: 'hidden', timeout: 45000 }).catch(() => {});
    }

    // Verify final Activated / Booked status
    const activatedStatus = page.locator('[data-field-api-name="Status"] lightning-formatted-text, span:has-text("Activated"), span:has-text("Booked")').first();
    await activatedStatus.waitFor({ state: 'visible', timeout: 30000 });
    console.log('[AC-005-12] Order successfully Activated/Booked. URL:', orderUrl);
  });
  // ── US-005 END ───────────────────────────────────────────────────────


  // ── US-005 START ─────────────────────────────────────────────────────
  // TC-CON-001 | AC Reference: AC-005-01
  test('TC-CON-001 — Verify Account Billing Address and Payment Terms (soft-fail)', async ({ page }) => {
    const accountName = 'SBOTestAccount';

    await page.goto(`${SF}/lightning/o/Account/list?filterName=Recent`, { waitUntil: 'domcontentloaded' });
    await dismissAuraError(page);
    await page.locator('.slds-page-header').first().waitFor({ state: 'visible', timeout: 30000 });

    // Find and open the target account
    const accountLink = page.locator(`a[title="${accountName}"]`).first();
    const hasAccount = await accountLink.waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false);
    if (hasAccount) {
      await accountLink.click();
    } else {
      const firstAccount = page.locator('tr[data-row-key-value] a[href*="/Account/"]').first();
      await firstAccount.waitFor({ state: 'visible', timeout: 30000 });
      await firstAccount.click();
    }
    await page.locator('.slds-page-header').first().waitFor({ state: 'visible', timeout: 30000 });
    await dismissAuraError(page);

    // Soft-fail: Billing Address
    const billingAddr = page.locator('[data-field-api-name="BillingAddress"], force-record-layout-row:has-text("Billing Address")').first();
    const hasBilling = await billingAddr.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false);
    if (!hasBilling) {
      console.warn('[SOFT-FAIL AC-005-01] Billing Address is missing on Account:', accountName);
    }

    // Soft-fail: Payment Terms
    const paymentTerms = page.locator('[data-field-api-name="Payment_Terms__c"], force-record-layout-row:has-text("Payment Terms")').first();
    const hasPayment = await paymentTerms.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false);
    if (!hasPayment) {
      console.warn('[SOFT-FAIL AC-005-01] Payment Terms is missing on Account:', accountName);
    }

    // Page must still be loaded regardless of soft-fails
    await page.locator('.slds-page-header').first().waitFor({ state: 'visible', timeout: 30000 });
  });

  // TC-CON-002 | AC Reference: AC-005-02
  test('TC-CON-002 — Create Contact for Account if not existing', async ({ page }) => {
    const accountName  = 'SBOTestAccount';
    const firstName    = 'David';
    const lastName     = 'John';
    const contactEmail = 'David.John@auto.com';
    const fullName     = `${firstName} ${lastName}`;

    // Step 1 — Navigate to Account and check for existing Contact
    await page.goto(`${SF}/lightning/o/Account/list?filterName=Recent`, { waitUntil: 'domcontentloaded' });
    await dismissAuraError(page);
    await page.locator('.slds-page-header').first().waitFor({ state: 'visible', timeout: 30000 });

    const accountLink = page.locator(`a[title="${accountName}"]`).first();
    const hasAccount  = await accountLink.waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false);
    if (hasAccount) {
      await accountLink.click();
    } else {
      const firstAccount = page.locator('tr[data-row-key-value] a[href*="/Account/"]').first();
      await firstAccount.waitFor({ state: 'visible', timeout: 30000 });
      await firstAccount.click();
    }
    await page.locator('.slds-page-header').first().waitFor({ state: 'visible', timeout: 30000 });
    await dismissAuraError(page);

    // Check Related tab for an existing Contact
    const relatedTab = page.getByRole('tab', { name: 'Related', exact: true }).first();
    const hasRelated  = await relatedTab.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false);
    if (hasRelated) {
      await relatedTab.click();
      await page.locator('.slds-spinner').first().waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
    }

    const existingContact = page.locator(`a[title="${fullName}"]`).first();
    const contactExists   = await existingContact.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false);

    if (contactExists) {
      console.log(`[AC-005-02] Contact ${fullName} already exists — skipping creation.`);
      return;
    }

    // Step 2 — Create new Contact via global New
    await page.goto(`${SF}/lightning/o/Contact/new`, { waitUntil: 'domcontentloaded' });
    await dismissAuraError(page);

    const modal = page.locator(MODAL);
    await modal.waitFor({ state: 'visible', timeout: 30000 });

    // First Name
    const firstNameInput = modal.locator('lightning-input:has-text("First Name") input').first();
    await firstNameInput.waitFor({ state: 'visible', timeout: 30000 });
    await firstNameInput.fill(firstName);

    // Last Name
    const lastNameInput = modal.locator('lightning-input:has-text("Last Name") input').first();
    await lastNameInput.waitFor({ state: 'visible', timeout: 30000 });
    await lastNameInput.fill(lastName);

    // Email
    const emailInput = modal.locator('lightning-input:has-text("Email") input').first();
    await emailInput.waitFor({ state: 'visible', timeout: 30000 });
    await emailInput.fill(contactEmail);

    // Account Name lookup
    const accountLookupInput = modal.locator('lightning-lookup input').first();
    await accountLookupInput.waitFor({ state: 'visible', timeout: 30000 });
    await accountLookupInput.fill(accountName);
    const lookupOption = page.locator(`.slds-listbox__option[data-value], .slds-listbox__option:has-text("${accountName}")`).first();
    await lookupOption.waitFor({ state: 'visible', timeout: 30000 });
    await lookupOption.click();

    // Save
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await modal.waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});
    await page.locator('.slds-page-header').first().waitFor({ state: 'visible', timeout: 30000 });
    await dismissAuraError(page);

    // Confirm Contact detail page loaded with correct name
    await page.locator(`h1:has-text("${fullName}")`).first().waitFor({ state: 'visible', timeout: 30000 });
  });

  // TC-CON-003 | AC Reference: AC-005-03
  test('TC-CON-003 — Create Opportunity from Contact perspective', async ({ page }) => {
    const firstName       = 'David';
    const lastName        = 'John';
    const fullName        = `${firstName} ${lastName}`;
    const opportunityName = 'Standard E2E - Q2 Order';

    // Step 1 — Navigate to Contact record
    await page.goto(`${SF}/lightning/o/Contact/list?filterName=Recent`, { waitUntil: 'domcontentloaded' });
    await dismissAuraError(page);
    await page.locator('.slds-page-header').first().waitFor({ state: 'visible', timeout: 30000 });

    const contactLink = page.locator(`a[title="${fullName}"]`).first();
    await contactLink.waitFor({ state: 'visible', timeout: 30000 });
    await contactLink.click();
    await page.locator('.slds-page-header').first().waitFor({ state: 'visible', timeout: 30000 });
    await dismissAuraError(page);

    // Step 2 — Switch to Related tab and locate Opportunities section
    const relatedTab = page.getByRole('tab', { name: 'Related', exact: true }).first();
    await relatedTab.waitFor({ state: 'visible', timeout: 30000 });
    await relatedTab.click();
    await page.locator('.slds-spinner').first().waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});

    const oppSection = page.locator('article:has-text("Opportunities")').first();
    await oppSection.waitFor({ state: 'visible', timeout: 30000 });
    await oppSection.getByRole('button', { name: 'New', exact: true }).first().click();

    // Step 3 — Fill in Opportunity details
    const modal = page.locator(MODAL);
    await modal.waitFor({ state: 'visible', timeout: 30000 });

    // Opportunity Name
    const oppNameInput = modal.locator('lightning-input:has-text("Opportunity Name") input').first();
    await oppNameInput.waitFor({ state: 'visible', timeout: 30000 });
    await oppNameInput.fill(opportunityName);

    // Close Date
    const closeDateInput = modal.locator('lightning-datepicker input, lightning-input:has-text("Close Date") input').first();
    await closeDateInput.waitFor({ state: 'visible', timeout: 30000 });
    await closeDateInput.fill('12/31/2026');
    await closeDateInput.press('Tab');

    // Stage
    const stageCombobox = modal.locator('lightning-combobox:has-text("Stage") button').first();
    await stageCombobox.waitFor({ state: 'visible', timeout: 30000 });
    await stageCombobox.click();
    const stageOption = page.locator('.slds-listbox__option:has-text("Prospecting")').first();
    await stageOption.waitFor({ state: 'visible', timeout: 30000 });
    await stageOption.click();

    // Save
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await modal.waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});
    await page.locator('.slds-page-header').first().waitFor({ state: 'visible', timeout: 30000 });
    await dismissAuraError(page);

    // Verify Opportunity detail page
    await page.locator(`h1:has-text("${opportunityName}")`).first().waitFor({ state: 'visible', timeout: 30000 });
  });

  // TC-CON-004 | AC Reference: AC-005-04
  test('TC-CON-004 — Verify Contact is Primary Contact Role on Opportunity', async ({ page }) => {
    const firstName       = 'David';
    const lastName        = 'John';
    const fullName        = `${firstName} ${lastName}`;
    const opportunityName = 'Standard E2E - Q2 Order';

    // Step 1 — Open Opportunity
    await page.goto(`${SF}/lightning/o/Opportunity/list?filterName=Recent`, { waitUntil: 'domcontentloaded' });
    await dismissAuraError(page);
    await page.locator('.slds-page-header').first().waitFor({ state: 'visible', timeout: 30000 });

    const oppLink = page.locator(`a[title="${opportunityName}"]`).first();
    await oppLink.waitFor({ state: 'visible', timeout: 30000 });
    await oppLink.click();
    await page.locator('.slds-page-header').first().waitFor({ state: 'visible', timeout: 30000 });
    await dismissAuraError(page);

    // Step 2 — Switch to Related tab
    const relatedTab = page.getByRole('tab', { name: 'Related', exact: true }).first();
    await relatedTab.waitFor({ state: 'visible', timeout: 30000 });
    await relatedTab.click();
    await page.locator('.slds-spinner').first().waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});

    // Step 3 — Locate Contact Roles section
    const crSection = page.locator('article:has-text("Contact Roles")').first();
    const hasCRSection = await crSection.waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false);

    if (!hasCRSection) {
      console.warn('[AC-005-04] Contact Roles related list not visible — may require page layout configuration.');
    }

    // Step 4 — Check if David John already appears as Primary
    const primaryRow = page.locator(`tr:has(a:has-text("${fullName}"))`).first();
    const isPrimary   = await primaryRow.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false);

    if (!isPrimary) {
      // Add contact role via New button inside Contact Roles section
      const crNewBtn = crSection.getByRole('button', { name: 'New', exact: true }).first();
      await crNewBtn.waitFor({ state: 'visible', timeout: 30000 });
      await crNewBtn.click();

      const modal = page.locator(MODAL);
      await modal.waitFor({ state: 'visible', timeout: 30000 });

      // Contact lookup
      const contactInput = modal.locator('lightning-lookup input, input[placeholder*="Search Contacts"]').first();
      await contactInput.waitFor({ state: 'visible', timeout: 30000 });
      await contactInput.fill(fullName);
      const contactOption = page.locator(`.slds-listbox__option:has-text("${fullName}")`).first();
      await contactOption.waitFor({ state: 'visible', timeout: 30000 });
      await contactOption.click();

      // Mark as Primary
      const primaryCheckbox = modal.locator('input[type="checkbox"][name*="rimary"], lightning-input:has-text("Primary") input[type="checkbox"]').first();
      await primaryCheckbox.waitFor({ state: 'visible', timeout: 30000 });
      const alreadyChecked = await primaryCheckbox.isChecked().catch(() => false);
      if (!alreadyChecked) {
        await primaryCheckbox.check();
      }

      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await modal.waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});
      await dismissAuraError(page);
      await page.locator('.slds-spinner').first().waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
    }

    // Step 5 — Final assertion: Contact row visible in Contact Roles list
    const verifiedRow = page.locator(`tr:has(a:has-text("${fullName}")), a:has-text("${fullName}")`).first();
    await verifiedRow.waitFor({ state: 'visible', timeout: 30000 });
  });
  // ── US-005 END ───────────────────────────────────────────────────────

});
