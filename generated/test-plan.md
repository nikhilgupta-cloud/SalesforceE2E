# Salesforce CPQ — QA Test Plan

**Version:** 1.0
**Date:** 2026-04-24
**Author:** AI-Generated
**Project:** Salesforce CPQ End-to-End Test Automation
**Framework:** Playwright + TypeScript

---

## 1. Scope

### 1.1 In-Scope Objects

| Object | Prefix | Rationale |
|--------|--------|-----------|
| Account | ACC | Root anchor of the CPQ lifecycle; all downstream records depend on a valid Account |
| Contact | CON | Required for Opportunity Contact Roles and Quote recipient linkage |
| Opportunity | OPP | Bridge between Account/Contact and the Quote; drives CPQ entry point |
| Quote (CPQ) | QTE | Core Revenue Cloud object; encapsulates pricing, products, and approval routing |
| Contract | CTR | Downstream output of an accepted Quote; governs entitlement and renewal eligibility |
| Order | ORD | Activated from a Contract or Quote; triggers fulfillment and revenue recognition |
| Amendment | AMD | Modifies an active Contract mid-term; validates delta pricing and line changes |
| Renewal | RNW | Extends or re-prices an expiring Contract; validates renewal Quote generation |

### 1.2 Out of Scope

- Manual test cases and exploratory testing
- Load testing, performance benchmarking, and stress testing
- API-only flows (no UI interaction)
- Salesforce metadata deployments and configuration changes
- Third-party integrations not surfaced in the CPQ UI

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

### 2.1 Account Test Cases (US-005)

| TC ID | Scenario | Type | AC Ref | Expected Result |
|-------|----------|------|--------|-----------------|
| TC-ACC-001 | Identify existing Account and soft-verify Billing Address and Payment Terms on Details tab | Positive | AC-005-01 | Billing Address fields and Payment Terms are present; warnings logged if missing (no hard failure) |
| TC-ACC-002 | Create a new Contact directly on the Account record via the Related tab | Positive | AC-005-02 | Contact is successfully created and visible in the Contacts related list on the Account |
| TC-ACC-003 | Create a new Opportunity from the Contact record's Related tab | Positive | AC-005-03 | Opportunity is created and linked; user lands on the new Opportunity record |
| TC-ACC-004 | Verify the newly created Contact is assigned as Primary Contact Role on the Opportunity | Edge Case | AC-005-04 | Contact appears in the Contact Roles related list with Primary designation |
| TC-ACC-005 | Create a Quote from the Opportunity using the Create Quote button | Negative | QO-005-05 | Quote record is created and visible; linked to the parent Opportunity |

> **Note:** Contact, Opportunity, Quote, Contract, Order, Amendment, and Renewal objects currently have no authored user stories or TC IDs. Test cases for these objects must be added in a future sprint before execution coverage can be declared complete. The execution order below is defined and ready to receive those TCs.

---

## 3. Test Data Strategy

### 3.1 Uniqueness

All dynamically created records use a timestamp suffix to prevent collisions across runs and parallel environments:

```
AutoAcc-<Date.now()>     → Account Name
AutoCon-<Date.now()>     → Contact Last Name
AutoOpp-<Date.now()>     → Opportunity Name
AutoQte-<Date.now()>     → Quote Name
```

### 3.2 Supporting Record Creation

- Every supporting record (Contact, Opportunity, Quote) is created in-test within the same spec file, in dependency order.
- No pre-seeded static records are assumed to exist unless the test explicitly navigates to and soft-verifies an existing Account (TC-ACC-001).
- If an upstream record creation step fails, all downstream steps in that spec are skipped via `test.skip` to prevent false negatives.

### 3.3 Data Sources

| Source | Usage |
|--------|-------|
| `getTestData()` helper | Structured field values (Account type, Opportunity stage, etc.) |
| Inline AC values | Field-level assertions specified directly in acceptance criteria |
| Runtime generation | `AutoXxx-${Date.now()}` names for any record requiring uniqueness |

### 3.4 Credential and Secret Handling

- Salesforce credentials are read exclusively from environment variables (`SF_USERNAME`, `SF_PASSWORD`, `SF_SANDBOX_URL`).
- No credentials, tokens, or org URLs are hardcoded in test files or committed to source control.
- Session state is persisted in `auth/session.json` and reused across the suite; the file is excluded from version control via `.gitignore`.

---

## 4. Execution Order

Tests execute **sequentially** in the following object order with a single Playwright worker (`workers: 1`). This mirrors the natural CPQ lifecycle and ensures that upstream records are available when downstream tests reference them.

