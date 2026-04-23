# Salesforce CPQ — End-to-End QA Test Plan

**Version:** 1.0
**Date:** 2026-04-23
**Author:** AI-Generated

---

## 1. Scope

The following Salesforce objects are in scope for this test plan. They represent the complete Revenue Cloud / CPQ lifecycle from record creation through contract execution, amendment, and renewal.

| Object | Prefix | Reason for Inclusion |
|---|---|---|
| Account | ACC | Root entity; all downstream records depend on a valid Account |
| Contact | CON | Required for Opportunity Contact Roles and Quote recipient |
| Opportunity | OPP | Bridge between Account/Contact and Quote; drives CPQ entry |
| Quote (CPQ) | QTE | Core CPQ object; pricing, product selection, and approval flows |
| Contract | CTR | Generated from a won Opportunity or activated Quote |
| Order | ORD | Activated from Contract; fulfillment trigger |
| Amendment | AMD | Mid-term Contract change; must preserve original terms |
| Renewal | RNW | End-of-term Contract extension; must inherit pricing |

**Out of Scope:** Manual test cases, load / performance testing, API-only flows, UI accessibility audits, and any Salesforce objects not listed above.

---

## 2. Test Case Summary

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
| **Total** | **1** | **5** | **3** | **1** | **1** |

> **Note:** Contact, Opportunity, Quote, Contract, Order, Amendment, and Renewal objects have no user stories or acceptance criteria assigned at this time. Test cases for those objects must be added before execution begins on those modules.

### 2.1 Account Test Cases (US-005)

| TC ID | Scenario | Type | AC Reference |
|---|---|---|---|
| TC-ACC-001 | Verify Billing Address and Payment Terms on Account Details tab (soft-fail if absent) | Edge Case | AC-005-01 |
| TC-ACC-002 | Create new Contact record from Account Related list | Positive | AC-005-02 |
| TC-ACC-003 | Create Opportunity from Contact's Related list Opportunities section | Positive | AC-005-03 |
| TC-ACC-004 | Verify newly created Contact appears as Primary Contact Role on the Opportunity | Positive | AC-005-04 |
| TC-ACC-005 | Create Quote from Opportunity record | Negative | QO-005-05 |

---

## 3. Test Data Strategy

### 3.1 Uniqueness

All record names include a timestamp suffix to guarantee uniqueness across runs and prevent collision with existing sandbox data.

```
AutoAcc-${Date.now()}
AutoCon-${Date.now()}
AutoOpp-${Date.now()}
AutoQte-${Date.now()}
```

### 3.2 Supporting Records

Supporting records (Contacts, Opportunities, Quotes) are created within the test run itself, in execution order. No pre-seeded data is required beyond a reachable Salesforce sandbox with standard CPQ objects enabled.

### 3.3 Prohibited Practices

- No hardcoded usernames, passwords, or security tokens in any spec file
- No hardcoded Account, Contact, or Opportunity IDs
- No reliance on sandbox-specific record names that may not exist
- All credentials sourced exclusively from environment variables (`SF_USERNAME`, `SF_PASSWORD`, `SF_SANDBOX_URL`)
- `auth/session.json` holds session state and must never be committed to version control

### 3.4 Data Mapping

| Variable | Salesforce Object |
|---|---|
| `data.account` | Account |
| `data.contact` | Contact |
| `data.opportunity` | Opportunity |
| `data.quote` | Quote |

---

## 4. Execution Order

Tests must execute strictly in the following sequence. Each stage depends on the successful state produced by the prior stage. Playwright is configured with **1 worker only** to enforce sequential execution and preserve session state.

```
Account → Contact → Opportunity → Quote (CPQ) → Contract → Order → Amendment → Renewal
```

| Stage | Prefix | Depends On |
|---|---|---|
| 1 | ACC | None — creates root Account |
| 2 | CON | ACC — Contact linked to Account |
| 3 | OPP | CON — Opportunity linked to Account + Contact |
| 4 | QTE | OPP — Quote created from Opportunity |
| 5 | CTR | QTE — Contract generated from Quote / won Opportunity |
| 6 | ORD | CTR — Order activated from Contract |
| 7 | AMD | CTR — Amendment applied to active Contract |
| 8 | RNW | CTR — Renewal generated at Contract end-of-term |

---

## 5. Entry Criteria

All of the following must be satisfied before test execution begins.

- `auth/session.json` exists and contains a valid, unexpired Salesforce session
- `SF_SANDBOX_URL`, `SF_USERNAME`, and `SF_PASSWORD` are set in the `.env` file
- Playwright and all project dependencies are installed (`npm install` completed without errors)
- Salesforce CPQ package is installed and active in the target sandbox
- Target sandbox is accessible and not undergoing a scheduled maintenance window
- All spec files compile without TypeScript errors (`npx tsc --noEmit`)

---

## 6. Exit Criteria

Test execution is considered complete only when all of the following are true.

- All in-scope test cases have been executed (pass, fail, or skipped with justification)
- Agent 6 self-healing has completed; no test remains in an unresolved failure state without a documented root cause
- `reports/dashboard.html` has been updated with the final run results
- `reports/results.json` contains a full machine-readable record of all test outcomes
- `reports/pipeline-state.json` reflects the terminal pipeline state
- Any unresolved failures are logged with failure classification (selector / timing / data / environment / product bug)
- A PowerPoint or equivalent summary report has been generated by Agent 7

---

## 7. Risks and Mitigations

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R-01 | Salesforce session expiry mid-run invalidates `session.json` | Medium | High | Re-authenticate before each run using `npx ts-node scripts/refresh-session.ts`; validate session on pipeline start |
| R-02 | Spinner or loading overlay blocks element interactions, causing false failures | High | Medium | Use `await page.locator('.slds-spinner').waitFor({ state: 'hidden' })` with a 30-second timeout on all navigation steps |
| R-03 | Lookup field search lag causes the dropdown to render after the interaction fires | High | Medium | Insert `await page.waitForTimeout(3000)` before any lookup field interaction; never rely on `networkidle` |
| R-04 | Shadow DOM boundaries on Lightning Web Components prevent standard locators from resolving | Medium | High | Use native `lightning-*` element locators only; never pierce shadow DOM manually; follow strict locator hierarchy |
| R-05 | Sandbox data drift — existing records conflict with generated names | Low | Medium | Timestamp-suffixed names (`AutoAcc-${Date.now()}`) ensure uniqueness; never query by static name |
| R-06 | CPQ package version mismatch changes field API names or UI flows | Low | High | Load domain knowledge from `knowledge/agentforce-rm/` before any test generation; verify against live sandbox before pipeline runs |
| R-07 | Test cases for 7 of 8 objects are missing (no ACs defined) | High | High | Block execution on those modules until user stories and ACs are provided; ACC module may proceed independently |

---

## 8. Traceability

Every test case must include an inline comment mapping it to its acceptance criterion. No test may exist without a traceable AC.

**Required comment format:**

```typescript
// TC-ACC-001 | AC Reference: AC-005-01
```

Tests without this mapping are considered invalid output and must not be merged or executed.

---

## 9. Out of Scope

The following are explicitly excluded from this test plan.

- Manual test cases or exploratory testing sessions
- Load, stress, or performance testing of any Salesforce object
- API-only flows (REST / SOAP) without UI interaction
- UI accessibility (WCAG) compliance testing
- Salesforce objects not listed in Section 1
- Managed package internals not exposed through the CPQ UI
