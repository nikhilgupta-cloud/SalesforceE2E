# Test Scenarios — Account
**Generated:** 2026-04-21

---

## US-005: Salesforce E2E Process — Account Verification Through Contact Role Assignment

| TC ID | Scenario | Expected Result | AC Ref |
|-------|----------|-----------------|--------|
| TC-ACC-001 | Verify existing Account has Billing Address and Payment Terms on Details tab | Account record opens; Details tab loads; soft-fail warning logged to console if either field is blank; page header remains visible (test never hard-fails) | AC-005-01 |
| TC-ACC-002 | Create a new Contact for the Account when no Contact exists in the Related list | New Contact modal opens, First Name and Last Name filled via SFUtils.fillName, record saved and Contact detail page confirmed | AC-005-02 |
| TC-ACC-003 | Create Opportunity from the Contact record using the New Opportunity action | Opportunity modal filled with Name, Close Date, Stage; record saved; Opportunity page header with correct name is visible | AC-005-03 |
| TC-ACC-004 | Verify newly created Contact is assigned as Primary Contact Role on the Opportunity | Opportunity Related tab shows Contact Roles section; Contact row present; Primary indicator visible; if missing, Edit modal used to set Primary and saved | AC-005-04 |
