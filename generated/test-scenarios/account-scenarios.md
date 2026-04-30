# Test Scenarios — Account
**Generated:** 2026-04-30

---

## US-005: Salesforce E2E — Account to Order Activation Lifecycle

| TC ID | Scenario | Expected Result | AC Ref |
|-------|----------|-----------------|--------|
| TC-ACC-001 | Verify existing Account has Billing Address and Payment Terms under Details tab | Billing Address and Payment Terms are present; soft-fail warning logged if either is missing | AC-005-01 |
| TC-ACC-002 | Create a new Contact from the Account record's Contacts related list | Contact saved successfully; page URL contains `/Contact/`; contact URL stored for downstream tests | AC-005-02 |
| TC-ACC-003 | Create Opportunity from Contact's Opportunities related list and verify Contact assigned as Primary Contact Role | Opportunity saved; URL contains `/Opportunity/`; Contact name visible in Contact Roles related list | AC-005-03, AC-005-04 |
| TC-ACC-004 | Create Quote from Opportunity; Browse Catalogs → select Standard Price Book → All Products → search and add product; verify product in cart | Quote created; product visible in quote cart/line editor | QO-005-05, PC-005-06, PC-005-07, PC-005-08, PC-005-09 |
| TC-ACC-005 | Accept Quote → Mark as Current Status → New Contract (None type) → Activate Contract → Create Order (single) → Activate Order | Contract activated; Order created and activated; Order status contains 'Activat' | QL-005-10, QL-005-11, CR-005-12, OR-005-13, OR-005-14, OR-005-15, OR-005-16 |
