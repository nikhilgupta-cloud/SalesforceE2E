# Salesforce CPQ — End-to-End Test Plan

**Version:** 1.0
**Date:** 2026-05-01
**Author:** AI-Generated
**Project:** Salesforce CPQ — Playwright TypeScript E2E Suite
**Prepared For:** QA Lead Review

---

## 1. Scope

### 1.1 In-Scope Objects

| # | Salesforce Object | Prefix | Rationale |
|---|-------------------|--------|-----------|
| 1 | Account | ACC | Root record; all downstream objects depend on a valid Account |
| 2 | Contact | CON | Required for Quote and Contract signatories |
| 3 | Opportunity | OPP | Gate record that drives CPQ Quote generation |
| 4 | Quote (CPQ) | QTE | Core CPQ object; covers product selection, pricing, and approval flows |
| 5 | Contract | CTR | Downstream of Opportunity; validates contractual state transitions |
| 6 | Order | ORD | Generated from Contract; validates order activation |
| 7 | Amendment | AMD | Mid-term change to an active Contract; CPQ-specific lifecycle |
| 8 | Renewal | RNW | End-of-term renewal flow; validates CPQ renewal quote generation |

### 1.2 Coverage Rationale

These eight objects represent the complete Salesforce CPQ revenue lifecycle: from customer acquisition (Account, Contact, Opportunity) through quoting and contracting (Quote, Contract, Order) to post-contract management (Amendment, Renewal). Covering this chain end-to-end validates system integrity across object relationships, field propagation, and CPQ business rules.

---

## 2. Test Case Summary

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

> **Note:** Objects with 0 TCs reflect the current pipeline state (no spec tests generated). They are in-scope for future sprints and are included in execution order to enforce dependency sequencing.

### 2.1 Account Test Cases (US-005)

| TC ID | Title | Type | Priority |
|-------|-------|------|----------|
| TC-ACC-001 | Create Account with all required fields and verify record saves successfully | Positive | P1 |
| TC-ACC-002 | Verify Account record details are persisted correctly on the Details tab | Positive | P1 |
| TC-ACC-003 | Edit an existing Account and confirm field updates are reflected | Positive | P2 |
| TC-ACC-004 | Attempt to save Account without required Name field and verify validation error | Negative | P1 |
| TC-ACC-005 | Create Account with maximum-length field values and verify no truncation | Edge Case | P2 |

---

## 3. Test Data Strategy

### 3.1 Uniqueness

All record names that must be unique within the org are suffixed with a UTC timestamp at runtime:

```
Account_Name: `Test Account ${Date.now()}`
Opportunity_Name: `Test Opp ${Date.now()}`
Quote_Name: `Test Quote ${Date.now()}`
```

This prevents name-collision failures across parallel runs or re-runs on the same sandbox.

### 3.2 Source File

All test data is sourced exclusively from `tests/fixtures/test-data.json`. Keys are consumed using their exact casing as defined in that file (e.g., `data.account.Account_Name`, `data.contact.First_Name`). camelCase variants of these keys are prohibited.

### 3.3 Supporting Records

Every test creates its own supporting records in-test via direct URL navigation. No pre-seeded sandbox data is assumed or required. The creation sequence within each spec mirrors the execution order defined in Section 5.

### 3.4 Credentials

No credentials, passwords, or session tokens are hardcoded in any spec file or fixture. Authentication is provided exclusively through:

- `auth/session.json` — Playwright storageState captured via `scripts/refresh-session.ts`
- `SF_SANDBOX_URL` environment variable — base URL injected at runtime

### 3.5 Cleanup

Post-run cleanup is handled by the dashboard reporter. No automated teardown is performed mid-suite to preserve state for failure inspection.

---

## 4. Execution Order

Tests execute sequentially in a single Playwright worker (`workers: 1`) to respect record dependency chains.

