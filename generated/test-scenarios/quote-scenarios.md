# Test Scenarios — Quote Object (Salesforce CPQ)
**User Stories:** US-010 (Create), US-011 (Quote Line Editor), US-012 (Primary Quote)
**Generated:** 2026-03-29

---

## US-010: Create Quote

| TC ID | Scenario | Expected Result | AC Ref |
|-------|----------|-----------------|--------|
| TC-QTE-001 | New Quote button accessible from Opportunity detail page | New Quote button visible | AC-010-01 |
| TC-QTE-003 | Quote inherits Opportunity data when created from Opportunity | Quote Name pre-populated | AC-010-02 |
| TC-QTE-004 | Create Quote directly with required fields | Quote saved, detail page loads | AC-010-01 |
| TC-QTE-007 | Saved Quote appears in Opportunity related list | Quote visible in Opportunity's Quotes list | AC-010-03 |
| TC-QTE-030 | Generate Document button visible on Quote | Generate Document accessible (CPQ configured feature) | AC-010-04 |
| TC-QTE-035 | Quote detail page loads with header visible | Page header visible | AC-010-05 |

## US-011: Quote Line Editor (QLE)

| TC ID | Scenario | Expected Result | AC Ref |
|-------|----------|-----------------|--------|
| TC-QTE-009 | Edit Lines button opens Quote Line Editor | QLE page or CPQ editor loads | AC-011-01 |
| TC-QTE-012 | Product catalog search in QLE | Product search field accessible | AC-011-02 |
| TC-QTE-021 | Discount percent field editable in QLE | Discount field visible and editable | AC-011-03 |

## US-012: Primary Quote

| TC ID | Scenario | Expected Result | AC Ref |
|-------|----------|-----------------|--------|
| TC-QTE-038 | Primary Quote checkbox available on Quote form | Primary checkbox accessible | AC-012-01 |
