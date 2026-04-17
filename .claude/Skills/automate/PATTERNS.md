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

// Fallback: LWC text filter
const field = page.locator('lightning-input').filter({ hasText: /Account Name/i }).locator('input');
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

**Rules:**
- Always use `.first()` on the trigger — multiple comboboxes may match
- Use `.last()` on options — duplicate label text can appear in the DOM
- Use `{ force: true }` on trigger click — overlay may intercept

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

**Rules:**
- Type at least 3 characters before waiting for options
- Always wait for option visibility — async search has latency

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

// Combobox via API name
const trigger = page.locator('[data-field-api-name="StageName"] button');
await trigger.click({ force: true });
```

---

## Pattern G: Modal-Scoped Interactions

ALWAYS scope all interactions inside a modal to the modal container. Never interact globally when a dialog is open.

```ts
const modal = page.locator('[role="dialog"]:not([id="auraError"]):not([aria-hidden="true"])');
await modal.waitFor({ state: 'visible', timeout: 30000 });

// Scoped field fill
await modal
  .locator('lightning-input')
  .filter({ hasText: /Name/i })
  .locator('input')
  .fill('Test Value');

// Scoped Save button
await modal.getByRole('button', { name: 'Save', exact: true }).click();
```

**Rules:**
- NEVER call `page.locator(...)` for fields when a modal is open
- Always use `modal.locator(...)` to scope every interaction
- The `:not([id="auraError"])` guard prevents matching Salesforce system error dialogs

---

## Pattern H: Toast Validation

Salesforce success/error messages are rendered as SLDS toast notifications.

```ts
// Assert success toast appears
const toast = page.locator('.slds-notify_toast');
await toast.waitFor({ state: 'visible', timeout: 10000 });
await expect(toast).toContainText('was created');

// Wait for toast to dismiss (for chaining actions)
await toast.waitFor({ state: 'hidden', timeout: 15000 });
```

---

## Pattern I: iFrame Handling

Some Salesforce flows embed content in an iframe (e.g. DocuSign, custom Visualforce).

```ts
const frame = page.frameLocator('iframe[title="Your Frame Title"]');
await frame.locator('button:has-text("Save")').click();

// For nested iframes
const outerFrame = page.frameLocator('iframe.outer');
const innerFrame = outerFrame.frameLocator('iframe.inner');
await innerFrame.getByRole('button', { name: 'Submit' }).click();
```

---

## Pattern J: Safe Click (Retry Wrapper)

For elements that occasionally fail due to overlay timing or animation.

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
  throw new Error(`safeClick failed after 3 attempts: ${locator}`);
}
```

**Use sparingly** — prefer fixing the root cause (missing `waitFor`) over wrapping in retry.

---

## Pattern K: Tab Navigation

Switch between tabs on a Salesforce record page (Details, Related, etc.).

```ts
await page.getByRole('tab', { name: 'Related', exact: true }).click();

// Verify tab is active
await expect(page.getByRole('tab', { name: 'Related' })).toHaveAttribute('aria-selected', 'true');
```

---

## Pattern L: Field Error Validation

Validate that a required field shows or hides its inline error message.

```ts
// Assert error is shown after bad submit
const error = page.locator('.slds-form-element__help');
await error.waitFor({ state: 'visible', timeout: 5000 });
await expect(error).toContainText('Complete this field');

// Assert error clears after valid input
await error.waitFor({ state: 'hidden', timeout: 5000 });
```

---

## Pattern M: Lightning Date Pickers

NEVER click the calendar icon or interact with the calendar popup. Always bypass it and fill the underlying input directly.

```ts
// Preferred: label-based
const dateField = page.getByLabel('Close Date');
await dateField.waitFor({ state: 'visible', timeout: 30000 });
await dateField.fill('2026-12-31');
await dateField.press('Tab'); // trigger Salesforce validation

// API name approach
const dateField = page.locator('[data-field-api-name="CloseDate"] input');
await dateField.fill('2026-12-31');
await dateField.press('Tab');

// Fallback: LWC text filter
const dateField = page.locator('lightning-input')
  .filter({ hasText: /Close Date/i })
  .locator('input');
await dateField.fill('2026-12-31');
await dateField.press('Tab');
```

**Rules:**
- ALWAYS use ISO format: `YYYY-MM-DD`
- ALWAYS call `.press('Tab')` after fill to trigger SF validation
- If value does not persist: also call `.blur()` after Tab

**Applies to:** Opportunity Close Date, Contract Start/End Dates, Quote Expiration Date, any Salesforce date field.

---

## Pattern N: List View / Related List Row Actions

Target the row container first, then open its action menu — never click the record link text for actions.

```ts
// Step 1: Locate row by unique text and assert
const row = page.locator('[role="row"]').filter({ hasText: 'Acme Corp' }).first();
await row.waitFor({ state: 'visible', timeout: 30000 });
await expect(row).toContainText('Acme Corp');

// Step 2: Open the row's action dropdown
const actionButton = row.locator('button[aria-haspopup="true"]').first();
await actionButton.click({ force: true });
await page.waitForTimeout(300); // allow menu to render

// Step 3: Scope click to the menu
const menu = page.locator('[role="menu"]');
await menu.waitFor({ state: 'visible' });
await menu.locator('[role="menuitem"]').filter({ hasText: 'Edit' }).click();
```

**Rules:**
- NEVER click the record name link (e.g. "Acme Corp") to trigger an action
- ALWAYS open the `aria-haspopup` button first
- ALWAYS scope to `[role="menu"] [role="menuitem"]`

**Applies to:** Related Lists (Quotes under Opportunity), List Views, RLM Line Item grids, any row-level action.

---

## Spinner Helper

Call after every Save, Pricing recalculation, or AG-Grid edit:

```ts
async function waitForRlmSpinners(page: Page): Promise<void> {
  await Promise.all([
    page.locator('.slds-spinner').waitFor({ state: 'hidden' }).catch(() => {}),
    page.locator('.blockUI').waitFor({ state: 'hidden' }).catch(() => {})
  ]);
}
```

---

## Navigation Helpers

Include in every spec file:

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

async function waitForDetail(page: Page): Promise<void> {
  await page.locator('.slds-page-header').first().waitFor({ state: 'visible' });
}
```
