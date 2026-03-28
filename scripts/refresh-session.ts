/**
 * refresh-session.ts
 * Programmatically logs into Salesforce and saves auth/session.json.
 * Run with: npx ts-node scripts/refresh-session.ts
 * OR:       npx playwright test --config=scripts/refresh-session.ts (not needed)
 */
import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
dotenv.config();

const SF_URL      = process.env.SF_SANDBOX_URL!;
const SF_USER     = process.env.SF_USERNAME!;
const SF_PASS     = process.env.SF_PASSWORD!;
const SESSION_OUT = 'auth/session.json';

(async () => {
  if (!SF_URL || !SF_USER || !SF_PASS) {
    console.error('❌  Missing SF_SANDBOX_URL, SF_USERNAME or SF_PASSWORD in .env');
    process.exit(1);
  }

  console.log(`🔐  Logging in as ${SF_USER} → ${SF_URL}`);
  const browser = await chromium.launch({ headless: false, slowMo: 50 });
  const context = await browser.newContext();
  const page    = await context.newPage();

  // Navigate to the org — will redirect to login page if session is expired
  await page.goto(SF_URL, { waitUntil: 'domcontentloaded' });

  // Also try standard login URL if already on login page
  const currentUrl = page.url();
  if (!currentUrl.includes('login') && !currentUrl.includes('username')) {
    await page.goto('https://login.salesforce.com', { waitUntil: 'domcontentloaded' });
  }

  // Fill credentials — wait up to 30s for the form
  const usernameInput = page.locator('#username, input[name="username"], input[type="email"]').first();
  await usernameInput.waitFor({ state: 'visible', timeout: 30000 });
  await usernameInput.fill(SF_USER);

  const passwordInput = page.locator('#password, input[name="password"], input[type="password"]').first();
  await passwordInput.fill(SF_PASS);

  await page.locator('#Login, input[type="submit"], button[type="submit"]').first().click();

  // Wait up to 60s — covers MFA prompts the user must handle manually
  console.log('⏳  Waiting for Salesforce home page… (complete MFA in the browser if prompted)');
  try {
    await page.locator('lightning-app, .slds-page-header, .desktop, .home').first()
      .waitFor({ state: 'attached', timeout: 60000 });
  } catch {
    // Give extra time for slow orgs
    await page.waitForTimeout(5000);
  }

  // Save session
  fs.mkdirSync('auth', { recursive: true });
  await context.storageState({ path: SESSION_OUT });
  console.log(`✅  Session saved to ${SESSION_OUT}`);

  await browser.close();
})();
