# Salesforce CPQ — QA Test Plan

**Version:** 1.0
**Date:** 2026-04-30
**Author:** AI-Generated

---

## 1. Scope

The following Salesforce objects are in scope for this test plan. They represent the full end-to-end Revenue Cloud / CPQ lifecycle, from customer identity through order activation, amendment, and renewal.

| Object | Prefix | Rationale |
|---|---|---|
| Account | ACC | Root entity; all downstream records anchor to an Account |
| Contact | CON | Required for Opportunity Contact Role and CPQ buyer identity |
| Opportunity | OPP | Gate record that drives Quote creation |
| Quote (CPQ) | QTE | Core CPQ object; price book selection, line items, and acceptance |
| Contract | CTR | Generated from an Accepted Quote; drives Order and renewal eligibility |
| Order | ORD | Activated from Contract/Quote; final commercial commitment |
| Amendment | AMD | Modifies an active Contract mid-term |
| Renewal | RNW | Generates a new Quote/Contract from an expiring Contract |

**Out of Scope:** Manual test cases, load and performance testing, API-only (non-UI) flows, and any Salesforce objects not listed above.

---

## 2. Summary Table

| Object | User Stories | Total TCs | Positive | Negative | Edge Cases |
|---|---|---|---|---|---|
| Account | US-005 | 5 | 3 | 1 | 1 |
| Contact | — | 0 | — | — | — |
| Opportunity | — | 0 | — | — | — |
| Quote (CPQ) | — | 0 | — | — | — |
| Contract | — | 0 | — | — | — |
| Order | — | 0 | — | — | — |
| Amendment | — | 0 | — | — | — |
| Renewal | — | 0 | — | — | — |
| **Total** | **1** | **5** | **3** | **1** | **1** |

### Account Test Cases

| TC ID | Type | Scenario Summary | AC References |
|---|---|---|---|
| TC-ACC-001 | Edge Case | Identify existing Account; verify Billing Address and Payment Terms (soft-fail if missing) | AC-005-01 |
| TC-ACC-002 | Positive | Create Contact on Account; create Opportunity from Contact; verify Primary Contact Role | AC-005-02, AC-005-03, AC-005-04 |
| TC-ACC-003 | Positive | Create Quote from Opportunity; select price book; add product; validate cart | QO-005-05, PC-005-06, PC-005-07, PC-005-08, PC-005-09 |
| TC-ACC-004 | Positive | Mark Quote as Accepted; create Contract with no prices or discounts | QL-005-10, QL-005-11 |
| TC-ACC-005 | Negative | Activate Contract with Contract Term; create and activate Order from Quote | CR-005-12, OR-005-13, OR-005-14, OR-005-15, OR-005-16 |

> **Note:** Contact, Opportunity, Quote, Contract, Order, Amendment, and Renewal objects have no independently authored user stories or dedicated TC IDs at this time. Their coverage is delivered transitively through TC-ACC-002 through TC-ACC-005 within the US-005 end-to-end flow. Dedicated suites must be authored when object-specific user stories are supplied.

---

## 3. Test Data Strategy

| Principle | Implementation |
|---|---|
| **Uniqueness** | All generated record names embed `Date.now()` (e.g., `AutoAcc-${Date.now()}`) to prevent collision across parallel or repeated runs |
| **Supporting records** | All prerequisite records (Account, Contact, Opportunity) are created within the test run; no dependency on pre-existing sandbox data except where explicitly stated (TC-ACC-001 uses an existing Account) |
| **Credentials** | Loaded exclusively from environment variables (`SF_USERNAME`, `SF_PASSWORD`, `SF_SANDBOX_URL`); never hardcoded in test files or committed to source control |
| **Session state** | Stored in `auth/session.json`; re-used across tests in the same run via Playwright's `storageState` |
| **TestData keys** | Accessed via `getTestData()` using exact keys from the `TestData` interface (e.g., `data.account.Account_Name`, `data.contact.Last_Name`); camelCase variants are forbidden |
| **Static fallbacks** | Fields absent from `test-data.json` use defined fallbacks only: `priceBook → 'Standard Price Book'`, `expirationDate → '12/31/2026'` |
| **Record URLs** | After each creation step, the resulting record URL is captured and passed forward; global search navigation is never used for records created in the same run |

