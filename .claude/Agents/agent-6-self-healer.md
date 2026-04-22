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

#### A. Selector Fix Strategy

**Step 1 — Check enriched locators (knowledge/scraped-locators.json)**
- Find the failing field by label in `knowledge/scraped-locators.json`
- If `apiName` is non-null → use Priority 1 selector immediately
- If `apiName` is null → run `npm run enrich:locators` to backfill from Salesforce MCP,
  then retry. If MCP unavailable, fall through.

**Step 2 — Salesforce MCP describe (if scraped-locators has null apiName)**
Use the Salesforce MCP to resolve the field API name:
```
salesforce.describe({ object: "Account" })  // or Contact, Opportunity, Quote
```
Map the failing field label to `name` in the describe response → use `data-field-api-name`.

**Step 3 — Apply locator by priority (STRICT — never skip levels)**

Priority 1 — API Name (most stable):
```typescript
modal.locator('[data-field-api-name="FieldApiName__c"] input').first()
modal.locator('[data-field-api-name="StageName"] button').first()   // picklist
```

Priority 2 — Role-based:
```typescript
page.getByRole('button', { name: 'Save', exact: true }).first()
```

Priority 3 — Label-based:
```typescript
modal.getByLabel('Last Name').first()
```

Priority 4 — LWC combobox fallback (picklists only):
```typescript
modal.locator('lightning-combobox:has-text("Stage") button').first()
```

Priority 5 — LWC input fallback:
```typescript
modal.locator('lightning-input').filter({ hasText: /Label/i }).locator('input').first()
```

**CRITICAL — Compound Name field (Contact / Lead / Person Account):**
If a failure targets `[data-field-api-name="LastName"]` or `[data-field-api-name="FirstName"]`,
these selectors find nothing because Name is a compound field. Fix immediately to:
```typescript
modal.locator('[data-field-api-name="Name"] input[name="lastName"]').first()
modal.locator('[data-field-api-name="Name"] input[name="firstName"]').first()
```

**Step 4 — Always scope to modal and enforce `.first()`**
```typescript
const modal = page.locator('[role="dialog"]:not([id="auraError"]):not([aria-hidden="true"])');
```


---

#### B. Timing Fix Strategy

Add:

await locator.waitFor({ state: 'visible', timeout: 30000 });


Handle spinners:

await page.locator('.sb-loading-mask').waitFor({ state: 'hidden' });


Add safety:

await dismissAuraError(page);


---

#### C. Data Fix Strategy

Inject helper inside test block:

async function createSupportingRecord(page) {
// create Account / Opportunity dynamically
}


Call before failing step.

---

#### D. Environment Failure

DO NOT PATCH.

Write to:

reports/healing-report.md


---

### Step 4 — Patch Rules

- ONLY modify code inside:

// ── US-XXX START ──
// ── US-XXX END ──


- NEVER touch manual code
- NEVER change test intent

---

### Step 5 — Re-run Test

Run ONLY failed test:

npx playwright test --grep "TC-{PREFIX}-{NUMBER}" --headed


---

### Step 6 — Iteration Control

- Max 3 rounds per failure
- Track attempts per TC
- Stop after success OR 3 failures

---

### Step 7 — Cleanup

Delete temporary files:

probe-.ts
probe-.txt


---

## Advanced Recovery (If Selector Still Fails)

1. Create probe script:

await page.goto(${process.env.SF_SANDBOX_URL}/lightning/o/{Object}/new);
const html = await page.locator('body').innerHTML();
fs.writeFileSync('probe-output.txt', html);


2. Extract real labels from DOM
3. Rebuild locator dynamically
4. Patch test

---

## Output

### 1. Updated Spec Files
- `tests/{object}.spec.ts`

### 2. Healing Report
- `reports/healing-report.md`

Format:

TC: TC-XXX-001
Failure: selector_failure
Fix: Updated locator using modal scope
Status: Healed


---

## Constraints

- Max 3 healing rounds
- No hardcoded values
- No SalesforceFormHandler usage
- No change to business logic
- No modification outside marker blocks

---

## Success Criteria

Agent is successful ONLY if:

- All failures are classified correctly
- Fixes are minimal and targeted
- Tests pass after healing
- No regression introduced