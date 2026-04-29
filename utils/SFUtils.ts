import { Page, Locator, FrameLocator } from '@playwright/test';

/**
 * Robust Salesforce Utilities (Agentic Framework Ready)
 */
export class SFUtils {
  static MODAL = '[role="dialog"]:not([id="auraError"]):not([aria-hidden="true"])';
  static SPINNER = '.slds-spinner_container, .slds-spinner, .forceVisualMessageQueue';

  static async goto(page: Page, url: string) {
    // Normalize Salesforce domain: lightning.force.com URLs lose session cookies;
    // always use the my.salesforce.com domain where the session is authenticated.
    const normalizedUrl = url.replace(
      /([a-z0-9-]+)\.lightning\.force\.com/i,
      '$1.my.salesforce.com'
    );
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
    const humanLabel = apiName.replace(/__c$/, '').replace(/([A-Z])/g, ' $1').trim();
    const shortLabel  = humanLabel.replace(/ Name$/, '').replace(/ Id$/, '').trim();
    const labelCandidates = [...new Set([shortLabel, humanLabel, apiName])].filter(Boolean);

    const doFill = async (input: Locator) => {
      await input.waitFor({ state: 'visible', timeout: 12000 });
      await input.click();
      await input.fill(value);
      await input.press('Tab');
    };

    // S1: data-field-api-name → inner input. Uses waitFor (not isVisible) so it waits for the
    // modal's form content to fully render before giving up.
    const field = this.getField(root, apiName);
    const cssInput = field.locator('input, textarea').first();
    try {
      await cssInput.waitFor({ state: 'visible', timeout: 15000 });
      await doFill(cssInput);
      return;
    } catch { /* try next */ }

    // S2: input[name] / textarea[name] — direct attribute across shadow DOM
    const byName = root.locator(`input[name="${apiName}"], textarea[name="${apiName}"]`).first();
    try {
      await byName.waitFor({ state: 'visible', timeout: 8000 });
      await doFill(byName);
      return;
    } catch { /* try next */ }

    // S3: getByLabel (aria tree — pierces shadow DOM)
    for (const lbl of labelCandidates) {
      const el = (root as Locator | Page).getByLabel(lbl, { exact: false }).first();
      try {
        await el.waitFor({ state: 'visible', timeout: 5000 });
        await doFill(el);
        return;
      } catch { /* try next */ }
    }

    // S4: .slds-form-element filtered by visible label → inner input
    for (const lbl of labelCandidates) {
      const formEl = root.locator('.slds-form-element').filter({
        has: root.locator('label, .slds-form-element__label').filter({
          hasText: new RegExp(`^[*\\s]*${lbl}[*\\s]*$`, 'i'),
        }),
      }).first();
      try {
        await formEl.waitFor({ state: 'visible', timeout: 3000 });
        const inp = formEl.locator('input, textarea').first();
        await inp.waitFor({ state: 'visible', timeout: 3000 });
        await doFill(inp);
        return;
      } catch { /* try next */ }
    }

    throw new Error(`fillField: could not locate field "${apiName}" to fill with "${value}"`);
  }

  static async selectCombobox(page: Page, root: Page | Locator | FrameLocator, apiName: string, label: string) {
    // Derive human-readable label candidates from the API name
    // e.g. "StageName" → "Stage Name" → "Stage" | "CloseDate" → "Close Date"
    const humanLabel = apiName.replace(/__c$/, '').replace(/([A-Z])/g, ' $1').trim();
    const shortLabel  = humanLabel.replace(/ Name$/, '').replace(/ Id$/, '').trim();
    const labelCandidates = [...new Set([shortLabel, humanLabel, apiName])].filter(Boolean);

    const pickOption = async () => {
      const opt = page.locator('lightning-base-combobox-item, [role="option"], .slds-listbox__item')
        .filter({ hasText: new RegExp(`^\\s*${label}\\s*$`, 'i') }).first();
      await opt.waitFor({ state: 'visible', timeout: 8000 });
      await opt.click();
    };

    // === S1: native <select> via data-field-api-name ===
    const nativeSelect = root.locator(
      `[data-field-api-name="${apiName}"] select, [field-name="${apiName}"] select`
    ).first();
    try {
      await nativeSelect.waitFor({ state: 'visible', timeout: 10000 });
      await nativeSelect.selectOption({ label });
      await this.waitForLoading(page);
      return;
    } catch { /* try next */ }

    // === S2: getByLabel — uses aria tree, pierces Salesforce LWC shadow DOM ===
    for (const lbl of labelCandidates) {
      const el = (root as Locator | Page).getByLabel(lbl, { exact: false }).first();
      try {
        await el.waitFor({ state: 'visible', timeout: 5000 });
        const tag = await el.evaluate((n: Element) => n.tagName.toLowerCase()).catch(() => '');
        if (tag === 'select') {
          await el.selectOption({ label });
        } else {
          await el.click();
          await page.waitForTimeout(500);
          await pickOption();
        }
        await this.waitForLoading(page);
        return;
      } catch { /* try next */ }
    }

    // === S3: .slds-form-element filtered by visible label text ===
    for (const lbl of labelCandidates) {
      const formEl = root.locator('.slds-form-element').filter({
        has: page.locator('label, .slds-form-element__label').filter({
          hasText: new RegExp(`^[*\\s]*${lbl}[*\\s]*$`, 'i'),
        }),
      }).first();
      if (await formEl.isVisible({ timeout: 3000 }).catch(() => false)) {
        const sel = formEl.locator('select').first();
        if (await sel.isVisible({ timeout: 1000 }).catch(() => false)) {
          await sel.selectOption({ label });
          await this.waitForLoading(page);
          return;
        }
        const trigger = formEl.locator('input[role="combobox"], button[aria-haspopup], button').first();
        await trigger.click();
        await page.waitForTimeout(500);
        await pickOption();
        await this.waitForLoading(page);
        return;
      }
    }

    // === S4: data-field-api-name container → inner trigger ===
    const fieldContainer = root.locator(
      `[data-field-api-name="${apiName}"], [field-name="${apiName}"]`
    ).first();
    if (await fieldContainer.isVisible({ timeout: 3000 }).catch(() => false)) {
      const trigger = fieldContainer.locator('select, input[role="combobox"], button').first();
      const tag = await trigger.evaluate((n: Element) => n.tagName.toLowerCase()).catch(() => '');
      if (tag === 'select') {
        await trigger.selectOption({ label });
      } else {
        await trigger.click();
        await page.waitForTimeout(500);
        await pickOption();
      }
      await this.waitForLoading(page);
      return;
    }

    // === S5: last resort — any <select> in scope whose options include the target label ===
    const allSelects = root.locator('select');
    const count = await allSelects.count();
    for (let i = 0; i < count; i++) {
      const sel = allSelects.nth(i);
      const opts = await sel.locator('option').allInnerTexts().catch(() => [] as string[]);
      if (opts.some(o => o.trim().toLowerCase() === label.toLowerCase())) {
        await sel.selectOption({ label });
        await this.waitForLoading(page);
        return;
      }
    }

    throw new Error(`selectCombobox: could not locate field "${apiName}" to select "${label}"`);
  }

  static async fillName(root: Page | Locator | FrameLocator, subFieldName: 'firstName' | 'lastName', value: string) {
    const input = root.locator(`input[name="${subFieldName}"]`).first();
    await input.waitFor({ state: 'visible', timeout: 15000 });
    await input.click(); // Wake up listener
    await input.fill(value);
  }

  static async waitForNavigationOrToast(page: Page, substrings: string | string[], _recordName?: string): Promise<string> {
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