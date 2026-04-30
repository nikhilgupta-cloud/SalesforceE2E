# Salesforce CPQ — End-to-End Test Plan

**Version:** 1.0
**Date:** 2026-04-30
**Author:** AI-Generated

---

## 1. Scope

### In Scope

| Object | Prefix | Rationale |
|---|---|---|
| Account | ACC | Root record; all downstream objects anchor to an Account |
| Contact | CON | Required for Opportunity creation and Contact Role assignment |
| Opportunity | OPP | Bridge between Account/Contact and the CPQ quoting flow |
| Quote (CPQ) | QTE | Core CPQ object; drives pricing, catalog selection, and cart validation |
| Contract | CTR | Generated from an accepted Quote; activates the commercial agreement |
| Order | ORD | Fulfillment record created from the Quote; must reach Activated/Complete status |
| Amendment | AMD | Post-activation change to an active Contract |
| Renewal | RNW | Extension of an expiring Contract into a new term |

### Out of Scope

- Manual / exploratory test cases not backed by an AC reference
- Load testing, stress testing, and performance benchmarking
- API-only (REST/SOAP) flows with no UI interaction
- Integration tests with external systems (ERP, billing platforms)
- Managed-package configuration and metadata deployment validation

---

## 2. Objectives

1. Validate the complete CPQ lifecycle from Account creation through Order activation via automated Playwright tests.
2. Ensure every test case maps to at least one Acceptance Criterion (AC reference mandatory).
3. Achieve zero un-classified failures — all failures must be triaged by the self-healing agent before final reporting.

---

## 3. Summary Table

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

> **Note:** Contact, Opportunity, Quote, Contract, Order, Amendment, and Renewal objects have no standalone user stories or independent TC IDs at this time. Their lifecycle steps are covered as sub-steps within the Account suite (US-005). Dedicated suites should be authored when corresponding user stories are raised.

---

## 4. Test Case Inventory

### 4.1 Account Suite (US-005)

| TC ID | Title | Type | AC Ref | Priority |
|---|---|---|---|---|
| TC-ACC-001 | Verify Billing Address and Payment Terms on Account Details tab | Positive | AC-005-01 | High |
| TC-ACC-002 | Create Contact, create Opportunity, verify Primary Contact Role | Positive | AC-005-02, AC-005-03, AC-005-04 | High |
| TC-ACC-003 | Create Quote from Opportunity, browse catalog, add product, validate cart | Positive | QO-005-05, PC-005-06, PC-005-07, PC-005-08, PC-005-09 | High |
| TC-ACC-004 | Accept Quote, create Contract (no prices/discounts), activate Contract with 12-month term | Negative | QL-005-10, QL-005-11, CR-005-12 | High |
| TC-ACC-005 | Create single Order from Quote, activate Order, mark Order as Complete | Edge Case | OR-005-13, OR-005-14, OR-005-15, OR-005-16 | High |

**Classification rationale:**

- **TC-ACC-001** — Positive: validates presence of expected fields; soft-fail warning logged if fields are absent, test continues.
- **TC-ACC-002** — Positive: happy-path creation chain with relational validation.
- **TC-ACC-003** — Positive: catalog and cart flow; validates CPQ product selection end-to-end.
- **TC-ACC-004** — Negative: Contract created deliberately with no prices/discounts to assert system accepts the "None" option without pricing errors.
- **TC-ACC-005** — Edge Case: single-Order creation path (not bulk); validates terminal Order status transition to Complete.

---

## 5. Test Data Strategy

### 5.1 Uniqueness

All record names use a millisecond timestamp suffix to prevent collision across parallel or repeated runs:

| Record | Name Pattern |
|---|---|
| Account | `AutoAcc-${Date.now()}` |
| Contact | `AutoCon-${Date.now()}` |
| Opportunity | `AutoOpp-${Date.now()}` |
| Quote | `AutoQte-${Date.now()}` |

### 5.2 Data Source

| Field | Source |
|---|---|
| `Account_Name` | `data.account.Account_Name` via `getTestData()` |
| `First_Name`, `Last_Name`, `Email`, `Phone` | `data.contact.*` via `getTestData()` |
| `Opportunity.Name`, `Stage`, `Close_Date` | `data.opportunity.*` via `getTestData()` |
| `Quote.Name`, `Contract_Type` | `data.quote.*` via `getTestData()` |
| `priceBook` | Hardcoded fallback: `'Standard Price Book'` |
| `expirationDate` | Hardcoded fallback: `'12/31/2026'` |

### 5.3 Rules

- **No hardcoded credentials.** All authentication is handled via `auth/session.json` and environment variables.
- **Supporting records are created in-test.** No pre-seeded data dependencies beyond an existing Account for TC-ACC-001.
- **Optional-chaining (`?.`) is prohibited** on typed `TestData` fields — all keys are guaranteed to exist.
- **Never invent keys.** Only keys present in `utils/test-data.ts` `TestData` interface are valid.
- **Do not use `SFUtils.searchAndOpen()`** to navigate to records created in the same test run — use the Related list link or success toast link instead.

