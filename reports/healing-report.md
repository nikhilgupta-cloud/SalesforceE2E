# Healing Report — 03/04/2026

**Skipped — ANTHROPIC_API_KEY not set (2):**
- ⚠ TC-QTE-009 — Edit Lines button opens Quote Line Editor
- ⚠ TC-QTE-012 — Product catalog search in QLE

**Next steps for remaining failures:**
1. Classify each failure: selector_failure | timing_failure | data_failure | environment_failure
2. For selector/timing: re-probe DOM, update SalesforceFormHandler or spec locator.
3. Re-run: `npx playwright test --headed --grep "<TC-ID>"`
4. Repeat up to 3 rounds before escalating.