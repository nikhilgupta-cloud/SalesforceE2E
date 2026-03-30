# Test Scenarios — Opportunity Object
**User Stories:** US-007 (Create), US-008 (Update Stage), US-009 (Forecast Category)
**Generated:** 2026-03-29

---

## US-007: Create Opportunity

| TC ID | Scenario | Expected Result | AC Ref |
|-------|----------|-----------------|--------|
| TC-OPP-001 | Navigate to Opportunities list and click New | New Opportunity modal opens | AC-007-01 |
| TC-OPP-004 | Create Opportunity with all required fields | Opportunity saved, detail page loads | AC-007-01 |
| TC-OPP-005 | Save Opportunity without required fields | Validation errors displayed | AC-007-01 |
| TC-OPP-007 | Stage picklist contains expected values (Prospecting, Closed Won) | Both values present | AC-007-02 |
| TC-OPP-010 | Saved Opportunity appears in Account related list | Opportunity visible in Account's Opps list | AC-007-04 |
| TC-OPP-012 | Create Opportunity without Amount (optional) | Opportunity saved without Amount | AC-007-05 |

## US-008: Update Opportunity Stage

| TC ID | Scenario | Expected Result | AC Ref |
|-------|----------|-----------------|--------|
| TC-OPP-014 | Update Opportunity Stage via detail page | Stage changed to Qualification | AC-008-01 |
| TC-OPP-017 | Create Opportunity with Stage = Closed Won, with Amount | Closed Won stage saved | AC-008-02 |

## US-009: Forecast Category

| TC ID | Scenario | Expected Result | AC Ref |
|-------|----------|-----------------|--------|
| TC-OPP-021 | Forecast Category auto-populated based on Stage | Forecast Category field visible on detail page | AC-009-01 |
| TC-OPP-024 | Forecast Category visible on Opportunities list view | Opportunities list view loads | AC-009-02 |
| TC-OPP-027 | Changing Stage recalculates Forecast Category | Stage updated to Qualification | AC-009-03 |
