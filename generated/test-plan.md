# Salesforce CPQ — QA Test Plan

**Version:** 1.0
**Date:** 2026-05-01
**Author:** AI-Generated

---

## 1. Scope

The following Salesforce objects are in scope for this test cycle. They collectively represent the full revenue lifecycle in Salesforce CPQ — from customer acquisition through contract execution and post-contract actions.

| Object | Prefix | Rationale |
|---|---|---|
| Account | ACC | Root record; all downstream objects depend on a valid Account |
| Contact | CON | Required for Opportunity Contact Roles and CPQ persona association |
| Opportunity | OPP | Bridge between Account and Quote; drives CPQ engagement |
| Quote (CPQ) | QTE | Core CPQ object; covers price book, product selection, and acceptance |
| Contract | CTR | Generated from accepted Quote; must reach Activated status |
| Order | ORD | Generated from Contract/Quote; must be created and activated |
| Amendment | AMD | Post-activation modification to an active Contract |
| Renewal | RNW | Post-expiry Contract continuation flow |

**Out of Scope:** Manual test cases, load and performance testing, API-only flows (no UI interaction), destructive/delete operations, and multi-currency configurations.

---

## 2. Summary Table

| Object | User Stories | Total TCs | Positive | Negative | Edge Cases |
|---|---|---|---|---|---|
| Account | US-005 | 5 | 3 | 1 | 1 |
| Contact | — | 0 | 0 | 0 | 0 |
| Opportunity | — | 0 | 0 | 0 | 0 |
| Quote (CPQ) | — | 0 | 0 | 0 | 0 |
| Contract | — | 0 | 0 | 0 | 0 |
| Order | — | 0 | 0 | 0 | 0 |
| Amendment | — | 0 | 0 | 0 | 0 |
| Renewal | — | 0 | 0 | 0 | 0 |
| **TOTAL** | **1** | **5** | **3** | **1** | **1** |

> **Note:** Contact, Opportunity, Quote, Contract, Order, Amendment, and Renewal are exercised as dependent steps within TC-ACC-002 through TC-ACC-005 (US-005 E2E lifecycle). Dedicated standalone user stories and TC IDs for those objects are pending authoring and are tracked as gaps.

---

## 3. Test Cases — Account (US-005)

### US-005: Account to Order Activation E2E Lifecycle

| TC ID | Type | Scenario | Expected Result | AC Ref |
|---|---|---|---|---|
| TC-ACC-001 | Edge Case | Verify existing Account has Billing Address and Payment Terms on the Details tab | Both fields visible; soft-fail warning logged if blank or absent — suite continues | AC-005-01 |
| TC-ACC-002 | Positive | Create a new Contact via direct URL navigation and link to Account | Contact saved; URL contains `/Contact/`; Contact last name visible on the record page | AC-005-02 |
| TC-ACC-003 | Positive | Create an Opportunity linked to the Account and verify Contact Primary Contact Role in the Related tab | Opportunity URL contains `/Opportunity/`; Contact name appears in the Contact Roles section | AC-005-03, AC-005-04 |
| TC-ACC-004 | Positive | Create a Quote from the Opportunity, select Price Book, add a product, save, accept the Quote, and initiate Contract creation | Quote has at least one product on line items; status = Accepted; Contract creation dialog completed with None option selected | QO-005-05, PC-005-06, PC-005-07, PC-005-08, PC-005-09, QL-005-10, QL-005-11 |
| TC-ACC-005 | Negative | Activate Contract with contract term filled, create a single Order from the Quote, open the Order, and activate it | Contract status = Activated; Order URL contains `/Order/`; Order status = Activated | CR-005-12, OR-005-13, OR-005-14, OR-005-15, OR-005-16 |

---

## 4. Test Data Strategy

### 4.1 Uniqueness
- All record names that must be unique (Account, Contact, Opportunity, Quote, Contract) are suffixed with a UTC timestamp at runtime: `${recordName}_${Date.now()}`.
- No hardcoded record IDs. IDs are captured at creation time and stored in describe-level variables for downstream steps.

### 4.2 Supporting Records
- Supporting records (Contact, Opportunity, Quote, Contract, Order) are created in-test as part of the E2E lifecycle. No pre-seeded data is required beyond the baseline Account.
- The baseline Account (referenced by `data.account.Account_Name`) must exist in the sandbox prior to execution. It is not created by the suite.

