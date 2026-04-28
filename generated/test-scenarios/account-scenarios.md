# Test Scenarios — Account
**Generated:** 2026-04-22

---

## US-005: Salesforce E2E — Account to Order Activation Lifecycle

| TC ID | Scenario | Expected Result | AC Ref |
|-------|----------|-----------------|--------|
| TC-ACC-001 | Verify existing Account has Billing Address and Payment Terms on the Details tab | Account loads; Billing Address and Payment Terms fields are present (soft-fail if empty/missing) | AC-005-01 |
| TC-ACC-002 | Create Contact on Account, create Opportunity from Contact, verify Primary Contact Role | Contact created and linked to Account; Opportunity created; Contact appears as Primary Contact Role | AC-005-02, AC-005-03, AC-005-04 |
| TC-ACC-003 | Create Quote from Opportunity, browse catalogs, select price book and All Products, add product, validate cart | Quote created; product added via catalog; line items visible on quote | QO-005-05, PC-005-06, PC-005-07, PC-005-08, PC-005-09 |
| TC-ACC-004 | Accept Quote, create Contract via dropdown with no prices, open contract and activate with Contract Term | Quote status set to Accepted; Contract created; Contract status Activated; Contract Term filled | QL-005-10, QL-005-11, CR-005-12 |
| TC-ACC-005 | Open Quote, create single Order, open Order, activate and mark complete | Order created from Quote; Order navigated to; Order status Activated/Complete | OR-005-13, OR-005-14, OR-005-15, OR-005-16 |
