# Salesforce CPQ — End-to-End QA Test Plan

**Version:** 1.0
**Date:** 2026-04-17
**Author:** AI-Generated
**Project:** Salesforce CPQ — E2E Playwright Automation Suite

---

## 1. Scope

### In Scope

| Object | Reason for Inclusion |
|---|---|
| Account | Prerequisite record for all downstream objects; billing address and payment terms verified as pre-conditions |
| Contact | Core CRM entity; creation, linkage to Account, and assignment as Opportunity Contact Role validated |
| Opportunity | Created in the context of a Contact; Contact Role association forms the terminal assertion of the E2E flow |
| Quote (CPQ) | Planned for future sprint; infrastructure scaffolded under prefix QTE; zero executable TCs at this time |

### Out of Scope

- Manual test cases and exploratory testing
- Load testing and performance benchmarking
- API-only flows (REST/SOAP) with no UI component
- Production org validation
- Third-party integrations not surfaced in the CPQ UI

---

## 2. Objective

Validate the sequential Salesforce CRM lifecycle from Account verification through Opportunity Contact Role assignment, executing as a single deterministic Playwright suite. All tests must map to an Acceptance Criterion and maintain traceability throughout the pipeline.

---

## 3. Test Case Summary

| Object | User Stories | Total TCs | Positive | Negative | Edge Cases |
|---|---|---|---|---|---|
| Account (ACC) | — | 0 | 0 | 0 | 0 |
| Contact (CON) | US-005 | 4 | 3 | 0 | 1 |
| Opportunity (OPP) | US-005 | 4 | 3 | 0 | 1 |
| Quote / CPQ (QTE) | — | 0 | 0 | 0 | 0 |
| **Total** | | **8** | **6** | **0** | **2** |

> Edge cases are TC-CON-001 and TC-OPP-001 (soft-fail on optional fields).

---

## 4. Test Case Inventory

### 4.1 Contact (CON) — US-005

| TC ID | Scenario | Expected Result | Type | AC Ref |
|---|---|---|---|---|
| TC-CON-001 | Verify Account Billing Address and Payment Terms exist (soft-fail if missing) | Page loads; missing fields produce console warnings; test does not hard-fail | Edge | AC-005-01 |
| TC-CON-002 | Create a new Contact record linked to the Account when none exists | Contact "David John" created, saved, and Account association confirmed | Positive | AC-005-02 |
| TC-CON-003 | Create an Opportunity from the Contact's Related list | Opportunity "Standard E2E - Q2 Order" created; detail page loads successfully | Positive | AC-005-03 |
| TC-CON-004 | Verify newly created Contact is assigned as Primary Contact Role on the Opportunity | "David John" appears in Contact Roles related list with Primary designation | Positive | AC-005-04 |

### 4.2 Opportunity (OPP) — US-005

| TC ID | Scenario | Expected Result | Type | AC Ref |
|---|---|---|---|---|
| TC-OPP-001 | Verify Account "SBOTestAccount" has Billing Address and Payment Terms (soft-fail if missing) | Detail page loads; missing fields produce console warnings; no hard failure | Edge | AC-005-01 |
| TC-OPP-002 | Create Contact "David John" for Account if not already present | Contact created and linked to SBOTestAccount, or confirmed pre-existing | Positive | AC-005-02 |
| TC-OPP-003 | Create Opportunity from Contact "David John" using New Opportunity action | Opportunity detail page confirms creation from Contact context | Positive | AC-005-03 |
| TC-OPP-004 | Verify "David John" is assigned as Primary Contact Role on the Opportunity | Contact Roles related list shows David John with Primary flag set | Positive | AC-005-04 |

---

## 5. Test Data Strategy

| Principle | Implementation |
|---|---|
| **Record uniqueness** | All dynamically named records use timestamp suffixes, e.g. `AutoAcc-${Date.now()}` |
| **Supporting records** | Accounts, Contacts, and Opportunities are created in-test; no pre-seeded data assumed |
| **Credentials** | Sourced exclusively from `.env` via `SF_USERNAME`, `SF_PASSWORD`, `SF_SANDBOX_URL`; never hardcoded |
| **Object mapping** | `data.account` → Account fields; `data.contact` → Contact fields; `data.opportunity` → Opportunity fields |
| **Idempotency** | Tests check for pre-existing records before creation (e.g., TC-OPP-002) to avoid duplicates |
| **Session state** | `auth/session.json` reused across tests; refreshed via `scripts/refresh-session.ts` before each run |
| **Isolation** | No shared mutable state between spec files; each suite cleans up or namespaces its records |

