# Salesforce CPQ End-to-End Test Plan

**Version:** 1.0
**Date:** 2026-04-30
**Author:** AI-Generated
**Project:** Salesforce CPQ — Account-to-Order Lifecycle

---

## 1. Scope

### In Scope

| Object | Rationale |
|--------|-----------|
| Account | Root anchor of the CPQ lifecycle; billing address and payment terms validation |
| Contact | Created under Account; drives Opportunity creation and Contact Role assignment |
| Opportunity | Spawned from Contact; hosts Quote creation |
| Quote (CPQ) | Core Revenue Cloud object; product selection, pricing, and cart validation |
| Contract | Generated from accepted Quote; activation and term validation |
| Order | Generated from active Contract; activation and status validation |
| Amendment | Post-activation contract modification flow |
| Renewal | Contract renewal lifecycle |

### Out of Scope

- Manual test cases and exploratory testing
- Load, performance, and stress testing
- API-only flows (no UI interaction)
- Flows not driven by a parsed user story with at least one AC reference

---

## 2. Test Summary

| Object | User Stories | Total TCs | Positive | Negative | Edge Cases |
|--------|-------------|-----------|----------|----------|------------|
| Account | US-005 | 5 | 3 | 1 | 1 |
| Contact | — | 0 | 0 | 0 | 0 |
| Opportunity | — | 0 | 0 | 0 | 0 |
| Quote (CPQ) | — | 0 | 0 | 0 | 0 |
| Contract | — | 0 | 0 | 0 | 0 |
| Order | — | 0 | 0 | 0 | 0 |
| Amendment | — | 0 | 0 | 0 | 0 |
| Renewal | — | 0 | 0 | 0 | 0 |
| **TOTAL** | **1** | **5** | **3** | **1** | **1** |

> **Note:** Contact, Opportunity, Quote, Contract, Order, Amendment, and Renewal objects are exercised as part of the US-005 end-to-end chain within the Account spec (TC-ACC-002 through TC-ACC-005). Standalone user stories for those objects are pending and will expand this plan when parsed.

---

## 3. Test Case Register

### Account (US-005)

| TC ID | Title | Type | AC References | Priority |
|-------|-------|------|---------------|----------|
| TC-ACC-001 | Verify Existing Account Billing Address and Payment Terms | Edge Case (Soft Fail) | AC-005-01 | P2 |
| TC-ACC-002 | Create Contact on Account from the Contacts Related List | Positive | AC-005-02 | P1 |
| TC-ACC-003 | Create Opportunity from Contact and Verify Primary Contact Role | Positive | AC-005-03, AC-005-04 | P1 |
| TC-ACC-004 | Create Quote, Browse Catalogs, Select Price Book, Add Product, Validate Cart | Positive | QO-005-05, PC-005-06, PC-005-07, PC-005-08, PC-005-09 | P1 |
| TC-ACC-005 | Quote Acceptance → Contract Activation → Order Activation | Negative / Integration | QL-005-10, QL-005-11, CR-005-12, OR-005-13, OR-005-14, OR-005-15, OR-005-16 | P1 |

**TC-ACC-001 — Edge Case Classification Rationale:** Billing Address and Payment Terms may be blank in sandbox; the test emits a console warning and continues (soft fail) rather than hard-failing the suite.

**TC-ACC-005 — Negative Classification Rationale:** Contract is created with "None" pricing/discounts, exercising the boundary condition of a zero-value contract activation path.

---

## 4. Test Data Strategy

### 4.1 Uniqueness

- All dynamically created record names embed a Unix timestamp suffix: `AutoAcc-${Date.now()}`, `AutoCon-${Date.now()}`, `AutoOpp-${Date.now()}`, etc.
- No two test runs will collide on record names regardless of parallelism or retry.

### 4.2 Supporting Records

| Record | Source | Notes |
|--------|--------|-------|
| Account | Pre-existing sandbox record | TC-ACC-001 reads; TC-ACC-002 onwards attaches to it |
| Contact | Created in-test (TC-ACC-002) | URL stored in state for downstream steps |
| Opportunity | Created in-test (TC-ACC-003) | URL stored in state |
| Quote | Created in-test (TC-ACC-004) | Linked to Opportunity |
| Price Book | Hardcoded fallback: `'Standard Price Book'` | Not sourced from test-data.json |
| Expiration Date | Hardcoded fallback: `'12/31/2026'` | Not sourced from test-data.json |
| Contract | Created in-test (TC-ACC-005) | 12-month term, None pricing |
| Order | Created in-test (TC-ACC-005) | Single Order from Contract |

### 4.3 TestData Keys

All test data is accessed via `getTestData()`. The following exact keys are mandatory — camelCase variants are prohibited:

| Object | Correct Key |
|--------|-------------|
| Account | `data.account.Account_Name` |
| Contact | `data.contact.First_Name`, `data.contact.Last_Name`, `data.contact.Email`, `data.contact.Phone`, `data.contact.Full_Name` |
| Opportunity | `data.opportunity.Name`, `data.opportunity.Stage`, `data.opportunity.Close_Date` |
| Quote | `data.quote.Name`, `data.quote.Contract_Type` |

