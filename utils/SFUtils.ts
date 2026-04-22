import { Page, Locator, FrameLocator } from '@playwright/test';

/**
 * Robust Salesforce Utilities
 */
export class SFUtils {
  static MODAL = '[role="dialog"]:not([id="auraError"]):not([aria-hidden="true"])';
  static SPINNER = '.slds-spinner_container, .slds-spinner, .forceVisualMessageQueue';

  /**
   * Enhanced navigation that waits for the Salesforce app to be ready
   */
  static async goto(page: Page, url: string) {
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    await this.waitForAppReady(page);
  }

  /**
   * Waits for spinners to disappear and for the main app to be attached
   */
  static async waitForAppReady(page: Page) {
    await page.locator('lightning-app, .slds-page-header, .desktop').first()
      .waitFor({ state: 'attached', timeout: 30000 }).catch(() => {});
    await this.waitForLoading(page);
  }

  /**
   * Specifically waits for all Salesforce spinners and progress bars to hide
   */
  static async waitForLoading(page: Page) {
    // Wait for spinner to appear (short timeout) then disappear
    const spinner = page.locator(this.SPINNER).first();
    if (await spinner.isVisible({ timeout: 2000 }).catch(() => false)) {
      await spinner.waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});
    }
    // Small buffer for LWC to settle
    await page.waitForTimeout(500);
  }

  /**
   * Finds a field by its API name, piercing Shadow DOM correctly.
   * Handles IFrames if we are inside a CPQ/Revenue Cloud context.
   */
  static getField(root: Page | Locator | FrameLocator, apiName: string): Locator {
    return root.locator(`[data-field-api-name="${apiName}"], [field-name="${apiName}"]`).first();
  }

  /**
   * Fills a standard lightning-input or lightning-textarea
   */
  static async fillField(root: Page | Locator | FrameLocator, apiName: string, value: string) {
    const field = this.getField(root, apiName);
    const input = field.locator('input, textarea').first();
    await input.waitFor({ state: 'visible', timeout: 15000 });
    await input.fill(value);
    // Ensure the change is registered (Salesforce sometimes needs a blur/tab)
    await input.press('Tab');
  }

  /**
   * Fills a lightning-lookup field and selects the first matching result.
   */
  static async fillLookup(page: Page, root: Page | Locator | FrameLocator, apiName: string, value: string) {
    const field = this.getField(root, apiName);
    const input = field.locator('input').first();
    await input.waitFor({ state: 'visible', timeout: 15000 });
    await input.fill(value);
    
    // Wait for the listbox results to appear
    const listbox = page.locator('.slds-listbox, .slds-lookup__menu').first();
    await listbox.waitFor({ state: 'visible', timeout: 15000 });
    
    // Click the result that matches our text
    const option = listbox.locator('.slds-listbox__option, [role="option"]').filter({ hasText: value }).first();
    await option.waitFor({ state: 'visible', timeout: 10000 });
    await option.click();
    await this.waitForLoading(page);
  }

  /**
   * Selects an option from a lightning-combobox
   */
  static async selectCombobox(page: Page, root: Page | Locator | FrameLocator, apiName: string, label: string) {
    const field = this.getField(root, apiName);
    const trigger = field.locator('button, input[role="combobox"]').first();
    
    await trigger.waitFor({ state: 'visible' });
    await trigger.click();
    
    // Dropdowns are often in a portal at the end of <body>
    const option = page.locator('lightning-base-combobox-item, [role="option"]')
      .filter({ hasText: new RegExp(`^${label}$`, 'i') }).first();
    
    await option.waitFor({ state: 'visible', timeout: 10000 });
    await option.click();
    await this.waitForLoading(page);
  }

  /**
   * Handles CPQ IFrames automatically
   */
  static getCPQFrame(page: Page): FrameLocator {
    // CPQ pages often use an iframe with 'sb' or 'CPQ' in the src
    return page.frameLocator('iframe[src*="sb"], iframe[title*="CPQ"], iframe[name*="vfFrameId"]');
  }

  /**
   * Fills a sub-input within a compound field (like Name -> firstName/lastName)
   */
  static async fillName(root: Page | Locator | FrameLocator, subFieldName: 'firstName' | 'lastName', value: string) {
    const field = this.getField(root, 'Name');
    const input = field.locator(`input[name="${subFieldName}"]`).first();
    await input.waitFor({ state: 'visible', timeout: 15000 });
    await input.fill(value);
    await input.press('Tab');
  }

  /**
   * Pierces Shadow DOM to find a button by text
   */
  static async clickButton(root: Page | Locator | FrameLocator, text: string) {
    const btn = root.locator(`button:has-text("${text}"), input[type="button"][value="${text}"]`).first();
    await btn.waitFor({ state: 'visible' });
    await btn.click();
  }
}
