# Test Scenarios — Account Object
**User Stories:** US-001 (Create), US-002 (View/Search), US-003 (Edit)
**Generated:** 2026-03-27

---

## US-001: Create Account

| TC ID | Scenario | Expected Result | AC Ref |
|-------|----------|-----------------|--------|
| TC-ACC-001 | Navigate to Accounts list and click New | New Account modal dialog opens | AC-001-01 |
| TC-ACC-004 | Create Account with Account Name only (required field) | Account saved, detail page loads | AC-001-01 |
| TC-ACC-005 | Save Account without Account Name | Validation error displayed | AC-001-02 |
| TC-ACC-010 | Saved Account appears in Accounts list view | Account visible in list | AC-001-03 |
| TC-ACC-013 | Account Type picklist contains Prospect and Customer | Both values present | AC-001-04 |

## US-002: View / Search Account

| TC ID | Scenario | Expected Result | AC Ref |
|-------|----------|-----------------|--------|
| TC-ACC-028 | Global search returns Account by name | Account appears in search results | AC-002-01 |
| TC-ACC-034 | Account detail page shows Name, Phone, page header | All fields visible | AC-002-02 |
| TC-ACC-035 | New Account detail page loads with empty related lists | Related list sections visible | AC-002-03 |

## US-003: Edit Account

| TC ID | Scenario | Expected Result | AC Ref |
|-------|----------|-----------------|--------|
| TC-ACC-016 | Open Account and click Edit, modify Phone, Save | Phone updated on detail page | AC-003-01 |
| TC-ACC-019 | All editable fields modified and saved | All changes persisted | AC-003-02 |
| TC-ACC-020 | Clear required Account Name, Save shows validation error | Error displayed, record not saved | AC-003-03 |
| TC-ACC-022 | Changes reflected on detail page immediately after Save | Updated values visible | AC-003-04 |
| TC-ACC-025 | Last Modified By updates after Save | Modified by field updated | AC-003-05 |
