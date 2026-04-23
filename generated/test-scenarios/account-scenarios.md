# Test Scenarios — Account
**Generated:** 2026-04-22

---

## US-005: Salesforce E2E Process — Account to Opportunity Lifecycle

| TC ID | Scenario | Expected Result | AC Ref |
|-------|----------|-----------------|--------|
| TC-ACC-001 | Verify existing Account Billing Address and Payment Terms are populated under the Details tab | Fields present → pass; fields empty → console.warn soft-fail, test continues | AC-005-01 |
| TC-ACC-002 | Create a new Contact directly on the Account record via the Contacts related list | Contact is created and visible as a link in the Account's Contacts related list | AC-005-02 |
| TC-ACC-003 | Create a new Opportunity from the Contact record via the Opportunities related list | Opportunity is saved and its record detail page opens with the correct name | AC-005-03 |
| TC-ACC-004 | Verify newly created Contact is listed as the Primary Contact Role on the Opportunity | Contact appears in the Contact Roles related list; Primary indicator is confirmed true | AC-005-04 |
