# Test Scenarios — Account
**Generated:** 2026-04-30

---

## US-005: E2E — Account Verification Through Order Activation

| TC ID | Scenario | Expected Result | AC Ref |
|-------|----------|-----------------|--------|
| TC-ACC-001 | Verify Account Billing Address and Payment Terms on Details tab | Billing Address visible and non-empty; Payment Terms label present; soft-fail with warning annotation if either is missing | AC-005-01 |
| TC-ACC-002 | Create Contact on Account, create Opportunity from Contact's Related List, verify Contact is Primary Contact Role on Opportunity | Contact saved and navigable via toast; Opportunity created and URL contains /Opportunity/; Contact name visible in Contact Roles related list | AC-005-02, AC-005-03, AC-005-04 |
| TC-ACC-003 | Create Quote from Opportunity, browse catalogs, select Standard Price Book, select All Products, add first product, save, validate product in cart | Quote URL captured; price book selected; product added; line item row visible in cart | QO-005-05, PC-005-06, PC-005-07, PC-005-08, PC-005-09 |
| TC-ACC-004 | Mark Quote as Accepted, create contract via "None: Create contract without any prices or discounts", open contract, activate it, fill Contract Term | Quote status set to Accepted; contract navigable via toast; contract Status field shows Activated | QL-005-10, QL-005-11, CR-005-12 |
| TC-ACC-005 | Navigate to Quote, click Create Order → Create single Order, open Order via toast, click Activated and Mark as Current Status | Order URL contains /Order/; Order Status field visible and confirmed after activation | OR-005-13, OR-005-14, OR-005-15, OR-005-16 |
