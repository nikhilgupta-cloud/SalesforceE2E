# Test Scenarios — Account
**Generated:** 2026-04-28

---

## US-005: Salesforce E2E Lifecycle — Account to Order Activation

| TC ID | Scenario | Expected Result | AC Ref |
|-------|----------|-----------------|--------|
| TC-ACC-001 | Verify existing Account has Billing Address and Payment Terms on Details tab | Account record opens; Details tab shows Billing Address and Payment Terms (soft-fail logged if missing) | AC-005-01 |
| TC-ACC-002 | Create new Contact on the Account via Contacts related list | Contact created and contactUrl captured; record URL contains /Contact/ | AC-005-02 |
| TC-ACC-003 | Create Opportunity from Contact and verify Primary Contact Role | Opportunity created from Contact; Contact Roles related list shows contact as Primary | AC-005-03, AC-005-04 |
| TC-ACC-004 | Create Quote with Products via Catalog, Accept Quote, and create Activated Contract | Quote created with product line items; status set to Accepted; Contract created with Activated status and 12-month term | QO-005-05, PC-005-06, PC-005-07, PC-005-08, PC-005-09, QL-005-10, QL-005-11, CR-005-12 |
| TC-ACC-005 | Create Order from Quote and Activate to Complete | Order created via Create single Order; Activate clicked; Order marked as Complete | OR-005-13, OR-005-14, OR-005-15, OR-005-16 |
