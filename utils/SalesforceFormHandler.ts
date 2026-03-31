import { type Page, type Locator } from '@playwright/test';

/**
 * SalesforceFormHandler — Centralized Salesforce LWC form utility
 *
 * Usage (per MasterPrompt):
 *   const sfHandler = new SalesforceFormHandler(page);
 *   await sfHandler.fillText('Account Name', 'Acme Corp');
 *   await sfHandler.selectCombobox('Type', 'Prospect');
 *   await sfHandler.checkCheckbox('Is Primary');
 *
 * Optional scoping to a container (e.g. a dialog):
 *   const sfHandler = new SalesforceFormHandler(page, dialog);
 *
 * Why these patterns:
 *  - Salesforce renders inside Shadow DOM via lightning-input / lightning-input-field
 *  - Standard .fill() alone doesn't fire LWC change events
 *  - click({clickCount:3}) selects existing text; fill() sets value; press('Tab') fires blur/change
 *  - pressSequentially() fires per-char events for reactive search fields (lookups)
 */
export class SalesforceFormHandler {
    private page: Page;
    private container: Locator;

    constructor(page: Page, container?: Locator) {
        this.page = page;
        this.container = container ?? page.locator('body');
    }

    // ─── TEXT FIELDS ─────────────────────────────────────────────────────────

    /** Fill a text input field (alias: fillTextField) */
    async fillText(label: string, value: string): Promise<void> {
        const fieldLabel = label.replace(/_/g, ' ');

        // Strategy 1: ARIA role — waitFor ensures LWC has finished rendering
        try {
            const input = this.container.getByRole('textbox', { name: fieldLabel, exact: false }).first();
            await input.waitFor({ state: 'visible', timeout: 10000 });
            await input.scrollIntoViewIfNeeded();
            await input.click({ clickCount: 3 });
            await input.fill(value);
            await input.press('Tab');
            return;
        } catch {}

        // Strategy 2: getByLabel (standard HTML label association)
        try {
            const input = this.container.getByLabel(fieldLabel, { exact: false }).first();
            await input.waitFor({ state: 'visible', timeout: 5000 });
            await input.scrollIntoViewIfNeeded();
            await input.click({ clickCount: 3 });
            await input.fill(value);
            await input.press('Tab');
            return;
        } catch {}

        // Strategy 3: Walk up from text label to adjacent input (most reliable for LWC)
        try {
            const input = this.container.locator('*')
                .filter({ hasText: new RegExp(`^\\*?\\s*${fieldLabel}\\s*$`, 'i') })
                .locator('..')
                .locator('input, textarea')
                .first();
            await input.waitFor({ state: 'visible', timeout: 5000 });
            await input.scrollIntoViewIfNeeded();
            await input.click({ clickCount: 3 });
            await input.fill(value);
            await input.press('Tab');
            return;
        } catch {}

        // Strategy 4: aria-label (CSS engine pierces Shadow DOM)
        try {
            const input = this.page.locator(`[aria-label="${fieldLabel}"], [aria-label*="${fieldLabel}"]`).first();
            await input.waitFor({ state: 'visible', timeout: 5000 });
            await input.scrollIntoViewIfNeeded();
            await input.click({ clickCount: 3 });
            await input.fill(value);
            await input.press('Tab');
            return;
        } catch {}

        console.warn(`⚠️ fillText: Could not locate field "${fieldLabel}"`);
    }

    /** Alias for fillText (backward compat) */
    async fillTextField(label: string, value: string): Promise<void> {
        return this.fillText(label, value);
    }

    // ─── COMBOBOX / PICKLIST ─────────────────────────────────────────────────

