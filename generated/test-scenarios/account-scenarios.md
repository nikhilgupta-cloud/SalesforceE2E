# Test Scenarios — Account
**Generated:** 2026-04-22

---

## US-005: Salesforce E2E — Account Verification through Quote Creation

| TC ID | Scenario | Expected Result | AC Ref |
|-------|----------|-----------------|--------|
| TC-ACC-001 | Identify existing Account and soft-verify Billing Address and Payment Terms on Details tab | Billing Address fields and Payment Terms are present; warnings logged if missing (no hard failure) | AC-005-01 |
| TC-ACC-002 | Create a new Contact directly on the Account record via the Related tab | Contact is successfully created and visible in the Contacts related list on the Account | AC-005-02 |
| TC-ACC-003 | Create a new Opportunity from the Contact record's Related tab | Opportunity is created and linked; user lands on the new Opportunity record | AC-005-03 |
| TC-ACC-004 | Verify the newly created Contact is assigned as Primary Contact Role on the Opportunity | Contact appears in the Contact Roles related list with Primary designation | AC-005-04 |
| TC-ACC-005 | Create a Quote from the Opportunity using the Create Quote button | Quote record is created and visible; linked to the parent Opportunity | QO-005-05 |
