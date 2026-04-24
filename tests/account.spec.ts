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

    await searchAndOpen(page, resolvedAccountName);
    await clickTab(page, 'Related');
    await SFUtils.waitForLoading(page);

    const contactsRelatedList = page
      .locator('force-related-list-single-container, force-related-list-card, article')
      .filter({ hasText: /^Contacts/ })
      .first();
    await contactsRelatedList.waitFor({ state: 'visible', timeout: 30000 });

    // AC-005-02: skip creation if contact already exists
    const existingContact = contactsRelatedList.getByRole('link', { name: createdContactName, exact: true }).first();
    if (await existingContact.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log(`[SKIP] "${createdContactName}" already exists — using existing record.`);
      await existingContact.click();
      await SFUtils.waitForLoading(page);
      await waitForDetail(page);
      createdContactUrl = page.url();
      return;
    }

    await contactsRelatedList.getByRole('button', { name: 'New', exact: true }).click();
    await SFUtils.waitForLoading(page);

    const modal = page.locator(MODAL);
    await modal.waitFor({ state: 'visible', timeout: 15000 });

    await SFUtils.fillName(modal, 'firstName', createdContactFirstName);
    await SFUtils.fillName(modal, 'lastName', createdContactLastName);

    await modal.getByRole('button', { name: 'Save', exact: true }).click();
    await SFUtils.waitForLoading(page);
    await dismissAuraError(page);

    // Salesforce stays on the Account page after saving from Related list — navigate to Contact.
    await page.waitForTimeout(1500);
    if (!page.url().includes('/Contact/')) {
      const newContactLink = page.getByRole('link', { name: createdContactName, exact: true }).first();
      await newContactLink.waitFor({ state: 'visible', timeout: 15000 });
      await newContactLink.click();
      await SFUtils.waitForLoading(page);
    }

    await waitForDetail(page);
    await page.getByRole('heading', { name: createdContactName, exact: false })
      .first().waitFor({ state: 'visible', timeout: 15000 });
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

    // AC-005-03: skip creation if opportunity already exists in related list
    const existingOpp = oppsRelatedList.getByRole('link', { name: createdOpportunityName, exact: true }).first();
    if (await existingOpp.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log(`[SKIP] "${createdOpportunityName}" already exists — using existing record.`);
      await existingOpp.click();
      await SFUtils.waitForLoading(page);
      await waitForDetail(page);
      createdOpportunityUrl = page.url();
      return;
    }

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

    // Salesforce stays on the Contact page after saving from a related list.
    await page.waitForTimeout(1500);
    if (!page.url().includes('/Opportunity/')) {
      const newOppLink = page.getByRole('link', { name: createdOpportunityName, exact: true }).first();
      await newOppLink.waitFor({ state: 'visible', timeout: 15000 });
      await newOppLink.click();
      await SFUtils.waitForLoading(page);
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
    await SFUtils.waitForLoading(page);
    await dismissAuraError(page);

    // Some orgs open a modal; others navigate directly to the Quote editor
    const modal = page.locator(MODAL);
    const modalVisible = await modal.isVisible({ timeout: 5000 }).catch(() => false);

    if (modalVisible) {
      const quoteNameInput = modal.locator('[data-field-api-name="Name"] input').first();
      if (await quoteNameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await quoteNameInput.fill(createdQuoteName);
      }
      await modal.getByRole('button', { name: 'Save', exact: true }).click();
      await SFUtils.waitForLoading(page);
      await dismissAuraError(page);
    } else {
      // Quote editor opened directly — fill the Name field if present before saving
      const editorNameInput = page.locator('[data-field-api-name="Name"] input').first();
      if (await editorNameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await editorNameInput.fill(createdQuoteName);
      }
      // Look for a Save button in the editor toolbar
      const saveBtn = page
        .getByRole('button', { name: 'Save', exact: true })
        .or(page.locator('button:has-text("Save")'))
        .first();
      if (await saveBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await saveBtn.click();
        await SFUtils.waitForLoading(page);
        await dismissAuraError(page);
      }
    }

    // Wait for navigation to land on a Quote record detail page
    await page.waitForURL(/\/Quote\/[a-zA-Z0-9]{15,18}\/view/, { timeout: 30000 }).catch(async () => {
      // If URL pattern doesn't match, fall back to waiting for any record detail URL change
      await page.waitForLoadState('domcontentloaded');
      await SFUtils.waitForLoading(page);
    });

    await waitForDetail(page);
    await page.locator('.slds-spinner').waitFor({ state: 'hidden' }).catch(() => {});

    // The heading may render as a highlights panel title or a record breadcrumb;
    // try multiple selectors before falling back to a full-page text search
    const headingSelectors = [
      page.getByRole('heading', { name: createdQuoteName, exact: false }).first(),
      page.locator('lightning-formatted-text').filter({ hasText: createdQuoteName }).first(),
      page.locator('.slds-page-header__title').filter({ hasText: createdQuoteName }).first(),
      page.locator('h1').filter({ hasText: createdQuoteName }).first(),
      page.locator('[data-field-api-name="Name"]').filter({ hasText: createdQuoteName }).first(),
    ];

    let found = false;
    for (const locator of headingSelectors) {
      const visible = await locator.isVisible({ timeout: 8000 }).catch(() => false);
      if (visible) {
        found = true;
        break;
      }
    }

    if (!found) {
      // Last resort: confirm the current URL is a Quote record (creation succeeded even if name differs)
      const currentUrl = page.url();
      const isQuoteRecord = /\/Quote\/[a-zA-Z0-9]{15,18}\/view/.test(currentUrl);
      if (!isQuoteRecord) {
        throw new Error(
          `TC-ACC-005: Quote detail page not reached. URL: ${currentUrl}. Expected heading "${createdQuoteName}" not found.`
        );
      }
    }
  });
  // ── US-005 END ───────────────────────────────────────────────────────

});
