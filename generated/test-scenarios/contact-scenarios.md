# Test Scenarios — Contact
**Generated:** 2026-04-17

---

## US-005: Salesforce E2E Process to Order Activation

| TC ID | Scenario | Expected Result | AC Ref |
|-------|----------|-----------------|--------|
| TC-CON-001 | Verify Account Billing Address and Payment Terms are present under the Details tab | Fields are visible; soft-fail warning logged if either field is absent — test continues | AC-005-01 |
| TC-CON-002 | Create a new Contact record linked to an existing Account when no Contact exists | Contact is saved successfully, detail page loads, Name and Account Name fields are populated | AC-005-02 |
| TC-CON-003 | Create a new Opportunity from the Contact's Related tab Opportunities list | Opportunity is saved and its detail page loads with the correct Opportunity Name visible | AC-005-03 |
| TC-CON-004 | Verify the newly created Contact is assigned as Primary Contact Role on the Opportunity | Contact appears in the Contact Roles related list with Primary indicator present | AC-005-04 |