---

## 4. Execution Order

Tests execute **strictly sequentially** in a single Playwright worker (`workers: 1`). State (record URLs, IDs) flows forward through the chain; no step may be skipped.

```
Account (TC-ACC-001)
  └─► Contact + Opportunity (TC-ACC-002)
        └─► Quote / CPQ (TC-ACC-003)
              └─► Contract (TC-ACC-004)
                    └─► Order Activation (TC-ACC-005)
                          └─► Amendment  [future]
                                └─► Renewal  [future]
```

---

## 5. Entry Criteria

All of the following must be satisfied before execution begins:

- [ ] `auth/session.json` exists and contains a valid Salesforce session token
- [ ] `SF_SANDBOX_URL`, `SF_USERNAME`, and `SF_PASSWORD` are set in `.env`
- [ ] Playwright and all `npm` dependencies are installed (`npm ci` completed without error)
- [ ] The target sandbox is accessible and the CPQ managed package is installed and licensed
- [ ] No active maintenance window is scheduled on the target org during the test run

---

## 6. Exit Criteria

The test run is considered complete when all of the following are true:

- [ ] All 5 test cases in scope have been executed (passed, failed, or marked `fixme`)
- [ ] Self-healing (Agent 6) has completed up to 3 retry iterations for any failing test
- [ ] `reports/dashboard.html` reflects the final pass/fail/warning state
- [ ] `reports/results.json` and `reports/pipeline-state.json` have been written
- [ ] All soft-fail (Warning) annotations are visible and documented in the dashboard
- [ ] No test has been silently skipped without a `test.fixme()` comment

---

## 7. Risks and Mitigations

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| R-01 | Salesforce session expiry mid-run | All subsequent tests fail with `INVALID_SESSION_ID` | Re-authenticate by running `npx ts-node scripts/refresh-session.ts` before the suite; Agent 6 must not change selectors when console shows `INVALID_SESSION_ID` — escalate for re-auth instead |
| R-02 | Spinner / loading overlay blocking interactions | `ElementNotInteractable` errors, flaky timing failures | Use `await page.locator('.slds-spinner').waitFor({ state: 'hidden' })` with a 30 s timeout before every interaction following a save or navigation event |
| R-03 | Lookup field search indexing lag | Lookup returns no results for a record just created | Add `waitForTimeout(3000)` before typing into any lookup field that targets a record created earlier in the same run; never use `SFUtils.searchAndOpen()` for same-run records |
| R-04 | Shadow DOM preventing locator resolution | Selectors fail on Lightning Web Components | Use native `lightning-*` element locators and `[data-field-api-name]` attributes exclusively; never pierce shadow DOM manually; XPath is last resort only |
| R-05 | CPQ cart / pricing engine async recalculation | Price totals not yet populated when assertion fires | Wait for spinner dismissal after every line-item change before asserting cart totals |
| R-06 | Insufficient user permissions in sandbox | Buttons absent, fields read-only, HTTP 403/insufficient access | Agent 6 must check console for `INSUFFICIENT_ACCESS` before modifying selectors; escalate to Salesforce admin for profile/permission-set correction |
| R-07 | Amendment and Renewal suites not yet authored | Revenue Cloud regression coverage gap | Track as open backlog items; mark object rows in summary table with `—`; do not block current execution |

---

## 8. Out of Scope

- Manual / exploratory test cases
- Load, stress, and performance testing
- API-only flows (REST/SOAP) without a UI component
- Salesforce objects not listed in Section 1
- UAT sign-off procedures
- Data migration validation
