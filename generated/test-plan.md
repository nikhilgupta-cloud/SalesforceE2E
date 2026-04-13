# Salesforce CPQ — End-to-End Test Plan

**Version:** 1.0
**Date:** 2026-04-13
**Author:** AI-Generated
**Project:** Salesforce CPQ — Playwright + TypeScript E2E Framework

---

## 1. Scope

### In Scope

The following Salesforce objects are covered by this test plan. Each object maps directly to a Playwright spec file and is registered in `prompts/framework-config.json`.

| Object | Prefix | Spec File | Rationale |
|---|---|---|---|
| Account | ACC | `tests/account.spec.ts` | Root dependency for Contact, Opportunity, and Quote; must pass before downstream objects |
| Contact | CON | `tests/contact.spec.ts` | Associated to Accounts; required for Quote ownership and approval routing |
| Opportunity | OPP | `tests/opportunity.spec.ts` | Parent record for CPQ Quote creation; gate to the full revenue flow |
| Quote (CPQ) | QTE | `tests/quote.spec.ts` | Primary Revenue Cloud object under active test; covers the full acceptance-to-order flow |

### Out of Scope

- Manual test cases and exploratory testing
- Load testing, stress testing, or performance benchmarking
- API-only flows not exercised through the Salesforce Lightning UI
- Salesforce admin configuration (profiles, permission sets, page layouts)
- Billing, invoicing, and payment flows beyond Order creation

---

## 2. Test Case Summary

| Object | User Stories | Total TCs | Positive | Negative | Edge Cases |
|---|---|---|---|---|---|
| Account | — | 0 | 0 | 0 | 0 |
| Contact | — | 0 | 0 | 0 | 0 | 
| Opportunity | — | 0 | 0 | 0 | 0 |
| Quote (CPQ) | US-005 | 4 | 2 | 1 | 1 |
| **Total** | **1** | **4** | **2** | **1** | **1** |

> **Note:** Account, Contact, and Opportunity spec files are scaffolded and registered but contain no test cases at this time. Test generation is pending user story input for those objects.

### Quote (CPQ) — TC Detail

| TC ID | AC References | Type | Description |
|---|---|---|---|
| TC-QTE-001 | AC-005-01, AC-005-02 | Positive | Ready For Acceptance action visible on Approved quote; RCA validations run; screen flow modal opens |
| TC-QTE-002 | AC-005-03, AC-005-04, AC-005-06, AC-005-08, AC-005-10 | Positive | Screen flow modal renders all mandatory document capture fields |
| TC-QTE-003 | AC-005-26 | Edge Case | Both "Not Required" checkboxes set to TRUE; flow completes; Execution Status → Ready for Acceptance |
| TC-QTE-004 | AC-005-12, AC-005-13, AC-005-14 | Negative | Create Order action gated behind Execution Status = Ready for Acceptance; after click, Status = Accepted and Order record linked |

---

## 3. Test Data Strategy

### Principles

- **Uniqueness via timestamps.** Every dynamically created record name embeds `Date.now()`, e.g., `AutoAcc-${Date.now()}`, `AutoQuote-${Date.now()}`. This prevents collisions across parallel runs and retries.
- **In-test record creation.** Supporting records (Account, Opportunity) are created programmatically at the start of each Quote test using local helper functions (`createSupportingAccount()`, `createSupportingOpportunity()`). No pre-seeded static data is assumed to exist.
- **No hardcoded credentials.** All org access is provided exclusively via environment variables (`SF_SANDBOX_URL`, `SF_USERNAME`, `SF_PASSWORD`) loaded from `.env`. Credentials never appear in spec files or committed configuration.
- **Teardown not required.** Test records in the sandbox do not need to be deleted post-run. Record names contain timestamps and are effectively isolated. If cleanup is needed in future, a dedicated teardown helper should be added — not inline cleanup logic that could mask test failures.
- **Document attachments.** For TC-QTE-002, any attachment fields exercised by the screen flow modal use small synthetic files (e.g., a 1 KB PDF fixture stored in `test-results/fixtures/`). Fixtures must not contain real customer data.

---

## 4. Execution Order

Tests execute **sequentially** with a single Playwright worker (`workers: 1` in `playwright.config.ts`). This is mandatory because Salesforce session state is shared and concurrent navigation causes unpredictable UI behaviour.

```
1. account.spec.ts     (ACC)  — no active TCs; spec file runs clean
2. contact.spec.ts     (CON)  — no active TCs; spec file runs clean
3. opportunity.spec.ts (OPP)  — no active TCs; spec file runs clean
4. quote.spec.ts       (QTE)  — TC-QTE-001 → TC-QTE-002 → TC-QTE-003 → TC-QTE-004
```

Tests within `quote.spec.ts` must also run in TC-ID order because each subsequent test may depend on the Quote state left by the previous step (e.g., TC-QTE-004 requires Execution Status set by TC-QTE-003).

---

## 5. Entry Criteria

