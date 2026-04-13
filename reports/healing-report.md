# Healing Report — 13/04/2026

**Still failing (1):**
- ❌ TC-QTE-001 — Ready For Acceptance action visible on Approved quote and launches screenflow

**Next steps for remaining failures:**
1. Classify each failure: selector_failure | timing_failure | data_failure | environment_failure
2. For selector/timing: re-probe DOM, update SalesforceFormHandler or spec locator.
3. Re-run: `npx playwright test --headed --grep "<TC-ID>"`
4. Repeat up to 3 rounds before escalating.