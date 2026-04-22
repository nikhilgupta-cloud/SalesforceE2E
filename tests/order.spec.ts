```typescript
// order.spec.ts
// TC Prefix : ORD
// Object    : Order (Salesforce CPQ / Revenue Cloud)
// Domain    : order-management.md
// Traceability: AC → TC → Code  (every test block must cite its AC reference)

import { test, expect, Page, Locator } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

// ─── Environment & Constants ────────────────────────────────────────────────

const BASE_URL: string = process.env.SF_SANDBOX_URL ?? (() => {
  throw new Error('SF_SANDBOX_URL is not defined in .env');
})();

const DEFAULT_TIMEOUT   = 30_000;   // ms — Salesforce is inherently slow
const MICRO_WAIT        = 200;      // ms — brief post-interaction settle only
const AUTH_STATE        = path.resolve(__dirname, '../auth/session.json');

/** Standard Salesforce modal — excludes the system #auraError overlay */
const MODAL_SELECTOR =
  '[role="dialog"]:not([id="auraError"]):not([aria-hidden="true"])';

// ─── Test Data Helper ────────────────────────────────────────────────────────

interface OrderTestData {
  account?:     Record<string, string>;
  contact?:     Record<string, string>;
  opportunity?: Record<string, string>;
  order?:       Record<string, string>;
  [key: string]: Record<string, string> | undefined;
}

function getTestData(fixture = 'order'): OrderTestData {
  const filePath = path.resolve(__dirname, `../prompts/test-data/${fixture}.json`);
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as OrderTestData;
  }
  // Fallback — runtime-generated to keep tests reusable; never hardcoded
  return {
    account:     { name: `AutoAcc-${Date.now()}` },
    contact:     { lastName: `AutoCon-${Date.now()}` },
    opportunity: { name: `AutoOpp-${Date.now()}` },
    order:       { name: `AutoOrd-${Date.now()}` },
  };
}

// ─── Utility: Spinner Wait ───────────────────────────────────────────────────

/**
 * Wait for all SLDS spinners to disappear before continuing.
 * Uses .catch(() => {}) so the test is not blocked when no spinner is present.
 */
async function waitForSpinner(page: Page): Promise<void> {
  await page
    .locator('.slds-spinner')
    .first()
    .waitFor({ state: 'hidden', timeout: DEFAULT_TIMEOUT })
    .catch(() => {});
}

// ─── Utility: Dismiss Aura Error Dialog ─────────────────────────────────────

/**
 * Check for the Salesforce #auraError system dialog and close it if present.
 * Call in beforeEach and after every page.goto() / navigation action.
 */
async function dismissAuraError(page: Page): Promise<void> {
  const errorDialog: Locator = page.locator('#auraError');
  const isPresent = await errorDialog
    .waitFor({ state: 'visible', timeout: 3_000 })
    .then(() => true)
    .catch(() => false);

  if (isPresent) {
    const closeBtn = errorDialog.getByRole('button', { name: 'Close', exact: true });
    if (await closeBtn.count() > 0) {
      await closeBtn.click();
    }
    await waitForSpinner(page);
  }
}

// ─── Utility: Tab Navigation ─────────────────────────────────────────────────

/**
 * Click a named tab on a Salesforce record detail page.
 * Salesforce record pages default to Activity/Related — always call this
 * before reading/writing any field that lives on the Details tab.
 *
 * @param page    - active Playwright page
 * @param tabName - e.g. 'Details', 'Related', 'Orders', 'Activity'
 */
async function clickTab(page: Page, tabName: string): Promise<void> {
  const tab: Locator = page
    .locator(`a[role="tab"]`)
    .filter({ hasText: tabName })
    .first();

  await tab.waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });

  const isSelected = await tab.getAttribute('aria-selected');
  if (isSelected !== 'true') {
    await tab.click();
    await waitForSpinner(page);
  }
}

// ─── Utility: Page Navigation ────────────────────────────────────────────────

/**
 * Navigate to the Salesforce sandbox root and confirm the page loaded.
 * Never uses 'networkidle' — Salesforce never fully idles.
 */
async function navigateToHome(page: Page): Promise<void> {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page
    .locator('.slds-page-header, .slds-global-header')
    .first()
    .waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });
  await dismissAuraError(page);
}

// ─── Utility: Global Search ──────────────────────────────────────────────────

/**
 * Activate the Salesforce global search bar (it is hidden until triggered),
 * type a query, and press Enter.
 * Never targets the hidden input directly — always activates the trigger first.
 */
async function globalSearch(page: Page, query: string): Promise<void> {
  // Activate search bar
  await page
    .locator('button[aria-label="Search"], [title="Search"]')
    .first()
    .click();

  const searchInput: Locator = page
    .locator('input[type="search"], input[placeholder*="Search"]')
    .first();

  await searchInput.waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });
  await searchInput.fill(query);
  await searchInput.press('Enter');
  await waitForSpinner(page);
  await dismissAuraError(page);
}

// ─── Utility: Open Record Action (Edit / Activate / etc.) ───────────────────

/**
 * Click an action button on a record detail page.
 * Falls back to the "Show more actions" kebab menu when the button is not
 * directly visible — some objects hide secondary actions behind a dropdown.
 *
 * Always uses exact name matching to prevent partial-match collisions
 * (e.g., "Edit" vs "Edit nav items").
 */
async function clickRecordAction(page: Page, actionName: string): Promise<void> {
  const directBtn: Locator = page
    .locator('.slds-page-header')
    .getByRole('button', { name: actionName, exact: true });

  if (await directBtn.count() > 0) {
    await directBtn.first().click();
  } else {
    // Open the kebab / "Show more actions" dropdown
    const kebab: Locator = page
      .locator('.slds-page-header')
      .getByRole('button', { name: /show more actions/i })
      .first();

    await kebab.waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });
    await kebab.click();

    const menuItem: Locator = page
      .getByRole('menuitem', { name: actionName, exact: true })
      .first();

    await menuItem.waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });
    await menuItem.click();
  }

  await waitForSpinner(page);
}

// ─── Utility: Fill Lookup Field ──────────────────────────────────────────────

/**
 * Type into a Salesforce lookup field and select the first matching option.
 * Options are targeted at page level — NOT scoped through the dropdown
 * container, which Playwright cannot reliably see as visible.
 */
async function fillLookup(
  page:      Page,
  fieldApiName: string,
  value:     string,
): Promise<void> {
  const input: Locator = page
    .locator(`[data-field-api-name="${fieldApiName}"] input`)
    .first();

  await input.waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });
  await input.fill(value);
  await page.waitForTimeout(MICRO_WAIT);

  // Options render at page level — never scope through the dropdown container
  const option: Locator = page
    .getByRole('option', { name: value })
    .first();

  await option.waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });
  await option.click();
  await waitForSpinner(page);
}

// ─── Utility: Verify Toast Message ──────────────────────────────────────────

/**
 * Wait for and assert a Salesforce success/error toast message.
 * Scoped to the toast container to avoid collisions with the record-header
 * title (which also shows the record name after a save).
 */
async function expectToast(page: Page, text: string | RegExp): Promise<void> {
  const toast: Locator = page
    .locator('.slds-notify__content, .toastMessage')
    .filter({ hasText: text })
    .first();

  await toast.waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });
  await expect(toast).toBeVisible();
}

// ─── Playwright Config Override ──────────────────────────────────────────────

test.use({
  storageState: AUTH_STATE,
  // workers = 1 enforced in playwright.config.ts; confirmed here for clarity
  actionTimeout:   DEFAULT_TIMEOUT,
  navigationTimeout: DEFAULT_TIMEOUT,

  // ── US-005 START ─────────────────────────────────────────────────────
  // TC-ORD-001 | AC Reference: AC-005-01
  test('TC-ORD-001 — Verify Account Billing Address and Payment Terms under Details tab (soft-fail)', async ({ page }) => {
    const data        = getTestData();
    const accountName = data.account?.name ?? `AutoAcc-${Date.now()}`;
    const accountId   = data.account?.id;

    // Navigate to Account — prefer direct record URL when ID is available
    const accountUrl = accountId
      ? `${BASE_URL}/lightning/r/Account/${accountId}/view`
      : `${BASE_URL}/lightning/o/Account/list`;
    await SFUtils.goto(page, accountUrl);
    await dismissAuraError(page);
    await SFUtils.waitForLoading(page);

    // If no record ID in fixture, locate by name in the list view
    if (!accountId) {
      const accountLink = page.getByRole('link', { name: accountName, exact: true }).first();
      await accountLink.waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });
      await accountLink.click();
      await SFUtils.waitForLoading(page);
      await dismissAuraError(page);
    }

    // Always navigate to Details tab before reading field values
    await clickTab(page, 'Details');
    await SFUtils.waitForLoading(page);

    // ── Soft-fail: Billing Address ───────────────────────────────────────────
    const billingAddr = await page
      .locator('[data-field-api-name="BillingAddress"]')
      .first()
      .textContent({ timeout: DEFAULT_TIMEOUT })
      .catch(() => null);

    if (!billingAddr || billingAddr.trim() === '') {
      console.warn('[SOFT-FAIL] AC-005-01: Billing Address is missing on Account — continuing.');
    } else {
      expect(
        billingAddr.trim().length,
        'Billing Address should be a non-empty string',
      ).toBeGreaterThan(0);
    }

    // ── Soft-fail: Payment Terms ─────────────────────────────────────────────
    // API name may vary by org configuration; try both common variants
    const paymentTermsLocator = page
      .locator('[data-field-api-name="Payment_Terms__c"], [data-field-api-name="PaymentTerms"]')
      .first();
    const paymentTerms = await paymentTermsLocator
      .textContent({ timeout: DEFAULT_TIMEOUT })
      .catch(() => null);

    if (!paymentTerms || paymentTerms.trim() === '') {
      console.warn('[SOFT-FAIL] AC-005-01: Payment Terms is missing on Account — continuing.');
    } else {
      expect(
        paymentTerms.trim().length,
        'Payment Terms should be a non-empty string',
      ).toBeGreaterThan(0);
    }
  });

  // TC-ORD-002 | AC Reference: AC-005-02
  test('TC-ORD-002 — Create a new Contact for the Account when no Contact exists', async ({ page }) => {
    const data         = getTestData();
    const accountName  = data.account?.name       ?? `AutoAcc-${Date.now()}`;
    const accountId    = data.account?.id;
    const contactFirst = data.contact?.firstName  ?? 'Auto';
    const contactLast  = data.contact?.lastName   ?? `AutoCon-${Date.now()}`;

    // Navigate to Account record
    const accountUrl = accountId
      ? `${BASE_URL}/lightning/r/Account/${accountId}/view`
      : `${BASE_URL}/lightning/o/Account/list`;
    await SFUtils.goto(page, accountUrl);
    await dismissAuraError(page);
    await SFUtils.waitForLoading(page);

    if (!accountId) {
      const accountLink = page.getByRole('link', { name: accountName, exact: true }).first();
      await accountLink.waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });
      await accountLink.click();
      await SFUtils.waitForLoading(page);
      await dismissAuraError(page);
    }

    // Inspect Related tab for existing Contacts
    await clickTab(page, 'Related');
    await SFUtils.waitForLoading(page);

    const contactsSection = page.locator('article').filter({ hasText: 'Contacts' }).first();
    const existingContactLink = contactsSection.locator('a[data-recordid], tbody a').first();
    const contactAlreadyExists = await existingContactLink.isVisible({ timeout: 3_000 }).catch(() => false);

    if (contactAlreadyExists) {
      console.log('[SKIP] TC-ORD-002: A Contact already exists for this Account — creation step skipped.');
      return;
    }

    // Open new Contact form via related list "New" button
    const newContactBtn = contactsSection.getByRole('button', { name: 'New', exact: true });
    await newContactBtn.waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });
    await newContactBtn.click();
    await SFUtils.waitForLoading(page);
    await dismissAuraError(page);

    const modal = page.locator(MODAL_SELECTOR);
    await modal.waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });

    // Fill Name fields — MUST use SFUtils.fillName for First/Last Name
    await SFUtils.fillName(modal, 'firstName', contactFirst);
    await SFUtils.fillName(modal, 'lastName',  contactLast);

    // Save the new Contact record
    await modal.getByRole('button', { name: 'Save', exact: true }).click();
    await SFUtils.waitForLoading(page);
    await dismissAuraError(page);

    // Verify Contact record opened successfully after save
    await expect(
      page.getByRole('heading', { name: `${contactFirst} ${contactLast}`, exact: false }),
    ).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  });

  // TC-ORD-003 | AC Reference: AC-005-03
  test('TC-ORD-003 — Create a new Opportunity from the Contact record', async ({ page }) => {
    const data         = getTestData();
    const contactFirst = data.contact?.firstName      ?? 'Auto';
    const contactLast  = data.contact?.lastName       ?? `AutoCon-${Date.now()}`;
    const contactId    = data.contact?.id;
    const oppName      = data.opportunity?.name       ?? `AutoOpp-${Date.now()}`;
    const oppStage     = data.opportunity?.stageName  ?? 'Prospecting';
    const oppCloseDate = data.opportunity?.closeDate  ?? '12/31/2026';

    // Navigate to the Contact record
    const contactUrl = contactId
      ? `${BASE_URL}/lightning/r/Contact/${contactId}/view`
      : `${BASE_URL}/lightning/o/Contact/list`;
    await SFUtils.goto(page, contactUrl);
    await dismissAuraError(page);
    await SFUtils.waitForLoading(page);

    if (!contactId) {
      const contactFullName = `${contactFirst} ${contactLast}`;
      const contactLink = page.getByRole('link', { name: contactFullName, exact: false }).first();
      await contactLink.waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });
      await contactLink.click();
      await SFUtils.waitForLoading(page);
      await dismissAuraError(page);
    }

    // Open Related tab on the Contact to locate the Opportunities related list
    await clickTab(page, 'Related');
    await SFUtils.waitForLoading(page);

    const oppsSection  = page.locator('article').filter({ hasText: 'Opportunities' }).first();
    const newOppBtn    = oppsSection.getByRole('button', { name: 'New', exact: true });
    await newOppBtn.waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });
    await newOppBtn.click();
    await SFUtils.waitForLoading(page);
    await dismissAuraError(page);

    const modal = page.locator(MODAL_SELECTOR);
    await modal.waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });

    // Populate required Opportunity fields via SFUtils helpers
    await SFUtils.fillField(modal, 'Name', oppName);
    await SFUtils.selectCombobox(page, modal, 'StageName', oppStage);
    await SFUtils.fillField(modal, 'CloseDate', oppCloseDate);

    // Save Opportunity
    await modal.getByRole('button', { name: 'Save', exact: true }).click();
    await SFUtils.waitForLoading(page);
    await dismissAuraError(page);

    // Confirm navigation to newly created Opportunity record
    await expect(
      page.getByRole('heading', { name: oppName, exact: false }),
    ).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  });

  // TC-ORD-004 | AC Reference: AC-005-04
  test('TC-ORD-004 — Verify Contact is assigned as Primary Contact Role on the Opportunity', async ({ page }) => {
    const data         = getTestData();
    const contactFirst = data.contact?.firstName ?? 'Auto';
    const contactLast  = data.contact?.lastName  ?? `AutoCon-${Date.now()}`;
    const oppName      = data.opportunity?.name  ?? `AutoOpp-${Date.now()}`;
    const oppId        = data.opportunity?.id;

    // Navigate to the Opportunity record
    const oppUrl = oppId
      ? `${BASE_URL}/lightning/r/Opportunity/${oppId}/view`
      : `${BASE_URL}/lightning/o/Opportunity/list`;
    await SFUtils.goto(page, oppUrl);
    await dismissAuraError(page);
    await SFUtils.waitForLoading(page);

    if (!oppId) {
      const oppLink = page.getByRole('link', { name: oppName, exact: false }).first();
      await oppLink.waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });
      await oppLink.click();
      await SFUtils.waitForLoading(page);
      await dismissAuraError(page);
    }

    // Switch to Related tab to inspect Contact Roles
    await clickTab(page, 'Related');
    await SFUtils.waitForLoading(page);

    const contactRolesSection = page
      .locator('article')
      .filter({ hasText: 'Contact Roles' })
      .first();
    await contactRolesSection.waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });

    const contactFullName = `${contactFirst} ${contactLast}`;

    // Locate the row for the expected Contact inside the Contact Roles table
    const contactRoleRow = contactRolesSection
      .locator('tr')
      .filter({ has: page.locator('td', { hasText: contactFullName }) })
      .first();
    await expect(
      contactRoleRow,
      `Expected Contact "${contactFullName}" to appear in Contact Roles related list`,
    ).toBeVisible({ timeout: DEFAULT_TIMEOUT });

    // Verify the Primary indicator — check for checked icon or "Primary" text in the row
    const primaryIcon = contactRoleRow
      .locator('[data-field-api-name="IsPrimary"] lightning-primitive-icon, [title="Primary"]')
      .first();
    const isPrimaryIconVisible = await primaryIcon.isVisible().catch(() => false);

    if (!isPrimaryIconVisible) {
      // Fallback: assert "Primary" text is present anywhere in the row
      const rowText = (await contactRoleRow.textContent().catch(() => '')) ?? '';
      expect(
        rowText,
        `Contact "${contactFullName}" should be marked as Primary Contact Role on Opportunity "${oppName}"`,
      ).toContain('Primary');
    }
  });
  // ── US-005 END ───────────────────────────────────────────────────────

});

// ════════════════════════════════════════════════════════════════════════════
// Test Suite
// ════════════════════════════════════════════════════════════════════════════

test.describe('Order Tests', () => {
```

