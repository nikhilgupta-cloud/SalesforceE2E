# Test Scenarios — Opportunity
**Generated:** 2026-04-17

---

## US-005: Salesforce E2E Process — Account Verification through Opportunity Contact Role

| TC ID | Scenario | Expected Result | AC Ref |
|-------|----------|-----------------|--------|
| TC-OPP-001 | Verify Account "SBOTestAccount" has Billing Address and Payment Terms (soft-fail if missing) | Account detail page loads; missing fields produce console warnings but do not fail the test | AC-005-01 |
| TC-OPP-002 | Create Contact "David John" for Account if not already present | Contact record for David John is created and linked to SBOTestAccount, or confirmed already existing | AC-005-02 |
| TC-OPP-003 | Create Opportunity from Contact "David John" record using New Opportunity action | Opportunity detail page loads confirming creation from the Contact's context | AC-005-03 |
| TC-OPP-004 | Verify "David John" is assigned as Primary Contact Role on the created Opportunity | Contact Roles related list shows David John with Primary flag set | AC-005-04 |
