# Salesforce CPQ — QA Test Plan

**Version:** 1.0
**Date:** 2026-04-30
**Author:** AI-Generated

---

## 1. Scope

The following Salesforce objects are in scope for this test plan. They represent the end-to-end Revenue Cloud / CPQ lifecycle from customer identification through order activation, contract management, and post-contract operations.

| Object | Prefix | Rationale |
|--------|--------|-----------|
| Account | ACC | Root record; billing address and payment terms must be validated before any downstream flow |
| Contact | CON | Primary contact role on Opportunity is a CPQ prerequisite |
| Opportunity | OPP | Gate for Quote creation; drives CPQ lifecycle entry |
| Quote (CPQ) | QTE | Core CPQ object; product selection, pricing, and approval states tested here |
| Contract | CTR | Generated from accepted Quote; activation and term validation required |
| Order | ORD | Generated from Quote; activation status is the final delivery signal |
| Amendment | AMD | Post-activation contract change; verifies amendment flow integrity |
| Renewal | RNW | Post-term renewal; verifies renewal opportunity and quote generation |

**Out of Scope:**
- Manual (non-automated) test cases
- Load and performance testing
- API-only flows (no Playwright UI interaction)
- Flows that do not originate from an Account record

---

## 2. Test Case Summary

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
| **Total** | **1** | **5** | **3** | **1** | **1** |

### Test Case Detail — Account (US-005)

| TC ID | Type | Scenario | AC Ref |
|-------|------|----------|--------|
| TC-ACC-001 | Positive | Identify existing Account; verify Billing Address and Payment Terms on Details tab; soft-fail warning if either field is missing | AC-005-01 |
| TC-ACC-002 | Positive | Create Contact on Account; create Opportunity from Contact Related list; verify Contact assigned as Primary Contact Role on Opportunity | AC-005-02, AC-005-03, AC-005-04 |
| TC-ACC-003 | Positive | Create Quote from Opportunity; open Browse Catalogs; select Standard Price Book and All Products; add first product; save; validate product row in cart | QO-005-05, PC-005-06, PC-005-07, PC-005-08, PC-005-09 |
| TC-ACC-004 | Edge Case | Accept Quote and mark as Current; create Contract via New Contract (None — no prices/discounts); open Contract; set Contract Term to 12 months; activate | QL-005-10, QL-005-11, CR-005-12 |
| TC-ACC-005 | Negative | Open Quote; click Create Order → single Order; navigate to Order record; click Activate; confirm Order Status = Activated | OR-005-13, OR-005-14, OR-005-15, OR-005-16 |

> **Note:** Objects Contact, Opportunity, Quote, Contract, Order, Amendment, and Renewal carry zero standalone test cases in the current story set. Their UI interactions are exercised transitively within the ACC suite (TC-ACC-002 through TC-ACC-005). Dedicated user stories for these objects must be provided before standalone TC IDs can be assigned.

---

## 3. Test Data Strategy

| Principle | Implementation |
|-----------|----------------|
| **Uniqueness** | All dynamically created record names are suffixed with `Date.now()` (e.g., `AutoAcc-${Date.now()}`) to prevent collisions across runs |
| **Supporting records** | Contacts, Opportunities, Quotes, Contracts, and Orders are created in-test in sequential order; no pre-seeded records assumed beyond the root Account |
| **Account lookup** | A single existing Account is identified at runtime; if not found, one is created with a timestamped name |
| **Price Book** | Hardcoded to `'Standard Price Book'` — not sourced from test-data.json |
| **Expiration / Contract dates** | Hardcoded to `'12/31/2026'`; Contract Term hardcoded to `12` months |
| **Test data file keys** | All keys consumed via `getTestData()` use exact `TestData` interface casing: `data.account.Account_Name`, `data.contact.First_Name`, `data.contact.Last_Name`, `data.opportunity.Name`, `data.opportunity.Stage`, `data.opportunity.Close_Date`, `data.quote.Name`, `data.quote.Contract_Type` |
| **No optional chaining** | `?.` is never used on `TestData` fields — all keys are guaranteed present |
| **No hardcoded credentials** | All auth material stored exclusively in `auth/session.json` and `.env`; never committed |

---

## 4. Execution Order

Tests execute strictly sequentially. Playwright is configured with **1 worker only**. Each phase depends on the record URL captured in the preceding phase.

```
Account (TC-ACC-001)
  └─► Contact + Opportunity (TC-ACC-002)
        └─► Quote / CPQ (TC-ACC-003)
              └─► Contract (TC-ACC-004)
                    └─► Order (TC-ACC-005)
                          └─► Amendment  [future: TC-AMD-xxx]
                                └─► Renewal  [future: TC-RNW-xxx]
```

**State passing rule:** Record URLs (containing `/Contact/`, `/Opportunity/`, `/Quote/`, `/Contract/`, `/Order/`) are captured from navigation and used for direct access in subsequent steps. Salesforce global search is never used to navigate to records created in the same test run.

