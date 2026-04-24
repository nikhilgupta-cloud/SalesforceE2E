# Playwright Patterns — Salesforce Lightning (LWC)

This is the **single source of truth** for all Playwright interaction patterns used in this framework.

Referenced by:
- [`SKILL.MD`](./SKILL.MD) — automate skill decision engine
- [`FRAMEWORK-GUIDE.html`](../../../FRAMEWORK-GUIDE.html) — patterns reference section
- [`CLAUDE.md`](../../../CLAUDE.md) — architecture patterns overview

---

## Pattern A: Text Input

Standard text fields rendered as `lightning-input`.

```ts
// Preferred: label-based
const field = page.getByLabel('Account Name');
await field.waitFor({ state: 'visible', timeout: 30000 });
await field.fill('Acme Corp');

// Fallback: API name
const field = page.locator('[data-field-api-name="Name"] input');
await field.waitFor({ state: 'visible' });
await field.fill('Acme Corp');
```

---

## Pattern B: Combobox (Picklist / Dropdown)

Salesforce picklist fields rendered as `lightning-combobox`.

```ts
const trigger = page.locator('lightning-combobox')
  .filter({ hasText: /Stage/i })
  .locator('button')
  .first();
await trigger.click({ force: true });

const option = page.locator('[role="option"]')
  .filter({ hasText: /Closed Won/i })
  .last();
await option.waitFor({ state: 'visible' });
await option.click();
```

---

## Pattern C: Lookup (Record Search)

Salesforce relationship fields rendered as `lightning-lookup`.

```ts
const input = page.locator('lightning-lookup')
  .filter({ hasText: /Account/i })
  .locator('input');
await input.fill('Acme');

const option = page.locator('[role="option"]')
  .filter({ hasText: 'Acme Corp' })
  .first();
await option.waitFor({ state: 'visible' });
await option.click();
```

---

## Pattern D: Checkbox

Boolean fields rendered as `lightning-input` with `type="checkbox"`.

```ts
const checkbox = page.locator('lightning-input[type="checkbox"]').locator('input');
await checkbox.check();

// Verify state after
await expect(checkbox).toBeChecked();
```

---

## Pattern E: AG-Grid (RLM Line Editor)

Revenue Cloud line item grids use AG-Grid. Cells require click-then-enter to activate the input.

```ts
// Click cell to select row
const cell = page.locator('div[role="row"][row-id="row-0"] div[col-id="Quantity"]');
await cell.click({ force: true });
await page.keyboard.press('Enter');

// Fill the activated inline input
const input = page.locator('input.slds-input').last();
await input.fill('10');
await page.keyboard.press('Enter');

// Wait for grid to recalculate
await waitForRlmSpinners(page);
```

**Rules:**
- Always press `Enter` after `click()` to activate the cell editor
- Always press `Enter` after `fill()` to commit the value
- Always call `waitForRlmSpinners()` after any grid edit

---

## Pattern F: API Name Locator (MANDATORY IF AVAILABLE)

When `knowledge/scraped-locators.json` contains a `data-field-api-name` for a field, this pattern MUST be used — it is immune to UI label renames.

```ts
// Input field
const field = page.locator('[data-field-api-name="AccountId"] input');
await field.waitFor({ state: 'visible' });
await field.fill('Acme Corp');
```

---

## Pattern G: Modal-Scoped Interactions

ALWAYS scope all interactions inside a modal to the modal container.

```ts
const modal = page.locator('[role="dialog"]:not([id="auraError"]):not([aria-hidden="true"])');
await modal.waitFor({ state: 'visible', timeout: 30000 });

// Scoped field fill
await modal.locator('lightning-input').filter({ hasText: /Name/i }).locator('input').fill('Test Value');

// Scoped Save button
await modal.getByRole('button', { name: 'Save', exact: true }).click();
```

---

## Pattern H: Toast Validation

Salesforce success/error messages are rendered as SLDS toast notifications.

```ts
// Assert success toast appears
const toast = page.locator('.slds-notify_toast');
await toast.waitFor({ state: 'visible', timeout: 10000 });
await expect(toast).toContainText('was created');

// Wait for toast to dismiss
await toast.waitFor({ state: 'hidden', timeout: 15000 });
```

---

## Pattern I: iFrame Handling

```ts
const frame = page.frameLocator('iframe[title="Your Frame Title"]');
await frame.locator('button:has-text("Save")').click();
```

---

## Pattern J: Safe Click (Retry Wrapper)

```ts
async function safeClick(locator: Locator): Promise<void> {
  for (let i = 0; i < 3; i++) {
    try {
      await locator.click();
      return;
    } catch {
      await locator.page().waitForTimeout(500);
    }
  }
}
```

---

## Pattern K: Tab Navigation

```ts
await page.getByRole('tab', { name: 'Related', exact: true }).click();
await expect(page.getByRole('tab', { name: 'Related' })).toHaveAttribute('aria-selected', 'true');
```

---

## Pattern L: Field Error Validation

```ts
const error = page.locator('.slds-form-element__help');
await error.waitFor({ state: 'visible', timeout: 5000 });
await expect(error).toContainText('Complete this field');
```

---

## Pattern M: Lightning Date Pickers

