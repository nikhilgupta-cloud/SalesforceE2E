# Healing Report — 01/04/2026

**Skipped — ANTHROPIC_API_KEY not set (1):**
- ⚠ TC-CON-008 — Saved Contact appears in Account related Contacts list

**Next steps for remaining failures:**
1. Classify each failure: selector_failure | timing_failure | data_failure | environment_failure
2. For selector/timing: re-probe DOM, update SalesforceFormHandler or spec locator.
3. Re-run: `npx playwright test --headed --grep "<TC-ID>"`
4. Repeat up to 3 rounds before escalating.