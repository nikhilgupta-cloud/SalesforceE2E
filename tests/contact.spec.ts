/**
 * Contact Tests — Salesforce CPQ (RCA)
 * Auth: auth/session.json
 *
 * AI-generated test blocks are inserted automatically when user stories are processed.
 * Run: npm run pipeline   |   Watch mode: npm run watch:stories
 */
import { test, type Page } from '@playwright/test';
import * as dotenv from 'dotenv';
import { getTestData } from '../utils/test-data';
import { SFUtils } from '../utils/SFUtils';
dotenv.config();

const data = getTestData();
const SF    = process.env.SF_SANDBOX_URL!;
const MODAL = SFUtils.MODAL;

// ── Helpers ──────────────────────────────────────────────────────────────────

async function dismissAuraError(page: Page) {
  const auraErr = page.locator('#auraError');
  if (await auraErr.isVisible({ timeout: 2000 }).catch(() => false)) {
    await auraErr.locator('button').first().click().catch(() => {});
    await auraErr.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
  }
}

async function waitForDetail(page: Page) {
  await page.locator('.slds-page-header').first().waitFor({ state: 'attached', timeout: 45000 }).catch(() => {});
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

// ── Suite ─────────────────────────────────────────────────────────────────────

test.describe('Contact Tests', () => {

  test.beforeEach(async ({ page }) => {
    await SFUtils.goto(page, `${SF}/lightning/page/home`);
    await dismissAuraError(page);
  });

  // AI-generated tests will be inserted here automatically when user stories are processed.
  // Run: npm run pipeline


});
