# Salesforce CPQ — End-to-End Test Plan

**Version:** 1.0
**Date:** 2026-04-28
**Author:** AI-Generated
**Project:** Salesforce CPQ — Account to Order Activation Lifecycle

---

## 1. Scope

### 1.1 In-Scope Objects

| Object | Prefix | Rationale |
|--------|--------|-----------|
| Account | ACC | Root record; all downstream objects depend on a valid Account |
| Contact | CON | Required for Opportunity creation and Contact Role assignment |
| Opportunity | OPP | CPQ entry point; Quote is created from an Opportunity |
| Quote (CPQ) | QTE | Core Revenue Cloud object; drives pricing, catalog, and line items |
| Contract | CTR | Created from an Accepted Quote; must be Activated before Order |
| Order | ORD | Final commercial output; must reach Activated/Complete status |
| Amendment | AMD | Post-contract change flow; validates mid-term Quote adjustments |
| Renewal | RNW | End-of-term lifecycle; validates renewal Quote and Contract creation |

### 1.2 Out of Scope

- Manual test cases executed outside Playwright
- Load testing and performance benchmarking
- API-only flows (no UI interaction)
- CPQ backend pricing engine unit tests
- Metadata deployment and configuration validation

---

## 2. Test Case Summary

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

### 2.1 Account Test Cases

| TC ID | Title | Type | AC Reference |
|-------|-------|------|--------------|
| TC-ACC-001 | Verify Billing Address and Payment Terms on Account Details tab | Positive | AC-005-01 |
| TC-ACC-002 | Create Contact, create Opportunity, verify Primary Contact Role | Positive | AC-005-02, AC-005-03, AC-005-04 |
| TC-ACC-003 | Create Quote from Opportunity, add product via catalog, validate cart | Positive | QO-005-05, PC-005-06, PC-005-07, PC-005-08, PC-005-09 |
| TC-ACC-004 | Accept Quote, create and activate Contract with Contract Term | Edge Case | QL-005-10, QL-005-11, CR-005-12 |
| TC-ACC-005 | Create Order from Quote, activate Order and mark complete | Negative | OR-005-13, OR-005-14, OR-005-15, OR-005-16 |

> **Note:** Contact, Opportunity, Quote, Contract, Order, Amendment, and Renewal objects have no independently authored user stories or dedicated TC IDs at this time. Their lifecycle steps are covered transitionally within the US-005 Account suite (TC-ACC-002 through TC-ACC-005). Standalone suites should be authored when dedicated user stories are defined.

---

## 3. Test Data Strategy

### 3.1 Uniqueness

- All record names use a millisecond timestamp suffix to prevent collisions:
  `AutoAcc-${Date.now()}`, `AutoCon-${Date.now()}`, `AutoOpp-${Date.now()}`
- Timestamps are captured once per test and reused within that test to maintain referential consistency.

### 3.2 Supporting Records

- All supporting records (Account, Contact, Opportunity, Quote, Contract, Order) are created in-test within the same Playwright session.
- No dependency on pre-existing sandbox data, with the exception of TC-ACC-001, which reads an existing Account and soft-fails if fields are empty.

### 3.3 Test Data Source

- Structured fields sourced from `getTestData()` using exact `TestData` interface keys:
  - `data.account.Account_Name`
  - `data.contact.First_Name`, `data.contact.Last_Name`, `data.contact.Email`
  - `data.opportunity.Name`, `data.opportunity.Stage`, `data.opportunity.Close_Date`
  - `data.quote.Name`, `data.quote.Contract_Type`
- Fields absent from `test-data.json` use approved hardcoded fallbacks only:
  - Price Book → `'Standard Price Book'`
  - Expiration Date → `'12/31/2026'`

### 3.4 Credentials and Secrets

- No credentials are hardcoded in test files.
- `SF_USERNAME`, `SF_PASSWORD`, and `SF_SANDBOX_URL` are loaded exclusively from `.env`.
- `auth/session.json` holds the authenticated browser state and must never be committed.

---

## 4. Execution Order

Tests execute sequentially in the following object order. Playwright is configured with **1 worker** (`workers: 1`). State (record IDs, URLs) is passed forward through the test run.

```
Account → Contact → Opportunity → Quote (CPQ) → Contract → Order → Amendment → Renewal
```

