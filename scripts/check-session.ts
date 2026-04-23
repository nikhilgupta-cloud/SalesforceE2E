import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
dotenv.config();

const sessionFile = 'auth/session.json';
const SF_URL = process.env.SF_SANDBOX_URL!;

(async () => {
  if (!fs.existsSync(sessionFile)) {
    console.log('❌ session.json not found');
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const storageState = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
  const context = await browser.newContext({ storageState });
  const page = await context.newPage();

  console.log(`Checking session at ${SF_URL}...`);
  await page.goto(SF_URL, { waitUntil: 'domcontentloaded' });

  const url = page.url();
  const title = await page.title();
  console.log(`Final URL: ${url}`);
  console.log(`Page Title: ${title}`);

  if (url.includes('login.salesforce.com') || title.toLowerCase().includes('login')) {
    console.log('❌ SESSION EXPIRED: Redirected to login page.');
  } else if (await page.locator('lightning-app').count() > 0 || await page.locator('.slds-global-header').count() > 0) {
    console.log('✅ SESSION VALID: Salesforce home/app detected.');
  } else {
    console.log('❓ SESSION UNCERTAIN: Neither login nor app detected. Check URL/Title.');
  }

  await browser.close();
})();
