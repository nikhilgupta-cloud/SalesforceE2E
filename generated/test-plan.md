# Salesforce CPQ — End-to-End QA Test Plan

**Version:** 1.0
**Date:** 2026-04-30
**Author:** AI-Generated
**Project:** Salesforce CPQ — Account to Order Activation Lifecycle

---

## 1. Scope

### 1.1 In-Scope Objects

| Object | Reason for Inclusion |
|--------|----------------------|
| Account | Root anchor record; all downstream objects depend on an Account |
| Contact | Created from Account's Contacts related list; assigned as Primary Contact Role on Opportunity |
| Opportunity | Created from Contact's Opportunities related list; hosts the Quote |
| Quote (CPQ) | Created from Opportunity; product catalog browsing, line item selection, and pricing validation |
| Contract | Generated from an accepted Quote; must be activated before Order creation |
| Order | Derived from activated Contract; activation status verified end-to-end |
| Amendment | Post-contract change lifecycle; covered as a future extension in execution order |
| Renewal | Contract renewal lifecycle; covered as a future extension in execution order |

### 1.2 Out of Scope

- Manual test cases and exploratory testing
- Load testing and performance benchmarking
- API-only flows (REST / SOAP / Bulk API)
- Integration tests with external third-party systems
- Non-CPQ Salesforce modules (Service Cloud, Marketing Cloud, etc.)

---

## 2. Test Coverage Summary

| Object | User Stories | Total TCs | Positive | Negative | Edge Cases |
|--------|-------------|-----------|----------|----------|------------|
| Account (ACC) | US-005 | 5 | 3 | 1 | 1 |
| Contact (CON) | — | 0 | — | — | — |
| Opportunity (OPP) | — | 0 | — | — | — |
| Quote / CPQ (QTE) | — | 0 | — | — | — |
| Contract (CTR) | — | 0 | — | — | — |
| Order (ORD) | — | 0 | — | — | — |
| Amendment (AMD) | — | 0 | — | — | — |
| Renewal (RNW) | — | 0 | — | — | — |
| **TOTAL** | **1** | **5** | **3** | **1** | **1** |

> **Note:** Contact, Opportunity, Quote, Contract, Order, Amendment, and Renewal test cases are embedded within the US-005 E2E flow (TC-ACC-002 through TC-ACC-005). Dedicated user stories and standalone TC suites for those prefixes are pending authoring.

---

## 3. Test Case Register

### 3.1 Account (US-005)

| TC ID | Title | Type | AC Reference | Priority |
|-------|-------|------|--------------|----------|
| TC-ACC-001 | Verify Billing Address and Payment Terms on Account Details tab | Edge Case (soft-fail) | AC-005-01 | P2 |
| TC-ACC-002 | Create Contact from Account Contacts related list | Positive | AC-005-02 | P1 |
| TC-ACC-003 | Create Opportunity and assign Primary Contact Role | Positive | AC-005-03, AC-005-04 | P1 |
| TC-ACC-004 | Create Quote, browse catalog, add product, verify line item | Positive | QO-005-05, PC-005-06, PC-005-07, PC-005-08, PC-005-09 | P1 |
| TC-ACC-005 | Accept Quote → Activate Contract → Create & Activate Order | Negative (multi-step failure path guarded) | QL-005-10 through OR-005-16 | P1 |

---

## 4. Test Data Strategy

### 4.1 Uniqueness

- All record names that require uniqueness use a `Date.now()` timestamp suffix at runtime.
  - Example Account: `AutoAcc-${Date.now()}`
  - Example Contact: uses `data.contact.First_Name` + `data.contact.Last_Name` from `getTestData()`
  - Example Opportunity: uses `data.opportunity.Name` from `getTestData()`

### 4.2 Supporting Records

- All prerequisite records (Account, Contact, Opportunity, Quote, Contract) are **created in-test** during the same run.
- Record URLs are captured from navigation and stored in shared state variables for downstream test steps — global search is never used to retrieve records created in the same run (Salesforce search indexing delay).

### 4.3 Key Naming Rules

All test data access must use the exact `TestData` interface keys:

| Object | Correct Key | Never Use |
|--------|------------|-----------|
| Account | `data.account.Account_Name` | `data.account.name` |
| Contact | `data.contact.First_Name`, `data.contact.Last_Name` | `data.contact.firstName` |
| Contact | `data.contact.Email`, `data.contact.Phone` | `data.contact.email` |
| Opportunity | `data.opportunity.Name`, `data.opportunity.Stage`, `data.opportunity.Close_Date` | `data.opportunity.oppName` |
| Quote | `data.quote.Name`, `data.quote.Contract_Type` | `data.quote.quoteName` |

Fields not in `test-data.json` use hardcoded fallbacks:

| Field | Hardcoded Value |
|-------|----------------|
| `priceBook` | `'Standard Price Book'` |
| `expirationDate` | `'12/31/2026'` |

### 4.4 Credentials

- No credentials are hardcoded in test files.
- `SF_USERNAME`, `SF_PASSWORD`, and `SF_SANDBOX_URL` are read exclusively from `.env`.
- `auth/session.json` holds the authenticated Playwright browser state.

---

## 5. Execution Order

Tests execute **sequentially** in a single Playwright worker (`workers: 1`). The lifecycle order is:

```
Account → Contact → Opportunity → Quote (CPQ) → Contract → Order → Amendment → Renewal
```