```
1. Account      (TC-ACC-001 → TC-ACC-005)
2. Contact      (TC-CON-xxx — pending story authoring)
3. Opportunity  (TC-OPP-xxx — pending story authoring)
4. Quote (CPQ)  (TC-QTE-xxx — pending story authoring)
5. Contract     (TC-CTR-xxx — pending story authoring)
6. Order        (TC-ORD-xxx — pending story authoring)
7. Amendment    (TC-AMD-xxx — pending story authoring)
8. Renewal      (TC-RNW-xxx — pending story authoring)
```

**Playwright configuration constraint:** `workers` must never exceed `1`. Parallel execution is prohibited due to shared Salesforce org state and session token limitations.

---

## 5. Entry Criteria

All of the following must be satisfied before test execution begins:

| # | Criterion | Verification |
|---|-----------|-------------|
| 1 | `auth/session.json` is present and the session token is valid | Run `npx ts-node scripts/refresh-session.ts`; confirm no authentication error |
| 2 | `SF_SANDBOX_URL` environment variable is set in `.env` | `echo $SF_SANDBOX_URL` returns a non-empty HTTPS URL |
| 3 | `SF_USERNAME` and `SF_PASSWORD` environment variables are set | Present in `.env`; not committed to source control |
| 4 | Playwright is installed and browsers are provisioned | `npx playwright install` completes without error |
| 5 | TypeScript compiles without errors | `npx tsc --noEmit` exits with code 0 |
| 6 | Salesforce sandbox is accessible and not under a maintenance window | Manual confirmation or status page check prior to run |

---

## 6. Exit Criteria

The test run is considered complete when **all** of the following conditions are met:

| # | Criterion |
|---|-----------|
| 1 | All authored TC IDs have been executed (pass, fail, or skip — no pending state) |
| 2 | Self-healing Agent 6 has completed all healing iterations (maximum 3 retries per failure) |
| 3 | Unresolved failures are explicitly marked and documented with failure classification |
| 4 | `reports/dashboard.html` has been regenerated by Agent 7 and reflects the current run |
| 5 | `reports/results.json` and `reports/pipeline-state.json` are up to date |
| 6 | A PowerPoint or HTML summary report is available for stakeholder review |
| 7 | No TC is left in an indeterminate state |

---

## 7. Risks and Mitigations

| # | Risk | Impact | Likelihood | Mitigation |
|---|------|--------|------------|------------|
| R-01 | Salesforce session expiry mid-run | High — all subsequent tests fail with login redirect | Medium | Execute `npx ts-node scripts/refresh-session.ts` before each run; implement session-check hook at suite setup |
| R-02 | Spinner timing causes premature interaction with loading elements | Medium — flaky `ElementNotInteractable` or stale-element errors | High | Add `await page.locator('.slds-spinner').waitFor({ state: 'hidden' })` with a 30-second timeout before every page transition and save action |
| R-03 | Lookup search lag causes empty results on typeahead fields | Medium — lookup fails silently or selects wrong record | High | Insert `await page.waitForTimeout(3000)` before interacting with any lookup field; confirm dropdown is visible before clicking |
| R-04 | Shadow DOM pierce failures on Lightning Web Components | High — locator resolves to nothing; test errors immediately | Medium | Use only native `lightning-*` locators and `[data-field-api-name]` attribute selectors; never use CSS shadow-piercing (`>>>`) or `evaluate` for locator resolution |
| R-05 | Missing upstream records due to prior step failure | High — cascading failures across all downstream TCs | Medium | Implement `test.skip` guards on all dependent steps; log the root cause TC ID in the skip message |
| R-06 | Sandbox refresh or data wipe between runs | High — existing Account no longer present for TC-ACC-001 | Low | TC-ACC-001 uses soft-verify (warnings, not hard failures); suite creates all other records dynamically |
| R-07 | Incomplete user story coverage (Contact through Renewal) | High — no test coverage for 7 of 8 objects | High — current state | Prioritise story authoring for remaining objects in next sprint; block release sign-off until coverage is complete |

---

## 8. Traceability Matrix

Every test case must carry a traceability comment in its spec file linking TC ID to AC reference. No test may be generated or executed without a valid AC reference.

```typescript
// TC-ACC-001 | AC Reference: AC-005-01
```

| TC ID | User Story | AC Reference | Spec File |
|-------|-----------|-------------|-----------|
| TC-ACC-001 | US-005 | AC-005-01 | tests/account.spec.ts |
| TC-ACC-002 | US-005 | AC-005-02 | tests/account.spec.ts |
| TC-ACC-003 | US-005 | AC-005-03 | tests/account.spec.ts |
| TC-ACC-004 | US-005 | AC-005-04 | tests/account.spec.ts |
| TC-ACC-005 | US-005 | QO-005-05 | tests/account.spec.ts |

---

## 9. Approvals

| Role | Name | Status | Date |
|------|------|--------|------|
| QA Lead | — | Pending | 2026-04-24 |
| Dev Lead | — | Pending | — |
| Product Owner | — | Pending | — |