---

## 5. Entry Criteria

All of the following must be satisfied before execution begins:

- [ ] `auth/session.json` exists and contains a valid, non-expired Salesforce session
- [ ] `.env` file is present with `SF_SANDBOX_URL`, `SF_USERNAME`, and `SF_PASSWORD` set
- [ ] Playwright and all `npm` dependencies are installed (`npm install` has been run)
- [ ] `npx playwright --version` exits cleanly
- [ ] Target sandbox is reachable and not in a maintenance window
- [ ] `prompts/user-stories/` contains the latest story file for US-005

---

## 6. Exit Criteria

Execution is considered complete when all of the following are true:

- [ ] All 5 TC-ACC test cases have been executed (pass, fail, or fixme)
- [ ] Self-healing (Agent 6) has completed up to 3 retry iterations for any failing test
- [ ] Any test that cannot be healed within 3 iterations is marked `test.fixme()` with a descriptive comment
- [ ] `reports/dashboard.html` reflects the final run status
- [ ] `reports/results.json` and `reports/pipeline-state.json` are written and up to date
- [ ] No test is silently skipped without a recorded reason

---

## 7. Risks and Mitigations

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| R-01 | **Salesforce session expiry** mid-run invalidates all subsequent steps | Medium | High | Re-run `npx ts-node scripts/refresh-session.ts` before pipeline start; Agent 6 detects `INVALID_SESSION_ID` in console and halts selector changes, escalating to session refresh |
| R-02 | **Spinner / loading overlay** not dismissed before next interaction causes stale-element or click failures | High | Medium | All steps execute `await page.locator('.slds-spinner').waitFor({ state: 'hidden' }).catch(() => {})` with a 30-second timeout before proceeding |
| R-03 | **Lookup search indexing lag** causes lookup fields to return no results | High | Medium | A `waitForTimeout(3000)` pause is inserted before every lookup field interaction; lookup fields use `[data-field-api-name]` locators, not text search |
| R-04 | **Shadow DOM** in Lightning Web Components prevents standard locator access | Medium | High | Only native `lightning-*` element locators and `[data-field-api-name]` attribute selectors are used; no `pierce/` or JS `shadowRoot` hacks |
| R-05 | **Salesforce HTTP 4xx / 5xx** errors misclassified as selector failures | Low | High | Agent 6 inspects browser console and `stderr` for HTTP error codes before modifying any selector; healing is suppressed and the error is escalated if a 4xx/5xx is detected |
| R-06 | **Insufficient AC coverage** for CON, OPP, QTE, CTR, ORD, AMD, RNW objects | High (current) | Medium | Downstream objects are exercised transitively via TC-ACC-002 – TC-ACC-005; dedicated user stories must be supplied to generate standalone TCs for those prefixes |
| R-07 | **Wrong test-data key casing** causes runtime `undefined` access | Medium | High | CI lint step validates all `data.*` key references against the `TestData` interface; camelCase variants are rejected at code-review time |

---

## 8. Traceability Matrix

Every test case maps to at least one Acceptance Criterion. No test may be generated without an AC reference.

| TC ID | User Story | AC References | Spec File |
|-------|-----------|---------------|-----------|
| TC-ACC-001 | US-005 | AC-005-01 | tests/account.spec.ts |
| TC-ACC-002 | US-005 | AC-005-02, AC-005-03, AC-005-04 | tests/account.spec.ts |
| TC-ACC-003 | US-005 | QO-005-05, PC-005-06, PC-005-07, PC-005-08, PC-005-09 | tests/account.spec.ts |
| TC-ACC-004 | US-005 | QL-005-10, QL-005-11, CR-005-12 | tests/account.spec.ts |
| TC-ACC-005 | US-005 | OR-005-13, OR-005-14, OR-005-15, OR-005-16 | tests/account.spec.ts |

---

## 9. Tooling and Pipeline

| Step | Agent | Responsibility |
|------|-------|----------------|
| 1 | Agent 1 — Knowledge Base | Load `quote-lifecycle.md`, `pricing.md`, `foundations-and-coexistence.md`, `contract-lifecycle.md`, `order-management.md` |
| 2 | Agent 2 — Story Reader | Parse US-005 into structured ACs with TEMP IDs where missing |
| 3 | Agent 3 — Test Plan Drafter | Generate this document and structured scenario table |
| 4 | Agent 4 — Scenario Drafter | Emit Playwright TypeScript spec using SFUtils engine only |
| 5 | Agent 5 — Test Executor | Execute spec; log pass/fail/fixme per TC |
| 6 | Agent 6 — Self-Healer | Classify failures; apply fixes; re-run up to 3 times |
| 7 | Agent 7 — Dashboard Reporter | Aggregate results into `dashboard.html`, `results.json`, `pipeline-state.json` |
