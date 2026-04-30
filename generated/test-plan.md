# Salesforce CPQ — End-to-End Test Plan

**Version:** 1.0
**Date:** 2026-04-30
**Author:** AI-Generated
**Project:** Salesforce CPQ — Account to Order Activation Lifecycle

---

## 1. Scope

### In Scope

| Object | Justification |
|---|---|
| Account | Root record; all downstream objects are anchored to an Account |
| Contact | Created on the Account; required for Opportunity Contact Roles |
| Opportunity | Created from the Contact's related list; drives Quote creation |
| Quote (CPQ) | Core CPQ artifact; covers catalog browsing, pricing, and line items |
| Contract | Generated from an Accepted Quote; activation validates the CPQ-to-contract bridge |
| Order | Provisioned from the Activated Contract/Quote; activation closes the lifecycle |
| Amendment | Post-activation Quote Amendment flow (object in scope; TCs pending story input) |
| Renewal | Contract Renewal flow (object in scope; TCs pending story input) |

### Out of Scope

- Manual test cases executed outside Playwright
- Load testing and performance benchmarking
- API-only flows (REST/SOAP) not surfaced in the UI
- Data migration and ETL validation
- User permission and profile administration

---

## 2. Test Summary

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

> Contact, Opportunity, Quote, Contract, and Order TCs are exercised within TC-ACC-002 through TC-ACC-005 as steps of the US-005 lifecycle. Dedicated prefix suites (CON, OPP, QTE, CTR, ORD, AMD, RNW) require separate user story input before test cases can be generated.

---

## 3. Test Case Inventory

### Account (US-005)

| TC ID | Title | Type | AC Reference |
|---|---|---|---|
| TC-ACC-001 | Verify Billing Address & Payment Terms on Account Details tab | Positive (soft-fail) | AC-005-01 |
| TC-ACC-002 | Create Contact on Account via Contacts related list | Positive | AC-005-02 |
| TC-ACC-003 | Create Opportunity from Contact and verify Primary Contact Role | Positive | AC-005-03, AC-005-04 |
| TC-ACC-004 | Create Quote, browse catalog, add product, validate line item | Edge Case | QO-005-05, PC-005-06 through PC-005-09 |
| TC-ACC-005 | Accept Quote → Contract (Activate) → Order (Activate) | Negative / E2E | QL-005-10, QL-005-11, CR-005-12, OR-005-13 through OR-005-16 |

**Type Classification Rationale**

- **TC-ACC-001 — Positive (soft-fail):** Field existence check; missing fields do not block execution.
- **TC-ACC-002 — Positive:** Standard Contact creation; expects clean success path.
- **TC-ACC-003 — Positive:** Standard Opportunity creation with Contact Role validation.
- **TC-ACC-004 — Edge Case:** Catalog browsing with Price Book selection is sensitive to search indexing lag and dynamic catalog state.
- **TC-ACC-005 — Negative / E2E:** Multi-step state transition; any activation failure mid-flow constitutes a failure condition to be classified by Agent 6.

---

## 4. Test Data Strategy

### Principles

1. **Timestamp-based uniqueness.** All record names are generated at runtime using `Date.now()` (e.g., `AutoAcc-${Date.now()}`) to prevent collisions across parallel executions or reruns.
2. **Supporting records created in-test.** No pre-existing test records are assumed. Each test run creates its own Account → Contact → Opportunity → Quote → Contract → Order chain.
3. **No hardcoded credentials.** Salesforce credentials are read exclusively from environment variables (`SF_USERNAME`, `SF_PASSWORD`, `SF_SANDBOX_URL`). The `.env` file and `auth/session.json` are never committed.
4. **Exact `TestData` key usage.** All references to `getTestData()` use the exact typed keys defined in `utils/test-data.ts`. CamelCase or snake_case variants are forbidden.
5. **Hardcoded fallbacks for fields not in test-data.json.**

| Field | Hardcoded Value |
|---|---|
| `priceBook` | `'Standard Price Book'` |
| `expirationDate` | `'12/31/2026'` |

### Key Mapping Reference

| Object | Key | Example Usage |
|---|---|---|
| Account | `data.account.Account_Name` | Name field on Account creation |
| Contact | `data.contact.First_Name` | First Name on Contact form |
| Contact | `data.contact.Last_Name` | Last Name on Contact form |
| Contact | `data.contact.Email` | Email on Contact form |
| Opportunity | `data.opportunity.Name` | Opportunity Name field |
| Opportunity | `data.opportunity.Stage` | Stage picklist |
| Opportunity | `data.opportunity.Close_Date` | Close Date field |
| Quote | `data.quote.Name` | Quote Name field |
| Quote | `data.quote.Contract_Type` | Contract Type picklist |

---

## 5. Execution Order

