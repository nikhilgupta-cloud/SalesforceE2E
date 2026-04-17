/**
 * Account Tests — Salesforce CPQ (RCA)
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

test.describe('Account Tests', () => {

  test.beforeEach(async ({ page }) => {
    await goTo(page, '/lightning/o/Account/list?filterName=Recent');
    await waitForDetail(page);
    await dismissAuraError(page);
  });

  // AI-generated tests will be inserted here automatically when user stories are processed.
  // Run: npm run pipeline

});
