# Test Scenarios — Contact Object
**User Stories:** US-004 (Create), US-005 (Associate), US-006 (Edit)
**Generated:** 2026-03-29

---

## US-004: Create Contact

| TC ID | Scenario | Expected Result | AC Ref |
|-------|----------|-----------------|--------|
| TC-CON-001 | Navigate to Contacts list and click New | New Contact modal dialog opens | AC-004-01 |
| TC-CON-004 | Create Contact with required fields (Last Name) | Contact saved, detail page loads | AC-004-01 |
| TC-CON-005 | Account Name lookup resolves to existing account | Account linked to Contact | AC-004-02 |
| TC-CON-009 | Duplicate email triggers duplicate alert | Duplicate warning displayed | AC-004-03 |

## US-005: Associate Contact with Account

| TC ID | Scenario | Expected Result | AC Ref |
|-------|----------|-----------------|--------|
| TC-CON-008 | Saved Contact appears in Account related Contacts list | Contact visible in Account's Contacts related list | AC-005-01 |
| TC-CON-020 | Add Contact Role from Opportunity related list | Contact Role created with Role value | AC-005-02 |
| TC-CON-022 | Contact Role includes Role value | Role picklist value saved | AC-005-03 |

## US-006: Edit Contact

| TC ID | Scenario | Expected Result | AC Ref |
|-------|----------|-----------------|--------|
| TC-CON-013 | Edit Contact Phone, Title, Email | All three fields updated | AC-006-01 |
| TC-CON-016 | Changes persist after navigating away and back | Updated values retained | AC-006-02 |
| TC-CON-018 | Clear required Last Name shows validation error | Error displayed, record not saved | AC-006-03 |
