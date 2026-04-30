# Salesforce CPQ — End-to-End Test Plan

**Version:** 1.0
**Date:** 2026-04-30
**Author:** AI-Generated
**Project:** Salesforce CPQ — Revenue Cloud E2E Automation Suite
**Framework:** Playwright + TypeScript

---

## 1. Scope

### 1.1 In Scope

The following Salesforce objects are covered by this test plan. They represent the complete CPQ revenue lifecycle from customer record creation through order activation, amendment, and renewal.

| Object | Prefix | Rationale |
|--------|--------|-----------|
| Account | ACC | Root anchor record; all downstream objects depend on a valid Account |
| Contact | CON | Required as Primary Contact Role on Opportunity |
| Opportunity | OPP | Gate record that drives Quote creation |
| Quote (CPQ) | QTE | Core CPQ object; product selection, pricing, acceptance |
| Contract | CTR | Generated from accepted Quote; requires activation |
| Order | ORD | Generated from activated Contract; terminal activation step |
| Amendment | AMD | Mid-term changes to an active Contract |
| Renewal | RNW | End-of-term Contract renewal flow |

### 1.2 Out of Scope

- Manual (non-automated) test execution
- Load, stress, or performance testing
- API-only flows (no UI interaction)
- Salesforce Admin / configuration testing
- Mobile or cross-browser testing (Chromium only)

---

## 2. Test Case Summary

> Contact, Opportunity, Quote, Contract, Order, Amendment, and Renewal objects are exercised transitively through the Account E2E flow (US-005). Dedicated standalone user stories for those objects are not yet authored; their TC counts reflect the current backlog state.

| Object | User Stories | Total TCs | Positive | Negative | Edge Cases |
|--------|-------------|-----------|----------|----------|------------|
| Account | US-005 | 5 | 3 | 1 | 1 |
| Contact | — | 0 | — | — | — |
| Opportunity | — | 0 | — | — | — |
| Quote (CPQ) | — | 0 | — | — | — |
| Contract | — | 0 | — | — | — |
| Order | — | 0 | — | — | — |
| Amendment | — | 0 | — | — | — |
| Renewal | — | 0 | — | — | — |
| **Total** | **1** | **5** | **3** | **1** | **1** |

### 2.1 Test Case Register — Account (US-005)

| TC ID | Type | Scenario | AC References |
|-------|------|----------|---------------|
| TC-ACC-001 | Edge Case | Verify Account Billing Address and Payment Terms on Details tab; soft-fail with warning annotation if missing | AC-005-01 |
| TC-ACC-002 | Positive | Create Contact on Account; create Opportunity from Contact's Related List; verify Contact is Primary Contact Role | AC-005-02, AC-005-03, AC-005-04 |
| TC-ACC-003 | Positive | Create Quote from Opportunity; select Standard Price Book; add first product from All Products; validate line item in cart | QO-005-05, PC-005-06, PC-005-07, PC-005-08, PC-005-09 |
| TC-ACC-004 | Positive | Mark Quote as Accepted; create Contract without prices or discounts; open and activate Contract; fill Contract Term | QL-005-10, QL-005-11, CR-005-12 |
| TC-ACC-005 | Negative | Navigate to Quote; Create Order → Create single Order; open Order via toast; activate and mark as current status | OR-005-13, OR-005-14, OR-005-15, OR-005-16 |

---

## 3. Test Data Strategy

### 3.1 Principles

- **Timestamp uniqueness** — all dynamic record names embed `Date.now()` (e.g., `AutoAcc-${Date.now()}`) to prevent collision across parallel runs or reruns.
- **No hardcoded credentials** — all authentication material is sourced exclusively from environment variables (`SF_USERNAME`, `SF_PASSWORD`, `SF_SANDBOX_URL`).
- **Supporting records created in-test** — no pre-seeded fixture data is assumed; every prerequisite record (Account, Contact, Opportunity) is created within the test run and its ID/URL is captured from the success toast or navigation URL.
- **Typed key access** — all data is accessed through the `getTestData()` helper using exact `TestData` interface keys (e.g., `data.account.Account_Name`, `data.opportunity.Close_Date`). Optional chaining (`?.`) is never used on typed fields.