---

## 6. Execution Order

Tests execute sequentially in a single Playwright worker (`workers: 1`). The order mirrors the CPQ lifecycle dependency chain:

```
Account (ACC)
  └─► Contact (CON)
        └─► Opportunity (OPP)
              └─► Quote / CPQ (QTE)
                    └─► Contract (CTR)
                          └─► Order (ORD)
                                └─► Amendment (AMD)
                                      └─► Renewal (RNW)
```

State (record IDs, URLs) is passed forward through test fixtures or shared context. No test may assume a prior object exists unless it was created earlier in the same run.

---

## 7. Entry Criteria

| Criterion | Validation |
|---|---|
| `auth/session.json` is valid and not expired | `npx ts-node scripts/refresh-session.ts` completes without error |
| `SF_SANDBOX_URL` is set in `.env` | Environment variable present and reachable via HTTP 200 |
| `SF_USERNAME` and `SF_PASSWORD` are set in `.env` | Variables present (values not logged) |
| Playwright is installed | `npx playwright --version` returns without error |
| `npm install` has been run | `node_modules/` present and up-to-date |
| Knowledge base files accessible | `knowledge/agentforce-rm/INDEX.md` readable |

---

## 8. Exit Criteria

| Criterion | Owner |
|---|---|
| All 5 TCs have been executed (pass, fail, or fixme) | Agent 5 — Test Executor |
| Zero unclassified failures remain | Agent 6 — Self-Healer (max 3 healing iterations per TC) |
| Any persistently failing TC is tagged `test.fixme()` with a descriptive comment | Agent 6 |
| `reports/dashboard.html` has been regenerated with final results | Agent 7 — Dashboard Reporter |
| `reports/results.json` and `reports/pipeline-state.json` are updated | Agent 7 |
| PowerPoint / summary report generated | Agent 7 |

---

## 9. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Salesforce session expiry mid-run | All tests fail with `INVALID_SESSION_ID` | Run `npx ts-node scripts/refresh-session.ts` before pipeline start; do not change selectors when console shows `INVALID_SESSION_ID` |
| Spinner / page-load timing | Intermittent `TimeoutError` on element interaction | Use `page.locator('.slds-spinner').waitFor({ state: 'hidden' })` with 30 s timeout; wrap in `.catch(() => {})` to tolerate absent spinners |
| Lookup search indexing lag | Lookup field returns no results for a freshly created record | Add `waitForTimeout(3000)` before interacting with lookup inputs that target in-run records |
| Shadow DOM / LWC component piercing | Selector resolves to zero elements | Use native `lightning-*` locators only; never pierce Shadow DOM manually; follow locator priority: `[data-field-api-name]` → role → label → LWC tag → XPath (last resort) |
| Duplicate record creation on re-run | Data conflicts, assertion failures | Timestamp suffix on all generated names ensures uniqueness per run |
| CPQ catalog/pricing misconfiguration in sandbox | Product not found, cart empty | Confirm Standard Price Book active in sandbox before pipeline execution; document as pre-run check |
| Modal selector ambiguity | Wrong dialog acted upon | Always scope to `[role="dialog"]:not([id="auraError"]):not([aria-hidden="true"])` |

---

## 10. Traceability Matrix

| TC ID | User Story | AC Reference(s) | Spec File | Status |
|---|---|---|---|---|
| TC-ACC-001 | US-005 | AC-005-01 | `tests/account.spec.ts` | Planned |
| TC-ACC-002 | US-005 | AC-005-02, AC-005-03, AC-005-04 | `tests/account.spec.ts` | Planned |
| TC-ACC-003 | US-005 | QO-005-05, PC-005-06, PC-005-07, PC-005-08, PC-005-09 | `tests/account.spec.ts` | Planned |
| TC-ACC-004 | US-005 | QL-005-10, QL-005-11, CR-005-12 | `tests/account.spec.ts` | Planned |
| TC-ACC-005 | US-005 | OR-005-13, OR-005-14, OR-005-15, OR-005-16 | `tests/account.spec.ts` | Planned |

> Every test function must include a traceability comment on its first line, e.g.:
> `// TC-ACC-001 | AC Reference: AC-005-01`

---

## 11. Tooling and Infrastructure

| Component | Detail |
|---|---|
| Test runner | Playwright (TypeScript) — `workers: 1` |
| AI pipeline | 7-agent Claude pipeline (`npm run pipeline`) |
| Session management | `scripts/refresh-session.ts` |
| Test generation | `scripts/generate-tests.ts` |
| Self-healing | `scripts/self-heal.ts` (max 3 iterations) |
| Reporting | `reports/dashboard.html`, `results.json`, `pipeline-state.json` |
| Auth state | `auth/session.json` (never committed to VCS) |
| Secrets | `.env` (never committed to VCS) |

---

## 12. Approvals

| Role | Name | Date |
|---|---|---|
| QA Lead | — | 2026-04-30 |
| Dev Lead | — | |
| Product Owner | — | |