All of the following must be satisfied before the test run begins:

| # | Criterion | Verification |
|---|---|---|
| 1 | `auth/session.json` is present and contains a valid, unexpired Salesforce session token | File exists; run `npx ts-node scripts/refresh-session.ts` if stale |
| 2 | `SF_SANDBOX_URL` is set in `.env` and resolves to the target org | `curl $SF_SANDBOX_URL` returns HTTP 200 |
| 3 | `SF_USERNAME` and `SF_PASSWORD` are set in `.env` | Non-empty strings; used by `refresh-session.ts` |
| 4 | Playwright is installed (`@playwright/test` 1.58.2) and Chromium browser binary is present | `npx playwright install --dry-run` shows no missing browsers |
| 5 | `ts-node` and all `node_modules` are installed | `npm ci` completed without errors |
| 6 | The target Quote record referenced by US-005 exists in the sandbox or will be created in-test | Verified by TC-QTE-001 setup block |
| 7 | The `claude` CLI is available in PATH (required for self-healing step) | `claude --version` exits 0 |

---

## 6. Exit Criteria

The test run is considered complete when all of the following are true:

| # | Criterion |
|---|---|
| 1 | All 4 active TCs (TC-QTE-001 through TC-QTE-004) have been executed at least once |
| 2 | Any initially failing TCs have been processed by the self-healing pipeline (`scripts/self-heal.ts`) for up to 3 rounds |
| 3 | `reports/results.json` has been written with final pass/fail status for every executed TC |
| 4 | `reports/dashboard.html` reflects the final run results (auto-refreshes every 2 seconds) |
| 5 | `reports/pipeline-state.json` shows all 7 pipeline steps as completed or intentionally skipped |
| 6 | `reports/SalesforceE2E-Framework-Overview.pptx` has been generated by `scripts/generate-ppt.js` |
| 7 | No TC is left in an indeterminate state; every TC is marked passed, failed, or skipped with a recorded reason |

---

## 7. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Salesforce session expiry** mid-run invalidates `auth/session.json` | Medium | High | Run `npx ts-node scripts/refresh-session.ts` before every pipeline execution. The pipeline orchestrator (`run-pipeline.ts`) should validate session freshness as step 0. |
| **Spinner / loading overlay timing** causes locator actions to fire before the page is interactive | High | High | Use explicit `page.waitForSelector()` or `locator.waitFor({ state: 'visible' })` with a 30-second timeout on every navigation and modal open. Never rely on fixed `waitForTimeout` for readiness checks. |
| **Lookup search lag** — the Salesforce typeahead does not return results immediately | High | Medium | Insert `page.waitForTimeout(3000)` before typing into any `lightning-lookup` input to allow the search index to initialise. Follow with `waitForSelector` on the dropdown option. |
| **Shadow DOM pierce failures** using generic CSS selectors | Medium | High | Use only native `lightning-*` component locators filtered by visible label text (e.g., `page.locator('lightning-input').filter({ hasText: /Account Name/i }).locator('input')`). Never query by generated Salesforce class names. |
| **Aura error overlay** blocking interactions after a failed server action | Low | High | Call `dismissAuraError(page)` at the start of each test and after any action that triggers a server-side save or Flow execution. |
| **Screen flow modal selector ambiguity** — multiple dialogs may be present in the DOM | Medium | Medium | Scope all modal interactions to `[role="dialog"]:not([id="auraError"]):not([aria-hidden="true"])` to target only the active, visible dialog. |
| **Order record not created** due to missing Quote field prerequisites | Low | High | TC-QTE-004 must assert Execution Status = Ready for Acceptance before clicking Create Order. If the prerequisite assertion fails, the test must abort and report a blocked status — not continue and produce a misleading failure. |
| **Self-healing loop exhaustion** — Claude patches do not resolve a failure within 3 rounds | Low | Medium | After 3 rounds, `self-heal.ts` marks the TC as permanently failed and logs the last error. A human reviewer must triage. Healing failures are surfaced in `dashboard.html` with a distinct visual indicator. |

---

## 8. Tooling and Environment

| Component | Detail |
|---|---|
| Test runner | Playwright 1.58.2, Chromium only |
| Language | TypeScript 6.0.2, executed via ts-node 10.9.2 |
| AI backend | Claude Code CLI (`claude -p`); no `ANTHROPIC_API_KEY` required |
| Workers | 1 (sequential) |
| Timeouts | Test: 120 s · Action: 30 s · Navigation: 60 s |
| Screenshots | On failure only |
| Trace | On first retry |
| Reports | `reports/dashboard.html`, `reports/results.json`, `reports/pipeline-state.json`, `reports/SalesforceE2E-Framework-Overview.pptx` |

---

## 9. Approval

| Role | Name | Date |
|---|---|---|
| QA Lead | _(to be signed)_ | 2026-04-13 |
| Dev Lead | _(to be signed)_ | |
| Product Owner | _(to be signed)_ | |