### 3.2 Key Mapping Reference

| Field | Correct Access Pattern |
|-------|----------------------|
| Account name | `data.account.Account_Name` |
| Contact first name | `data.contact.First_Name` |
| Contact last name | `data.contact.Last_Name` |
| Contact email | `data.contact.Email` |
| Opportunity name | `data.opportunity.Name` |
| Opportunity stage | `data.opportunity.Stage` |
| Opportunity close date | `data.opportunity.Close_Date` |
| Quote name | `data.quote.Name` |
| Quote contract type | `data.quote.Contract_Type` |

### 3.3 Hardcoded Fallbacks (Fields Not in test-data.json)

| Field | Fallback Value |
|-------|---------------|
| `priceBook` | `'Standard Price Book'` |
| `expirationDate` | `'12/31/2026'` |

---

## 4. Execution Order

Tests are executed **sequentially** using a single Playwright worker (`workers: 1`). State (record URLs, IDs) is passed forward through shared variables within the spec file.

```
Account (TC-ACC-001)
    ↓
Contact + Opportunity (TC-ACC-002)
    ↓
Quote / CPQ (TC-ACC-003)
    ↓
Contract (TC-ACC-004)
    ↓
Order (TC-ACC-005)
    ↓
Amendment  [backlog — no TC authored]
    ↓
Renewal    [backlog — no TC authored]
```

**Worker constraint:** `workers = 1` is mandatory and must not be increased. Salesforce CPQ flows are stateful and record-order-dependent.

---

## 5. Entry Criteria

All of the following must be satisfied before test execution begins:

| # | Criterion | Verification |
|---|-----------|-------------|
| 1 | `auth/session.json` exists and contains a valid Salesforce session | File present; `accessToken` field non-empty |
| 2 | `SF_SANDBOX_URL` environment variable is set in `.env` | `process.env.SF_SANDBOX_URL` resolves to a valid org URL |
| 3 | `SF_USERNAME` and `SF_PASSWORD` environment variables are set | Present in `.env`; not committed to source control |
| 4 | Playwright is installed with Chromium browser available | `npx playwright install chromium` completed without error |
| 5 | `npm install` dependencies are resolved | `node_modules/` present; no missing peer dependency warnings |
| 6 | Target org is accessible and not in maintenance window | Manual pre-check via browser login |

---

## 6. Exit Criteria

The test run is considered complete when all of the following are true:

| # | Criterion |
|---|-----------|
| 1 | All 5 authored TCs have been executed (pass, fail, or `test.fixme()`) |
| 2 | Agent 6 self-healing has run for any failed tests (maximum 3 healing iterations per TC) |
| 3 | Any test that cannot be healed within 3 iterations is annotated with `test.fixme()` and a descriptive comment |
| 4 | `reports/dashboard.html` is updated and reflects final pass/fail/warning status |
| 5 | `reports/results.json` and `reports/pipeline-state.json` are written |
| 6 | No test failure is silently ignored — every failure is classified and logged |

---

## 7. Risks and Mitigations

