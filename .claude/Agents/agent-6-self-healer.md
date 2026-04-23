---
name: agent-6-self-healer
description: Analyse failed Playwright tests, classify failures, apply intelligent fixes, and re-run tests to confirm stability. Supports up to 3 healing iterations. Fully dynamic and CPQ-aware.
---

# Agent 6 — Intelligent Self-Healer

## Role
Automatically analyse failed Playwright tests, identify root cause, apply targeted fixes, and re-run tests to confirm resolution.

This agent improves test stability WITHOUT modifying business logic.

---

## Inputs
- `reports/results.json`
- `tests/{object}.spec.ts`
- Domain context from Agent 1
- `knowledge/scraped-locators.json` (if available)
- Playwright traces in `test-results/`

---

## Failure Classification (STRICT)

### Legacy Category Mapping (backward compatibility)

If `reports/results.json` contains Agent 5 legacy category names, remap them before classification:

| Legacy (Agent 5 old) | Canonical (Agent 6) |
|----------------------|---------------------|
| `LOCATOR`            | `selector_failure`  |
| `SYNC`               | `timing_failure`    |
| `SF_SYSTEM`          | `environment_failure` |
| `BUSINESS_LOGIC`     | Inspect error message: if a tab-locked field is referenced → `tab_navigation_failure`; if a record is missing → `data_failure`; otherwise → `selector_failure` |

Always normalise to canonical names before routing to a fix strategy.

---

Classify each failure into ONE of:

### 1. selector_failure
Symptoms:
- locator not found
- multiple elements found
- strict mode violation

Fix:
- Use `.first()`
- Use better scoped locator
- Prefer scraped locators

---

### 2. timing_failure
Symptoms:
- timeout errors
- element not ready
- click intercepted

Fix:
- Add `.waitFor({ state: 'visible' })`
- Add wait for spinner disappearance
- Add `dismissAuraError(page)`

---

### 3. data_failure
Symptoms:
- missing records
- lookup failures
- validation errors

Fix:
- Create prerequisite data dynamically
- Add helper inside test

---

### 4. tab_navigation_failure
Symptoms:
- locator times out on a record detail page
- field not found but locator pattern looks correct
- error occurs immediately after page navigation (before any interaction)
- error message references a field that lives on Details tab (Stage, Amount, Industry, Phone, etc.)

Fix:
- Insert `await clickTab(page, 'Details');` (or the relevant tab name) immediately after `waitForLoadState`
- Confirm `clickTab` helper exists in the spec file header — if missing, add it
- Do NOT change the field locator itself; only add the tab navigation step before it

Priority check before classifying as selector_failure: if the failing line targets a record-page field and no `clickTab` call precedes it in the same test, reclassify as tab_navigation_failure first.

---

### 5. environment_failure
Symptoms:
- login/session expired
- network failure
- Salesforce org issue

Fix:
- DO NOT auto-fix
- Log and exit

---

## Healing Workflow

### Step 1 — Read Failures
- Parse `reports/results.json`
- Extract:
  - TC ID
  - Error message
  - Spec file
  - Step failure

---

### Step 2 — Classify Failure
Use keyword-based + pattern-based classification.

---

### Step 3 — Apply Fix

#### A. Selector Fix Strategy (DYNAMIC)

**Step 1 — ALWAYS Use SFUtils**
The primary fix for any selector failure is to convert raw locators into `SFUtils` calls. This leverages the dynamic `scraped-locators.json` database.

| Failure | Fix using SFUtils |
|---------|-------------------|
| Input/Textarea not found | `await SFUtils.fillField(modal, 'LabelOrApiName', value);` |
| Picklist/Combobox error | `await SFUtils.selectCombobox(page, modal, 'LabelOrApiName', 'Option');` |
| Lookup timeout | `await SFUtils.fillLookup(page, modal, 'LabelOrApiName', 'Value');` |
| Name field error | `await SFUtils.fillName(modal, 'firstName'\|'lastName', value);` |

**Step 2 — Identification Logic**
1. Check `knowledge/scraped-locators.json` for the field's `apiName`.
2. If no API Name exists, use the literal Label found on the screen (e.g., `'Salutation'`).
3. `SFUtils.getField` will automatically resolve the best selector at runtime.

**Step 3 — Compound Name field (CRITICAL)**
If healing a Contact/Lead form, NEVER use `LastName` as an API name. Use the `fillName` helper:
```typescript
await SFUtils.fillName(modal, 'lastName', 'Smith');
```

---

#### B. Timing Fix Strategy
Use the robust helpers in `SFUtils`:
```typescript
await SFUtils.waitForLoading(page);
await dismissAuraError(page);
```
Add explicit waits only as a last resort:
```typescript
await locator.waitFor({ state: 'visible', timeout: 30000 });
```

---

#### C. Tab Navigation (MANDATORY FIX)
If a field on a record detail page is not found:
1. Insert `await clickTab(page, 'Details');` immediately after navigation.
2. Ensure `SFUtils.waitForLoading(page)` is called after the tab click.