    /** Select a value from a Salesforce Lightning picklist / combobox */
    async selectCombobox(label: string, value: string): Promise<void> {
        console.log(`   -> Filling Picklist: "${label}" with "${value}"`);
        try {
            // Universal trigger: lightning-combobox or slds-form-element containing the label
            const dropdownBtn = this.container
                .locator('lightning-combobox, div.slds-form-element')
                .filter({ hasText: new RegExp(`^\\*?\\s*${label}`, 'i') })
                .locator('button[role="combobox"], input[role="combobox"]')
                .first();

            const btnReady = await dropdownBtn.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false);
            if (btnReady) {
                await dropdownBtn.scrollIntoViewIfNeeded();
                await dropdownBtn.click({ force: true });
            } else {
                // Fallback: getByRole combobox
                const combo = this.container.getByRole('combobox', { name: label, exact: false });
                await combo.waitFor({ state: 'visible', timeout: 8000 });
                await combo.click();
            }

            // Wait for option to appear and click
            const option = this.page
                .locator(`lightning-base-combobox-item, [role="option"]`)
                .filter({ hasText: new RegExp(`^${value}$`, 'i') })
                .first();
            await option.waitFor({ state: 'visible', timeout: 8000 });
            await option.scrollIntoViewIfNeeded().catch(() => {});
            await option.click({ force: true });

        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            console.log(`   ⚠️ selectCombobox SOFT FAIL: "${label}" → "${value}". ${msg}`);
        }
    }

    /** Alias for selectCombobox */
    async fillPicklist(label: string, value: string): Promise<void> {
        return this.selectCombobox(label, value);
    }

    // ─── LOOKUP FIELDS ───────────────────────────────────────────────────────

    /** Fill a Salesforce lookup field (typeahead search + suggestion selection) */
    async fillLookup(label: string, value: string): Promise<void> {
        const fieldLabel = label.replace(/_/g, ' ');
        console.log(`   -> Filling Lookup: "${fieldLabel}" with "${value}"`);

        // Find lookup input
        const fieldContainer = this.container
            .locator('div.slds-form-element, lightning-lookup, force-record-layout-item')
            .filter({ hasText: new RegExp(`^\\*?\\s*${fieldLabel}`, 'i') })
            .first();

        let input: Locator = fieldContainer.locator('input[role="combobox"], input[type="text"]').first();
        const inputReady = await input.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
        if (!inputReady) {
            input = this.container
                .locator(`label:has-text("${fieldLabel}")`)
                .locator('..')
                .locator('input[role="combobox"], input[type="text"]')
                .first();
        }

        try {
            await input.waitFor({ state: 'visible', timeout: 8000 });
            await input.scrollIntoViewIfNeeded();
            await input.click({ force: true });
            await input.clear();
            await input.pressSequentially(value.substring(0, 15), { delay: 80 });

            // Wait for options to appear — Salesforce listbox container may not be "visible" to Playwright
            // but [role="option"] items are directly accessible on the page
            const option = this.page.locator('[role="option"]')
                .filter({ has: this.page.locator(`[title="${value}"]`) })
                .or(this.page.locator('[role="option"]').filter({ hasText: value }))
                .first();

            const optionReady = await option.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false);
            if (optionReady) {
                // Use native scrollIntoView to handle options inside scrollable listbox containers
                await option.evaluate(el => el.scrollIntoView({ block: 'nearest', behavior: 'instant' })).catch(() => {});
                await this.page.waitForTimeout(100);
                await option.click({ force: true });
                console.log(`      ✅ Selected "${value}"`);
            } else {
                // Fallback: try pressing Enter to trigger search and try again
                await input.press('Enter');
                const optionRetry = this.page.locator('[role="option"]')
                    .filter({ has: this.page.locator(`[title="${value}"]`) })
                    .or(this.page.locator('[role="option"]').filter({ hasText: value }))
                    .first();
                const retryReady = await optionRetry.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
                if (retryReady) {
                    await optionRetry.evaluate(el => el.scrollIntoView({ block: 'nearest', behavior: 'instant' })).catch(() => {});
                    await optionRetry.click({ force: true });
                    console.log(`      ✅ Selected "${value}" (retry)`);
                } else {
                    throw new Error(`Could not find "${value}" in suggestion dropdown.`);
                }
            }
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            console.log(`      ❌ fillLookup: ${msg}`);
            throw error;
        }
    }

    // ─── CHECKBOXES ──────────────────────────────────────────────────────────

    /** Check or uncheck a Salesforce checkbox field */
    async checkCheckbox(label: string, shouldCheck = true): Promise<void> {
        const fieldLabel = label.replace(/_/g, ' ');

        let checkbox: Locator = this.container.getByRole('checkbox', { name: fieldLabel }).first();
        const cbReady = await checkbox.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
        if (!cbReady) {
            checkbox = this.container
                .locator('label')
                .filter({ hasText: fieldLabel })
                .locator('..')
                .locator('input[type="checkbox"]')
                .first();
        }

        const cbVisible = await checkbox.waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false);
        if (cbVisible) {
            await checkbox.scrollIntoViewIfNeeded();
            const isChecked = await checkbox.isChecked();
            if (isChecked !== shouldCheck) {
                await checkbox.click();
            }
        } else {
            // Salesforce hidden checkbox — click the visual span instead
            const faux = this.container
                .locator('label')
                .filter({ hasText: fieldLabel })
                .locator('..')
                .locator('span.slds-checkbox_faux')
                .first();
            const fauxVisible = await faux.waitFor({ state: 'visible', timeout: 2000 }).then(() => true).catch(() => false);
            if (fauxVisible) {
                await faux.click({ force: true });
            } else {
                console.warn(`⚠️ checkCheckbox: Could not find "${fieldLabel}"`);
            }
        }
    }

    /** Alias for checkCheckbox */
    async fillCheckbox(label: string, value: string | boolean): Promise<void> {
        return this.checkCheckbox(label, String(value).toLowerCase() === 'true');
    }

    // ─── RADIO GROUPS ────────────────────────────────────────────────────────

    async fillRadioGroup(label: string, value: string): Promise<void> {
        const fieldLabel = label.replace(/_/g, ' ');
        const group = this.container.locator('fieldset').filter({ hasText: fieldLabel }).first();

        let radio: Locator = await group.isVisible()
            ? group.getByLabel(value).first()
            : this.container.getByRole('radio', { name: value }).first();

        if (!(await radio.isVisible({ timeout: 3000 }).catch(() => false))) {
            radio = this.container
                .locator('label, span').filter({ hasText: value })
                .locator('..').locator('input[type="radio"]').first();
        }

        if (await radio.isVisible({ timeout: 3000 }).catch(() => false)) {
            await radio.scrollIntoViewIfNeeded();
            await radio.click({ force: true });
        } else {
            console.warn(`⚠️ fillRadioGroup: Could not find "${value}" in "${fieldLabel}"`);
        }
    }

    // ─── MULTI-SELECT (DUAL LISTBOX) ─────────────────────────────────────────

    async fillMultiSelect(label: string, value: string): Promise<void> {
        const fieldLabel = label.replace(/_/g, ' ');
        try {
            const dualListBox = this.container
                .locator('lightning-dual-listbox')
                .filter({ hasText: new RegExp(fieldLabel, 'i') })
                .first();

            await dualListBox.waitFor({ state: 'visible', timeout: 5000 });
            await dualListBox.scrollIntoViewIfNeeded();

            const optionToSelect = dualListBox.locator('[role="option"]').filter({ hasText: value }).first();
            await optionToSelect.waitFor({ state: 'visible', timeout: 3000 });
            await optionToSelect.click({ force: true });

            const rightArrow = dualListBox
                .locator('button[title="Move selection to Chosen"], button[title="Move to Chosen"]').first();
            await rightArrow.waitFor({ state: 'visible', timeout: 3000 });
            await rightArrow.click({ force: true });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            console.log(`⚠️ fillMultiSelect: "${label}" → "${value}". ${msg}`);
        }
    }

    // ─── SAFE CLICK ──────────────────────────────────────────────────────────

    async safeClick(locatorString: string, timeout = 10000): Promise<boolean> {
        const element = this.page.locator(locatorString).first();
        try {
            await element.waitFor({ state: 'visible', timeout });
            await element.click({ force: true });
            return true;
        } catch {
            console.log(`⚠️ safeClick: "${locatorString}" not found`);
            return false;
        }
    }
}
