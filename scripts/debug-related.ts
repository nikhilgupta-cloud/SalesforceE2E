import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { SFUtils } from '../utils/SFUtils';
import { getTestData } from '../utils/test-data';
dotenv.config();

const sessionFile = 'auth/session.json';
const data = getTestData();
const SF_URL = process.env.SF_SANDBOX_URL!;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const storageState = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
  const context = await browser.newContext({ storageState });
  const page = await context.newPage();

  const accountName = data.account.Account_Name;

  console.log(`Searching and opening Account: ${accountName}...`);
  await SFUtils.goto(page, `${SF_URL}/lightning/page/home`);
  await SFUtils.searchAndOpen(page, accountName);
  
  // Wait for page header to be sure we are on record page
  await page.locator('.slds-page-header').first().waitFor({ state: 'attached', timeout: 30000 });
  
  console.log('Clicking Related tab...');
  const tabsInfo = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('[role="tab"]')).map(t => ({
      text: t.textContent?.trim(),
      selected: t.getAttribute('aria-selected'),
      visible: (t as HTMLElement).offsetParent !== null
    }));
  });
  console.log('Tabs Info:', JSON.stringify(tabsInfo, null, 2));

  const tab = page.getByRole('tab', { name: 'Related', exact: true }).first();
  if (await tab.isVisible().catch(() => false)) {
    console.log('Clicking tab...');
    await tab.click();
    await SFUtils.waitForLoading(page);
    await page.waitForTimeout(5000); 
    
    const selectedTab = await page.evaluate(() => {
       const t = Array.from(document.querySelectorAll('[role="tab"]')).find(t => t.getAttribute('aria-selected') === 'true');
       return t?.textContent?.trim();
    });
    console.log(`Current Selected Tab: ${selectedTab}`);
  } else {
    console.log('Related tab NOT visible even after searchAndOpen');
  }

  // Dump all headings again
  const finalHeadings = await page.evaluate(() => Array.from(document.querySelectorAll('h1, h2, h3, .slds-card__header-link')).map(h => h.textContent?.trim()));
  console.log('Final Headings:', finalHeadings);

  await browser.close();
})();