| # | Risk | Impact | Mitigation |
|---|------|--------|-----------|
| R-01 | **Salesforce session expiry** mid-run invalidates `auth/session.json` | All subsequent tests fail with `INVALID_SESSION_ID` | Re-run `npx ts-node scripts/refresh-session.ts` before pipeline start; Agent 6 must not change selectors when console shows `INVALID_SESSION_ID` — escalate to session refresh instead |
| R-02 | **Spinner timing** — async Salesforce page operations leave spinner visible longer than default timeout | Test proceeds before page is ready; stale element errors | Use `await page.locator('.slds-spinner').waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {})` after every navigation and save action |
| R-03 | **Lookup search indexing lag** — Salesforce global search index can be minutes behind | Lookup field returns no results for a record just created | Wait `3000 ms` before interacting with lookup fields for freshly created records; prefer navigating via Related List link or toast URL over global search |
| R-04 | **Shadow DOM pierce** — LWC components encapsulate their DOM | Selectors targeting inner elements fail silently | Use native `lightning-*` locators only; never pierce Shadow DOM manually; follow locator priority: `data-field-api-name` → role → label → `lightning-input` filter → XPath |
| R-05 | **Salesforce HTTP 4xx / 5xx errors** masquerade as selector failures | Agent 6 changes correct selectors unnecessarily | Agent 6 must inspect browser console for HTTP error codes before modifying any locator; `INSUFFICIENT_ACCESS` or `5xx` errors require data / permission fix, not selector change |
| R-06 | **Record search lag after creation** — using `SFUtils.searchAndOpen()` on a record created in the same run | 30-second timeout burned; test flake | Never use `SFUtils.searchAndOpen()` for same-run records; always use toast link or Related List URL for navigation |
| R-07 | **Amendment / Renewal TCs not yet authored** | Coverage gap for end-of-lifecycle flows | Treat as backlog; document as known gap in dashboard; create placeholder spec files with `test.todo()` annotations |

---

## 8. Tooling and Infrastructure

| Component | Detail |
|-----------|--------|
| Test runner | Playwright (TypeScript) |
| Browser | Chromium (single instance) |
| Parallelism | `workers: 1` (mandatory) |
| AI pipeline | 7-agent pipeline (`npm run pipeline`) |
| Session management | `npx ts-node scripts/refresh-session.ts` |
| Self-healing | `npx ts-node scripts/self-heal.ts` (Agent 6, max 3 iterations) |
| Reporting | `reports/dashboard.html`, `reports/results.json` |
| Traceability | Every `test()` block must carry `// TC-XXX-NNN | AC Reference: AC-XXX-NN` |

---

## 9. Traceability Matrix

| TC ID | User Story | AC References | Spec File | Status |
|-------|-----------|---------------|-----------|--------|
| TC-ACC-001 | US-005 | AC-005-01 | `tests/account.spec.ts` | Authored |
| TC-ACC-002 | US-005 | AC-005-02, AC-005-03, AC-005-04 | `tests/account.spec.ts` | Authored |
| TC-ACC-003 | US-005 | QO-005-05, PC-005-06, PC-005-07, PC-005-08, PC-005-09 | `tests/account.spec.ts` | Authored |
| TC-ACC-004 | US-005 | QL-005-10, QL-005-11, CR-005-12 | `tests/account.spec.ts` | Authored |
| TC-ACC-005 | US-005 | OR-005-13, OR-005-14, OR-005-15, OR-005-16 | `tests/account.spec.ts` | Authored |
| TC-CON-001+ | — | — | `tests/contact.spec.ts` | **Backlog** |
| TC-OPP-001+ | — | — | `tests/opportunity.spec.ts` | **Backlog** |
| TC-QTE-001+ | — | — | `tests/quote.spec.ts` | **Backlog** |
| TC-CTR-001+ | — | — | `tests/contract.spec.ts` | **Backlog** |
| TC-ORD-001+ | — | — | `tests/order.spec.ts` | **Backlog** |
| TC-AMD-001+ | — | — | `tests/amendment.spec.ts` | **Backlog** |
| TC-RNW-001+ | — | — | `tests/renewal.spec.ts` | **Backlog** |

---

## 10. Approvals

| Role | Name | Date |
|------|------|------|
| QA Lead | _(pending review)_ | 2026-04-30 |
| Dev Lead | _(pending review)_ | — |
| Product Owner | _(pending review)_ | — |