| Step | Object | Key Action |
|------|--------|------------|
| 1 | Account | Verify or create root Account |
| 2 | Contact | Create Contact linked to Account |
| 3 | Opportunity | Create Opportunity from Contact; assign Contact Role |
| 4 | Quote (CPQ) | Create Quote; select Price Book; add product via catalog |
| 5 | Contract | Accept Quote; create Contract; set Contract Term; Activate |
| 6 | Order | Create Order from Quote; Activate; mark Complete |
| 7 | Amendment | Amend active Contract; validate mid-term Quote |
| 8 | Renewal | Renew Contract; validate renewal Quote and Contract |

---

## 5. Entry Criteria

All of the following must be satisfied before test execution begins:

- [ ] `auth/session.json` is valid and not expired (refresh via `npx ts-node scripts/refresh-session.ts` if needed)
- [ ] `SF_SANDBOX_URL` is set and reachable in `.env`
- [ ] `SF_USERNAME` and `SF_PASSWORD` are set in `.env`
- [ ] Playwright is installed (`npx playwright install`)
- [ ] `npm install` has been run; all dependencies are resolved
- [ ] Target sandbox org is accessible and CPQ is enabled
- [ ] Domain knowledge files under `knowledge/agentforce-rm/` are present and loaded by Agent 1

---

## 6. Exit Criteria

The test run is considered complete when all of the following are true:

- [ ] All 5 TC-ACC test cases have been executed (pass, fail, or `test.fixme`)
- [ ] Agent 5 has produced `reports/results.json` with execution results
- [ ] Agent 6 self-healing has completed (maximum 3 retry iterations per failure)
- [ ] Any residual failures are annotated with `test.fixme()` and a diagnostic comment
- [ ] `reports/dashboard.html` reflects the final pass/fail/skip counts
- [ ] `reports/pipeline-state.json` shows pipeline status as complete
- [ ] Agent 7 has generated the final HTML and PowerPoint reports

---

## 7. Risks and Mitigations

| # | Risk | Impact | Mitigation |
|---|------|--------|------------|
| R-01 | Salesforce session expiry mid-run | All subsequent tests fail with `INVALID_SESSION_ID` | Run `npx ts-node scripts/refresh-session.ts` before pipeline start; Agent 6 must not change selectors when console shows `INVALID_SESSION_ID` — re-auth instead |
| R-02 | Spinner blocking interactions | `TimeoutError` on element clicks | `await page.locator('.slds-spinner').waitFor({ state: 'hidden' })` with 30 s timeout wrapping every navigation step |
| R-03 | Lookup search indexing lag | Related record not found in lookup field | `waitForTimeout(3000)` before triggering lookup interaction; never use `SFUtils.searchAndOpen()` for records created in the same run — use Related list links or toast links instead |
| R-04 | Shadow DOM / LWC encapsulation | Native selectors fail to pierce component boundary | Use native `lightning-*` locators and `[data-field-api-name]` attributes exclusively; never use XPath across shadow roots |
| R-05 | Salesforce API / HTTP 5xx errors | Intermittent failures unrelated to selectors | Agent 6 must inspect `stderr` for 4xx/5xx codes before modifying selectors; suppress selector changes when server errors are the root cause |
| R-06 | Duplicate record creation on retry | Data integrity issues in sandbox | All names include `Date.now()` suffix; retry logic reuses the record URL captured in prior step rather than creating a new record |
| R-07 | Incomplete CPQ configuration in sandbox | Product catalog empty; Quote line items missing | Verify CPQ package version and Price Book / Product setup as part of entry criteria sign-off |

---

## 8. Traceability Matrix

Every test case maps to an Acceptance Criterion, a TC ID, and a spec file location. No test may exist without an AC reference.

| TC ID | AC Reference(s) | Spec File | Status |
|-------|-----------------|-----------|--------|
| TC-ACC-001 | AC-005-01 | `tests/account.spec.ts` | Defined |
| TC-ACC-002 | AC-005-02, AC-005-03, AC-005-04 | `tests/account.spec.ts` | Defined |
| TC-ACC-003 | QO-005-05, PC-005-06, PC-005-07, PC-005-08, PC-005-09 | `tests/account.spec.ts` | Defined |
| TC-ACC-004 | QL-005-10, QL-005-11, CR-005-12 | `tests/account.spec.ts` | Defined |
| TC-ACC-005 | OR-005-13, OR-005-14, OR-005-15, OR-005-16 | `tests/account.spec.ts` | Defined |

---

## 9. Approval

| Role | Name | Date |
|------|------|------|
| QA Lead | | |
| Dev Lead | | |
| Product Owner | | |
