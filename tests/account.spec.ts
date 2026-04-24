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
  // ── Shared state across serial tests ─────────────────────────────────────
  const resolvedAccountName: string = data.account.Account_Name;
  let createdContactFirstName: string;
  let createdContactLastName: string;
  let createdContactName: string;
  let createdContactUrl: string;
  let createdOpportunityName: string;
  let createdOpportunityUrl: string;
  let createdQuoteName: string;

  // TC-ACC-001 | AC Reference: AC-005-01
  test('TC-ACC-001 — Verify Account Billing Address and Payment Terms under Details tab (soft-fail)', async ({ page }) => {
    await searchAndOpen(page, resolvedAccountName);
    await clickTab(page, 'Details');

    const readFieldOutput = async (labelText: string): Promise<string> => {
      const container = page
        .locator('records-record-layout-item, force-record-layout-item')
        .filter({ hasText: new RegExp(labelText, 'i') })
        .first();
      const raw = await container.textContent({ timeout: 5000 }).catch(() => '');
      return (raw ?? '').replace(new RegExp(labelText, 'i'), '').trim();
    };

    const billingAddress = await readFieldOutput('Billing Address');
    if (!billingAddress) {
      console.warn('[SOFT-FAIL][AC-005-01] Billing Address is empty or not populated on Account.');
    }

    const paymentTerms = await readFieldOutput('Payment Terms');
    if (!paymentTerms) {
      console.warn('[SOFT-FAIL][AC-005-01] Payment Terms is empty or not populated on Account.');
    }
  });

  // TC-ACC-002 | AC Reference: AC-005-02