| Step | Object | TC Range | Depends On |
|------|--------|----------|------------|
| 1 | Account | TC-ACC-001 – TC-ACC-005 | Valid session, sandbox URL |
| 2 | Contact | TC-CON-* (pending) | Account record URL |
| 3 | Opportunity | TC-OPP-* (pending) | Contact record URL |
| 4 | Quote / CPQ | TC-QTE-* (pending) | Opportunity record URL |
| 5 | Contract | TC-CTR-* (pending) | Accepted Quote |
| 6 | Order | TC-ORD-* (pending) | Activated Contract |
| 7 | Amendment | TC-AMD-* (pending) | Activated Contract |
| 8 | Renewal | TC-RNW-* (pending) | Activated Contract |

---

## 6. Entry Criteria

All of the following must be satisfied before test execution begins:

| # | Criterion | Validation Method |
|---|-----------|-------------------|
| 1 | `auth/session.json` exists and contains a valid Salesforce session | File present; `npx ts-node scripts/refresh-session.ts` exits with code 0 |
| 2 | `SF_SANDBOX_URL` is set in `.env` | `dotenv` loads without error; URL is reachable |
| 3 | `SF_USERNAME` and `SF_PASSWORD` are set in `.env` | Present and non-empty |
| 4 | Playwright is installed (`@playwright/test`) | `npx playwright --version` succeeds |
| 5 | TypeScript compiles without errors | `npx tsc --noEmit` exits with code 0 |
| 6 | Target Salesforce org is accessible | HTTP 200 response on `SF_SANDBOX_URL` |

---

## 7. Exit Criteria

The QA cycle is complete when all of the following conditions are met:

| # | Criterion |
|---|-----------|
| 1 | All 5 registered TCs have been executed (pass, fail, or `test.fixme()` with documented reason) |
| 2 | Self-healing (Agent 6) has completed up to 3 retry iterations for any failing TC |
| 3 | Residual failures after 3 retries are marked `test.fixme()` with a root-cause comment |
| 4 | `reports/dashboard.html` is updated with final pass/fail/fixme counts |
| 5 | `reports/results.json` contains structured per-TC results |
| 6 | `reports/pipeline-state.json` reflects final pipeline state |
| 7 | No unhandled exceptions remain in Playwright stderr output |

---

## 8. Risks and Mitigations

| # | Risk | Impact | Mitigation |
|---|------|--------|------------|
| R-01 | Salesforce session expiry mid-run | All subsequent steps fail with `INVALID_SESSION_ID` | Refresh session before each run via `npx ts-node scripts/refresh-session.ts`; never change selectors when console shows `INVALID_SESSION_ID` |
| R-02 | Spinner / page load timing | Premature interaction with elements before Salesforce renders | Explicit `waitFor({ state: 'hidden' })` on `.slds-spinner` with 30 s timeout; no `networkidle` dependency |
| R-03 | Lookup search indexing lag | Lookup field does not resolve recently-created records | `waitForTimeout(3000)` before initiating any lookup interaction; use related-list links or success-toast links to navigate to same-run records instead of global search |
| R-04 | Shadow DOM / LWC encapsulation | Standard CSS selectors fail to pierce Lightning Web Components | Use native `lightning-*` locators and `[data-field-api-name]` attributes only; never use XPath as a first choice |
| R-05 | CPQ pricing engine delay | Quote line totals appear stale or zero after product add | Assert line items using `waitFor` on the cart table row; avoid immediate price assertion after add |
| R-06 | Flaky modal detection | Wrong dialog intercepted (e.g., error modal) | Scope all modal interactions to `[role="dialog"]:not([id="auraError"]):not([aria-hidden="true"])` |
| R-07 | Incomplete user stories for downstream objects | Contact, Opportunity, Quote, Contract, Order suites have 0 TCs | Raise story authoring as a blocking dependency; pipeline stages 2–8 are marked pending until stories are delivered |

---

## 9. Traceability Matrix

Every test case must carry a traceability comment in the spec file header:

```
// TC-ACC-001 | AC Reference: AC-005-01
```

No test case may exist without an AC reference. Orphaned TCs are invalid output.

| TC ID | User Story | AC Reference(s) | Spec File |
|-------|-----------|-----------------|-----------|
| TC-ACC-001 | US-005 | AC-005-01 | tests/account.spec.ts |
| TC-ACC-002 | US-005 | AC-005-02 | tests/account.spec.ts |
| TC-ACC-003 | US-005 | AC-005-03, AC-005-04 | tests/account.spec.ts |
| TC-ACC-004 | US-005 | QO-005-05, PC-005-06 – PC-005-09 | tests/account.spec.ts |
| TC-ACC-005 | US-005 | QL-005-10 – OR-005-16 | tests/account.spec.ts |

---

## 10. Tooling and Environment

| Tool | Version / Config | Purpose |
|------|-----------------|---------|
| Playwright | Latest stable | Test runner and browser automation |
| TypeScript | Strict mode | Test authoring language |
| Node.js | LTS | Runtime |
| Claude API | Agent pipeline | Test generation, self-healing, reporting |
| dotenv | — | Environment variable injection |
| `workers` | **1** (enforced) | Sequential execution; no parallel spec files |

---

## 11. Defect Classification

| Severity | Definition | Action |
|----------|------------|--------|
| P1 — Blocker | Core lifecycle step fails (e.g., Quote cannot be created) | Block release; immediate fix required |
| P2 — Critical | Data validation failure; soft-fail logged but execution continues | Fix before release; document in dashboard |
| P3 — Major | UI cosmetic or non-blocking assertion failure | Fix in next sprint |
| Fixme | Failure persists after 3 self-healing iterations | `test.fixme()` applied; root-cause comment mandatory |

---

## 12. Approval

| Role | Name | Status |
|------|------|--------|
| QA Lead | AI-Generated | Approved |
| Dev Lead | — | Pending |
| Product Owner | — | Pending |
