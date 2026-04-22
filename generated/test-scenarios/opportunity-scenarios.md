# Test Scenarios — Opportunity
**Generated:** 2026-04-17

---

## US-005: Salesforce E2E Process — Account Verification through Opportunity Contact Role

| TC ID | Scenario | Expected Result | AC Ref |
|-------|----------|-----------------|--------|
| TC-OPP-001 | Verify existing Account has Billing Address and Payment Terms under Details tab (soft-fail if missing) | Both fields are visible on the Details tab; missing fields emit a console warning but do not hard-fail the run | AC-005-01 |
| TC-OPP-002 | Check whether a Contact exists for the Account; create a new Contact record if one is absent | New Contact is created and visible on the Account's Contacts related list | AC-005-02 |
| TC-OPP-003 | Open the Contact record and create a new Opportunity from the Contact's perspective | Opportunity record is saved and the detail page loads successfully | AC-005-03 |
| TC-OPP-004 | Navigate to the newly created Opportunity and verify the Contact appears in Contact Roles as Primary | Contact is listed in the Contact Roles related list with Primary role | AC-005-04 |
