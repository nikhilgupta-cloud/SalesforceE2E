import { test } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
dotenv.config();

test('Debug Navigation with Session', async ({ page, context }) => {
  const baseUrl = process.env.SF_SANDBOX_URL;
  const targetUrl = `${baseUrl}/lightning/page/home`;
  
  console.log('Base URL:', baseUrl);
  console.log('Target URL:', targetUrl);
  
  // Check if storageState is actually being used
  const sessionFile = 'auth/session.json';
  if (fs.existsSync(sessionFile)) {
    console.log('Session file exists. Size:', fs.statSync(sessionFile).size);
  } else {
    console.log('Session file DOES NOT exist!');
  }

  console.log('Navigating to target...');
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  
  await page.waitForTimeout(5000);
  console.log('Final URL:', page.url());
  console.log('Page Title:', await page.title());
  
  const isLogin = page.url().includes('login.salesforce.com') || (await page.title()).includes('Login');
  if (isLogin) {
    console.log('❌ Still on Login Page!');
  } else {
    console.log('✅ Appears to be logged in.');
  }
  
  await page.screenshot({ path: 'debug-nav-session.png' });
});