```ts
const dateField = page.getByLabel('Close Date');
await dateField.fill('2026-12-31');
await dateField.press('Tab');
```

---

## Pattern N: List View / Related List Row Actions

```ts
const row = page.locator('[role="row"]').filter({ hasText: 'Acme Corp' }).first();
const actionButton = row.locator('button[aria-haspopup="true"]').first();
await actionButton.click({ force: true });

const menu = page.locator('[role="menu"]');
await menu.locator('[role="menuitem"]').filter({ hasText: 'Edit' }).click();
```

---

## Pattern O: Product Selection Modal (Revenue Cloud)

Interaction with the specialized "Add Products" selection screen.

```ts
// 1. Open Modal
await page.getByRole('button', { name: 'Add Products', exact: true }).click();
const modal = page.locator('[role="dialog"]').first();
await modal.waitFor({ state: 'visible' });

// 2. Search for Product
const searchInput = modal.locator('input[type="search"]').first();
await searchInput.fill('Laptop');
await searchInput.press('Enter');
await waitForRlmSpinners(page);

// 3. Select Product Row
const row = modal.locator('[role="row"]').filter({ hasText: 'Laptop' }).first();
await row.locator('lightning-input[type="checkbox"] input').click({ force: true });

// 4. Proceed
await modal.getByRole('button', { name: 'Next', exact: true }).click();
```

---

## Pattern P: Configurator Attributes (CML Testing)

Interacting with the configurator and verifying CML rule consequences.

```ts
// Scope to the configurator container
const configContainer = page.locator('.configurator-container, c-product-configurator');
await configContainer.waitFor({ state: 'visible' });

// Verify dynamic visibility (CML "Hide" Rule)
const attribute = configContainer.locator('lightning-input').filter({ hasText: /Processor/i });
await expect(attribute).toBeHidden();

// Select attribute value
const trigger = configContainer.locator('lightning-combobox').filter({ hasText: /Memory/i }).locator('button');
await trigger.click();
await page.locator('[role="option"]').filter({ hasText: '16GB' }).click();

// Verify Constraint Message
const message = configContainer.locator('.slds-theme_error');
await expect(message).toContainText('Incompatible with selected Processor');
```

---

## Pattern Q: Global Quote Actions

Triggering high-level processes on the Quote record.

```ts
// Reprice All
await page.getByRole('button', { name: 'Reprice All', exact: true }).click();
await waitForRlmSpinners(page);
await expect(page.locator('.slds-notify_toast')).toContainText('Pricing updated');

// Submit for Approval
await page.getByRole('button', { name: 'Submit for Approval', exact: true }).click();
const modal = page.locator('[role="dialog"]');
await modal.locator('textarea').fill('Applying standard discount');
await modal.getByRole('button', { name: 'Submit', exact: true }).click();
```

---

## Pattern R: Lifecycle Transition (Ordered/Contracted)

Triggering and verifying the Quote → Order → Contract flow.

```ts
// 1. Trigger Ordering
const orderedCheckbox = page.locator('[data-field-api-name="Ordered"] input');
await orderedCheckbox.check();
await page.getByRole('button', { name: 'Save', exact: true }).click();
await waitForRlmSpinners(page);

// 2. Verify Order Creation
await page.getByRole('tab', { name: 'Related' }).click();
const orderLink = page.getByRole('link', { name: /^ORD-/ }).first();
await expect(orderLink).toBeVisible();

// 3. Navigate to Order and Contract
await orderLink.click();
const contractedCheckbox = page.locator('[data-field-api-name="Contracted"] input');
await contractedCheckbox.check();
await page.getByRole('button', { name: 'Save', exact: true }).click();
```

---

## Pattern S: Document Generation

Creating and verifying the output PDF.

```ts
await page.getByRole('button', { name: 'Generate Document', exact: true }).click();
const modal = page.locator('[role="dialog"]');

// Select Template
await modal.locator('lightning-lookup').locator('input').fill('Standard Quote Template');
await page.locator('[role="option"]').first().click();

// Generate
await modal.getByRole('button', { name: 'Create PDF', exact: true }).click();
await waitForRlmSpinners(page);

// Verify ContentDocument in Related List
await page.getByRole('tab', { name: 'Related' }).click();
await expect(page.locator('.slds-card').filter({ hasText: 'Notes & Attachments' })).toContainText('.pdf');
```

---

## Spinner Helper

```ts
async function waitForRlmSpinners(page: Page): Promise<void> {
  await Promise.all([
    page.locator('.slds-spinner').waitFor({ state: 'hidden' }).catch(() => {}),
    page.locator('.blockUI').waitFor({ state: 'hidden' }).catch(() => {})
  ]);
  // Small buffer for LWC to settle
  await page.waitForTimeout(500);
}
```

---

## Navigation Helpers

```ts
async function goTo(page: Page, path: string): Promise<void> {
  await page.goto(`${process.env.SF_SANDBOX_URL}${path}`);
  await page.waitForLoadState('domcontentloaded');
  await dismissAuraError(page);
}

async function dismissAuraError(page: Page): Promise<void> {
  const auraError = page.locator('#auraError button[title="Close"]');
  if (await auraError.isVisible().catch(() => false)) {
    await auraError.click();
  }
}
```
