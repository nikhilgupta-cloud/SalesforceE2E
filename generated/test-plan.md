# Salesforce CPQ E2E Test Plan
**Project:** SalesforceE2E
**Environment:** Salesforce Sandbox (Lightning Experience)
**Framework:** Playwright + TypeScript
**Generated:** 2026-03-27
**Auth:** `auth/session.json` (storageState)

---

## Scope

End-to-end automation covering 4 Salesforce objects across 12 User Stories and 44 test cases.

| Object | User Stories | Tests |
|--------|-------------|-------|
| Account | US-001, US-002, US-003 | 13 |
| Contact | US-004, US-005, US-006 | 10 |
| Opportunity | US-007, US-008, US-009 | 11 |
| Quote (CPQ) | US-010, US-011, US-012 | 10 |
| **Total** | **12** | **44** |

---

## Architecture

```
d:\SalesforceE2E\
├── auth/
│   └── session.json          # Playwright storageState (pre-authenticated)
├── tests/
│   ├── account.spec.ts       # 13 tests — Account CRUD + Search
│   ├── contact.spec.ts       # 10 tests — Contact CRUD + Roles
│   ├── opportunity.spec.ts   # 11 tests — Opportunity CRUD + Stage + Forecast
│   └── quote.spec.ts         # 10 tests — CPQ Quote + QLE
├── utils/
│   └── SalesforceFormHandler.ts  # Centralized LWC form utility
├── generated/
│   ├── test-plan.md
│   ├── test-scenarios/       # Per-object scenario tables
│   └── scripts/              # Production-ready copies of spec files
└── playwright.config.ts
```

---

## Key Patterns

### Authentication
All tests use `storageState: 'auth/session.json'` — no login flow required per test.

### MODAL constant
```typescript
const MODAL = '[role="dialog"]:not([id="auraError"]):not([aria-hidden="true"])';
```
Targets visible Salesforce modals while excluding the "Sorry to interrupt" Aura error dialog.

### Aura Error Dismissal
```typescript
async function dismissAuraError(page: Page) {
  const auraErr = page.locator('#auraError');
  if (await auraErr.isVisible({ timeout: 2000 }).catch(() => false)) {
    await auraErr.locator('button').first().click().catch(() => {});
    await auraErr.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
  }
}
```

### SalesforceFormHandler
Centralized utility for all form interactions with Shadow DOM piercing:
- `fillText(label, value)` — 4-strategy text input fill
- `fillLookup(label, value)` — typeahead lookup with `[role="option"]` selection
- `selectCombobox(label, value)` — Lightning picklist selection
- `checkCheckbox(label, shouldCheck)` — Standard + SLDS faux checkbox

### Supporting Record Helpers
Each spec creates isolated supporting records via helper functions:
- `createSupportingAccount()` — creates Account for Contact/Opportunity tests
- `createAccountAndOpportunity()` — creates Account + Opportunity for Quote tests

---

## Test Execution

```bash
# Full suite
npx playwright test tests/account.spec.ts tests/contact.spec.ts tests/opportunity.spec.ts tests/quote.spec.ts --reporter=list

# Single spec
npx playwright test tests/account.spec.ts --reporter=list

# Single test
npx playwright test tests/account.spec.ts --grep "TC-ACC-004"
```

---

## Known Constraints

| Constraint | Detail |
|-----------|--------|
| Opportunity Edit | Accessed via "Show more actions" kebab menu — no direct Edit button on detail page |
| Lookup dropdowns | `div[role="listbox"]` is invisible to Playwright; use `page.locator('[role="option"]')` directly |
| `isVisible()` timing | Playwright's `isVisible()` is synchronous/immediate — use `waitFor({ state: 'visible' })` for LWC fields |
| Generate Document | CPQ document generation requires separate Salesforce CPQ configuration; test passes if detail page loads |
| Opportunity Name lookup in Quote | Intermittent: newly-created Opportunity may not appear in search if Salesforce indexing is delayed; test handles gracefully |
