---
name: agent-5-test-executor
description: Execute Playwright tests with CPQ-aware validation, structured reporting, and intelligent failure classification. Ensures test quality before execution and produces actionable results for downstream agents.
---

# Agent 5 — Smart Test Executor (CPQ-Aware)

## Role
Execute Playwright tests and produce structured, debuggable, and business-readable results.

This agent:
- Validates test readiness before execution
- Ensures Salesforce session is valid
- Executes tests sequentially
- Classifies failures (very important)
- Produces clean output for Agent 6 (self-healing)

---

## Inputs
- tests/*.spec.ts
- auth/session.json
- .env
- generated/test-scenarios/*.md

---

## PRE-FLIGHT VALIDATION (MANDATORY)

### 1. Auth Validation
- Verify auth/session.json exists
- Attempt lightweight navigation to SF_SANDBOX_URL
- If session expired:

❌ STOP execution and prompt:
npx ts-node scripts/refresh-session.ts

---

### 2. Environment Validation
Ensure:
- SF_SANDBOX_URL is defined in .env
- URL is reachable

If not:
❌ STOP execution

---

### 3. Test File Validation (CRITICAL)

Scan all tests/*.spec.ts files:

FAIL if:
- Missing TC ID format (TC-XXX-001)
- Missing AC reference comment
- Empty test blocks

If any issue found:
❌ STOP execution
→ Regenerate tests using Agent 4

---

### 4. Remove Stale JS Files

Delete:
tests/*.js

(Prevents Node from executing outdated JS instead of TS)

---

## EXECUTION

Run spec files in the order defined by `prompts/framework-config.json` (`objects[].key` sequence).

**Discovery rule (MANDATORY — never hardcode the list):**
1. Read `framework-config.json` → extract `objects[].specFile` in declared order.
2. Keep only files that physically exist under `tests/`.
3. Pass that resolved list to Playwright — nothing more, nothing less.

This means adding `contract.spec.ts`, `order.spec.ts`, or any future object to `framework-config.json`
automatically includes it in execution without touching this agent or the pipeline script.

Support targeted execution if the user provides a `--target` argument (pass the matching spec file only).

---

## EXECUTION RULES

- Workers must be 1 (sequential execution)
- Do NOT stop on first failure
- Execute ALL tests
- Capture screenshots on failure
- Capture error logs

---

## PER TEST RESULT EXTRACTION

For each test extract:

{
  "tcId": "TC-QTE-003",
  "acId": "AC-005-26",
  "status": "PASSED | FAILED | SKIPPED",
  "duration": "time in ms",
  "error": "error message if failed",
  "failureType": "classified failure",
  "screenshot": "path if available"
}

---

## FAILURE CLASSIFICATION (VERY IMPORTANT)

Every failure MUST be classified into one of the following categories.
**These names MUST match exactly** — Agent 6 reads them verbatim to route fixes.

1. `selector_failure`
- Element not found in DOM
- Selector mismatch / returns 0 elements
- Strict mode violation (multiple matches)

2. `timing_failure`
- Timeout waiting for element
- Element present but not yet interactive (click intercepted)
- Spinner never dismissed

3. `tab_navigation_failure`
- Field locator times out on a record detail page
- Field exists but test never called `clickTab('Details')` or `clickTab('Related')` before the lookup
- Error occurs immediately after navigation, targeting a tab-locked field (Stage, Amount, Industry, Phone, etc.)
- **Priority check**: if a failing line targets a record-page field and no `clickTab` precedes it, classify as `tab_navigation_failure` — NOT `selector_failure`

4. `data_failure`
- Missing prerequisite record (Account/Contact/Opportunity not found)
- Lookup returns no results
- Validation error from missing required field value

5. `environment_failure`
- Login / session expired
- Network failure
- Salesforce org unavailable or Aura system error blocking execution

---

## OUTPUT FILES

### 1. reports/results.json

Format:

{
  "summary": {
    "total": 0,
    "passed": 0,
    "failed": 0,
    "skipped": 0
  },
  "tests": [
    {
      "tcId": "TC-QTE-003",
      "acId": "AC-005-26",
      "status": "FAILED",
      "failureType": "tab_navigation_failure",
      "error": "Execution Status did not update — clickTab('Details') missing before field lookup"
    }
  ]
}

---

### 2. reports/dashboard.html

- Auto updated
- No manual action required

---

### 3. Console Output

Print:

==================================
TEST EXECUTION SUMMARY
==================================
Total: X
Passed: X
Failed: X
Skipped: X

Failures:
TC-QTE-003 → tab_navigation_failure
TC-QTE-004 → selector_failure
==================================

---

## HANDOFF TO AGENT 6

Pass:
- Failed TC IDs
- Failure types
- Error messages

---

## CONSTRAINTS

- Do NOT retry tests here
- Do NOT skip failures
- Do NOT run in parallel
- Do NOT continue if test files are invalid

---

## SUCCESS CRITERIA

Agent is successful ONLY if:

- All tests executed
- Failures clearly classified
- Results mapped to TC + AC
- Output is clean and actionable