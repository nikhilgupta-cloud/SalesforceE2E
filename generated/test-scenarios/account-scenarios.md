# Test Scenarios — Account
**Generated:** 2026-04-30

---

## US-005: Salesforce E2E — Account to Order Activation Lifecycle

| TC ID | Scenario | Expected Result | AC Ref |
|-------|----------|-----------------|--------|
| TC-ACC-001 | Identify existing Account and verify Billing Address & Payment Terms on Details tab | Billing Address and Payment Terms fields are present; soft-fail warning logged if either is missing or empty | AC-005-01 |
| TC-ACC-002 | Create new Contact on the existing Account record via the Contacts related list | Contact is saved; URL contains `/Contact/`; contactUrl captured for downstream tests | AC-005-02 |
| TC-ACC-003 | Create Opportunity from Contact's Opportunities related list and verify Primary Contact Role | Opportunity created and the Contact appears in the Contact Roles related list on the Opportunity | AC-005-03, AC-005-04 |
| TC-ACC-004 | Create Quote from Opportunity, browse catalog to select Price Book and All Products, search & add product, then validate product on the cart | Quote is created; product is added via catalog browser; quote line-items section is visible confirming the product | QO-005-05, PC-005-06, PC-005-07, PC-005-08, PC-005-09 |
| TC-ACC-005 | Accept Quote → Mark as Current Status → create Contract (None) → activate Contract with term → create single Order from Quote → Activate Order | Quote status is Accepted; Contract status is Activated with 12-month term; Order is created and Status is Activated | QL-005-10, QL-005-11, CR-005-12, OR-005-13, OR-005-14, OR-005-15, OR-005-16 |