```
1. Account       (ACC)  — creates root org record
2. Contact       (CON)  — depends on Account
3. Opportunity   (OPP)  — depends on Account
4. Quote (CPQ)   (QTE)  — depends on Opportunity
5. Contract      (CTR)  — depends on Opportunity/Quote
6. Order         (ORD)  — depends on Contract
7. Amendment     (AMD)  — depends on active Contract
8. Renewal       (RNW)  — depends on expiring Contract
```

Each spec receives the record URL from the preceding spec via a shared state variable declared at the `describe` block level. `fullyParallel: false` must be set in `playwright.config.ts`.

---

## 5. Entry Criteria

All of the following must be satisfied before the suite is executed:

- [ ] `auth/session.json` is present, valid, and not expired
- [ ] Environment variable `SF_SANDBOX_URL` is set and resolves to a reachable Salesforce sandbox
- [ ] Playwright is installed (`npx playwright install` completed with no errors)
- [ ] `tests/fixtures/test-data.json` exists and passes schema validation
- [ ] No pending migrations or deployments are in progress on the target sandbox
- [ ] Agent pipeline (Knowledge Base → Story Reader → Test Plan → Scenario Drafter → Executor) has completed prior stages without fatal errors

---

## 6. Exit Criteria

The suite is considered complete when all of the following are true:

- [ ] All generated test cases have been executed (pass, fail, or skipped with documented reason)
- [ ] Self-healing agent (Agent 6) has completed up to 3 healing iterations on any failed tests
- [ ] Post-healing re-run results are captured and classified
- [ ] HTML dashboard is updated with final pass/fail/warning counts
- [ ] PowerPoint report is generated and available in the pipeline output directory
- [ ] All Soft Failures (Warnings) are explicitly documented in the dashboard

---

## 7. Risks and Mitigations

| # | Risk | Impact | Mitigation |
|---|------|--------|------------|
| R-01 | Salesforce session expiry mid-run | All tests fail with auth error | Re-authenticate via `scripts/refresh-session.ts` before suite start; pipeline checks `session.json` age and refreshes if older than 90 minutes |
| R-02 | Spinner / loading overlay timing | `ElementNotInteractable` or stale-element errors | Replace all `waitForTimeout()` calls with `SFUtils.waitForLoading(page)` and explicit `.waitFor({ state: 'visible', timeout: 30000 })` on target locators |
| R-03 | Lookup search result lag | Lookup dropdown never appears; test fails | Insert `waitForTimeout(3000)` immediately before any lookup `fillField` interaction, then await `[role="option"]` visibility before clicking |
| R-04 | Shadow DOM inaccessibility | Standard locators fail to pierce shadow root | Use native `lightning-*` component locators exclusively; never attempt manual shadow-root piercing with `>>` or `evaluateHandle` |
| R-05 | Dynamic Related List layout | `New` button in related list is unreachable or absent | Always navigate to record creation via direct URL (e.g., `/lightning/o/Contact/new`) as mandated by CLAUDE.md; never click related-list `New` buttons |
| R-06 | Sandbox data conflicts from prior runs | Duplicate-record validation errors | Timestamp-suffix all unique fields (see Section 3.1); run suite against a dedicated QA sandbox, not shared dev orgs |

---

## 8. Out of Scope

The following are explicitly excluded from this test plan:

- **Manual test cases** — This plan covers only automated Playwright E2E scenarios. Manual exploratory testing is a separate workstream.
- **Load and performance testing** — No volume, soak, or stress tests are included. Playwright is not configured for concurrent load generation.
- **API-only flows** — Tests that interact solely with the Salesforce REST or SOAP API (no UI interaction) are not part of this suite. All scenarios require a rendered Lightning UI.
- **Integration tests with external systems** — Third-party ERP, billing, or middleware integrations are out of scope.
- **Mobile / Salesforce1 layouts** — All tests target the standard Lightning desktop experience only.
- **Permission and profile matrix testing** — Role-based access control validation is not covered in this suite.

---

*End of Test Plan v1.0*
