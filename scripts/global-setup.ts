import { chromium, FullConfig } from '@playwright/test';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
dotenv.config();

const SESSION_FILE = 'auth/session.json';
const SESSION_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

async function globalSetup(_config: FullConfig) {
  const exists = fs.existsSync(SESSION_FILE);
  const tooOld = exists
    ? Date.now() - fs.statSync(SESSION_FILE).mtimeMs > SESSION_MAX_AGE_MS
    : true;

  if (!tooOld) {
    const ageMin = Math.round((Date.now() - fs.statSync(SESSION_FILE).mtimeMs) / 60000);
    console.log(`[global-setup] Session valid (${ageMin}m old) — skipping login`);
    return;
  }

  const SF_URL  = process.env.SF_SANDBOX_URL!;
  const SF_USER = process.env.SF_USERNAME!;
  const SF_PASS = (process.env.SF_PASSWORD ?? '').replace(/^"|"$/g, '');

  if (!SF_URL || !SF_USER || !SF_PASS) {
    console.error('[global-setup] ❌ Missing SF_SANDBOX_URL, SF_USERNAME or SF_PASSWORD in .env');
    process.exit(1);
  }

  console.log(`[global-setup] Session expired or missing — logging in as ${SF_USER}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page    = await context.newPage();

  try {
    await page.goto(SF_URL, { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(2000);

    const usernameInput = page.locator('#username, input[name="username"], input[type="email"]').first();
    if (await usernameInput.isVisible({ timeout: 15000 }).catch(() => false)) {
      await usernameInput.fill(SF_USER);
      const passwordInput = page.locator('#password, input[name="password"], input[type="password"]').first();
      await passwordInput.waitFor({ state: 'visible', timeout: 10000 });
      await passwordInput.fill(SF_PASS);
      await page.locator('#Login, input[type="submit"], button[type="submit"]').first().click();
      await page.waitForURL(url => !url.href.includes('login.salesforce.com') || url.href.includes('/secur/'), { timeout: 30000 }).catch(() => {});
    }

    // Handle MFA if triggered
    const vCodeInput = page.locator('#emc, input[name="emc"], #smsc').first();
    if (await vCodeInput.isVisible({ timeout: 10000 }).catch(() => false)) {
      const mfaPath = 'auth/mfa_code.txt';
      if (!fs.existsSync('auth')) fs.mkdirSync('auth');
      if (fs.existsSync(mfaPath)) fs.unlinkSync(mfaPath);

      console.log('[global-setup] MFA required — write code to auth/mfa_code.txt');
      let code = '';
      for (let i = 0; i < 60; i++) {
        if (fs.existsSync(mfaPath)) {
          code = fs.readFileSync(mfaPath, 'utf8').trim();
          if (code) break;
        }
        await new Promise(r => setTimeout(r, 2000));
      }
      if (!code) throw new Error('MFA code timeout — no code written to auth/mfa_code.txt');
      await vCodeInput.fill(code);
      await page.locator('#save, input[type="submit"], button[type="submit"]').first().click();
      if (fs.existsSync(mfaPath)) fs.unlinkSync(mfaPath);
    }

    // Wait for Lightning app to confirm login succeeded
    await page.locator([
      'lightning-app',
      '.slds-global-header',
      '.slds-page-header',
      '.desktop.container',
      'force-record-layout-section',
      '.appLauncher',
    ].join(', ')).first().waitFor({ state: 'attached', timeout: 60000 });

    fs.mkdirSync('auth', { recursive: true });
    await context.storageState({ path: SESSION_FILE });
    console.log('[global-setup] ✅ Session saved');
  } catch (err: any) {
    console.error('[global-setup] ❌ Login failed:', err.message);
    await page.screenshot({ path: 'auth-error.png' });
    throw err;
  } finally {
    await browser.close();
  }
}

export default globalSetup;
