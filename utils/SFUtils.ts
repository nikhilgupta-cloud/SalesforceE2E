import { Page, Locator, FrameLocator } from '@playwright/test';

/**
 * Robust Salesforce Utilities (Agentic Framework Ready)
 */
export class SFUtils {
  static MODAL = '[role="dialog"]:not([id="auraError"]):not([aria-hidden="true"])';
  static SPINNER = '.slds-spinner_container, .slds-spinner, .forceVisualMessageQueue';

  static async goto(page: Page, url: string) {
    // FIX 1: Change 'load' to 'domcontentloaded' so it doesn't hang on background telemetry
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await this.waitForAppReady(page);
  }

  static async waitForAppReady(page: Page) {
    await page.locator('lightning-app, .slds-global-header, .slds-page-header, .desktop, force-record-layout-section').first()
      .waitFor({ state: 'visible', timeout: 10000 }).catch(() => {
        console.log("⚠️ App Ready indicator not visible, continuing anyway...");
      });
    await this.waitForLoading(page);
  }

  static async waitForLoading(page: Page) {
    // FIX 3: Wait a tiny bit first to allow the initial spinner to trigger
    await page.waitForTimeout(500); 
    const spinner = page.locator(this.SPINNER).first();
    
    // Check if spinner is there, wait for it to leave.
    if (await spinner.isVisible({ timeout: 2000 }).catch(() => false)) {
      await spinner.waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});
    }
    // A secondary small wait to bypass the "flickering spinner" gap
    await page.waitForTimeout(500);
  }

  // NEW METHOD: The Agentic "Safe Click"
  // Forces the agent to wait for stability before clicking things like Tabs or Save buttons
  static async safeClick(locator: Locator, timeout = 15000) {
    await locator.waitFor({ state: 'visible', timeout });
    
    // Scroll into view - SF often hides elements under sticky headers
    await locator.scrollIntoViewIfNeeded(); 
    await locator.click();
  }

  static getField(root: Page | Locator | FrameLocator, apiName: string): Locator {
    return root.locator(`[data-field-api-name="${apiName}"], [field-name="${apiName}"], lightning-input:has-text("${apiName}"), lightning-output-field:has-text("${apiName}")`).first();
  }

  static async getOutputValue(root: Page | Locator | FrameLocator, apiName: string): Promise<string> {
    const field = this.getField(root, apiName);
    await field.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
    
    if (!await field.isVisible({ timeout: 5000 }).catch(() => false)) return '';
    
    const output = field.locator('.slds-form-element__static, lightning-formatted-text, lightning-formatted-address, slot').first();
    const text = await (await output.isVisible({ timeout: 1000 }).catch(() => false) 
      ? output.innerText() 
      : field.innerText());
      
    return text.trim();
  }

  static async fillField(root: Page | Locator | FrameLocator, apiName: string, value: string) {
    const field = this.getField(root, apiName);
    const input = field.locator('input, textarea').first();
    await input.waitFor({ state: 'visible', timeout: 15000 });
    
    // FIX 4: Always click a Salesforce field before filling to wake up the event listeners
    await input.click(); 
    await input.fill(value);
    await input.press('Tab');
  }

  static async selectCombobox(page: Page, root: Page | Locator | FrameLocator, apiName: string, label: string) {
    const field = this.getField(root, apiName);
    const trigger = field.locator('input[role="combobox"], button').first();
    await trigger.click();
    
    // Wait for the dropdown to actually render in the DOM
    await page.waitForTimeout(500); 

    const option = page.locator('lightning-base-combobox-item, [role="option"]')
      .filter({ hasText: new RegExp(`^${label}$`, 'i') }).first();
    await option.scrollIntoViewIfNeeded();
    await option.click();
    await this.waitForLoading(page);
  }

  static async fillName(root: Page | Locator | FrameLocator, subFieldName: 'firstName' | 'lastName', value: string) {
    const input = root.locator(`input[name="${subFieldName}"]`).first();
    await input.waitFor({ state: 'visible', timeout: 15000 });
    await input.click(); // Wake up listener
    await input.fill(value);
  }

  static async waitForNavigationOrToast(page: Page, substrings: string | string[], recordName?: string): Promise<string> {
    const subs = Array.isArray(substrings) ? substrings : [substrings];
    const checkMatch = (url: string) => subs.some(sub => url.includes(sub));

    try {
      await page.waitForURL(url => checkMatch(url.href) && !url.href.includes('/new'), { timeout: 10000 });
      return page.url();
    } catch (e) {}

    const toastLink = page.locator('.slds-notify--toast a, .toastMessage a').first();
    if (await toastLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      const href = await toastLink.getAttribute('href') ?? '';
      if (!page.url().includes(href)) {
        await toastLink.click();
        await this.waitForLoading(page);
      }
      return page.url();
    }

    if (checkMatch(page.url())) return page.url();
    throw new Error(`Navigation failed to ${subs.join(',')}`);
  }

  private static async _triggerGlobalSearch(page: Page, query: string) {
    await page.keyboard.press('/');
    const searchInput = page.locator('input[placeholder*="Search"]').first();
    await searchInput.waitFor({ state: 'visible', timeout: 5000 });
    await searchInput.fill(query);
    await page.keyboard.press('Enter');
    await this.waitForLoading(page);
  }

  static async searchAndOpen(page: Page, name: string): Promise<string> {
    await this._triggerGlobalSearch(page, name);
    const resultLink = page.getByRole('link', { name, exact: true }).first();
    
    // Use the new safeClick here too!
    await this.safeClick(resultLink); 
    await this.waitForLoading(page);
    return page.url();
  }
}