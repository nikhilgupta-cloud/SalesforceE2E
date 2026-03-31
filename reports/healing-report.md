# Healing Report — 30/03/2026
**Failed tests (5):**

- TC-ACC-005 — Save Account without name shows validation error
- TC-ACC-010 — Saved Account appears in list view
- TC-CON-001 — Navigate to Contacts list and click New
- TC-OPP-001 — Navigate to Opportunities list and click New
- TC-QTE-001 — New Quote button accessible from Opportunity detail page

**Next steps:**
1. Classify each failure: selector_failure | timing_failure | data_failure | environment_failure
2. For selector/timing: re-probe DOM, update SalesforceFormHandler or spec locator.
3. Re-run: `npx playwright test --headed --grep "<TC-ID>"`
4. Repeat up to 3 rounds before escalating.