Tests execute sequentially in a single Playwright worker (`workers: 1`). State (record URLs, IDs) is passed forward through shared variables within the spec file.

```
Account (TC-ACC-001)
  └─► Contact (TC-ACC-002)
        └─► Opportunity (TC-ACC-003)
              └─► Quote / CPQ (TC-ACC-004)
                    └─► Contract + Order Activation (TC-ACC-005)
                          └─► Amendment  [pending TCs]
                                └─► Renewal  [pending TCs]
```

**Navigation Rule:** After creating a record within a test, navigate to it via the success toast link or the related list link. Do **not** use global search (`SFUtils.searchAndOpen`) — search indexing has a multi-minute delay and will cause false negatives.

---

## 6. Entry Criteria

All conditions below must be satisfied before test execution begins.

| # | Criterion | Verification |
|---|---|---|
| 1 | `auth/session.json` exists and contains a valid Salesforce session | `npx ts-node scripts/refresh-session.ts` exits with code 0 |
| 2 | `SF_SANDBOX_URL` is set in `.env` | `echo $SF_SANDBOX_URL` returns a non-empty HTTPS URL |
| 3 | `SF_USERNAME` and `SF_PASSWORD` are set in `.env` | Environment variables resolve without error |
| 4 | Playwright and all dependencies are installed | `npx playwright install` completes without errors |
| 5 | TypeScript compiles without errors | `npx tsc --noEmit` exits with code 0 |
| 6 | Target sandbox is accessible | HTTP 200 response from `SF_SANDBOX_URL` |

---

## 7. Exit Criteria

The test run is considered complete when all of the following are true.

| # | Criterion |
|---|---|
| 1 | All 5 TCs in scope have been executed (pass, fail, or `test.fixme()`) |
| 2 | Agent 6 (Self-Healer) has completed up to 3 healing iterations for any failed TC |
| 3 | Remaining failures after healing are annotated with `test.fixme()` and a root-cause comment |
| 4 | `reports/dashboard.html` has been updated by Agent 7 |
| 5 | `reports/results.json` and `reports/pipeline-state.json` reflect the final run state |
| 6 | No TC failure is silently ignored; every failure is classified and logged |

---

## 8. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| **Salesforce session expiry** during a long-running suite | Auth failures cause all subsequent TCs to fail | Run `npx ts-node scripts/refresh-session.ts` before execution; Agent 6 detects `INVALID_SESSION_ID` in console and halts selector changes |
| **Spinner / page load timing** causes premature interactions | Stale element errors, false negatives | `await page.locator('.slds-spinner').waitFor({ state: 'hidden' })` with 30 s timeout before every interaction |
| **Lookup search indexing lag** when searching for newly created records | Lookup returns no results | `await page.waitForTimeout(3000)` before initiating lookup; use related list or toast navigation instead of global search |
| **Shadow DOM / LWC component boundary** breaks standard locators | Selectors do not resolve | Use native `lightning-*` locators and `[data-field-api-name]` attributes exclusively; never pierce shadow DOM manually |
| **CPQ catalog product not found** due to Price Book misconfiguration | TC-ACC-004 fails at product search step | Hardcode `'Standard Price Book'`; verify product assignment in sandbox setup prior to run |
| **Salesforce API errors (4xx / 5xx)** misattributed to selector failures | Incorrect healing applied by Agent 6 | Agent 6 checks browser console and stderr for HTTP error codes before changing any selectors; `INSUFFICIENT_ACCESS` and HTTP 5xx freeze selector healing |
| **Amendment / Renewal TCs absent** | Coverage gap for post-activation lifecycle | Flag as pending in pipeline state; block sprint sign-off until user stories are provided and TCs generated |

---

## 9. Traceability Matrix

Every test case must carry the following header comment in the Playwright spec:

```
// TC-ACC-001 | AC Reference: AC-005-01
```

No test case may exist without a traceable AC reference. If an AC is unavailable, a `TEMP-AC-NNN` placeholder is assigned and flagged for review before merge.

| TC ID | AC Reference(s) | Spec File |
|---|---|---|
| TC-ACC-001 | AC-005-01 | `tests/account.spec.ts` |
| TC-ACC-002 | AC-005-02 | `tests/account.spec.ts` |
| TC-ACC-003 | AC-005-03, AC-005-04 | `tests/account.spec.ts` |
| TC-ACC-004 | QO-005-05, PC-005-06, PC-005-07, PC-005-08, PC-005-09 | `tests/account.spec.ts` |
| TC-ACC-005 | QL-005-10, QL-005-11, CR-005-12, OR-005-13, OR-005-14, OR-005-15, OR-005-16 | `tests/account.spec.ts` |

---

## 10. Approval

| Role | Name | Sign-off |
|---|---|---|
| QA Lead | AI-Generated | — |
| Salesforce Architect | — | Pending |
| Product Owner | — | Pending |