### 4.4 Credentials

- No credentials are hardcoded in test files.
- All authentication state is loaded from `auth/session.json` at runtime.
- `SF_SANDBOX_URL`, `SF_USERNAME`, and `SF_PASSWORD` are sourced exclusively from `.env`.

---

## 5. Execution Order

Tests execute sequentially in a single Playwright worker (`workers: 1`). The order mirrors the CPQ object lifecycle:

```
Account → Contact → Opportunity → Quote (CPQ) → Contract → Order → Amendment → Renewal
```

Within the Account spec, TC execution order is strictly:

```
TC-ACC-001 → TC-ACC-002 → TC-ACC-003 → TC-ACC-004 → TC-ACC-005
```

State (record URLs, IDs) is passed forward via in-memory variables within the spec file. No global search (`SFUtils.searchAndOpen`) is used for records created in the same run; navigation uses Related List links or success toast URLs.

---

## 6. Entry Criteria

All of the following must be satisfied before test execution begins:

- [ ] `auth/session.json` exists and contains a valid Salesforce session token
- [ ] `SF_SANDBOX_URL` is set in `.env` and resolves to the target sandbox
- [ ] `SF_USERNAME` and `SF_PASSWORD` are set in `.env`
- [ ] Playwright is installed (`npx playwright --version` exits 0)
- [ ] TypeScript dependencies are installed (`npm install` completed without errors)
- [ ] Domain knowledge files loaded: `quote-lifecycle.md`, `pricing.md`, `contract-lifecycle.md`, `order-management.md`, `foundations-and-coexistence.md`
- [ ] Target sandbox is accessible and not in a maintenance window

---

## 7. Exit Criteria

The test run is considered complete when all of the following are met:

- [ ] All 5 TCs have been executed (pass, fail, or `test.fixme()`)
- [ ] Self-healing (Agent 6) has been run on any failing tests; maximum 3 iterations per TC
- [ ] Any TC that remains failing after 3 healing iterations is marked `test.fixme()` with a comment
- [ ] `reports/dashboard.html` reflects the final pass/fail/skip state
- [ ] `reports/results.json` contains raw execution results
- [ ] `reports/pipeline-state.json` is updated with the run outcome
- [ ] Agent 7 dashboard report has been generated and reviewed

---

## 8. Risks and Mitigations

| # | Risk | Impact | Mitigation |
|---|------|--------|------------|
| R-01 | Salesforce session expiry mid-run | All tests fail with `INVALID_SESSION_ID` | Re-run `npx ts-node scripts/refresh-session.ts` before execution; Agent 6 must not change selectors when console shows `INVALID_SESSION_ID` — escalate to session refresh instead |
| R-02 | Spinner / loading overlay blocking interactions | Intermittent `ElementNotInteractable` errors | Wrap every action with `await page.locator('.slds-spinner').waitFor({ state: 'hidden' }).catch(() => {})` with a 30-second explicit timeout |
| R-03 | Lookup search lag (Salesforce indexing delay) | Lookup field returns no results | Apply `waitForTimeout(3000)` before triggering lookup interaction; never use `SFUtils.searchAndOpen` for records created in the same test run |
| R-04 | Shadow DOM / LWC component pierce failures | Selector not found; test aborts | Use native `lightning-*` locators only; never pierce shadow DOM with `>>>` or `evaluate`; follow locator priority hierarchy: API name → role → label → LWC → XPath |
| R-05 | Sandbox data drift (missing Price Book, Products) | TC-ACC-004 fails on product selection | Assert `'Standard Price Book'` existence before proceeding; log a soft warning and skip catalog steps if no products are found rather than hard-failing |
| R-06 | Record creation indexing delay (search-based navigation) | TC navigates to wrong or stale record | Always navigate using the success toast URL or Related List link — never use global search for same-run records |
| R-07 | Parallel execution state collision | Record name duplication across workers | `workers: 1` is mandatory; never increase parallelism on this project |

---

## 9. Traceability Matrix

Every test case must include a header comment linking TC ID to its AC reference(s). No test may be generated without at least one AC reference.

| TC ID | AC References | Spec File |
|-------|---------------|-----------|
| TC-ACC-001 | AC-005-01 | `tests/account.spec.ts` |
| TC-ACC-002 | AC-005-02 | `tests/account.spec.ts` |
| TC-ACC-003 | AC-005-03, AC-005-04 | `tests/account.spec.ts` |
| TC-ACC-004 | QO-005-05, PC-005-06, PC-005-07, PC-005-08, PC-005-09 | `tests/account.spec.ts` |
| TC-ACC-005 | QL-005-10, QL-005-11, CR-005-12, OR-005-13, OR-005-14, OR-005-15, OR-005-16 | `tests/account.spec.ts` |

---

## 10. Approval

| Role | Name | Status |
|------|------|--------|
| QA Lead | AI-Generated | Draft |
| Dev Lead | — | Pending |
| Product Owner | — | Pending |
