# Test Scenarios — Order
**Generated:** 2026-04-22

---

## US-005: Salesforce E2E Process — Account Verification through Contact, Opportunity & Contact Role

| TC ID | Scenario | Expected Result | AC Ref |
|-------|----------|-----------------|--------|
| TC-ORD-001 | Verify existing Account has Billing Address and Payment Terms under the Details tab (soft-fail if missing) | Billing Address and Payment Terms fields are present and non-empty; test logs a SOFT-FAIL warning but does not block execution if either field is absent | AC-005-01 |
| TC-ORD-002 | Create a new Contact for the Account when no Contact exists | New Contact record is saved and visible, linked to the parent Account | AC-005-02 |
| TC-ORD-003 | Create a new Opportunity from the Contact record's Related tab | Opportunity record is created and navigated to; heading matches the expected Opportunity name | AC-005-03 |
| TC-ORD-004 | Verify the newly created Contact is assigned as the Primary Contact Role on the Opportunity | Contact Roles related list on the Opportunity contains the Contact with the Primary flag set | AC-005-04 |
