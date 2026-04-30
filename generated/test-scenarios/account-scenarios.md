# Test Scenarios — Account
**Generated:** 2026-04-30

---

## US-005: Salesforce E2E Process — Account to Order Activation

| TC ID | Scenario | Expected Result | AC Ref |
|-------|----------|-----------------|--------|
| TC-ACC-001 | Verify existing Account has Billing Address and Payment Terms on Details tab | Account record opens; Billing Address present and Payment Terms field visible (soft-fail warning logged if either is missing, test continues) | AC-005-01 |
| TC-ACC-002 | Create Contact on Account, create Opportunity from Contact perspective, verify Primary Contact Role | Contact created under Account; Opportunity created and linked to Account; Contact visible as Primary Contact Role on Opportunity Related tab | AC-005-02, AC-005-03, AC-005-04 |
| TC-ACC-003 | Create Quote from Opportunity, Browse Catalogs, select Price Book, add product, validate cart | Quote created from Opportunity; Standard Price Book selected via Browse Catalogs; All Products viewed; product added and saved to Quote; product line item visible on cart | QO-005-05, PC-005-06, PC-005-07, PC-005-08, PC-005-09 |
| TC-ACC-004 | Accept Quote, create Contract with no prices/discounts, activate Contract with term | Quote status progressed to Accepted; Contract created via None option (no prices); Contract Status set to Activated with 12-month term and saved | QL-005-10, QL-005-11, CR-005-12 |
| TC-ACC-005 | Open Quote, create single Order, open Order, activate Order and mark as Complete | Order created from Quote via Create Single Order; Order record opened; Order activated and status marked Complete | OR-005-13, OR-005-14, OR-005-15, OR-005-16 |
