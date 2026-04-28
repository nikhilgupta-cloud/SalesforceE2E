# Orphan Test Report — 2026-04-28

**Total tests:** 8  
**Story-backed:** 5  
**Orphans:** 3  
**Active story markers:** US-005

## ⚠ Orphan Tests (3)

These tests have **no backing user story marker** (`// ── US-XXX START ──`).
They run in Playwright and appear in the dashboard but cannot be traced to a Jira story.

| TC ID | Spec File | Line | Test Title | AC Hint |
|-------|-----------|------|-----------|---------|
| TC-ACC-001 | account.spec.ts | 38 | TC-ACC-001 — Verify Billing Address (Soft-Fail) |  |
| TC-ACC-003 | account.spec.ts | 77 | TC-ACC-003 — Create Opportunity |  |
| TC-ACC-005 | account.spec.ts | 93 | TC-ACC-005 — Create Quote |  |

## How to Fix

1. **For each orphan**, identify which Jira story it belongs to.
2. Wrap the test(s) in story markers:
   ```ts
   // ── US-001 START ─────────────────────────────────────────────────────
   test('TC-ACC-001 — ...', async ({ page }) => { ... });
   // ── US-001 END ───────────────────────────────────────────────────────
   ```
3. Create a matching user story file in `prompts/user-stories/US_001_xxx.md`.
4. Re-run `npm run pipeline` — the story will be tracked and the orphan removed.
