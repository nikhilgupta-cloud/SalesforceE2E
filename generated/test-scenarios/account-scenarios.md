# Test Scenarios — Account
**Generated:** 2026-04-22

---

## US-005: Account-to-Quote E2E Lifecycle — Contact, Opportunity & Quote Creation

| TC ID | Scenario | Expected Result | AC Ref |
|-------|----------|-----------------|--------|
| TC-ACC-001 | Verify existing Account has Billing Address and Payment Terms under Details tab (soft-fail if missing) | Billing Address and Payment Terms fields are visible; test logs warning but does not hard-fail if absent | AC-005-01 |
| TC-ACC-002 | Create a new Contact on the Account's Related tab | Contact is saved successfully and appears in the Account's Contacts related list | AC-005-02 |
| TC-ACC-003 | Create a new Opportunity from the Contact's Related tab | Opportunity is saved successfully and linked to the Contact | AC-005-03 |
| TC-ACC-004 | Verify newly created Contact is assigned as Primary Contact Role on the Opportunity | Contact appears in the Opportunity's Contact Roles related list with role marked Primary | AC-005-04 |
| TC-ACC-005 | Create a Quote from the Opportunity using the Create Quote button | Quote record is created and saved; user lands on the new Quote detail page | QO-005-05 |
