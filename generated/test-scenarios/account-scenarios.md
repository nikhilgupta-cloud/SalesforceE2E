# Test Scenarios — Account
**Generated:** 2026-04-30

---

## US-005: Account to Order Activation E2E Lifecycle

| TC ID | Scenario | Expected Result | AC Ref |
|-------|----------|-----------------|--------|
| TC-ACC-001 | Verify existing Account has Billing Address and Payment Terms on Details tab | Both fields visible; soft-fail warning logged if blank or absent without failing the suite | AC-005-01 |
| TC-ACC-002 | Create new Contact via direct URL navigation and link to Account | Contact saved; URL contains /Contact/; Contact last name visible on record page | AC-005-02 |
| TC-ACC-003 | Create Opportunity linked to Account and verify Contact Primary Contact Role in Related tab | Opportunity URL contains /Opportunity/; Contact name appears in Contact Roles section | AC-005-03, AC-005-04 |
| TC-ACC-004 | Create Quote from Opportunity, browse catalog to select Price Book, add product, save, accept Quote, and initiate Contract creation | Quote has product on line items; status set to Accepted; Contract creation dialog completed with None option | QO-005-05, PC-005-06, PC-005-07, PC-005-08, PC-005-09, QL-005-10, QL-005-11 |
| TC-ACC-005 | Activate Contract with term filled, create single Order from Quote, open Order, and activate it | Contract shows Activated status; Order created and URL contains /Order/; Order shows Activated status | CR-005-12, OR-005-13, OR-005-14, OR-005-15, OR-005-16 |
