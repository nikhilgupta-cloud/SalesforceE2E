# Test Scenarios — Contact
**Generated:** 2026-04-17

---

## US-005: Salesforce E2E Process — Account Verification Through Opportunity Contact Role

| TC ID | Scenario | Expected Result | AC Ref |
|-------|----------|-----------------|--------|
| TC-CON-001 | Verify Account Billing Address and Payment Terms exist (soft-fail if missing) | Page remains stable; warnings logged for any missing fields; no hard failure | AC-005-01 |
| TC-CON-002 | Create a new Contact record linked to the Account when none exists | Contact "David John" is created and saved with Account association confirmed | AC-005-02 |
| TC-CON-003 | Create an Opportunity from the Contact's Related list perspective | Opportunity "Standard E2E - Q2 Order" is created and detail page loads successfully | AC-005-03 |
| TC-CON-004 | Verify newly created Contact is assigned as Primary Contact Role on the Opportunity | David John appears in the Contact Roles related list with Primary designation visible | AC-005-04 |
