# Salesforce CPQ — End-to-End QA Test Plan

**Version:** 1.0
**Date:** 2026-04-29
**Author:** AI-Generated

---

## 1. Scope

The following Salesforce objects are in scope for this test cycle. They represent the full Revenue Cloud / CPQ lifecycle, from initial customer record creation through order activation, amendment, and renewal. Each object is a prerequisite for the next; therefore all are covered to validate end-to-end data integrity and workflow continuity.

| Object | Reason for Inclusion |
|---|---|
| Account | Root record; all downstream objects depend on a valid Account |
| Contact | Required for Opportunity Contact Role and Quote recipient |
| Opportunity | Required to create a Quote and drive the CPQ flow |
| Quote (CPQ) | Core Revenue Cloud object; drives pricing, product selection, and contract generation |
| Contract | Generated from an Accepted Quote; prerequisite for Orders and Renewals |
| Order | Created from an Activated Contract; validated through Order Activation |
| Amendment | Tests mid-term contract changes via CPQ Amendment flow |
| Renewal | Tests end-of-term renewal via CPQ Renewal flow |

---

## 2. Summary Table

| Object | User Stories | Total TCs | Positive | Negative | Edge Cases |
|---|---|---|---|---|---|
| Account (ACC) | US-005 | 5 | 3 | 1 | 1 |
| Contact (CON) | — | 0 | — | — | — |
| Opportunity (OPP) | — | 0 | — | — | — |
| Quote / CPQ (QTE) | — | 0 | — | — | — |
| Contract (CTR) | — | 0 | — | — | — |
| Order (ORD) | — | 0 | — | — | — |
| Amendment (AMD) | — | 0 | — | — | — |
| Renewal (RNW) | — | 0 | — | — | — |
| **Total** | **1** | **5** | **3** | **1** | **1** |

> **Note:** Contact, Opportunity, Quote, Contract, Order, Amendment, and Renewal are exercised as embedded steps within the Account E2E suite (US-005). Dedicated user stories and standalone TC IDs for those objects are pending and must be authored before the next test cycle.

---

## 3. Test Cases

### Account (ACC) — US-005

| TC ID | Title | Type | AC Ref | Expected Result |
|---|---|---|---|---|
| TC-ACC-001 | Verify Billing Address and Payment Terms on Account Details tab | Positive | AC-005-01 | Details tab displays Billing Address and Payment Terms; soft-fail logged if fields absent |
| TC-ACC-002 | Create Contact via Account Contacts related list | Positive | AC-005-02 | Contact created; record URL contains `/Contact/`; `contactUrl` captured for downstream steps |
| TC-ACC-003 | Create Opportunity from Contact and verify Primary Contact Role | Positive | AC-005-03, AC-005-04 | Opportunity created; Contact Roles related list shows contact as Primary |
| TC-ACC-004 | Create Quote with Products, Accept Quote, generate Activated Contract | Edge Case | QO-005-05 → CR-005-12 | Quote contains product line items; status transitions to Accepted; Contract generated with Activated status and 12-month term |
| TC-ACC-005 | Create Order from Quote and Activate to Complete | Negative | OR-005-13 → OR-005-16 | Order created via "Create single Order"; Activate succeeds; Order status = Complete |

---

## 4. Test Data Strategy

### Uniqueness
- All record names include a millisecond timestamp suffix to prevent collisions across runs:
  - Account: `AutoAcc-${Date.now()}`
  - Contact: `AutoCon-${Date.now()}`
  - Opportunity: `AutoOpp-${Date.now()}`
  - Quote: `AutoQte-${Date.now()}`
- Timestamps are generated once per test run and reused within that run to maintain referential consistency.

### Supporting Records
- All prerequisite records (Account, Contact, Opportunity) are created within the test run itself. No dependency on pre-existing sandbox data.
- Record URLs captured from success toast links or Related list links are stored in scoped variables and passed to subsequent test steps. Global search (`SFUtils.searchAndOpen`) is **never** used for same-run records due to Salesforce search indexing delay.

### External Data Source
- Structured test data loaded via `getTestData()` using the `TestData` interface in `utils/test-data.ts`.
- Exact key names enforced: `data.account.Account_Name`, `data.contact.First_Name`, `data.opportunity.Name`, `data.quote.Name`, etc.
- Fields absent from `test-data.json` use hardcoded fallbacks only:
  - `priceBook` → `'Standard Price Book'`
  - `expirationDate` → `'12/31/2026'`

### Credentials
- No credentials are hardcoded in test files.
- `SF_SANDBOX_URL`, `SF_USERNAME`, and `SF_PASSWORD` are consumed exclusively from `.env` via `dotenv`.
- `auth/session.json` is the Playwright auth state file; it is never committed to source control.

---

## 5. Execution Order

Tests are executed strictly sequentially using **1 Playwright worker**. Each stage depends on state produced by the previous stage.

