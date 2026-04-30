# Playwright Patterns — Salesforce Lightning (LWC)

This is the **single source of truth** for all Playwright interaction patterns used in this framework.

**CRITICAL DIRECTIVE FOR AI AGENTS:** You are acting as a Test Assembler. You MUST use the mapped utility functions imported from the `SFUtils` class for interactions. NEVER use raw `page.locator().fill()` or `page.locator().click()` for standard field fills, clicks, or waits.

Referenced by:
- [`SKILL.MD`](./SKILL.MD) — automate skill decision engine
- [`FRAMEWORK-GUIDE.html`](../../../FRAMEWORK-GUIDE.html) — patterns reference section
- [`CLAUDE.md`](../../../CLAUDE.md) — architecture patterns overview

---

## Pattern A: Standard Field Fill (Text, Picklist, Lookup, Checkbox, Date)
**Utility:** `SFUtils.fillField(page, root, apiName, value)`
This single utility automatically detects and handles the LWC shadow DOM for `lightning-input`, `lightning-combobox`, `lightning-lookup`, and checkboxes.

```ts
// ✅ CORRECT - ALWAYS use API Names from test data / scraped JSON
await SFUtils.fillField(page, page, 'Name', data.account.Account_Name);
await SFUtils.fillField(page, page, 'StageName', 'Closed Won');
await SFUtils.fillField(page, page, 'CloseDate', '2026-12-31');
await SFUtils.fillField(page, page, 'Is_Active__c', 'true'); // Checkboxes take 'true'/'false'

// ❌ INCORRECT (Do not generate this)
await page.locator('[data-field-api-name="Name"] input').fill('Acme Corp');
Pattern B: Standard Clicks (Buttons, Tabs, Links)
Utility: SFUtils.safeClick(locator)
Use this for all buttons, tabs, and action menus. It includes built-in retry, scrolling, and force-click logic.

TypeScript
// ✅ CORRECT
await SFUtils.safeClick(page.locator('button[name="SaveEdit"]'));
await SFUtils.safeClick(page.locator('button:has-text("Next")'));
await SFUtils.safeClick(page.locator('a[title="Related"]'));
Pattern C: Synchronization (MANDATORY)
Utility: SFUtils.waitForLoading(page)
Salesforce processes asynchronously. You MUST call this after any Save, Reprice, Grid Edit, or Page Navigation. This waits for both UI spinners and background Aura network traffic.

TypeScript
// ✅ CORRECT
await SFUtils.safeClick(page.locator('button[name="SaveEdit"]'));
await SFUtils.waitForLoading(page);
Pattern D: AG-Grid (RLM Line Editor / QLE)
Utility: SFUtils.fillQleGridCell(page, rowIdentifier, columnId, value)
RLM uses AG-Grid. You cannot use standard locators here. (Assume this method exists in SFUtils for grid edits).

TypeScript
// ✅ CORRECT
await SFUtils.fillQleGridCell(page, data.quoteline.ProductCode, 'Quantity', '10');
await SFUtils.waitForLoading(page); // Mandatory after grid edits
Pattern E: Modal-Scoped Interactions
ALWAYS scope interactions inside a modal to the modal container to prevent interacting with background elements. Pass the modal locator as the root parameter.

TypeScript
const modal = page.locator(SFUtils.MODAL);
await modal.waitFor({ state: 'visible', timeout: 10000 });

// Scoped fills and clicks
await SFUtils.fillField(page, modal, 'Description', 'Modal Update');
await SFUtils.safeClick(modal.locator('button:has-text("Save")'));
await SFUtils.waitForLoading(page);
Pattern F: Toast Validation
Salesforce success/error messages are rendered as SLDS toast notifications.

TypeScript
const toast = page.locator('.slds-notify_toast');
await expect(toast).toBeVisible({ timeout: 15000 });
await expect(toast).toContainText('was saved');

// Wait for toast to clear before next action
await toast.waitFor({ state: 'hidden', timeout: 15000 });
Pattern G: iFrame Handling
For embedded visualforce or external flows.

TypeScript
const frame = page.frameLocator('iframe[title="Target Frame Title"]');
await SFUtils.safeClick(frame.locator('button:has-text("Submit")'));
Pattern H: Field Error Validation
Validating LWC form validation rules (Constraint rules).

TypeScript
const error = page.locator('.slds-form-element__help, .slds-theme_error');
await expect(error).toBeVisible({ timeout: 5000 });
await expect(error).toContainText('Complete this field');
Pattern I: List View / Related List Row Actions
Opening the dropdown menu on a related list row.

TypeScript
const row = page.locator('[role="row"]').filter({ hasText: 'Acme Corp' }).first();
await SFUtils.safeClick(row.locator('button[aria-haspopup="true"]'));

const menu = page.locator('[role="menu"]');
await SFUtils.safeClick(menu.locator('[role="menuitem"]:has-text("Edit")'));
await SFUtils.waitForLoading(page);
Pattern J: Product Selection Modal (Revenue Cloud)
Interaction with the RLM "Add Products" selection screen.

TypeScript
// 1. Open Modal
await SFUtils.safeClick(page.locator('button:has-text("Add Products")'));
const modal = page.locator(SFUtils.MODAL);

// 2. Search for Product
await modal.locator('input[type="search"]').fill(data.product.Name);
await page.keyboard.press('Enter');
await SFUtils.waitForLoading(page);

// 3. Select Product Row
const row = modal.locator('[role="row"]').filter({ hasText: data.product.Name });
await SFUtils.safeClick(row.locator('lightning-input[type="checkbox"] input'));

// 4. Proceed
await SFUtils.safeClick(modal.locator('button:has-text("Next")'));
await SFUtils.waitForLoading(page);
Pattern K: Configurator Attributes (CML Testing)
Verifying Revenue Cloud CML rule consequences.

TypeScript
const configContainer = page.locator('.configurator-container, c-product-configurator');
await configContainer.waitFor({ state: 'visible' });

// Verify dynamic visibility (CML "Hide" Rule)
const attribute = configContainer.locator('lightning-input').filter({ hasText: /Processor/i });
await expect(attribute).toBeHidden();

// Select attribute and wait for config engine
await SFUtils.fillField(page, configContainer, 'Memory_Size__c', '16GB');
await SFUtils.waitForLoading(page);

// Verify Constraint Message
const message = configContainer.locator('.slds-theme_error');
await expect(message).toContainText('Incompatible with selected Processor');
Pattern L: Global Quote Actions
Triggering high-level processes on the Quote record (Reprice, Approval).

TypeScript
// Reprice All
await SFUtils.safeClick(page.locator('button[name="Reprice_All"]'));
await SFUtils.waitForLoading(page);
await expect(page.locator('.slds-notify_toast')).toContainText('Pricing updated');

// Submit for Approval
await SFUtils.safeClick(page.locator('button[name="Submit_Approval"]'));
const modal = page.locator(SFUtils.MODAL);
await SFUtils.fillField(page, modal, 'Comments', 'Standard discount applied');
await SFUtils.safeClick(modal.locator('button:has-text("Submit")'));
await SFUtils.waitForLoading(page);
Pattern M: Lifecycle Transition (Ordered/Contracted)
Triggering Quote → Order → Contract flow using API names.

TypeScript
// 1. Trigger Ordering via Checkbox
await SFUtils.fillField(page, page, 'Ordered', 'true');
await SFUtils.safeClick(page.locator('button[name="SaveEdit"]'));
await SFUtils.waitForLoading(page);

// 2. Verify Order Creation in Related List
await SFUtils.safeClick(page.locator('a[title="Related"]'));
await SFUtils.waitForLoading(page);
const orderLink = page.getByRole('link', { name: /^ORD-/ }).first();
await expect(orderLink).toBeVisible();

// 3. Navigate to Order and Trigger Contracting
await SFUtils.safeClick(orderLink);
await SFUtils.waitForLoading(page);
await SFUtils.fillField(page, page, 'Contracted', 'true');
await SFUtils.safeClick(page.locator('button[name="SaveEdit"]'));
await SFUtils.waitForLoading(page);
Pattern N: Document Generation
Creating and verifying the output PDF.

TypeScript
await SFUtils.safeClick(page.locator('button:has-text("Generate Document")'));
const modal = page.locator(SFUtils.MODAL);

// Select Template
await SFUtils.fillField(page, modal, 'TemplateId', 'Standard Quote Template');

// Generate
await SFUtils.safeClick(modal.locator('button:has-text("Create PDF")'));
await SFUtils.waitForLoading(page);

// Verify ContentDocument in Related List
await SFUtils.safeClick(page.locator('a[title="Related"]'));
await SFUtils.waitForLoading(page);
await expect(page.locator('.slds-card').filter({ hasText: 'Notes & Attachments' })).toContainText('.pdf');
System Helpers
These must be defined in tests/utils/sf-utils.ts and imported into every test.

TypeScript
import { SFUtils } from '../utils/sf-utils';

// Core Framework Utilities:
// - SFUtils.fillField(page, root, apiName, value)
// - SFUtils.safeClick(locator)
// - SFUtils.waitForLoading(page)
// - SFUtils.goto(page, url)
// - SFUtils.searchAndOpen(page, query)