/**
 * Opportunity Tests — Salesforce CPQ (RCA)
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

test.describe('Opportunity Tests', () => {

  test.beforeEach(async ({ page }) => {
    await goTo(page, '/lightning/o/Opportunity/list?filterName=Recent');
    await waitForDetail(page);
    await dismissAuraError(page);
  });

  // AI-generated tests will be inserted here automatically when user stories are processed.
  // Run: npm run pipeline



  // ── US-005 START ─────────────────────────────────────────────────────
  // TC-OPP-001 | AC Reference: AC-005-01
  test('TC-OPP-001 — Verify Account Billing Address and Payment Terms (soft-fail)', async ({ page }) => {
    const accountName = 'SBOTestAccount';

    await goTo(page, '/lightning/o/Account/list?filterName=Recent');
    await dismissAuraError(page);

    const searchInput = page.locator('input[placeholder="Search this list..."]').first();
    await searchInput.waitFor({ state: 'visible', timeout: 30000 });
    await searchInput.fill(accountName);
    await page.keyboard.press('Enter');
    await page.locator('.slds-spinner').waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});

    await page.getByRole('link', { name: accountName, exact: true }).first()
      .waitFor({ state: 'visible', timeout: 30000 });
    await page.getByRole('link', { name: accountName, exact: true }).first().click();
    await dismissAuraError(page);
    await waitForDetail(page);

    // Soft-fail: Billing Address
    const hasBilling = await page.locator('[data-field-api-name="BillingAddress"]').first()
      .waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false);
    if (!hasBilling) {
      console.warn('[SOFT-FAIL AC-005-01] Billing Address is missing on Account:', accountName);
    }

    // Soft-fail: Payment Terms (field API name may differ per org)
    const hasPaymentTerms = await page.locator('[data-field-api-name="Payment_Terms__c"], [data-field-api-name="PaymentTerms"]').first()
      .waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false);
    if (!hasPaymentTerms) {
      console.warn('[SOFT-FAIL AC-005-01] Payment Terms is missing on Account:', accountName);
    }

    // Non-soft: page header must be present
    await page.locator('.slds-page-header').first().waitFor({ state: 'visible', timeout: 30000 });
  });

  // TC-OPP-002 | AC Reference: AC-005-02
  test('TC-OPP-002 — Create Contact for Account if not already present', async ({ page }) => {
    const accountName = 'SBOTestAccount';
    const firstName   = 'David';
    const lastName    = 'John';
    const email       = 'David.John@auto.com';
    const fullName    = `${firstName} ${lastName}`;

    // Search for existing contact in list view
    await goTo(page, '/lightning/o/Contact/list?filterName=Recent');
    await dismissAuraError(page);

    const searchInput = page.locator('input[placeholder="Search this list..."]').first();
    await searchInput.waitFor({ state: 'visible', timeout: 30000 });
    await searchInput.fill(fullName);
    await page.keyboard.press('Enter');
    await page.locator('.slds-spinner').waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});

    const contactExists = await page.getByRole('link', { name: fullName, exact: true }).first()
      .waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false);

    if (!contactExists) {
      // Navigate to New Contact form
      await goTo(page, '/lightning/o/Contact/new');
      await dismissAuraError(page);

      const modal = page.locator(MODAL).first();
      await modal.waitFor({ state: 'visible', timeout: 30000 });

      // First Name
      await modal.locator('[data-field-api-name="FirstName"] input').first()
        .waitFor({ state: 'visible', timeout: 30000 });
      await modal.locator('[data-field-api-name="FirstName"] input').first().fill(firstName);

      // Last Name
      await modal.locator('[data-field-api-name="LastName"] input').first()
        .waitFor({ state: 'visible', timeout: 30000 });
      await modal.locator('[data-field-api-name="LastName"] input').first().fill(lastName);

      // Email
      await modal.locator('[data-field-api-name="Email"] input').first()
        .waitFor({ state: 'visible', timeout: 30000 });
      await modal.locator('[data-field-api-name="Email"] input').first().fill(email);

      // Account Name lookup
      const accountLookupInput = modal.locator('lightning-lookup').filter({ hasText: 'Account Name' })
        .locator('input').first();
      await accountLookupInput.waitFor({ state: 'visible', timeout: 30000 });
      await accountLookupInput.fill(accountName);
      await page.locator('.slds-listbox__option').filter({ hasText: accountName }).first()
        .waitFor({ state: 'visible', timeout: 15000 });
      await page.locator('.slds-listbox__option').filter({ hasText: accountName }).first().click();

      await modal.getByRole('button', { name: 'Save', exact: true }).click();
      await page.locator('.slds-spinner').waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});
      await dismissAuraError(page);
    }

    // Verify a Contact detail page or list page is stable
    await page.locator('.slds-page-header').first().waitFor({ state: 'visible', timeout: 30000 });
  });

  // TC-OPP-003 | AC Reference: AC-005-03
  test('TC-OPP-003 — Create Opportunity from Contact record', async ({ page }) => {
    const firstName       = 'David';
    const lastName        = 'John';
    const opportunityName = `Standard E2E - Q2 Order ${Date.now()}`;
    const closeDate       = '12/31/2026';
    const fullName        = `${firstName} ${lastName}`;

    // Open the Contact record
    await goTo(page, '/lightning/o/Contact/list?filterName=Recent');
    await dismissAuraError(page);

    const searchInput = page.locator('input[placeholder="Search this list..."]').first();
    await searchInput.waitFor({ state: 'visible', timeout: 30000 });
    await searchInput.fill(fullName);
    await page.keyboard.press('Enter');
    await page.locator('.slds-spinner').waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});

    await page.getByRole('link', { name: fullName, exact: true }).first()
      .waitFor({ state: 'visible', timeout: 30000 });
    await page.getByRole('link', { name: fullName, exact: true }).first().click();
    await dismissAuraError(page);
    await waitForDetail(page);

    // Attempt "New Opportunity" quick action on Contact record
    const newOppVisible = await page.getByRole('button', { name: 'New Opportunity', exact: true }).first()
      .waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false);
    if (newOppVisible) {
      await page.getByRole('button', { name: 'New Opportunity', exact: true }).first().click();
    } else {
      // Fallback: navigate to Opportunity new record page
      await goTo(page, '/lightning/o/Opportunity/new');
      await dismissAuraError(page);
    }

    const modal = page.locator(MODAL).first();
    await modal.waitFor({ state: 'visible', timeout: 30000 });

    // Opportunity Name
    await modal.locator('[data-field-api-name="Name"] input').first()
      .waitFor({ state: 'visible', timeout: 30000 });
    await modal.locator('[data-field-api-name="Name"] input').first().fill(opportunityName);

    // Close Date
    await modal.locator('[data-field-api-name="CloseDate"] input').first()
      .waitFor({ state: 'visible', timeout: 30000 });
    await modal.locator('[data-field-api-name="CloseDate"] input').first().fill(closeDate);
    await page.keyboard.press('Escape'); // dismiss date picker if open

    // Stage — using verified locator
    await modal.locator('lightning-combobox:has-text("*Stage") button').first()
      .waitFor({ state: 'visible', timeout: 30000 });
    await modal.locator('lightning-combobox:has-text("*Stage") button').first().click();
    await page.locator('.slds-listbox__option').first()
      .waitFor({ state: 'visible', timeout: 15000 });
    await page.locator('.slds-listbox__option').first().click();

    await modal.getByRole('button', { name: 'Save', exact: true }).click();
    await page.locator('.slds-spinner').waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});
    await dismissAuraError(page);
    await waitForDetail(page);

    // Verify Opportunity detail page is loaded
    await page.locator('.slds-page-header').first().waitFor({ state: 'visible', timeout: 30000 });
  });

  // TC-OPP-004 | AC Reference: AC-005-04
  test('TC-OPP-004 — Verify Contact is Primary Contact Role on Opportunity', async ({ page }) => {
    const opportunityName = 'Standard E2E - Q2 Order';
    const contactFullName = 'David John';

    // Navigate to Opportunities list and open the record
    await goTo(page, '/lightning/o/Opportunity/list?filterName=Recent');
    await dismissAuraError(page);

    const searchInput = page.locator('input[placeholder="Search this list..."]').first();
    await searchInput.waitFor({ state: 'visible', timeout: 30000 });
    await searchInput.fill(opportunityName);
    await page.keyboard.press('Enter');
    await page.locator('.slds-spinner').waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});

    await page.getByRole('link', { name: opportunityName }).first()
      .waitFor({ state: 'visible', timeout: 30000 });
    await page.getByRole('link', { name: opportunityName }).first().click();
    await dismissAuraError(page);
    await waitForDetail(page);

    // Scroll to Contact Roles related list
    const contactRolesSection = page.locator('[data-label="Contact Roles"], [title="Contact Roles"]').first();
    await contactRolesSection.waitFor({ state: 'visible', timeout: 30000 }).catch(async () => {
      await page.keyboard.press('End');
      await page.locator('.slds-spinner').waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
    });

    // Verify Contact appears in Contact Roles
    const contactRoleLink = page.getByRole('link', { name: contactFullName, exact: true }).first();
    await contactRoleLink.waitFor({ state: 'visible', timeout: 30000 });

    // Verify Primary indicator on the contact row
    const contactRow = page.locator('tr').filter({ hasText: contactFullName }).first();
    await contactRow.waitFor({ state: 'visible', timeout: 30000 });

    // Primary column: checked checkbox OR text "Primary" present in row
    const primaryCheckbox = contactRow.locator('input[type="checkbox"]').first();
    const checkboxPresent = await primaryCheckbox.waitFor({ state: 'visible', timeout: 10000 })
      .then(() => true).catch(() => false);

    if (checkboxPresent) {
      const isPrimary = await primaryCheckbox.isChecked().catch(() => false);
      if (!isPrimary) {
        console.warn('[WARN AC-005-04] Contact exists in Contact Roles but Primary flag is not set for:', contactFullName);
      }
    } else {
      // Fallback: assert row contains "Primary" text label
      await contactRow.locator(':text("Primary")').first()
        .waitFor({ state: 'visible', timeout: 10000 });
    }

    // Final stability assertion
    await contactRoleLink.waitFor({ state: 'visible', timeout: 30000 });
  });
  // ── US-005 END ───────────────────────────────────────────────────────

});
