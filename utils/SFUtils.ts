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
   * Finds a field by its API name or Label by checking the scraped locators database.
   */
  static getField(root: Page | Locator | FrameLocator, apiNameOrLabel: string): Locator {
    // 1. Try direct API name attribute in DOM (most stable)
    const apiSelector = `[data-field-api-name="${apiNameOrLabel}"], [field-name="${apiNameOrLabel}"]`;
    
    // 2. Load scraped locators for dynamic fallback
    let scrapedSelector = '';
    try {
      const locatorsPath = 'knowledge/scraped-locators.json';
      if (require('fs').existsSync(locatorsPath)) {
        const db = JSON.parse(require('fs').readFileSync(locatorsPath, 'utf8'));
        // Search across all objects for a matching API name or Label
        for (const obj of Object.values(db) as any[]) {
          const field = obj.fields?.find((f: any) => f.apiName === apiNameOrLabel || f.label === apiNameOrLabel);
          if (field?.selector) {
            scrapedSelector = `, ${field.selector}`;
            break;
          }
        }
      }
    } catch (e) {}

    // 3. Common LWC patterns as last resort
    const fallbackSelector = `, lightning-input:has-text("${apiNameOrLabel}"), lightning-combobox:has-text("${apiNameOrLabel}"), lightning-lookup:has-text("${apiNameOrLabel}"), lightning-textarea:has-text("${apiNameOrLabel}")`;

    return root.locator(`${apiSelector}${scrapedSelector}${fallbackSelector}`).first();
  }

  /**
   * Reads the text value of a field in view mode (Detail tab).
   */
  static async getOutputValue(root: Page | Locator | FrameLocator, apiName: string): Promise<string> {
    const field = this.getField(root, apiName);
    
    // Ensure the field is scrolled into view (Salesforce Detail tabs are often long/lazy-loaded)
    await field.scrollIntoViewIfNeeded().catch(() => {});
    
    // Check if field exists at all before attempting to read it
    const exists = await field.isVisible({ timeout: 5000 }).catch(() => false);
    if (!exists) return '';
    
    // Salesforce output fields often wrap text in specific formatted components
    const output = field.locator('.slds-form-element__static, lightning-formatted-text, lightning-formatted-address, lightning-formatted-name, slot').first();
    
    const text = await (await output.isVisible({ timeout: 2000 }).catch(() => false) 
      ? output.innerText() 
      : field.innerText());
      
    return text.trim();
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

    // Native <select> (picklist in some modal layouts)
    const nativeSelect = field.locator('select').first();
    if (await nativeSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      await nativeSelect.selectOption({ label });
      await this.waitForLoading(page);
      return;
    }

    // Lightning combobox — input[role="combobox"] or button trigger
    const trigger = field.locator('input[role="combobox"], button').first();
    await trigger.waitFor({ state: 'visible' });
    await trigger.click();

    // Options render in a portal at the end of <body>
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
   * or separate First Name / Last Name fields if they are standalone.
   */
  static async fillName(root: Page | Locator | FrameLocator, subFieldName: 'firstName' | 'lastName', value: string) {
    const label = subFieldName === 'firstName' ? 'First Name' : 'Last Name';
    
    // 1. Try compound Name field first
    const compoundField = root.locator(`[data-field-api-name="Name"], [field-name="Name"]`).first();
    const compoundInput = compoundField.locator(`input[name="${subFieldName}"]`).first();
    
    // 2. Try standalone fields (e.g. lightning-input with First Name / Last Name label)
    const standaloneField = root.locator(`lightning-input:has-text("${label}"), [data-field-api-name="${subFieldName.charAt(0).toUpperCase() + subFieldName.slice(1)}"]`).first();
    const standaloneInput = standaloneField.locator('input').first();

    const input = (await compoundInput.isVisible({ timeout: 2000 }).catch(() => false)) 
      ? compoundInput 
      : standaloneInput;

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

  /**
   * Focuses the Salesforce global search box, types the query, and presses Enter.
   * Shared by searchAndOpen and searchExists.
   */
  private static async _triggerGlobalSearch(page: Page, query: string) {
    // Ensure focus is on the page body so the '/' shortcut registers
    await page.locator('body').click({ position: { x: 1, y: 1 }, force: true }).catch(() => {});

    // '/' opens and focuses the Salesforce global search input
    await page.keyboard.press('/');
    await page.waitForTimeout(1000);

    // Check if the search input is already focused or visible
    const searchInput = page.locator('input[type="search"][placeholder*="Search"], input.slds-input[placeholder*="Search"]').first();
    const alreadyFocused = await searchInput.isVisible({ timeout: 1000 }).catch(() => false);

    if (!alreadyFocused) {
      // If '/' didn't open it, try clicking the search trigger button
      const searchTrigger = page.locator([
        '.slds-global-header__item--search button',
        '.forceSearchAssistantTrigger button',
        'button[aria-label*="Search"]',
        'button.search-button'
      ].join(', ')).first();

      if (await searchTrigger.isVisible({ timeout: 2000 }).catch(() => false)) {
        // Use force: true to avoid "intercepted" errors if the input is partially covering the button
        await searchTrigger.click({ force: true }).catch(() => {});
        await page.waitForTimeout(800);
      } else {
        // ULTIMATE FALLBACK: Navigate directly to search results page via URL
        console.warn(`Search trigger not found. Navigating directly to search for: ${query}`);
        const currentUrl = page.url();
        const baseUrl = currentUrl.split('/lightning/')[0];
        await page.goto(`${baseUrl}/lightning/search/All/Home/result?q=${encodeURIComponent(query)}`);
        await this.waitForLoading(page);
        return;
      }
    }

    // Ensure the input is focused before typing
    await searchInput.focus().catch(() => {});
    await page.keyboard.type(query, { delay: 30 });
    await page.keyboard.press('Enter');
    await this.waitForLoading(page);
  }

  /**
   * Uses Salesforce global search to find a record and open it.
   * Preferred over navigating Recent list views — finds any record regardless of recency.
   */
  static async searchAndOpen(page: Page, name: string): Promise<void> {
    await this._triggerGlobalSearch(page, name);
    
    // Check if we've already navigated to a record page matching the name
    // Must be a 'view' page, not just a 'search' results page
    const currentUrl = page.url();
    const currentTitle = await page.title().catch(() => '');
    if (currentUrl.includes('/view') && currentTitle.toLowerCase().includes(name.toLowerCase())) {
      console.log(`Already on record view page for "${name}"`);
      await this.waitForAppReady(page);
      return;
    }

    // Use exact role-based link match — avoids false matches in Opportunity/Account Name columns
    const resultLink = page.getByRole('link', { name, exact: true }).first();

    await resultLink.waitFor({ state: 'visible', timeout: 30000 }).catch(async () => {
      const finalUrl = page.url();
      const finalTitle = await page.title().catch(() => '');
      if (finalUrl.includes('/view') && finalTitle.toLowerCase().includes(name.toLowerCase())) return;
      throw new Error(`Search result for "${name}" not found after 30s. Current URL: ${finalUrl}`);
    });

    if (!page.url().includes('/view')) {
      await resultLink.click();
      await this.waitForLoading(page);
      await this.waitForAppReady(page);
    }
  }

  /**
   * Returns true if a global search for `name` returns at least one matching link.
   * Use this as a lighter-weight existence check before deciding whether to create a record.
   */
  static async searchExists(page: Page, name: string): Promise<boolean> {
    await this._triggerGlobalSearch(page, name);
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return page.getByRole('link', { name: new RegExp(`^${escaped}$`, 'i') })
      .first().isVisible({ timeout: 10000 }).catch(() => false);
  }
}
