import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
dotenv.config();

const sessionFile = 'auth/session.json';
const SF_URL = process.env.SF_SANDBOX_URL!;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const storageState = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
  const context = await browser.newContext({ storageState });
  const page = await context.newPage();

  console.log(`Navigating to ${SF_URL}...`);
  await page.goto(SF_URL, { waitUntil: 'load', timeout: 60000 });

  // Wait for any indicator that the app is loaded
  console.log('Waiting for app elements...');
  await page.waitForSelector('lightning-app, .slds-global-header, .desktop', { timeout: 30000 }).catch(() => console.log('Timeout waiting for app elements'));

  // Dump all buttons in the header
  const buttons = await page.evaluate(() => {
    const header = document.querySelector('.slds-global-header');
    if (!header) return 'HEADER NOT FOUND';
    const btns = Array.from(header.querySelectorAll('button, input')).map(b => ({
      tag: b.tagName,
      className: b.className,
      id: b.id,
      label: b.getAttribute('aria-label') || b.getAttribute('title') || b.textContent?.trim(),
      placeholder: b.getAttribute('placeholder')
    }));
    return btns;
  });

  console.log('Buttons in header:', JSON.stringify(buttons, null, 2));

  await browser.close();
})();
