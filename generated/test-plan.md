# Salesforce CPQ — QA Test Plan

**Version:** 1.0
**Date:** 2026-04-22
**Author:** AI-Generated
**Project:** Salesforce CPQ / Revenue Cloud — End-to-End Test Suite

---

## 1. Scope

### In Scope

| Object | Reason for Inclusion |
|---|---|
| Account | Root anchor of every E2E flow; billing address and payment terms must be verified before downstream records are created |
| Contact | Created against the Account; used as the Contact Role on Opportunity |
| Opportunity | Created from the Contact; links Account, Contact, and Quote lifecycle |
| Quote (CPQ) | CPQ quoting layer — part of the lifecycle sequence; no specs exist yet, reserved for future user stories |
| Contract | Downstream of Quote activation; reserved for future user stories |
| Order | Final transactional record; E2E flows validated against US-005 |
| Amendment | Post-contract change lifecycle; reserved for future user stories |
| Renewal | Contract renewal lifecycle; reserved for future user stories |

### Out of Scope

- Manual test cases not backed by a user story and AC reference
- Load testing and performance benchmarking
- API-only flows (no Playwright UI interaction)
- Production org — sandbox only

---

## 2. Test Case Summary

| Object | User Stories | Total TCs | Positive | Negative | Edge Cases |
|---|---|---|---|---|---|
| Account (ACC) | US-005 | 4 | 2 | 1 | 1 |
| Contact (CON) | US-005 | 4 | 2 | 1 | 1 |
| Opportunity (OPP) | US-005 | 4 | 2 | 1 | 1 |
| Quote — CPQ (QTE) | — | 0 | 0 | 0 | 0 |
| Contract (CTR) | — | 0 | 0 | 0 | 0 |
| Order (ORD) | US-005 | 4 | 2 | 1 | 1 |
| Amendment (AMD) | — | 0 | 0 | 0 | 0 |
| Renewal (RNW) | — | 0 | 0 | 0 | 0 |
| **Total** | | **16** | **8** | **4** | **4** |

### Classification Key

- **Positive** — Happy path; all required fields present and valid, record saves successfully.
- **Negative** — Missing or invalid field values; soft-fail warnings logged without blocking execution.
- **Edge Case** — Conditional branching (e.g., Contact already exists, Contact Role already set as Primary).

---

## 3. Test Case Register

### 3.1 Account (ACC)

| TC ID | Title | Classification | AC Ref |
|---|---|---|---|
| TC-ACC-001 | Verify Billing Address and Payment Terms present on Account Details tab | Edge Case (soft-fail) | AC-005-01 |
| TC-ACC-002 | Create new Contact for Account when no Contact exists | Positive | AC-005-02 |
| TC-ACC-003 | Create Opportunity from Contact record | Positive | AC-005-03 |
| TC-ACC-004 | Verify Contact assigned as Primary Contact Role on Opportunity | Negative / Edge | AC-005-04 |

### 3.2 Contact (CON)

| TC ID | Title | Classification | AC Ref |
|---|---|---|---|
| TC-CON-001 | Verify Account Billing Address and Payment Terms on Details tab | Edge Case (soft-fail) | AC-005-01 |
| TC-CON-002 | Create new Contact linked to existing Account | Positive | AC-005-02 |
| TC-CON-003 | Create new Opportunity from Contact Related tab | Positive | AC-005-03 |
| TC-CON-004 | Verify Contact is Primary Contact Role on Opportunity | Negative / Edge | AC-005-04 |

### 3.3 Opportunity (OPP)

| TC ID | Title | Classification | AC Ref |
|---|---|---|---|
| TC-OPP-001 | Verify Account Billing Address and Payment Terms (soft-fail if missing) | Edge Case (soft-fail) | AC-005-01 |
| TC-OPP-002 | Check for existing Contact; create new Contact if absent | Edge Case | AC-005-02 |
| TC-OPP-003 | Create Opportunity from Contact record | Positive | AC-005-03 |
| TC-OPP-004 | Verify Contact appears in Contact Roles as Primary | Positive | AC-005-04 |

### 3.4 Quote — CPQ (QTE)

No test cases defined. User stories and ACs pending. Placeholder reserved in execution order.

### 3.5 Contract (CTR)

No test cases defined. Pending Quote activation coverage.

### 3.6 Order (ORD)

| TC ID | Title | Classification | AC Ref |
|---|---|---|---|
| TC-ORD-001 | Verify Account Billing Address and Payment Terms (soft-fail if missing) | Edge Case (soft-fail) | AC-005-01 |
| TC-ORD-002 | Create new Contact for Account when no Contact exists | Positive | AC-005-02 |
| TC-ORD-003 | Create new Opportunity from Contact Related tab | Positive | AC-005-03 |
| TC-ORD-004 | Verify Contact is Primary Contact Role on Opportunity | Negative / Edge | AC-005-04 |

### 3.7 Amendment (AMD) / Renewal (RNW)

No test cases defined. Pending upstream Contract and Order coverage.

---

## 4. Test Data Strategy

### Principles