```
1. Account       (TC-ACC-001 → TC-ACC-005)
2. Contact       (TC-CON-* — pending stories)
3. Opportunity   (TC-OPP-* — pending stories)
4. Quote (CPQ)   (TC-QTE-* — pending stories)
5. Contract      (TC-CTR-* — pending stories)
6. Order         (TC-ORD-* — pending stories)
7. Amendment     (TC-AMD-* — pending stories)
8. Renewal       (TC-RNW-* — pending stories)
```

**Worker constraint:** `workers = 1` in `playwright.config.ts`. Parallelism is disabled for all runs to preserve Salesforce record state dependencies and prevent session conflicts.

---

## 6. Entry Criteria

All of the following must be satisfied before test execution begins:

- [ ] `auth/session.json` is present and contains a valid, non-expired Salesforce session token
- [ ] `SF_SANDBOX_URL` is set in `.env` and resolves to an accessible Salesforce sandbox org
- [ ] `SF_USERNAME` and `SF_PASSWORD` are set in `.env`
- [ ] Playwright is installed and `npx playwright --version` returns without error
- [ ] `npm install` has been run and `node_modules/` is up to date
- [ ] Target sandbox org is accessible and not undergoing a scheduled maintenance window
- [ ] CPQ package is installed and active in the target sandbox

---

## 7. Exit Criteria

The test cycle is considered complete when all of the following are true:

- [ ] All in-scope TC IDs have been executed (pass, fail, or `test.fixme()`)
- [ ] Agent 6 (Self-Healer) has completed up to 3 healing iterations for any failing tests
- [ ] Tests that cannot be healed within 3 iterations are marked `test.fixme()` with a descriptive comment
- [ ] `reports/dashboard.html` has been updated and reflects the final run status
- [ ] `reports/results.json` and `reports/pipeline-state.json` are written
- [ ] Agent 7 (Dashboard Reporter) has generated the final HTML dashboard and PowerPoint report
- [ ] No unclassified failures remain in the results (every failure has a root-cause label)

---

## 8. Risks and Mitigations

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R-01 | Salesforce session expiry mid-run | Medium | High | Run `npx ts-node scripts/refresh-session.ts` before execution; pipeline checks session validity at startup |
| R-02 | Spinner/loading overlay blocks interactions | High | Medium | Explicit `page.locator('.slds-spinner').waitFor({ state: 'hidden' })` with 30 s timeout before every post-action step |
| R-03 | Lookup search lag causes stale or empty results | High | Medium | Insert `waitForTimeout(3000)` before any lookup field interaction; retry lookup clear-and-retype once on empty result |
| R-04 | Shadow DOM prevents standard locator resolution | Medium | High | Use native `lightning-*` component locators only; never attempt `pierce/` shadow selectors for LWC components |
| R-05 | Global search indexing delay for same-run records | High | High | Navigate to created records via Related list links or success toast URL — never use `SFUtils.searchAndOpen()` within the same test run |
| R-06 | CPQ pricing engine timeout on Quote save | Low | High | Set `timeout: 60000` on Quote save actions; assert spinner hidden before proceeding; log and soft-fail on first occurrence |
| R-07 | Sandbox data contamination from prior runs | Low | Medium | All records use `Date.now()` suffix; no cleanup dependency on pre-existing records |
| R-08 | Pending user stories for 7 of 8 objects | High | Medium | Current run covers ACC E2E scope only; remaining objects flagged as "pending stories" and excluded from pass/fail gate |

---

## 9. Out of Scope

The following are explicitly excluded from this test plan:

- **Manual test cases** — all coverage is automated via Playwright; no manual execution scripts are maintained
- **Load and performance testing** — no volume, soak, or stress scenarios; Playwright worker count is fixed at 1
- **API-only flows** — no direct Salesforce REST/SOAP API tests; all interactions simulate UI user actions only
- **Metadata and configuration validation** — custom field setup, permission sets, and profile assignments are not tested
- **Mobile and cross-browser testing** — tests target Chromium only; Salesforce Classic UI is not in scope
- **Integration tests with external systems** — ERP, billing, or third-party CPQ connectors are out of scope
- **User acceptance testing (UAT)** — this plan covers automated regression only; UAT is a separate workstream

---

## 10. Traceability Matrix

Every test case must carry an inline comment linking it to its AC reference and TC ID. No test may exist without a corresponding AC.

```
// TC-ACC-001 | AC Reference: AC-005-01
// TC-ACC-002 | AC Reference: AC-005-02
// TC-ACC-003 | AC Reference: AC-005-03, AC-005-04
// TC-ACC-004 | AC Reference: QO-005-05, PC-005-06, PC-005-07, PC-005-08, PC-005-09, QL-005-10, QL-005-11, CR-005-12
// TC-ACC-005 | AC Reference: OR-005-13, OR-005-14, OR-005-15, OR-005-16
```

Objects with no user stories (Contact, Opportunity, Quote, Contract, Order, Amendment, Renewal) must have user stories authored and AC IDs assigned before test generation is initiated for those objects.
