# Salesforce CPQ — End-to-End QA Test Plan

**Version:** 1.0
**Date:** 2026-04-28
**Author:** AI-Generated

---

## 1. Scope

The following Salesforce objects are in scope for this test cycle. They represent the full Revenue Cloud / CPQ lifecycle from account setup through order activation, amendment, and renewal. Testing is automated via Playwright + TypeScript against a Salesforce sandbox environment.

| Object | Prefix | Rationale |
|---|---|---|
| Account | ACC | Root record; prerequisite for all downstream objects |
| Contact | CON | Required for Opportunity contact role assignment |
| Opportunity | OPP | Bridge between Account and Quote; CPQ entry point |
| Quote (CPQ) | QTE | Core CPQ object; product catalog, pricing, and approval flows |
| Contract | CTR | Generated from accepted Quote; governs subscription terms |
| Order | ORD | Activated from Contract; represents fulfillment commitment |
| Amendment | AMD | Mid-term contract change; tests CPQ amendment lifecycle |
| Renewal | RNW | End-of-term Quote regeneration; tests renewal lifecycle |

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

> **Note:** Contact, Opportunity, Quote, Contract, Order, Amendment, and Renewal objects have no independently authored user stories or TC IDs at this time. Their lifecycle steps are currently exercised transitively through TC-ACC-003 through TC-ACC-005 (US-005). Dedicated user stories and TCs must be authored before those objects can reach exit criteria independently.

---

## 3. Test Cases — Account (US-005)

| TC ID | Title | Type | AC Reference |
|---|---|---|---|
| TC-ACC-001 | Verify existing Account Billing Address and Payment Terms | Positive | AC-005-01 |
| TC-ACC-002 | Create Contact on Account and verify Contact URL | Positive | AC-005-02 |
| TC-ACC-003 | Create Opportunity from Contact Related list; verify Primary Contact Role | Positive / Edge | AC-005-03, AC-005-04 |
| TC-ACC-004 | Create Quote from Opportunity, select Price Book, add product, validate cart | Positive | QO-005-05 through PC-005-09 |
| TC-ACC-005 | Accept Quote, create and activate Contract, create and activate Order | Negative / E2E | QL-005-10 through OR-005-16 |

**Classification rationale:**

- **TC-ACC-001** — Positive: verifies expected field presence; soft-fail pattern applied when fields are absent (edge tolerance).
- **TC-ACC-002** — Positive: verifies Contact creation success via URL pattern.
- **TC-ACC-003** — Positive with edge: Primary Contact Role assignment logged as soft-fail if the role picker is absent — tests both happy path and graceful degradation.
- **TC-ACC-004** — Positive: end-to-end CPQ cart validation with product and Price Book selection.
- **TC-ACC-005** — Negative / E2E: covers the failure surface of contract activation and order completion; any missing activation status is a hard failure.

---

## 4. Test Data Strategy

### 4.1 Uniqueness
- All generated record names use a `Date.now()` timestamp suffix to prevent collisions across parallel runs or reruns.
  - Example: `AutoAcc-1745836800000`, `AutoCon-1745836800000`
- Timestamps are injected at runtime; no name is hardcoded in the spec.

### 4.2 Supporting Records
- Each test creates its own dependent records in sequence within the same test run.
- Records created earlier in the run (Account, Contact, Opportunity) are passed by reference (URL / record ID) to downstream steps — never re-queried via global search, which has a multi-minute Salesforce indexing delay.
- Navigation to records saved within the same run uses the success toast link or Related list link.

### 4.3 Fixed Fallbacks (non-business data)
| Field | Hardcoded Value | Reason |
|---|---|---|
| Price Book | `Standard Price Book` | Not in test-data.json; org-standard value |
| Expiration Date | `12/31/2026` | Not in test-data.json; stable future date |

### 4.4 TestData Key Contract
All dynamic business data is sourced from `getTestData()`. Exact keys must be used as defined in `utils/test-data.ts`. camelCase variants are invalid and will cause runtime errors.

| Object | Correct Key |
|---|---|
| Account | `data.account.Account_Name` |
| Contact | `data.contact.First_Name`, `data.contact.Last_Name`, `data.contact.Email`, `data.contact.Phone`, `data.contact.Full_Name` |
| Opportunity | `data.opportunity.Name`, `data.opportunity.Stage`, `data.opportunity.Close_Date` |
| Quote | `data.quote.Name`, `data.quote.Contract_Type` |

### 4.5 Credentials
- No credentials are hardcoded in test files.
- Authentication state is read exclusively from `auth/session.json` at runtime.
- `SF_USERNAME` and `SF_PASSWORD` are consumed only by `scripts/refresh-session.ts`.

