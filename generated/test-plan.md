# Salesforce CPQ — End-to-End Test Plan

**Version:** 1.0
**Date:** 2026-04-23
**Author:** AI-Generated

---

## 1. Scope

The following Salesforce objects are in scope for this test plan. They represent the complete Revenue Cloud / CPQ transactional lifecycle — from Account creation through Renewal — and must be validated end-to-end to ensure data integrity, UI correctness, and business-rule compliance across the Salesforce sandbox environment.

| Object | Prefix | In Scope | Rationale |
|---|---|---|---|
| Account | ACC | Yes | Root record; all downstream objects depend on an Account |
| Contact | CON | Yes | Required for Opportunity Contact Roles and Quote recipients |
| Opportunity | OPP | Yes | Primary sales vehicle; parent of Quote |
| Quote (CPQ) | QTE | Yes | Core Revenue Cloud object; drives pricing and line items |
| Contract | CTR | Yes | Generated from closed Opportunity; anchors amendments and renewals |
| Order | ORD | Yes | Activated from Contract; triggers fulfillment |
| Amendment | AMD | Yes | Mid-term Contract change; must preserve original terms |
| Renewal | RNW | Yes | End-of-term Contract extension; must carry forward active assets |

**Out of scope:** Manual test cases, load / performance testing, API-only flows (no UI interaction), and any Salesforce object not listed above.

---

## 2. Test Case Summary

| Object | User Stories | Total TCs | Positive | Negative | Edge Cases |
|---|---|---|---|---|---|
| Account | US-005 | 4 | 2 | 1 | 1 |
| Contact | — | 0 | — | — | — |
| Opportunity | — | 0 | — | — | — |
| Quote (CPQ) | — | 0 | — | — | — |
| Contract | — | 0 | — | — | — |
| Order | — | 0 | — | — | — |
| Amendment | — | 0 | — | — | — |
| Renewal | — | 0 | — | — | — |
| **Total** | **1** | **4** | **2** | **1** | **1** |

### 2.1 Account Test Cases

| TC ID | Scenario | Type | AC Ref | Expected Result |
|---|---|---|---|---|
| TC-ACC-001 | Verify existing Account Billing Address and Payment Terms are populated under the Details tab | Positive | AC-005-01 | Fields present → pass; fields empty → soft-fail (console.warn), test continues |
| TC-ACC-002 | Create a new Contact directly on the Account record via the Contacts related list | Positive | AC-005-02 | Contact created and visible as a link in the Account's Contacts related list |
| TC-ACC-003 | Create a new Opportunity from the Contact record via the Opportunities related list | Edge Case | AC-005-03 | Opportunity saved; record detail page opens with the correct name |
| TC-ACC-004 | Verify newly created Contact is listed as the Primary Contact Role on the Opportunity | Negative | AC-005-04 | Contact appears in Contact Roles related list; Primary indicator confirmed true |

> **Traceability note:** Every test case maps `AC Reference → TC ID → Playwright spec`. No test case may exist without a corresponding AC reference.

---

## 3. Test Data Strategy

1. **Uniqueness via timestamps** — All dynamically created record names incorporate `Date.now()` to prevent collisions across runs.
   - Example: `AutoAcc-${Date.now()}`, `AutoCon-${Date.now()}`, `AutoOpp-${Date.now()}`

2. **Supporting records created in-test** — No pre-existing sandbox data is assumed. Each spec creates its own prerequisite records in the correct lifecycle order before asserting.

3. **No hardcoded credentials** — All environment-sensitive values (`SF_SANDBOX_URL`, `SF_USERNAME`, `SF_PASSWORD`) are consumed exclusively from `.env` and `auth/session.json`. These files are never committed to source control.

4. **Test data source priority:**
   - JSON fixture via `getTestData()` (if available)
   - Inline values derived from AC narrative
   - Runtime-generated fallback names (timestamp pattern above)

5. **Record reuse** — Within a single pipeline run, records created in earlier steps (e.g., Account) are passed as state to later steps (e.g., Contact, Opportunity). No duplicate records are created.

---

## 4. Execution Order

Tests execute strictly sequentially with **1 Playwright worker** to preserve shared session state and avoid record-creation race conditions.

```
Account (ACC) → Contact (CON) → Opportunity (OPP) → Quote / CPQ (QTE)
  → Contract (CTR) → Order (ORD) → Amendment (AMD) → Renewal (RNW)
```