---

## 6. Execution Order

Tests execute **sequentially** in a single Playwright worker (`workers = 1`). The order reflects the Salesforce CRM object dependency chain.

```
Step 1 — Account    (ACC)  → Verify pre-existing "SBOTestAccount" fields [pre-condition]
Step 2 — Contact    (CON)  → TC-CON-001 → TC-CON-002 → TC-CON-003 → TC-CON-004
Step 3 — Opportunity (OPP) → TC-OPP-001 → TC-OPP-002 → TC-OPP-003 → TC-OPP-004
Step 4 — Quote/CPQ  (QTE)  → [No executable TCs — placeholder only]
```

State (record IDs, URLs) produced by each step is passed forward to subsequent steps. No step may be skipped if a preceding step has produced a hard failure.

---

## 7. Entry Criteria

All of the following must be satisfied before test execution begins.

| # | Criterion | Verification |
|---|---|---|
| 1 | `auth/session.json` is present and contains a valid, non-expired Salesforce session | Run `npx ts-node scripts/refresh-session.ts`; confirm no auth error |
| 2 | `SF_SANDBOX_URL`, `SF_USERNAME`, and `SF_PASSWORD` are set in `.env` | `dotenv` loads without missing-key warnings at suite startup |
| 3 | Playwright is installed and TypeScript compilation succeeds | `npx playwright --version` returns without error |
| 4 | Target sandbox org is accessible and the CPQ package is installed | Manual spot-check of sandbox login before pipeline trigger |
| 5 | Account "SBOTestAccount" exists in the sandbox | TC-CON-001 / TC-OPP-001 soft-fail check confirms presence |

---

## 8. Exit Criteria

The test run is considered complete when all of the following are true.

| # | Criterion |
|---|---|
| 1 | All 8 executable TCs have been run and a pass/fail status recorded |
| 2 | Self-healing (Agent 6) has completed up to 3 retry attempts for any failing TC |
| 3 | Any remaining unresolved failures are explicitly marked `UNRESOLVED` in `results.json` |
| 4 | `dashboard.html` reflects the final execution state |
| 5 | `pipeline-state.json` is updated with terminal status for each TC |
| 6 | A summary report has been generated and is available under `reports/` |

---

## 9. Risks and Mitigations

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| R-01 | Salesforce session expiry mid-run | All subsequent steps fail with auth error | Re-run `scripts/refresh-session.ts` before pipeline start; Agent 6 detects auth failures and triggers refresh |
| R-02 | Spinner / loading overlay blocks element interaction | Click or assertion fires on hidden element | `await page.locator('.slds-spinner').waitFor({ state: 'hidden' })` with 30 s timeout on every navigation |
| R-03 | Lookup search field lag (SOSL debounce) | Lookup returns no results; record not selected | `waitForTimeout(3000)` inserted before typing into lookup fields; confirmed against known lag pattern |
| R-04 | Shadow DOM / LWC component encapsulation | Standard selectors fail to pierce shadow root | Use native `lightning-*` locators exclusively; never use `>>` pierce or `evaluate` workarounds |
| R-05 | Duplicate record creation on retry | Data integrity issues and assertion mismatches | Idempotency guards check for existing records by name before creating; timestamps ensure uniqueness when creation is required |
| R-06 | Hardcoded wait times causing flakiness on slow sandbox | Tests pass locally but fail in CI | All waits are explicit `waitFor` calls; no arbitrary `sleep` without a condition |

---

## 10. Traceability Matrix

| AC Reference | TC ID(s) | Spec File |
|---|---|---|
| AC-005-01 | TC-CON-001, TC-OPP-001 | contact.spec.ts, opportunity.spec.ts |
| AC-005-02 | TC-CON-002, TC-OPP-002 | contact.spec.ts, opportunity.spec.ts |
| AC-005-03 | TC-CON-003, TC-OPP-003 | contact.spec.ts, opportunity.spec.ts |
| AC-005-04 | TC-CON-004, TC-OPP-004 | contact.spec.ts, opportunity.spec.ts |

Every test function in a spec file must carry a leading comment in the format:

```
// TC-CON-002 | AC Reference: AC-005-02
```

No test may be committed without a valid TC ID and AC reference.

---

## 11. Approval

| Role | Name | Status |
|---|---|---|
| QA Lead | AI-Generated | Approved — 2026-04-17 |
| Dev Lead | — | Pending |
| Product Owner | — | Pending |