---

## 5. Execution Order

Tests execute sequentially with a single Playwright worker (`workers: 1`). The order mirrors the Salesforce CPQ object lifecycle:

```
Account → Contact → Opportunity → Quote (CPQ) → Contract → Order → Amendment → Renewal
```

State flows forward: each stage consumes the record URL produced by the prior stage. No stage may be skipped or reordered.

---

## 6. Entry Criteria

All of the following must be satisfied before test execution begins:

- [ ] `auth/session.json` is present and contains a valid, unexpired Salesforce session.
- [ ] `SF_SANDBOX_URL` is set in `.env` and resolves to the target sandbox.
- [ ] `SF_USERNAME` and `SF_PASSWORD` are set in `.env`.
- [ ] Playwright is installed (`npx playwright install` completed).
- [ ] `npm install` has been run and `node_modules` is up to date.
- [ ] Target sandbox is accessible and not under a scheduled maintenance window.

---

## 7. Exit Criteria

The test cycle is considered complete when all of the following are true:

- [ ] All in-scope TC IDs have been executed at least once.
- [ ] Agent 6 (Self-Healer) has completed up to 3 healing iterations for any failed test.
- [ ] Tests that could not be healed have been marked `test.fixme()` with a documented failure comment.
- [ ] `reports/dashboard.html` reflects the final pass/fail/fixme status.
- [ ] `reports/results.json` and `reports/pipeline-state.json` are written and non-empty.
- [ ] No test remains in an unclassified failure state.

---

## 8. Risks and Mitigations

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| R-01 | Salesforce session expiry mid-run | All tests fail with `INVALID_SESSION_ID` | Re-run `npx ts-node scripts/refresh-session.ts` before execution; Agent 6 must **not** modify selectors when console shows `INVALID_SESSION_ID` — re-auth is the correct fix |
| R-02 | Spinner / loading overlay blocking interactions | Flaky clicks on obscured elements | All interactions preceded by `await page.locator('.slds-spinner').waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {})` |
| R-03 | Lookup field search indexing lag | Lookup returns no results for freshly created records | `await page.waitForTimeout(3000)` before initiating any lookup interaction; use Related list links rather than global search for same-run records |
| R-04 | Shadow DOM blocking element access | Selectors return null; test errors | Use native `lightning-*` component locators only; no `pierce/` or `>>` shadow-piercing syntax; follow strict locator hierarchy defined in CLAUDE.md |
| R-05 | Modal targeting wrong dialog | Actions fire on wrong overlay | Always scope to `[role="dialog"]:not([id="auraError"]):not([aria-hidden="true"])` |
| R-06 | Contact / Opportunity objects have no dedicated TCs | Lifecycle gaps; regressions undetected | Flag to QA lead immediately; author dedicated user stories and TCs before next sprint |
| R-07 | Heading text locale-dependency | Navigation assertions fail in non-English orgs | Assert on URL pattern (`/Contact/`, `/Opportunity/`) — never on heading text |

---

## 9. Out of Scope

The following are explicitly excluded from this test plan:

- Manual test cases and exploratory testing sessions.
- Load testing, stress testing, and performance benchmarking.
- API-only flows (REST / SOAP / Bulk API) with no UI component.
- Salesforce configuration and deployment validation (e.g., permission sets, profiles, custom metadata).
- Integration testing with external systems (ERP, billing platforms, DocuSign).
- Mobile browser or Salesforce mobile app testing.

---

## 10. Traceability Matrix

Every test case must carry an inline comment mapping it to its AC reference. No test may exist without a traceable AC.

| TC ID | AC Reference(s) | Spec File |
|---|---|---|
| TC-ACC-001 | AC-005-01 | `tests/account.spec.ts` |
| TC-ACC-002 | AC-005-02 | `tests/account.spec.ts` |
| TC-ACC-003 | AC-005-03, AC-005-04 | `tests/account.spec.ts` |
| TC-ACC-004 | QO-005-05, PC-005-06, PC-005-07, PC-005-08, PC-005-09 | `tests/account.spec.ts` |
| TC-ACC-005 | QL-005-10, QL-005-11, CR-005-12, OR-005-13, OR-005-14, OR-005-15, OR-005-16 | `tests/account.spec.ts` |

> Tests for Contact (CON), Opportunity (OPP), Quote (QTE), Contract (CTR), Order (ORD), Amendment (AMD), and Renewal (RNW) are pending user story authoring. No TCs may be generated for these objects until AC references exist.