Each stage depends on the successful completion of the preceding stage. If a stage fails and self-healing (Agent 6) cannot resolve the issue within 3 retries, the pipeline halts and marks all downstream stages as **BLOCKED**.

---

## 5. Entry Criteria

All of the following must be satisfied before test execution begins:

| # | Criterion | Verification |
|---|---|---|
| 1 | `auth/session.json` exists and contains a valid Salesforce session token | `npx ts-node scripts/refresh-session.ts` exits 0 |
| 2 | `SF_SANDBOX_URL` is set and reachable in `.env` | `curl -I $SF_SANDBOX_URL` returns HTTP 200 |
| 3 | `SF_USERNAME` and `SF_PASSWORD` are set in `.env` | Non-empty environment variables confirmed |
| 4 | Playwright is installed and browser binaries are present | `npx playwright --version` exits 0 |
| 5 | `npm install` has been run; `node_modules` is current | `package-lock.json` matches `package.json` |
| 6 | Domain knowledge base loaded from `knowledge/agentforce-rm/` | Agent 1 confirms INDEX.md read and relevant domain files loaded |

---

## 6. Exit Criteria

The test pipeline is considered complete when **all** of the following are true:

| # | Criterion |
|---|---|
| 1 | All in-scope test cases have been executed (pass, fail, or blocked — no untriaged status) |
| 2 | Agent 6 (Self-Healer) has completed up to 3 healing iterations on every failed test |
| 3 | Any test that remains failing after 3 healing attempts is formally marked **UNRESOLVED** in `reports/results.json` |
| 4 | `reports/dashboard.html` has been updated by Agent 7 with the final pass/fail/unresolved counts |
| 5 | `reports/pipeline-state.json` reflects the terminal state of every pipeline stage |
| 6 | A PowerPoint or structured summary report has been generated by Agent 7 |

---

## 7. Risks and Mitigations

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| R-001 | **Salesforce session expiry** during a long pipeline run causes authentication failures mid-suite | High | Run `npx ts-node scripts/refresh-session.ts` before pipeline start; implement session-check hook between lifecycle stages |
| R-002 | **Spinner / loading overlay** not dismissed before next interaction causes `ElementNotInteractable` errors | High | Assert `.slds-spinner` hidden with `waitFor({ state: 'hidden', timeout: 30000 })` before every post-action step; catch and swallow if spinner never appeared |
| R-003 | **Lookup search lag** (e.g., Account name lookup on Opportunity) returns empty results if typed too fast | Medium | Insert `waitForTimeout(3000)` after typing into a lookup field, before asserting or selecting a dropdown option |
| R-004 | **Shadow DOM / LWC encapsulation** breaks CSS-based selectors | High | Use native `lightning-*` component locators and `[data-field-api-name]` attribute selectors exclusively; never pierce Shadow DOM with `>>>` or `evaluate` |
| R-005 | **Duplicate record creation** if a prior run left orphaned data | Medium | Prefix all created records with `Auto*-${Date.now()}`; do not rely on finding records by fixed name |
| R-006 | **Modal z-index conflicts** (error dialogs masking target modals) | Medium | Always scope modal interactions to `[role="dialog"]:not([id="auraError"]):not([aria-hidden="true"])` |
| R-007 | **Pipeline stage blockers** — a zero-TC object stage (e.g., Contact, Opportunity) has no coverage yet | Medium | Flag as **PENDING AUTHORING** in dashboard; do not mark as passed; block downstream stages until TCs are authored and executed |

---

## 8. Defect Management

- Failures detected by Agent 5 are logged to `reports/results.json` with failure classification (selector, timing, data, or logic).
- Agent 6 attempts up to **3 automated healing iterations** per failure.
- Healed tests are re-executed to confirm stability before being marked **PASS**.
- Failures not resolved after 3 iterations are escalated to the QA lead with a full trace, screenshot, and classification tag.
- No failure is silently ignored. The only permitted soft-fail is TC-ACC-001 (missing optional fields), which uses `console.warn` and allows the test to continue.

---

## 9. Out of Scope

The following are explicitly excluded from this test plan:

- Manual test cases and exploratory testing
- Load, stress, or performance testing
- API-only flows with no corresponding UI interaction
- Salesforce objects not listed in Section 1 (e.g., Case, Campaign, Lead)
- Third-party integrations downstream of Order activation
- Production environment validation
