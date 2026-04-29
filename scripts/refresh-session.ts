/**
 * refresh-session.ts
 * Programmatically logs into Salesforce and saves auth/session.json.
 * Run with: npx ts-node scripts/refresh-session.ts
 */
import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
dotenv.config();

const SF_URL      = process.env.SF_SANDBOX_URL!;
const SF_USER     = process.env.SF_USERNAME!;
const SF_PASS     = (process.env.SF_PASSWORD ?? '').replace(/^"|"$/g, '');
const SESSION_OUT = 'auth/session.json';

(async () => {
  if (!SF_URL || !SF_USER || !SF_PASS) {
    console.error('❌  Missing SF_SANDBOX_URL, SF_USERNAME or SF_PASSWORD in .env');
    process.exit(1);
  }

  console.log(`🔐  Logging in as ${SF_USER} → ${SF_URL}`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page    = await context.newPage();

  try {
    // Use 'load' so the login form's JavaScript has time to render before we inspect
    await page.goto(SF_URL, { waitUntil: 'load', timeout: 60000 });

    // Give the page a moment to settle and redirect if needed
    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    console.log(`Current URL after navigation: ${currentUrl}`);

    // Detect login page — try multiple selectors with generous timeout
    const usernameInput = page.locator('#username, input[name="username"], input[type="email"]').first();
    const isLoginPage = await usernameInput.isVisible({ timeout: 15000 }).catch(() => false);

    if (isLoginPage) {
      console.log('✅ Login page detected — filling credentials...');
      await usernameInput.fill(SF_USER);

      const passwordInput = page.locator('#password, input[name="password"], input[type="password"]').first();
      await passwordInput.waitFor({ state: 'visible', timeout: 10000 });
      await passwordInput.fill(SF_PASS);

      await page.locator('#Login, input[type="submit"], button[type="submit"]').first().click();
      console.log('Credentials submitted — waiting for redirect...');

      // Wait for the page to navigate away from the login page
      await page.waitForURL(url => !url.href.includes('login.salesforce.com') || url.href.includes('/secur/'), { timeout: 30000 }).catch(() => {});
    } else {
      console.log('ℹ️  Login form not detected — checking if already authenticated...');
    }

    // Handle MFA / verification screen
    const vCodeInput = page.locator('#emc, input[name="emc"], #smsc, input[name="smsc"]').first();
    if (await vCodeInput.isVisible({ timeout: 10000 }).catch(() => false)) {
      const mfaPath = 'auth/mfa_code.txt';
      if (!fs.existsSync('auth')) fs.mkdirSync('auth');

      // Read pre-written code if already present (written before script started)
      let code = fs.existsSync(mfaPath) ? fs.readFileSync(mfaPath, 'utf8').trim() : '';

      if (!code) {
        // No pre-written code — clear file and wait for user to write it
        fs.writeFileSync(mfaPath, '');
        console.log('🔑 MFA required — write the verification code to auth/mfa_code.txt');
        for (let i = 0; i < 60; i++) {
          code = fs.readFileSync(mfaPath, 'utf8').trim();
          if (code) break;
          await new Promise(r => setTimeout(r, 2000));
        }
      } else {
        console.log('🔑 MFA required — using pre-written code from auth/mfa_code.txt');
      }

      if (!code) throw new Error('MFA timeout — no code written to auth/mfa_code.txt within 2 minutes');

      console.log(`Entering MFA code: ${code}`);
      await vCodeInput.fill(code);
      await page.locator('#save, input[type="submit"], button[type="submit"]').first().click();
      fs.unlinkSync(mfaPath);
    }

    console.log('⏳  Waiting for Salesforce Lightning app to load...');
    // Use a broad set of selectors — any one of these confirms we're inside SF Lightning
    await page.locator([
      'lightning-app',
      '.slds-global-header',
      '.slds-page-header',
      '.desktop.container',
      'force-record-layout-section',
      '.appLauncher',
    ].join(', ')).first().waitFor({ state: 'attached', timeout: 60000 });

    fs.mkdirSync('auth', { recursive: true });
    await context.storageState({ path: SESSION_OUT });
    console.log(`✅  Session saved to ${SESSION_OUT}`);
  } catch (err: any) {
    console.error('❌  Login failed:', err.message);
    console.log('Final URL:', page.url());
    const body = await page.locator('body').innerText().catch(() => 'Could not read body');
    console.log('Page Body Snippet:', body.substring(0, 500));
    await page.screenshot({ path: 'auth-error.png' });
    console.log('Captured auth-error.png for debugging.');
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
