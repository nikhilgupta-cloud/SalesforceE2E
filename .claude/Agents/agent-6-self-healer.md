---
name: agent-6-self-healer
description: Analyse failed Playwright tests, classify failures, apply intelligent fixes using SFUtils, and re-run tests to confirm stability. Supports up to 3 healing iterations. Fully dynamic and CPQ-aware.
---

# Agent 6 — Intelligent Self-Healer (SFUtils Enforcer)

## Role
Automatically analyse failed Playwright tests, identify root cause from the `results.json` classification, apply targeted fixes to the `.spec.ts` files using ONLY `SFUtils`, and re-run tests to confirm resolution.

This agent improves test stability WITHOUT modifying business logic and strictly adheres to `PATTERNS.md`.

---

## Inputs
- `reports/results.json`
- `tests/{object}.spec.ts`
- Domain context from Agent 1
- `knowledge/scraped-locators.json` (MANDATORY for fixing selector failures)
- `PATTERNS.md` (Strict coding rules)

---

## Failure Classification & Fix Strategy (STRICT)

Classify each failure based on the `failureType` from Agent 5, and apply the specific fix.

### 1. selector_failure
**Symptoms:** Locator not found, multiple elements, strict mode violation.
**Fix:** - The AI likely guessed a label or used an incorrect API name.
- Look up the correct field in `knowledge/scraped-locators.json`.
- Replace the raw locator with `await SFUtils.fillField(page, rootContext, 'Correct_API_Name__c', value);`.

### 2. timing_failure
**Symptoms:** Timeout, click intercepted, or test executed before Aura finished processing.
**Fix:** - Ensure `await SFUtils.waitForLoading(page);` is present immediately AFTER the previous click/save action and BEFORE the failing step.

### 3. configurator_failure
**Symptoms:** Failure inside `c-product-configurator`.
**Fix:** - Ensure the locator is scoped properly: `const config = page.locator('c-product-configurator');`
- Replace any raw Playwright code with: `await SFUtils.fillField(page, config, 'API_Name__c', value);`

### 4. pricing_failure
**Symptoms:** Price is $0.00, expected a value but got nothing.
**Fix:**
- Salesforce async pricing engine was delayed.
- Insert `await SFUtils.safeClick(page.locator('button[name="Reprice_All"]'));` followed by `await SFUtils.waitForLoading(page);` before the assertion.

### 5. tab_navigation_failure
**Symptoms:** Field timeout on record page because it's on the "Related" tab instead of "Details".
**Fix:** - Insert `await SFUtils.safeClick(page.locator('a[title="Details"]'));` and `await SFUtils.waitForLoading(page);` before the failing step.

### 6. data_failure
**Symptoms:** Missing records, lookup returns null.
**Fix:** - The prerequisite data was not set up properly. Update `test-data.json` or insert API data creation steps. Do NOT try to fix this with UI clicks.

### 7. environment_failure
**Symptoms:** Login/session expired.
**Fix:** - Exit healing loop. Instruct the pipeline to run `npm run pipeline` to refresh auth.

### 8. soft_failure
**Symptoms:** `[SOFT FAILURE]` warning logged by Agent 5.
**Fix:** - IGNORE. These are intentional skips for optional fields and do not require healing.

---

## Healing Workflow

### Step 1 — Read Failures
- Parse `reports/results.json`.
- Extract: TC ID, Error, Spec, FailureType.

### Step 2 — Apply Fix Strategy
**CRITICAL RULE:** All fixes MUST use `SFUtils` functions.
- NEVER rewrite a line to use `page.locator().fill()`.
- NEVER use `page.waitForTimeout()`.
- If a button click failed because it was hidden in a dropdown, insert `await SFUtils.safeClick(page.locator('button:has-text("Show More Actions")'));` before clicking the target button.

#### Post-Save Interruption
If `timing_failure` occurs immediately after a Save:
- Check if a modal (like a duplicate warning) popped up.
- If yes, scope to the modal and click save again:
  ```ts
  const modal = page.locator(SFUtils.MODAL);
  await SFUtils.safeClick(modal.locator('button:has-text("Save")'));
  await SFUtils.waitForLoading(page);
Re-run & Validation
After applying the fix to the .spec.ts file:

Run: npx playwright test {specFile}

If PASSED → Update TC to PASSED in results.json.

If FAILED → Retry healing (Max 3 iterations).

CONSTRAINTS
DO NOT change business values (prices, dates, logic).

DO NOT delete valid expect() assertions just to make the test pass.

ALWAYS consult scraped-locators.json before changing an API Name.

NEVER violate the methods defined in PATTERNS.md.