# Test Scenarios — Account
**Generated:** 2026-04-22

---

## US-005: Salesforce E2E — Account to Quote Lifecycle

| TC ID | Scenario | Expected Result | AC Ref |
|-------|----------|-----------------|--------|
| TC-ACC-001 | Verify Billing Address and Payment Terms on existing Account Details tab (soft-fail if absent) | Fields present with values; console warning logged if empty — test does not fail | AC-005-01 |
| TC-ACC-002 | Create new Contact record from Account Related list | Contact saved and Contact detail page heading displays full name | AC-005-02 |
| TC-ACC-003 | Create Opportunity from Contact's Related list Opportunities section | Opportunity saved and Opportunity detail page heading displays opportunity name | AC-005-03 |
| TC-ACC-004 | Verify newly created Contact appears as Primary Contact Role on the Opportunity | Contact row visible in Contact Roles related list; Primary indicator confirmed | AC-005-04 |
| TC-ACC-005 | Create Quote from Opportunity record | Quote created and Quote heading visible on resulting page | QO-005-05 |