### 4.3 Fixture Keys
- All test data is sourced from `tests/fixtures/test-data.json`.
- Keys are used verbatim (no camelCase conversion): `data.account.Account_Name`, `data.contact.First_Name`, `data.contact.Last_Name`, `data.contact.Email`, `data.opportunity.Name`, `data.opportunity.Stage`, `data.opportunity.Close_Date`, `data.quote.Name`.

### 4.4 Credentials
- No credentials are hardcoded in any spec file.
- Authentication state is provided exclusively via `auth/session.json` (Playwright `storageState`).
- `SF_SANDBOX_URL` is the single source of truth for the org endpoint, consumed via `process.env.SF_SANDBOX_URL`.

---

## 5. Execution Order

Tests execute sequentially under **1 Playwright worker** to preserve shared state (URLs, record IDs) across steps.

```
Account (TC-ACC-001 → TC-ACC-005)
  └─ Contact creation (within TC-ACC-002)
       └─ Opportunity creation (within TC-ACC-003)
            └─ Quote / CPQ (within TC-ACC-004)
                 └─ Contract activation (within TC-ACC-005)
                      └─ Order creation & activation (within TC-ACC-005)
                           └─ Amendment (pending TC authoring)
                                └─ Renewal (pending TC authoring)
```

**Parallelism:** Disabled (`workers: 1` in `playwright.config.ts`). Each object's spec depends on state produced by the preceding spec.

---

## 6. Entry Criteria

All of the following must be satisfied before a test run is initiated:

| # | Criterion | Verification |
|---|---|---|
| 1 | `auth/session.json` is present and contains a valid, non-expired Salesforce session | `scripts/verify-session.ts` exits with code 0 |
| 2 | `SF_SANDBOX_URL` environment variable is set and reachable | `curl -o /dev/null -s -w "%{http_code}" $SF_SANDBOX_URL` returns 200 or 302 |
| 3 | Playwright and all `@playwright/test` dependencies are installed | `npx playwright --version` succeeds |
| 4 | `tests/fixtures/test-data.json` exists and contains all required keys | Schema validation script passes |
| 5 | Baseline Account record (`data.account.Account_Name`) exists in the sandbox | Manual pre-check or setup script confirms record presence |

---

## 7. Exit Criteria

A test run is considered complete when **all** of the following are true:

| # | Criterion |
|---|---|
| 1 | All 5 TC IDs (TC-ACC-001 through TC-ACC-005) have been executed — pass, fail, or skip recorded |
| 2 | Self-healing agent has completed up to 3 iteration attempts on any failed tests |
| 3 | HTML dashboard is updated with final pass/fail/warning counts |
| 4 | PowerPoint/PDF report is generated and saved to `reports/` |
| 5 | All soft-fail warnings (e.g., TC-ACC-001 blank fields) are surfaced in the dashboard with Warning status — not as hard failures |

---

## 8. Risks and Mitigations

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| R-01 | Salesforce session expiry mid-run | All subsequent tests fail with login redirect | Re-run `scripts/refresh-session.ts` before each pipeline execution; monitor for 401/redirect in `beforeEach` hook |
| R-02 | Spinner / loading overlay timing | `waitForLoading` resolves before DOM is ready, causing stale element errors | Use `locator.waitFor({ state: 'visible' })` with an explicit **30-second** timeout on all post-action assertions; never use `waitForTimeout` for loading gates |
| R-03 | Lookup field search lag | Dropdown options not yet rendered when `click()` fires | Insert `await page.waitForTimeout(3000)` immediately after `SFUtils.fillField` for any lookup field, before interacting with the dropdown option |
| R-04 | Shadow DOM piercing failures on Lightning components | Locator returns 0 elements; test fails | Use native `lightning-*` element selectors only; never use `pierce/` or `>>>` shadow-piercing CSS; rely on `SFUtils.fillField` with API names |
| R-05 | CPQ Price Book / Product catalog not configured in sandbox | TC-ACC-004 cannot add a product line | Confirm at least one active Price Book and one Product are configured in the sandbox as part of entry criteria |
| R-06 | Contact, Opportunity, Contract, Order, Amendment, Renewal have no standalone TCs | Coverage gaps if E2E suite is skipped | Author dedicated user stories and TC IDs per object in the next sprint; treat current gap as a tracked risk |

---

## 9. Out of Scope

- Manual test cases and exploratory testing sessions
- Load, stress, and performance testing
- API-only flows (Salesforce REST / SOAP / Bulk API with no UI interaction)
- Destructive operations (record deletion, data purge)
- Multi-currency and multi-language configuration testing
- Mobile / Salesforce Mobile App UI testing
- Managed package internal logic outside CPQ quote and order flows
