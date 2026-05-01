import { Page, Locator, FrameLocator } from '@playwright/test';

/**
 * Robust Salesforce Utilities (Agentic Framework Ready)
 */
export class SFUtils {
  static MODAL = '[role="dialog"]:not([id="auraError"]):not([aria-hidden="true"])';
  
  // ==========================================
  // NAVIGATION & STATE MANAGEMENT
  // ==========================================

  static async goto(page: Page, url: string) {
    const normalizedUrl = url.replace(/([a-z0-9-]+)\.lightning\.force\.com/i, '$1.my.salesforce.com');
    await page.goto(normalizedUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await this.waitForAppReady(page);
  }

  static async waitForAppReady(page: Page) {
    await page.locator('lightning-app, .slds-global-header, .slds-page-header, .desktop, force-record-layout-section').first()
      .waitFor({ state: 'visible', timeout: 10000 }).catch(() => {
        console.log("⚠️ App Ready indicator not visible, continuing anyway...");
      });
    await this.waitForLoading(page);
  }

  // 🚀 UPGRADED: Lightning-fast wait strategy based ONLY on the UI spinner
  static async waitForLoading(page: Page) {
    // 1. Tiny buffer to give Salesforce a millisecond to trigger the spinner on screen
    await page.waitForTimeout(500); 

    // 2. Wait for the spinner to vanish. 
    // If the spinner is not on screen, Playwright moves on INSTANTLY (0 seconds).
    await page.locator('.slds-spinner_container, .slds-spinner').first()
      .waitFor({ state: 'hidden', timeout: 15000 })
      .catch(() => {});

    // 3. Tiny buffer to let the UI paint the fields after the spinner disappears
    await page.waitForTimeout(500); 
  }

  // ==========================================
  // ACTION HELPERS
  // ==========================================

  static async safeClick(locator: Locator, timeout = 15000) {
    await locator.waitFor({ state: 'visible', timeout });
    await locator.scrollIntoViewIfNeeded(); 
    try {
      await locator.click({ timeout: 5000 });
    } catch {
      console.warn('⚠️ Standard click intercepted. Attempting force click...');
      await locator.click({ force: true });
    }
  }

  // ==========================================
  // AI-OPTIMIZED FIELD INTERACTIONS
  // ==========================================

  // 🚀 UPGRADED: One universal method for AI to fill ANY field using API Name
  static async fillField(page: Page, root: Page | Locator | FrameLocator, apiName: string, value: string) {
    // 1. Locate the LWC container using the perfect API name we scraped
    const container = root.locator(`[data-field-api-name="${apiName}"], [field-name="${apiName}"]`).first();
    await container.waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForTimeout(500);
    await container.scrollIntoViewIfNeeded();

    // 2. Handle Checkboxes (Boolean)
    if (await container.locator('lightning-input[type="checkbox"]').isVisible().catch(() => false)) {
        const checkbox = container.locator('input');
        const isChecked = await checkbox.isChecked();
        if ((value.toLowerCase() === 'true' && !isChecked) || (value.toLowerCase() === 'false' && isChecked)) {
            await this.safeClick(checkbox);
        }
        return;
    }

    // 3. Handle Picklists / Comboboxes
    if (await container.locator('lightning-combobox').isVisible().catch(() => false)) {
        await this.safeClick(container.locator('button'));
        const option = page.locator('lightning-base-combobox-item, [role="option"]').filter({ hasText: new RegExp(`^\\s*${value}\\s*$`, 'i') }).first();
        await this.safeClick(option);
        return;
    }

    // 4. Handle Lookups (Reference)
    if (await container.locator('lightning-lookup').isVisible().catch(() => false)) {
        const input = container.locator('input');
        await input.fill(value);
        await page.waitForTimeout(1000); // Wait for search results to populate
        const option = page.locator('lightning-base-combobox-formatted-text').filter({ hasText: value }).first();
        await this.safeClick(option);
        return;
    }

    // 5. Standard Text / Number / Date / Textarea
    const textInput = container.locator('input, textarea').first();
    await textInput.click();
    await textInput.fill(value);
    await textInput.press('Tab');
  }

  // ==========================================
  // READ / VERIFY DATA
  // ==========================================

  static async getOutputValue(root: Page | Locator | FrameLocator, apiName: string): Promise<string> {
    const field = root.locator(`[data-field-api-name="${apiName}"], [field-name="${apiName}"]`).first();
    await field.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
    if (!await field.isVisible({ timeout: 5000 }).catch(() => false)) return '';
    
    const output = field.locator('.slds-form-element__static, lightning-formatted-text, lightning-formatted-address, slot').first();
    const text = await (await output.isVisible({ timeout: 1000 }).catch(() => false) ? output.innerText() : field.innerText());
    return text.trim();
  }

  // ==========================================
  // WORKFLOW HELPERS
  // ==========================================

  static async waitForNavigationOrToast(page: Page, substrings: string | string[]): Promise<string> {
    const subs = Array.isArray(substrings) ? substrings : [substrings];
    const checkMatch = (url: string) => subs.some(sub => url.includes(sub));

    try {
      await page.waitForURL(url => checkMatch(url.href) && !url.href.includes('/new'), { timeout: 10000 });
      return page.url();
    } catch (e) {}

    const toastLink = page.locator('.slds-notify--toast a, .toastMessage a').first();
    if (await toastLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await this.safeClick(toastLink);
      await this.waitForLoading(page);
      return page.url();
    }

    if (checkMatch(page.url())) return page.url();
    throw new Error(`Navigation failed to ${subs.join(',')}`);
  }

  static async fillName(root: Page | Locator | FrameLocator, type: 'firstName' | 'lastName', value: string): Promise<void> {
    const nameComp = root.locator('lightning-input-name').first();
    if (await nameComp.isVisible({ timeout: 5000 }).catch(() => false)) {
      const input = nameComp.locator(`[name="${type}"]`).first();
      await input.fill(value);
      await input.press('Tab');
      return;
    }
    const label = type === 'firstName' ? 'First' : 'Last';
    const input = root.locator(`input[name="${type}"], input[placeholder*="${label}"]`).first();
    await input.fill(value);
    await input.press('Tab');
  }

  static async selectCombobox(page: Page, root: Page | Locator | FrameLocator, apiName: string, label: string): Promise<void> {
    return this.fillField(page, root, apiName, label);
  }

  static async searchAndOpen(page: Page, name: string, _objectType?: string): Promise<string> {
    await page.keyboard.press('/');
    const searchInput = page.locator('input[placeholder*="Search"]').first();
    await searchInput.waitFor({ state: 'visible', timeout: 5000 });
    await searchInput.fill(name);
    await page.keyboard.press('Enter');
    await this.waitForLoading(page);

    const resultLink = page.getByRole('link', { name, exact: true }).first();
    await this.safeClick(resultLink); 
    await this.waitForLoading(page);
    return page.url();
  }
}