1. **No hardcoded business data.** All names, dates, and identifiers are generated at runtime.
2. **No hardcoded credentials.** All authentication values are read exclusively from environment variables (`SF_USERNAME`, `SF_PASSWORD`) or `auth/session.json`.
3. **Timestamp-based uniqueness.** Record names include `Date.now()` to prevent collision across runs.

### Naming Conventions

| Object | Pattern | Example |
|---|---|---|
| Account | `AutoAcc-${Date.now()}` | `AutoAcc-1745298000000` |
| Contact | `AutoCon-${Date.now()}` | `AutoCon-1745298000001` |
| Opportunity | `AutoOpp-${Date.now()}` | `AutoOpp-1745298000002` |
| Quote | `AutoQte-${Date.now()}` | `AutoQte-1745298000003` |
| Order | `AutoOrd-${Date.now()}` | `AutoOrd-1745298000004` |

### Supporting Records

- Supporting records (Account, Contact, Opportunity) are created programmatically within the test suite in strict lifecycle order.
- Each spec reuses state passed from the preceding spec via shared fixtures or written state files — no duplicate record creation.
- If a required parent record is missing at runtime, the test creates it rather than failing.

---

## 5. Execution Order

Tests are executed sequentially with **1 Playwright worker** (`workers: 1`). No parallel execution is permitted.

```
1. Account (ACC)
2. Contact (CON)
3. Opportunity (OPP)
4. Quote — CPQ (QTE)     ← placeholder; skipped if no specs present
5. Contract (CTR)         ← placeholder; skipped if no specs present
6. Order (ORD)
7. Amendment (AMD)        ← placeholder; skipped if no specs present
8. Renewal (RNW)          ← placeholder; skipped if no specs present
```

Each stage depends on the successful completion of all prior stages. State (record IDs, names) is propagated forward through shared context or written to a temporary state file consumed by subsequent specs.

---

## 6. Entry Criteria

All of the following must be satisfied before test execution begins:

| # | Criterion | Verification |
|---|---|---|
| 1 | `auth/session.json` is present and the session is valid | `npx ts-node scripts/refresh-session.ts` exits with code 0 |
| 2 | `SF_SANDBOX_URL` is set and resolves to the target sandbox | Environment variable check in pre-run hook |
| 3 | `SF_USERNAME` and `SF_PASSWORD` are set in `.env` | Environment variable check; values never logged |
| 4 | Playwright is installed and `@playwright/test` is at expected version | `npx playwright --version` |
| 5 | All TypeScript sources compile without error | `npx tsc --noEmit` |
| 6 | No uncommitted changes to `generated/` directory | `git status generated/` returns clean |

---

## 7. Exit Criteria

Test execution is considered complete when **all** of the following are true:

| # | Criterion |
|---|---|
| 1 | All 16 defined test cases have been executed (pass, soft-fail, or hard-fail) |
| 2 | Self-healing (Agent 6) has completed up to 3 iterations on any failing test |
| 3 | All unresolved failures are marked `UNRESOLVED` in `reports/results.json` |
| 4 | `reports/dashboard.html` reflects final execution state |
| 5 | `reports/pipeline-state.json` shows `status: complete` |
| 6 | Agent 7 has generated the final HTML and PowerPoint report |

---

## 8. Risks and Mitigations

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| R-01 | Salesforce session expiry mid-run | All subsequent steps fail with authentication errors | Re-run `scripts/refresh-session.ts` before execution; add a pre-test hook that validates session age |
| R-02 | Spinner / page load timing causes premature interaction | Flaky failures on record save and navigation steps | Use `page.locator('.slds-spinner').waitFor({ state: 'hidden' })` with a 30-second timeout on every navigation and save action |
| R-03 | Lookup field search lag returns no results | Lookup stays empty; record save fails | Apply `waitForTimeout(3000)` before interacting with any lookup field; re-type search term if result list is empty |
| R-04 | Shadow DOM prevents standard locator resolution | Selectors fail silently; test hangs | Use native `lightning-*` component locators only; never pierce Shadow DOM with `>>>` or `evaluateHandle`; follow strict locator hierarchy defined in CLAUDE.md |
| R-05 | Quote (QTE) and Contract (CTR) specs absent | E2E flow has a gap between Opportunity and Order | Placeholder stages are included in execution order; pipeline skips gracefully when spec count is 0; user stories must be raised before next sprint |
| R-06 | Duplicate record creation from re-runs | Pollutes sandbox data; lookup returns multiple results | Timestamp-based names ensure uniqueness; cleanup scripts should be run post-suite on sandbox |
| R-07 | Single Playwright worker increases total run time | Long feedback loop | Accepted trade-off for Salesforce session state integrity; parallelism is not supported |

---

## 9. Traceability Matrix

Every test case must satisfy the following traceability chain:

```
User Story (US-NNN)
  └── Acceptance Criterion (AC-NNN-NN)
        └── Test Case (TC-{PREFIX}-NNN)
              └── Playwright spec test() block
                    └── Code comment: // TC-{PREFIX}-NNN | AC Reference: AC-NNN-NN
```

No test case may exist without a corresponding AC reference. No AC may exist without a corresponding test case in the active sprint.

---

## 10. Approvals

| Role | Name | Date |
|---|---|---|
| QA Lead | | |
| Dev Lead | | |
| Product Owner | | |