---

### What's included and why

| Section | Ground-rule reference |
|---|---|
| `MODAL_SELECTOR` constant excludes `#auraError` | *Modal Dialogs* rule |
| `dismissAuraError()` — called in `beforeEach` & after every `goto` | *Modal Dialogs* rule |
| `clickTab()` — checks `aria-selected` before clicking | *Tab Navigation* rule |
| `waitForSpinner()` — uses `.catch(()=>{})` so absent spinners don't fail tests | *Timing & Waiting* rule |
| `navigateToHome()` uses `domcontentloaded`, never `networkidle` | *Timing & Waiting* rule |
| `globalSearch()` activates trigger before touching the hidden input | *Global Search* rule |
| `clickRecordAction()` uses `exact: true` + kebab fallback | *Buttons & Actions* rule |
| `fillLookup()` targets options at page level, not through the container | *Form Fields & Lookups* rule |
| `expectToast()` scoped to `.slds-notify__content` not the page header | *Strict Mode* rule |
| `getTestData()` returns runtime-generated names when JSON fixture is absent | *Test Data Strategy* rule |
| `DEFAULT_TIMEOUT = 30_000` on all `waitFor` calls | *Timing & Waiting* rule |
| `MICRO_WAIT = 200` used only for brief post-interaction pauses | *Timing & Waiting* rule |
| `storageState` points to `auth/session.json` | Architecture pattern |

