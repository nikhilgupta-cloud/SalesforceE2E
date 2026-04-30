# Test Scenarios — Account
**Generated:** 2026-04-30

---

## US-005: Salesforce E2E Process — Account to Order Activation

| TC ID | Scenario | Expected Result | AC Ref |
|-------|----------|-----------------|--------|
| TC-ACC-001 | Identify existing Account and verify Billing Address and Payment Terms (soft-fail if missing) | Account located; Billing Address and Payment Terms presence verified; warning annotation raised on soft-fail | AC-005-01 |
| TC-ACC-002 | Create Contact on Account, create Opportunity from Contact, verify Contact is Primary Contact Role | Contact saved and URL captured; Opportunity created and URL captured; Contact appears as Primary Contact Role on Opportunity | AC-005-02, AC-005-03, AC-005-04 |
| TC-ACC-003 | Create Quote from Opportunity, browse catalog, select price book, select All Products, search and add product, validate cart | Quote URL captured; Price Book selected; product added to quote line items; product visible in cart | QO-005-05, PC-005-06, PC-005-07, PC-005-08, PC-005-09 |
| TC-ACC-004 | Mark Quote as Accepted with Mark as Current Status, then create Contract selecting None (no prices or discounts) | Quote status updated to Accepted; Contract record created and URL captured | QL-005-10, QL-005-11 |
| TC-ACC-005 | Open Contract and activate it with Contract Term; navigate to Quote, create single Order, open Order and activate | Contract status is Activated; Order created from Quote; Order status set to Activated | CR-005-12, OR-005-13, OR-005-14, OR-005-15, OR-005-16 |
