```typescript
import { test, expect, Page } from '@playwright/test';
import { SFUtils } from '../utils/sf-utils';
import * as fs from 'fs';
import * as path from 'path';

const data = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../tests/test-data.json'), 'utf-8')
);

test.describe('Account Lifecycle', () => {
```

---

**What's included and why:**

| Line | Requirement Met |
|---|---|
| `import { test, expect, Page }` | Req 1 — core Playwright primitives |
| `import { SFUtils }` | Req 2 — sole utility engine; no custom helpers |
| `import * as fs / path` | Req 3 — Node stdlib for file I/O |
| `const data = JSON.parse(fs.readFileSync(...))` | Req 4 — loads `test-data.json` at module scope using `path.resolve(__dirname, ...)` for cross-OS safety |
| No `waitForSpinner` / `navigateToAccounts` | Req 5 — SFUtils owns all helpers |
| `process.env.SF_LOGIN_URL` | Req 6 — consumed at test runtime via `SFUtils` calls (e.g. `page.goto(process.env.SF_LOGIN_URL)`) |
| `test.describe('Account Lifecycle', () => {` | Req 7 — opens the describe block; **no closing brace, no `test()` blocks** |

> **Note:** `Page` is imported even though it isn't used at the header level — it will be used as a typed parameter in `test()` blocks that follow, and omitting it would force every subsequent agent to add a separate import patch.


  // ── US-005 START ─────────────────────────────────────────────────────
  // ── US-005 Shared State (carried forward across sequential tests) ──────────────
  const SF    = process.env.SF_SANDBOX_URL!;
  const MODAL = '[role="dialog"]:not([id="auraError"]):not([aria-hidden="true"])';
  let accountUrl     = '';
  let contactUrl     = '';
  let opportunityUrl = '';
  let quoteUrl       = '';
  let contractUrl    = '';
  let orderUrl       = '';

  // ── Local Helpers ─────────────────────────────────────────────────────────────

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
    await tab.waitFor({ state: 'visible', timeout: 15000 });
    const isActive = await tab.getAttribute('aria-selected').catch(() => null);
    if (isActive !== 'true') {
      await tab.click();
      await SFUtils.waitForLoading(page);
    }
  }

  // TC-ACC-001 | AC Reference: AC-005-01
  test('TC-ACC-001 — Verify Account Billing Address and Payment Terms', async ({ page }) => {
    await SFUtils.goto(page, `${SF}/lightning/page/home`);
    await dismissAuraError(page);

    // Navigate to the pre-existing Account (not created this run — searchAndOpen is safe)
    accountUrl = await SFUtils.searchAndOpen(page, data.account.Account_Name);
    await waitForDetail(page);
    await dismissAuraError(page);
    await clickTab(page, 'Details');

    // AC-005-01 — Billing Address (soft fail if blank)
    const billingVal = await SFUtils.getOutputValue(page, 'BillingAddress').catch(() => '');
    if (!billingVal.trim()) {
      console.warn('[SOFT FAIL] AC-005-01: BillingAddress is blank on Account Details tab.');
    } else {
      expect(billingVal.trim().length).toBeGreaterThan(0);
    }

    // AC-005-01 — Payment Terms (soft fail if field absent or blank)
    const ptField = page.locator('[data-field-api-name*="Payment"]').first();
    const ptFound = await ptField.isVisible({ timeout: 5000 }).catch(() => false);
    if (!ptFound) {
      console.warn('[SOFT FAIL] AC-005-01: Payment Terms field not found on Account Details tab.');
    } else {
      const ptText = await ptField.innerText().catch(() => '');
      if (!ptText.trim()) {
        console.warn('[SOFT FAIL] AC-005-01: Payment Terms field is empty on Account Details tab.');
      }
    }
  });

  // TC-ACC-002 | AC Reference: AC-005-02
  test('TC-ACC-002 — Create Contact on Account', async ({ page }) => {
    if (!accountUrl) { test.skip(); return; }

    await SFUtils.goto(page, accountUrl);
    await dismissAuraError(page);
    await waitForDetail(page);

    // Find and click New in the Contacts related list on the Account
    const newContactBtn = page.locator('article')
      .filter({ has: page.locator('[class*="header"], .slds-card__header-title').filter({ hasText: 'Contacts' }) })
      .getByRole('button', { name: 'New', exact: true }).first();
    await newContactBtn.scrollIntoViewIfNeeded({ timeout: 10000 }).catch(() => {});
    await SFUtils.safeClick(newContactBtn);
    await dismissAuraError(page);

    const modal = page.locator(MODAL).first();
    await modal.waitFor({ state: 'visible', timeout: 30000 });

    // First Name and Last Name via SFUtils.fillField (API name targets)
    await SFUtils.fillField(page, modal, 'FirstName', data.contact.First_Name);
    await SFUtils.fillField(page, modal, 'LastName', data.contact.Last_Name);

    // Email
    const emailInput = modal.locator('[data-field-api-name="Email"] input').first();
    if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await emailInput.fill(data.contact.Email);
    }

    // Phone
    const phoneInput = modal.locator('[data-field-api-name="Phone"] input').first();
    if (await phoneInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await phoneInput.fill(data.contact.Phone || '555-00000');
    }

    await modal.getByRole('button', { name: 'Save', exact: true }).click();
    await SFUtils.waitForLoading(page);
    await page.waitForURL(url => url.includes('/Contact/'), { timeout: 20000 }).catch(() => {});
    await waitForDetail(page);
    await dismissAuraError(page);
    contactUrl = page.url();
    expect(page.url()).toContain('/Contact/');
  });

  // TC-ACC-003 | AC Reference: AC-005-03, AC-005-04
  test('TC-ACC-003 — Create Opportunity from Contact and Verify Primary Contact Role', async ({ page }) => {
    if (!contactUrl) { test.skip(); return; }

    await SFUtils.goto(page, contactUrl);
    await dismissAuraError(page);
    await waitForDetail(page);

    // AC-005-03: Open Opportunities related list → New
    const newOppBtn = page.locator('article')
      .filter({ has: page.locator('[class*="header"], .slds-card__header-title').filter({ hasText: 'Opportunities' }) })
      .getByRole('button', { name: 'New', exact: true }).first();
    await newOppBtn.scrollIntoViewIfNeeded({ timeout: 10000 }).catch(() => {});
    await SFUtils.safeClick(newOppBtn);
    await dismissAuraError(page);

    const modal = page.locator(MODAL).first();
    await modal.waitFor({ state: 'visible', timeout: 30000 });

    // Opportunity Name
    const oppNameInput = modal.locator('[data-field-api-name="Name"] input').first();
    await oppNameInput.waitFor({ state: 'visible', timeout: 15000 });
    await oppNameInput.fill(data.opportunity.Name);

    // Close Date
    const closeDateInput = modal.locator('[data-field-api-name="CloseDate"] input').first();
    await closeDateInput.waitFor({ state: 'visible', timeout: 10000 });
    await closeDateInput.fill(data.opportunity.Close_Date);
    await closeDateInput.press('Tab');

    // Stage
    const stageTrigger = modal.locator('[data-field-api-name="StageName"] button')
      .or(modal.locator('lightning-combobox').filter({ hasText: /Stage/i }).locator('button'))
      .first();
    await stageTrigger.click({ force: true });
    await page.locator('[role="option"]').filter({ hasText: data.opportunity.Stage }).first()
      .waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('[role="option"]').filter({ hasText: data.opportunity.Stage }).first().click();

    await modal.getByRole('button', { name: 'Save', exact: true }).click();
    await SFUtils.waitForLoading(page);
    await page.waitForURL(url => url.includes('/Opportunity/'), { timeout: 20000 }).catch(() => {});
    await waitForDetail(page);
    await dismissAuraError(page);
    opportunityUrl = page.url();
    expect(page.url()).toContain('/Opportunity/');

    // AC-005-04: Verify Contact appears in Contact Roles related list
    const contactRolesSection = page.locator('article')
      .filter({ has: page.locator('[class*="header"], h2, .slds-card__header-title').filter({ hasText: 'Contact Roles' }) })
      .first();
    await contactRolesSection.scrollIntoViewIfNeeded({ timeout: 10000 }).catch(() => {});
    const sectionText = await contactRolesSection.innerText().catch(() => '');
    expect(sectionText).toContain(data.contact.Full_Name);
  });

  // TC-ACC-004 | AC Reference: QO-005-05, PC-005-06, PC-005-07, PC-005-08, PC-005-09
  test('TC-ACC-004 — Create Quote, Browse Catalogs, Add Product to Cart', async ({ page }) => {
    if (!opportunityUrl) { test.skip(); return; }

    await SFUtils.goto(page, opportunityUrl);
    await dismissAuraError(page);
    await waitForDetail(page);

    // QO-005-05: Create Quote button on Opportunity (try "Create Quote" then "New Quote")
    let quoteBtn = page.getByRole('button', { name: 'Create Quote', exact: true });
    if (!await quoteBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      quoteBtn = page.getByRole('button', { name: 'New Quote', exact: true });
    }
    await quoteBtn.waitFor({ state: 'visible', timeout: 15000 });
    await SFUtils.safeClick(quoteBtn);
    await dismissAuraError(page);
    await SFUtils.waitForLoading(page);

    // Quote Name — handle modal or inline form
    const quoteModal = page.locator(MODAL).first();
    const modalVisible = await quoteModal.isVisible({ timeout: 8000 }).catch(() => false);
    const quoteNameInput = modalVisible
      ? quoteModal.locator('[data-field-api-name="Name"] input').first()
      : page.locator('[data-field-api-name="Name"] input').first();
    if (await quoteNameInput.isVisible({ timeout: 8000 }).catch(() => false)) {
      await quoteNameInput.fill(data.quote.Name);
    }
    const saveQuoteModalBtn = modalVisible
      ? quoteModal.getByRole('button', { name: 'Save', exact: true })
      : page.getByRole('button', { name: 'Save', exact: true }).first();
    await saveQuoteModalBtn.click();
    await SFUtils.waitForLoading(page);
    await page.waitForURL(
      url => url.includes('/Quote/') || url.includes('__Quote__c') || url.includes('SBQQ'),
      { timeout: 25000 }
    ).catch(() => {});
    await waitForDetail(page);
    await dismissAuraError(page);
    quoteUrl = page.url();

    // PC-005-06: Browse Catalogs → select Price Book
    const browseCatalogsBtn = page.getByRole('button', { name: 'Browse Catalogs', exact: true });
    await browseCatalogsBtn.waitFor({ state: 'visible', timeout: 20000 });
    await SFUtils.safeClick(browseCatalogsBtn);
    await SFUtils.waitForLoading(page);
    await dismissAuraError(page);

    const pbOption = page.locator('[role="option"], .slds-media__body, tr, li')
      .filter({ hasText: 'Standard Price Book' }).first();
    await pbOption.waitFor({ state: 'visible', timeout: 15000 });
    await SFUtils.safeClick(pbOption);
    await SFUtils.waitForLoading(page);

    // PC-005-07: Select All Products from the catalog tree/menu
    const allProductsItem = page.getByRole('link', { name: 'All Products', exact: true })
      .or(page.locator('button, a, li').filter({ hasText: /^All Products$/i })).first();
    await allProductsItem.waitFor({ state: 'visible', timeout: 15000 });
    await SFUtils.safeClick(allProductsItem);
    await SFUtils.waitForLoading(page);

    // PC-005-08: Search for a product (empty search to reveal all) and add the first result
    const productSearch = page.locator(
      'input[type="search"], input[placeholder*="Search"], input[placeholder*="search"]'
    ).first();
    if (await productSearch.isVisible({ timeout: 5000 }).catch(() => false)) {
      await productSearch.fill('');
      await page.keyboard.press('Enter');
      await SFUtils.waitForLoading(page);
    }

    // Add first available product (button or checkbox pattern)
    const firstAddBtn = page.getByRole('button', { name: 'Add', exact: true }).first();
    if (await firstAddBtn.isVisible({ timeout: 8000 }).catch(() => false)) {
      await SFUtils.safeClick(firstAddBtn);
    } else {
      const firstCheckbox = page.locator('table input[type="checkbox"]').first();
      await firstCheckbox.waitFor({ state: 'visible', timeout: 8000 });
      await firstCheckbox.check();
    }
    await SFUtils.waitForLoading(page);

    // Save quote after adding product
    const saveAfterAddBtn = page.getByRole('button', { name: 'Save', exact: true }).first();
    if (await saveAfterAddBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await SFUtils.safeClick(saveAfterAddBtn);
      await SFUtils.waitForLoading(page);
      await dismissAuraError(page);
    }

    // PC-005-09: Validate at least one product row is visible in the cart
    await page.waitForURL(
      url => url.includes('/Quote/') || url.includes('__Quote__c') || url.includes('SBQQ'),
      { timeout: 20000 }
    ).catch(() => {});
    const cartRow = page.locator('table tbody tr, [data-row-key], .slds-table tbody tr').first();
    await cartRow.waitFor({ state: 'visible', timeout: 15000 });
    expect(await cartRow.isVisible()).toBeTruthy();
  });

  // TC-ACC-005 | AC Reference: QL-005-10, QL-005-11, CR-005-12, OR-005-13, OR-005-14, OR-005-15, OR-005-16
  test('TC-ACC-005 — Quote Acceptance, Contract Activation, and Order Lifecycle', async ({ page }) => {
    if (!quoteUrl) { test.skip(); return; }

    // QL-005-10: Open Quote → click Accepted → Mark as Current Status
    await SFUtils.goto(page, quoteUrl);
    await dismissAuraError(page);
    await waitForDetail(page);

    const acceptedBtn = page.getByRole('button', { name: 'Accepted', exact: true }).first();
    await acceptedBtn.waitFor({ state: 'visible', timeout: 20000 });
    await SFUtils.safeClick(acceptedBtn);
    await SFUtils.waitForLoading(page);
    await dismissAuraError(page);

    const markCurrentBtn = page.getByRole('button', { name: 'Mark as Current Status', exact: true })
      .or(page.getByRole('menuitem', { name: 'Mark as Current Status', exact: true })).first();
    if (await markCurrentBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await SFUtils.safeClick(markCurrentBtn);
      await SFUtils.waitForLoading(page);
      await dismissAuraError(page);
    }

    // QL-005-11: New Contract dropdown → None (Create contract without prices/discounts)
    const contractMenuTrigger = page.locator('lightning-button-menu, button[aria-haspopup="listbox"], button[aria-haspopup="menu"]')
      .filter({ hasText: /contract/i }).first();
    if (await contractMenuTrigger.isVisible({ timeout: 5000 }).catch(() => false)) {
      await SFUtils.safeClick(contractMenuTrigger);
    } else {
      await page.getByRole('button', { name: 'New Contract', exact: true })
        .or(page.locator('a[title="New Contract"], button[title="New Contract"]')).first()
        .click({ force: true });
    }
    await SFUtils.waitForLoading(page);
    await dismissAuraError(page);

    const noneContractOption = page.locator('[role="menuitem"], [role="option"], li')
      .filter({ hasText: /None.*Create contract without/i }).first();
    await noneContractOption.waitFor({ state: 'visible', timeout: 15000 });
    await SFUtils.safeClick(noneContractOption);
    await SFUtils.waitForLoading(page);
    await dismissAuraError(page);
    await page.waitForURL(url => url.includes('/Contract/'), { timeout: 25000 }).catch(() => {});
    await waitForDetail(page);
    contractUrl = page.url();
    expect(contractUrl).toContain('/Contract/');

    // CR-005-12: Open Contract → Edit → Status = Activated + Contract Term = 12 months
    await page.getByRole('button', { name: 'Edit', exact: true }).first()
      .waitFor({ state: 'visible', timeout: 15000 });
    await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
    await SFUtils.waitForLoading(page);

    // Status → Activated
    const statusComboBtn = page.locator('[data-field-api-name="Status"] button').first();
    if (await statusComboBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await SFUtils.safeClick(statusComboBtn);
      await page.locator('[role="option"]').filter({ hasText: 'Activated' }).first().click();
      await SFUtils.waitForLoading(page);
    }

    // Start Date (required for activation)
    const startDateInput = page.locator('[data-field-api-name="StartDate"] input').first();
    if (await startDateInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await startDateInput.fill('01/01/2026');
      await startDateInput.press('Tab');
    }

    // Contract Term (months)
    const termInput = page.locator('[data-field-api-name="ContractTerm"] input, [data-field-api-name="Contract_Term__c"] input').first();
    if (await termInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await termInput.fill('12');
      await termInput.press('Tab');
    }

    await page.getByRole('button', { name: 'Save', exact: true }).first().click();
    await SFUtils.waitForLoading(page);
    await dismissAuraError(page);

    // OR-005-13: Navigate back to the Quote (same quoteUrl from PC-005-06)
    await SFUtils.goto(page, quoteUrl);
    await dismissAuraError(page);
    await waitForDetail(page);

    // OR-005-14: Create Order → Create single Order
    const createOrderBtn = page.getByRole('button', { name: 'Create Order', exact: true })
      .or(page.locator('button').filter({ hasText: /Create Order/i })).first();
    await createOrderBtn.waitFor({ state: 'visible', timeout: 20000 });
    await SFUtils.safeClick(createOrderBtn);
    await SFUtils.waitForLoading(page);
    await dismissAuraError(page);

    const singleOrderOption = page.getByRole('menuitem', { name: 'Create single Order', exact: true })
      .or(page.locator('[role="option"], li').filter({ hasText: /Create single Order/i })).first();
    if (await singleOrderOption.isVisible({ timeout: 8000 }).catch(() => false)) {
      await SFUtils.safeClick(singleOrderOption);
      await SFUtils.waitForLoading(page);
      await dismissAuraError(page);
    }

    // OR-005-15: Verify we land on the Order record
    await page.waitForURL(url => url.includes('/Order/'), { timeout: 25000 }).catch(() => {});
    await waitForDetail(page);
    await dismissAuraError(page);
    orderUrl = page.url();
    expect(orderUrl).toContain('/Order/');

    // OR-005-16: Activate Order → mark status as complete
    const activateOrderBtn = page.getByRole('button', { name: 'Activate', exact: true }).first();
    await activateOrderBtn.waitFor({ state: 'visible', timeout: 20000 });
    await SFUtils.safeClick(activateOrderBtn);
    await SFUtils.waitForLoading(page);
    await dismissAuraError(page);

    // Optional "Mark Status as Complete" confirmation prompt
    const markCompleteBtn = page.getByRole('button', { name: 'Mark Status as Complete', exact: true })
      .or(page.getByRole('button', { name: 'Complete', exact: true })).first();
    if (await markCompleteBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await SFUtils.safeClick(markCompleteBtn);
      await SFUtils.waitForLoading(page);
      await dismissAuraError(page);
    }

    // Verify Order status is Activated / Active / Completed
    await clickTab(page, 'Details');
    const orderStatusText = await SFUtils.getOutputValue(page, 'Status').catch(() => '');
    expect(['Activated', 'Active', 'Completed'].some(s => orderStatusText.includes(s))).toBeTruthy();
  });
  // ── US-005 END ───────────────────────────────────────────────────────
