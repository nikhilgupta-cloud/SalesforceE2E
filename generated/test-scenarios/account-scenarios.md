# Test Scenarios — Account
**Generated:** 2026-04-28

---

## US-005: Salesforce E2E Process — Account to Order Activation

| TC ID | Scenario | Expected Result | AC Ref |
|-------|----------|-----------------|--------|
| TC-ACC-001 | Verify existing Account has Billing Address and Payment Terms under Details tab | Billing Address and Payment Terms logged (soft-fail if absent); accountUrl contains /Account/ | AC-005-01 |
| TC-ACC-002 | Create a new Contact on the Account and capture the Contact URL | Contact saved successfully; contactUrl contains /Contact/ | AC-005-02 |
| TC-ACC-003 | Create Opportunity from Contact Related list and verify Primary Contact Role assignment | Opportunity created; opportunityUrl contains /Opportunity/; Primary Contact Role visible (soft-fail) | AC-005-03, AC-005-04 |
| TC-ACC-004 | Create Quote from Opportunity, Browse Catalogs, select Price Book, add product, validate cart | Quote created; product appears in cart; quoteUrl contains /Quote/ | QO-005-05, PC-005-06, PC-005-07, PC-005-08, PC-005-09 |
| TC-ACC-005 | Accept Quote, create Contract, activate Contract, create Order from Quote and activate Order | Contract Activated; Order created and marked complete | QL-005-10, QL-005-11, CR-005-12, OR-005-13, OR-005-14, OR-005-15, OR-005-16 |
