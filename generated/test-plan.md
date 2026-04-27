# Test Plan — Salesforce CPQ End-to-End Automation

**Version:** 1.0
**Date:** 2026-04-27
**Author:** AI-Generated

---

## 1. Scope

### Objects in Scope

| Object | Salesforce API Name | Status |
|--------|---------------------|--------|
| Account | Account | Active — test cases exist |
| Contact | Contact | In scope — no TCs yet |
| Opportunity | Opportunity | In scope — no TCs yet |
| Quote (CPQ) | SBQQ__Quote__c | In scope — no TCs yet |
| Contract | Contract | In scope — no TCs yet |
| Order | Order | In scope — no TCs yet |
| Amendment | SBQQ__Quote__c | In scope — no TCs yet |
| Renewal | SBQQ__Quote__c | In scope — no TCs yet |

### Business Justification

This test plan covers the end-to-end Salesforce Revenue Cloud / CPQ lifecycle from Account setup through Quote creation, with provision for downstream Contract, Order, Amendment, and Renewal flows. The suite validates that core CRM and CPQ objects behave correctly in a configured sandbox, that data relationships are maintained across the object hierarchy, and that regression is caught automatically on each pipeline run.

---

## 2. Summary Table

| Object | User Stories | Total TCs | Positive | Negative | Edge Cases |
|--------|-------------|-----------|----------|----------|------------|
| Account | 1 | 5 | 3 | 0 | 2 |
| Contact | 0 | 0 | 0 | 0 | 0 |
| Opportunity | 0 | 0 | 0 | 0 | 0 |
| Quote (CPQ) | 0 | 0 | 0 | 0 | 0 |
| Contract | 0 | 0 | 0 | 0 | 0 |
| Order | 0 | 0 | 0 | 0 | 0 |
| Amendment | 0 | 0 | 0 | 0 | 0 |
| Renewal | 0 | 0 | 0 | 0 | 0 |
| **Totals** | **1** | **5** | **3** | **0** | **2** |

---

## 3. Test Data Strategy

### Uniqueness

All dynamically created records use timestamp-based naming to prevent collisions across runs:

- Account: `AutoAcc-${Date.now()}`
- Contact: `AutoCon-${Date.now()}`
- Opportunity: `AutoOpp-${Date.now()}`
- Quote: `AutoQte-${Date.now()}`

### TestData Key Reference

The `getTestData()` utility returns a typed `TestData` object. The following exact key names must be used — no camelCase variants, no optional chaining:

| Object | Field | Correct Key |
|--------|-------|-------------|
| Account | Account Name | `data.account.Account_Name` |
| Contact | First Name | `data.contact.First_Name` |
| Contact | Last Name | `data.contact.Last_Name` |
| Contact | Email | `data.contact.Email` |
| Contact | Phone | `data.contact.Phone` |
| Contact | Full Name | `data.contact.Full_Name` |
| Opportunity | Name | `data.opportunity.Name` |
| Opportunity | Stage | `data.opportunity.Stage` |
| Opportunity | Close Date | `data.opportunity.Close_Date` |
| Quote | Name | `data.quote.Name` |
| Quote | Contract Type | `data.quote.Contract_Type` |

### Hardcoded Fallback Values

The following fields are absent from `test-data.json` and must use hardcoded fallbacks only:

| Field | Hardcoded Value |
|-------|----------------|
| `priceBook` | `'Standard Price Book'` |
| `expirationDate` | `'12/31/2026'` |

### Supporting Records

All prerequisite records (Account, Contact, Opportunity) are created within the test suite itself. No external pre-provisioned data is required. Credentials are never hardcoded; authentication state is loaded exclusively from `auth/session.json`.

---

## 4. Execution Order

Tests execute sequentially using a single Playwright worker (`workers = 1`). The dependency chain must be respected:

1. **Account** — establish base record; verify Billing Address and Payment Terms
2. **Contact** — created from the Account Related tab; linked to Account
3. **Opportunity** — created from the Contact Related tab; linked to Contact
4. **Quote (CPQ)** — created from the Opportunity using the Create Quote button
5. **Contract** — derived from an accepted Quote
6. **Order** — activated from a contracted Quote or Contract
7. **Amendment** — initiated from an active Contract
8. **Renewal** — initiated from an expiring or active Contract

No step may be skipped. Each step depends on the record created by its predecessor. Parallelism is disabled.

---

## 5. Entry Criteria

The following conditions must be satisfied before test execution begins:

- `auth/session.json` is present and contains a valid, non-expired Salesforce session
- `SF_SANDBOX_URL` environment variable is set in `.env`
- `SF_USERNAME` and `SF_PASSWORD` environment variables are set in `.env`
- Playwright and all Node dependencies are installed (`node_modules` present)
- The target sandbox is accessible and responsive
- `prompts/framework-config.json` is present and correctly configured for the target org

---

## 6. Exit Criteria

The test run is considered complete when all of the following are true:

- All scheduled TCs have been executed at least once
- Self-healing (Agent 6) has completed its retry cycle — maximum 3 retries per failing TC
- Any remaining unresolved failures are logged with classification and root cause
- `reports/dashboard.html` reflects the current run results
- `reports/results.json` and `reports/pipeline-state.json` have been updated
- No TC is left in an unexecuted state without an explicit skip reason recorded

---

## 7. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Salesforce session expiry mid-run | All subsequent tests fail with authentication error | Refresh session before each run via `scripts/refresh-session.ts`; validate `auth/session.json` as part of entry criteria |
| Spinner timing — page not ready when assertion fires | False-negative failures on valid flows | Use explicit `waitFor({ state: 'hidden' })` on `.slds-spinner` with a 30-second timeout before proceeding |
| Lookup search lag — field not populated when next interaction fires | Lookup resolves to wrong record or remains empty | Apply `waitForTimeout(3000)` before interacting with any lookup field to allow the search dropdown to populate |
| Shadow DOM pierce — standard CSS selectors fail on Lightning Web Components | Locators return no elements; tests fail to interact with fields | Use native `lightning-*` locators only; never use deep CSS shadow-piercing selectors |

---

## 8. Out of Scope

The following are explicitly excluded from this test plan:

- Manual test cases and exploratory testing
- Load testing, stress testing, and performance benchmarking
- API-only flows that do not exercise the Salesforce UI
- Salesforce Setup and configuration validation (profiles, permission sets, field-level security)
- Integration testing with external systems (ERP, billing platforms, external APIs)
- Mobile browser and Salesforce mobile app testing