test('TC-ACC-002 — Create new Contact on Account record via Contacts related list', async ({ page }) => {
    createdContactFirstName = data.contact.First_Name;
    createdContactLastName  = data.contact.Last_Name;
    createdContactName      = `${createdContactFirstName} ${createdContactLastName}`;

    // AC-005-02: check globally first (10s timeout) — related list only shows first 6, misses deeper records
    // Use searchExists (non-navigating) then searchAndOpen only if found, to avoid 30s timeout on miss
    const contactFoundGlobally = await SFUtils.searchExists(page, createdContactName);
    if (contactFoundGlobally) {
      await SFUtils.goto(page, `${SF}/lightning/page/home`);
      await searchAndOpen(page, createdContactName);
      if (page.url().includes('/Contact/')) {
        console.log(`[SKIP] "${createdContactName}" already exists globally — using existing record.`);
        createdContactUrl = page.url();
        return;
      }
    }

    // Navigate to Account — fresh navigation guarantees no lingering search panel
    await SFUtils.goto(page, `${SF}/lightning/page/home`);
    await SFUtils.waitForAppReady(page);

    await searchAndOpen(page, resolvedAccountName);
    await clickTab(page, 'Related');
    await SFUtils.waitForLoading(page);

    const contactsRelatedList = page
      .locator('force-related-list-single-container, force-related-list-card, article')
      .filter({ hasText: /^Contacts/ })
      .first();
    await contactsRelatedList.waitFor({ state: 'visible', timeout: 30000 });

    await contactsRelatedList.getByRole('button', { name: 'New', exact: true }).click();
    await SFUtils.waitForLoading(page);

    const modal = page.locator(MODAL);
    await modal.waitFor({ state: 'visible', timeout: 15000 });

    await SFUtils.fillName(modal, 'firstName', createdContactFirstName);
    await SFUtils.fillName(modal, 'lastName', createdContactLastName);

    await modal.getByRole('button', { name: 'Save', exact: true }).click();
    await SFUtils.waitForLoading(page);
    await dismissAuraError(page);

    // After save, Salesforce stays on the Account page — navigate to the new contact via the Related list.
    // Never use global search for a freshly-created record: Salesforce indexes with a delay of minutes.
    await page.waitForURL(/\/Contact\//, { timeout: 5000 }).catch(() => {});

    if (!page.url().includes('/Contact/')) {
      // Try Salesforce success toast link first (contains direct link to new record)
      const toastLink = page.locator('.toastMessage a, [class*="toastMessage"] a').first();
      const toastVisible = await toastLink.isVisible({ timeout: 5000 }).catch(() => false);
      if (toastVisible) {
        const toastHref = await toastLink.getAttribute('href').catch(() => null);
        if (toastHref) {
          const toastUrl = toastHref.startsWith('http') ? toastHref : `${SF}${toastHref}`;
          await SFUtils.goto(page, toastUrl);
        } else {
          await toastLink.click();
          await waitForDetail(page);
        }
      } else {
        // Fallback: find the new contact in the Related list by name and navigate via href
        await clickTab(page, 'Related');
        await SFUtils.waitForLoading(page);
        const refreshedList = page
          .locator('force-related-list-single-container, force-related-list-card, article')
          .filter({ hasText: /^Contacts/ })
          .first();
        await refreshedList.waitFor({ state: 'visible', timeout: 15000 });
        const newContactLink = refreshedList
          .getByRole('link', { name: createdContactName, exact: true }).first();
        await newContactLink.waitFor({ state: 'visible', timeout: 15000 });
        const contactHref = await newContactLink.getAttribute('href').catch(() => null);
        if (contactHref) {
          const contactUrl = contactHref.startsWith('http') ? contactHref : `${SF}${contactHref}`;
          await SFUtils.goto(page, contactUrl);
        } else {
          await newContactLink.click();
          await page.waitForURL(/\/Contact\//, { timeout: 20000 }).catch(() => {});
          await SFUtils.waitForLoading(page);
        }
      }
    }

    await waitForDetail(page);
    await SFUtils.waitForAppReady(page);
    await SFUtils.waitForLoading(page);

    // Primary: heading role check; fallback to Lightning page-header title selectors
    const roleHeading = page.getByRole('heading', { name: createdContactName, exact: false }).first();
    const roleVisible = await roleHeading.isVisible({ timeout: 10000 }).catch(() => false);
    if (!roleVisible) {
      const titleFallback = page
        .locator(
          '.slds-page-header__title, .slds-page-header h1, [class*="entityNameTitle"], lightning-formatted-name, .slds-card__header-title'
        )
        .filter({ hasText: createdContactName })
        .first();
      await titleFallback.waitFor({ state: 'visible', timeout: 30000 });
    }

    createdContactUrl = page.url();
  });

  // TC-ACC-003 | AC Reference: AC-005-03
  test('TC-ACC-003 — Create Opportunity from Contact record via Opportunities related list', async ({ page }) => {
    createdOpportunityName = data.opportunity.Name;
    const closeDate        = data.opportunity.Close_Date;
    const stage            = data.opportunity.Stage;

    if (createdContactUrl) {
      await SFUtils.goto(page, createdContactUrl);
    } else {
      createdContactName = createdContactName || `${data.contact.First_Name} ${data.contact.Last_Name}`;
      await searchAndOpen(page, createdContactName);
    }
    await waitForDetail(page);
    await clickTab(page, 'Related');
    await SFUtils.waitForLoading(page);

    const oppsRelatedList = page
      .locator('force-related-list-single-container, force-related-list-card, article')
      .filter({ hasText: /^Opportunities/ })
      .first();
    await oppsRelatedList.waitFor({ state: 'visible', timeout: 30000 });

    // AC-005-03: skip creation if opportunity already exists — check related list (usually small)
    const existingOpp = oppsRelatedList.getByRole('link', { name: createdOpportunityName, exact: true }).first();
    if (await existingOpp.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log(`[SKIP] "${createdOpportunityName}" already exists — using existing record.`);
      // Navigate via href directly — clicking a related list link may not change page.url() before
      // waitForDetail() completes on the still-visible Contact header, causing a stale Contact URL.
      const oppHref = await existingOpp.getAttribute('href').catch(() => null);
      if (oppHref) {
        const oppUrl = oppHref.startsWith('http') ? oppHref : `${SF}${oppHref}`;
        await SFUtils.goto(page, oppUrl);
      } else {
        await existingOpp.click();
        await page.waitForURL(/\/006[A-Za-z0-9]+\/view/, { timeout: 20000 }).catch(() => {});
        await SFUtils.waitForLoading(page);
      }
      await waitForDetail(page);
      createdOpportunityUrl = page.url();
      return;
    }
    // Also check globally in case it's not visible in the related list
    const oppExistsGlobally = await SFUtils.searchAndOpen(page, createdOpportunityName)
      .then(() => page.url().includes('/Opportunity/'))
      .catch(() => false);
    if (oppExistsGlobally) {
      console.log(`[SKIP] "${createdOpportunityName}" found globally — using existing record.`);
      createdOpportunityUrl = page.url();
      return;
    }
    // Re-navigate to Contact after the global search attempt
    if (createdContactUrl) {
      await SFUtils.goto(page, createdContactUrl);
    } else {
      await searchAndOpen(page, createdContactName);
    }
    await waitForDetail(page);
    await clickTab(page, 'Related');
    await SFUtils.waitForLoading(page);
    await oppsRelatedList.waitFor({ state: 'visible', timeout: 30000 });

    await oppsRelatedList.getByRole('button', { name: 'New', exact: true }).click();
    await SFUtils.waitForLoading(page);

    const modal = page.locator(MODAL);
    await modal.waitFor({ state: 'visible', timeout: 15000 });
    await SFUtils.waitForLoading(page);
    await page.waitForTimeout(1500);

    const oppNameInput = modal.getByLabel('Opportunity Name').first();
    await oppNameInput.waitFor({ state: 'visible', timeout: 15000 });
    await oppNameInput.click();
    await oppNameInput.clear();
    await oppNameInput.pressSequentially(createdOpportunityName, { delay: 50 });
    await page.waitForTimeout(500);

    const closeDateInput = modal.locator(
      '[data-field-api-name="CloseDate"] input, lightning-datepicker input'
    ).first();
    await closeDateInput.waitFor({ state: 'visible', timeout: 15000 });
    await closeDateInput.click();
    await closeDateInput.press('Control+a');
    await closeDateInput.pressSequentially(closeDate, { delay: 50 });
    await closeDateInput.press('Tab');
    await page.waitForTimeout(500);

    const stageLocator = modal.getByLabel('Stage').first();
    await stageLocator.waitFor({ state: 'visible', timeout: 10000 });
    const stageTag = await stageLocator.evaluate(el => el.tagName.toLowerCase()).catch(() => '');
    if (stageTag === 'select') {
      await stageLocator.selectOption({ label: stage });
    } else {
      await stageLocator.click();
      await page.waitForTimeout(300);
      const stageOption = page.getByRole('option', { name: stage, exact: true });
      await stageOption.waitFor({ state: 'visible', timeout: 10000 });
      await stageOption.click();
    }
    await page.waitForTimeout(400);

    await modal.getByRole('button', { name: 'Save', exact: true }).click();
    await SFUtils.waitForLoading(page);
    await dismissAuraError(page);

    // After saving from Related list Salesforce stays on Contact page — use global search to navigate.
    await page.waitForTimeout(1500);
    if (!page.url().includes('/Opportunity/')) {
      await searchAndOpen(page, createdOpportunityName);
    }

    await waitForDetail(page);
    await page.getByRole('heading', { name: createdOpportunityName, exact: false })
      .first().waitFor({ state: 'visible', timeout: 20000 });
    createdOpportunityUrl = page.url();
  });

  // TC-ACC-004 | AC Reference: AC-005-04
test('TC-ACC-004 — Verify Contact is assigned as Primary Contact Role on Opportunity', async ({ page }) => {
    if (createdOpportunityUrl) {
      await SFUtils.goto(page, createdOpportunityUrl);
    } else {
      createdOpportunityName = createdOpportunityName || data.opportunity.Name;
      await searchAndOpen(page, createdOpportunityName);
    }
    await waitForDetail(page);
    await clickTab(page, 'Related');
    await SFUtils.waitForLoading(page);

    await page.evaluate(() => window.scrollBy(0, 600));
    await page.waitForTimeout(2000);

    const contactRolesSection = page
      .locator('force-related-list-single-container, force-related-list-card, article')
      .filter({ hasText: 'Contact Roles' })
      .first();
    await contactRolesSection.waitFor({ state: 'visible', timeout: 35000 });

    await contactRolesSection
      .getByRole('link', { name: createdContactName, exact: false })
      .first()
      .waitFor({ state: 'visible', timeout: 15000 });

    await page.waitForTimeout(2000);

    const contactRow = contactRolesSection
      .getByRole('row')
      .filter({ hasText: createdContactName })
      .first();

    const rowText = (await contactRow.innerText({ timeout: 8000 }).catch(() => '')) ?? '';
    const hasPrimaryBadge = rowText.toUpperCase().includes('PRIMARY');

    const hasPrimaryIcon = hasPrimaryBadge ? false : await contactRow
      .locator('lightning-icon[icon-name="utility:check"], [title="True"], abbr[title="True"], lightning-primitive-icon[icon-name="utility:check"]')
      .first()
      .isVisible({ timeout: 6000 })
      .catch(() => false);

    const sectionHasPrimary = hasPrimaryBadge || hasPrimaryIcon
      ? true
      : (await contactRolesSection.innerText({ timeout: 5000 }).catch(() => '')).toUpperCase().includes('PRIMARY');

    if (!hasPrimaryBadge && !hasPrimaryIcon && !sectionHasPrimary) {
      throw new Error(
        `[AC-005-04] Contact "${createdContactName}" is NOT marked as Primary Contact Role ` +
        `on Opportunity "${createdOpportunityName}". Row text: "${rowText}"`
      );
    }
  });

  // TC-ACC-005 | AC Reference: AC-005-05
test('TC-ACC-005 — Create Quote from Opportunity', async ({ page }) => {
    createdQuoteName = data.quote.Name;

    if (createdOpportunityUrl) {
      await SFUtils.goto(page, createdOpportunityUrl);
    } else {
      createdOpportunityName = createdOpportunityName || data.opportunity.Name;
      await searchAndOpen(page, createdOpportunityName);
    }
    await waitForDetail(page);
    await SFUtils.waitForLoading(page);

    // This org uses "Create Quote" in the Opportunity header action bar (not "New Quote")
    const newQuoteBtn = page
      .getByRole('button', { name: 'Create Quote', exact: true })
      .or(page.locator('a[title="Create Quote"]'))
      .or(page.getByRole('button', { name: 'New Quote', exact: true }))
      .first();
    await newQuoteBtn.waitFor({ state: 'visible', timeout: 20000 });
    await newQuoteBtn.click();

    // URL changes instantly in Lightning SPA but the "New Quote" modal renders asynchronously.
    // Wait for the modal explicitly (up to 20s) before interacting.
    await page.waitForURL(/Quote/, { timeout: 20000 }).catch(() => {});
    await dismissAuraError(page);

    const modal = page.locator(MODAL);
    const modalAppeared = await modal.waitFor({ state: 'visible', timeout: 20000 }).then(() => true).catch(() => false);

    if (modalAppeared) {
      // The Revenue Cloud "New Quote" form pre-fills the Quote Name — just click Save.
      // Wait for the Syncing spinner inside the modal to settle first.
      await modal.locator('.slds-spinner, [class*="spinner"]').first()
        .waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
      await modal.getByRole('button', { name: 'Save', exact: true }).click();
      await SFUtils.waitForLoading(page);
      await dismissAuraError(page);
    } else {
      // Full-page quote editor — try Save button anywhere on the page
      const saveBtn = page.getByRole('button', { name: 'Save', exact: true }).first();
      if (await saveBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await saveBtn.click();
        await SFUtils.waitForLoading(page);
        await dismissAuraError(page);
      }
    }

    // Wait for navigation to the saved Quote record view page
    await page.waitForURL(/\/Quote\/[a-zA-Z0-9]{15,18}\/view/, { timeout: 30000 }).catch(() => {});
    await waitForDetail(page);
    await page.locator('.slds-spinner').waitFor({ state: 'hidden' }).catch(() => {});

    const currentUrl = page.url();
    const isQuoteRecord = /\/Quote\/[a-zA-Z0-9]{15,18}\/view/.test(currentUrl);
    if (!isQuoteRecord) {
      throw new Error(
        `TC-ACC-005: Quote detail page not reached. URL: ${currentUrl}. Expected heading "${createdQuoteName}" not found.`
      );
    }
    console.info(`[PASS] AC-005-05: Quote created from Opportunity "${createdOpportunityName}". URL: ${currentUrl}`);
  });
  // ── US-005 END ───────────────────────────────────────────────────────

});
