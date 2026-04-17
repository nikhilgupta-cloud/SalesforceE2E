QA Automation Pipeline — Master Prompt
Application: Salesforce CPQ (RCA)
Orchestrator: Claude Code
Tools: Playwright, TypeScript, GitHub

═══════════════════════════════════════════════════════════════
OVERVIEW
═══════════════════════════════════════════════════════════════

This pipeline is executed by 7 specialised agents running in sequence. Each agent has a single responsibility, a defined input, and a defined output. No agent proceeds without its required inputs being available. The orchestrator (Claude Code) spawns and coordinates all agents.

Pipeline flow:

  [Agent 1: Knowledge Base]
          ↓ domain context
  [Agent 2: User Story Reader]
          ↓ AC-mapped requirements
  [Agent 3: Test Plan Drafter]
          ↓ test-plan.md
  [Agent 4: Scenario & Case Drafter]
          ↓ {object}-scenarios.md + spec files
  [Agent 5: Test Executor]
          ↓ results.json + pass/fail counts
  [Agent 6: Self-Healer]
          ↓ patched spec files + healing-report.md
  [Agent 7: Dashboard & Reporter]
          ↓ dashboard.html + pipeline-state.json + .pptx

═══════════════════════════════════════════════════════════════
SHARED INPUT FILES (read by the orchestrator before spawning agents)
═══════════════════════════════════════════════════════════════

- prompts/framework-config.json   — source of truth for object registry, prefixes, and app identity
- prompts/user-stories/*.md       — single-story files (one US per file); filtered per object by Agent 2
- user-stories/*.md               — multi-story files (e.g. CPQ_User_stories.md); parsed by Agent 2 using OBJECT N: headers
- prompts/dashboard-spec.md       — architecture reference for Agent 7; read before touching DashboardReporter
- knowledge/agentforce-rm/INDEX.md — domain knowledge index; used by Agent 1 to resolve which files to load

═══════════════════════════════════════════════════════════════
SHARED GROUND RULES
(Every agent that writes or modifies Playwright code must follow all of these)
═══════════════════════════════════════════════════════════════

TIMING & WAITING
- isVisible() is synchronous — it does not wait. Never use it to check if an element is ready. Always use waitFor({ state: 'visible', timeout }) instead.
- Never use waitForLoadState('networkidle') — Salesforce never goes idle.
- Never use waitForTimeout() to handle page loads — only for brief micro-waits (100–300ms) after interactions.
- Always wait for a specific landmark element to confirm page readiness (e.g., .slds-page-header, a known field label) before interacting.
- Set timeouts of 15000–30000ms on all waitFor calls — Salesforce is inherently slow.

STRICT MODE
- Many Salesforce pages render the same CSS class or text in multiple places (e.g., page headers appear for the main record and each related list section; a record name appears in the header and in the success toast).
- Any locator that could match more than one element must be scoped with .first() or a more specific selector to avoid Playwright strict mode violations.

MODAL DIALOGS
- Salesforce has a system error dialog (#auraError) that also carries role="dialog". Always exclude it from modal selectors so your test does not interact with the error overlay instead of the actual form.
- Standard modal selector: [role="dialog"]:not([id="auraError"]):not([aria-hidden="true"])
- Add a dismissAuraError() helper that checks for and closes this error dialog. Call it in beforeEach and after every page navigation.

BUTTONS & ACTIONS
- Partial name matching on buttons is dangerous in Salesforce — navigation bars contain buttons whose labels partially overlap with action button labels (e.g., "Edit" vs "Edit nav items"). Always use exact name matching.
- Some objects do not expose action buttons (like Edit) directly on the detail page. They may be hidden behind a dropdown menu (e.g., "Show more actions" / kebab). Probe the DOM before assuming a direct Edit button exists.

FORM FIELDS & LOOKUPS
- Salesforce lookup fields render a dropdown container that Playwright cannot see as visible, even when the dropdown is open. The individual option items inside it ARE accessible directly on the page. Never scope option searches through the container — target options at page level.
- Options inside Salesforce dropdown containers may be outside the viewport. scrollIntoViewIfNeeded() does not work inside custom scrollable containers — use element.evaluate() with native scrollIntoView() instead.
- Validation error indicators have DOM representations even when no error exists. Target only elements that are exclusively present during an error state (e.g., aria-invalid="true" or the parent container with the error class) — never target help-text spans that are always in the DOM.

GLOBAL SEARCH
- The Salesforce global search input is hidden (not interactable) until the search bar is activated. Never target it directly — first click the search trigger button, then target the now-visible search input.

UTILITY FILES
- Never allow compiled JavaScript (.js) files to coexist in the same directory as their TypeScript (.ts) source equivalents. Node will load the .js file and ignore the .ts, causing "method is not a function" errors. Check for and remove stale .js files before running tests.
- Always import utilities without file extensions so TypeScript resolution is used.

AUTHENTICATION
- auth/session.json contains live session credentials. Never commit it to git.
- Always check for auth/session.json first and use storageState to skip login entirely.
- If the file does not exist or the session has expired, pause and ask the user to re-authenticate manually using: npx playwright codegen --save-storage=auth/session.json {SF_SANDBOX_URL}

NATIVE LOCATORS (no centralised form handler)
- Do NOT use SalesforceFormHandler or any centralised form utility. Write all locators inline in the spec file.

Standard patterns:
  Text Inputs:    page.locator('lightning-input').filter({ hasText: /Account Name/i }).locator('input')
  Comboboxes:     page.locator('lightning-combobox').filter({ hasText: /Stage/i }).locator('button').first()
  Lookups:        page.locator('lightning-lookup').filter({ hasText: /Account/i }).locator('input')
  Checkboxes:     page.locator('lightning-input').filter({ hasText: /Is Ramped/i }).locator('input[type="checkbox"]')
  Textarea:       page.locator('lightning-textarea').filter({ hasText: /Description/i }).locator('textarea')

Modal-scoped interactions — always scope through the modal to avoid matching background page fields:
  const modal = page.locator('[role="dialog"]:not([id="auraError"]):not([aria-hidden="true"])');
  modal.locator('lightning-input').filter({ hasText: /Name/i }).locator('input')

LOCATOR DISCOVERY (when DOM is unknown)
- Write a temporary probe-*.ts script to navigate to the page, extract the innerHTML of the target area, and save it to probe-*.txt.
- Read the file, analyze the exact lightning-input / lightning-combobox / ag-grid elements, and construct locators from real DOM data — never from assumptions.
- DELETE all probe-*.ts and probe-*.txt files before committing.

CPQ-SPECIFIC
- Spinner: Always wait for .sb-loading-mask, .blockUI, or .slds-spinner to disappear before interacting with the cart.
- AG-Grid: Rows and columns are lazy-loaded. Use page.locator('div[role="row"]').filter({ hasText: 'Product Name' }).

═══════════════════════════════════════════════════════════════
AGENT 1 — KNOWLEDGE BASE READER
═══════════════════════════════════════════════════════════════

ROLE
Load and surface the correct domain knowledge for the Salesforce object(s) under test. Downstream agents must not generate tests or healing patches without this context being available.

INPUTS
- knowledge/agentforce-rm/INDEX.md  — object-to-domain file map
- prompts/framework-config.json     — list of objects being tested (key field)

PROCESS
1. Read INDEX.md to resolve which domain file(s) map to each object key.
   Object → Domain file quick map:
     quote, quotelineitem      → quote-lifecycle.md, pricing.md
     product2, productcategory → product-modeling.md
     pricebookentry, pricing   → pricing.md
     contract, asset           → contract-lifecycle.md
     order, orderitem          → order-management.md
     approvals, discount       → approvals.md
     amendments                → amendments.md
     renewals                  → renewals.md
2. Load each resolved domain file in full from knowledge/agentforce-rm/.
3. Extract and structure the following per object:
   - Canonical field names and labels as they appear in the Salesforce UI
   - Known UI patterns, Shadow DOM quirks, and LWC component names
   - Known platform limitations and gotchas
   - Any CPQ/Revenue Cloud-specific interaction patterns

OUTPUT
A structured domain context object passed to Agents 2, 3, 4, and 6.
Format: in-memory context (do not write a file — pass directly to the next agent).

CONSTRAINTS
- Do not skip this step for Revenue Cloud objects (Quote, Product, Pricing, Contract, Order, Approvals, Amendments, Renewals).
- If a domain file is not found for an object, flag the gap and fall back to generic Salesforce LWC knowledge — never hallucinate field names or selectors.

═══════════════════════════════════════════════════════════════
AGENT 2 — USER STORY READER
═══════════════════════════════════════════════════════════════

ROLE
Parse user stories and extract structured, testable acceptance criteria (ACs) per Salesforce object. Every downstream test must trace back to an AC produced by this agent.

INPUTS
- prompts/user-stories/*.md      — all user story files
- Domain context from Agent 1    — used to validate that field names in ACs match real Salesforce fields

PROCESS
1. Read every .md file in prompts/user-stories/.
2. Group stories by Salesforce object (Account, Contact, Opportunity, Quote, etc.).
3. For each story, extract:
   - User story ID and title
   - Each AC with its reference code (e.g., AC-001-01)
   - The expected behaviour (given / when / then where present)
   - Any field names or UI steps mentioned — cross-reference against Agent 1 domain context
4. Flag any AC that references a field or behaviour not found in the domain context.
5. Produce a flat, structured AC list per object.

OUTPUT
- Structured AC list per object (in-memory, passed to Agents 3 and 4)
- Flag report of unresolvable ACs (write to generated/ac-flag-report.md if any flags exist)

CONSTRAINTS
- Every AC must carry its original reference code — do not renumber or rename.
- Do not invent ACs. If a story is ambiguous, flag it — do not interpret creatively.

═══════════════════════════════════════════════════════════════
AGENT 3 — TEST PLAN DRAFTER
═══════════════════════════════════════════════════════════════

ROLE
Produce a consolidated, human-readable test plan that defines scope, approach, test data strategy, risks, and entry/exit criteria.

INPUTS
- AC list from Agent 2
- Domain context from Agent 1
- prompts/framework-config.json  — object list, prefixes, and app identity

PROCESS
1. Define test scope: which objects are in scope, which ACs are covered.
2. Write a summary table: Object | Total ACs | Positive | Negative | Edge Cases | Total TCs.
3. Document test data strategy:
   - Use timestamps for uniqueness: e.g., AutoAcc-${Date.now()}
   - No hardcoded credentials
   - Supporting records (Account, Opportunity) created within the test where needed
4. List execution order: Account → Contact → Opportunity → Quote (sequential, 1 worker).
5. Identify risks and mitigations (Salesforce session expiry, spinner timing, AG-Grid lazy load).
6. Define entry criteria: auth/session.json exists and is valid; SF_SANDBOX_URL is set.
7. Define exit criteria: all tests executed; self-healing complete; dashboard updated.

OUTPUT
- generated/test-plan.md

CONSTRAINTS
- Every TC reference in the plan must use format: TC-{PREFIX}-{NUMBER} (e.g., TC-ACC-001).
- Do not list individual test steps here — that is Agent 4's job.

═══════════════════════════════════════════════════════════════
AGENT 4 — SCENARIO & TEST CASE DRAFTER
═══════════════════════════════════════════════════════════════

ROLE
For every AC from Agent 2, generate Positive, Negative, and Edge Case test scenarios, then write production-ready Playwright TypeScript spec files.

INPUTS
- AC list from Agent 2
- Domain context from Agent 1
- Test plan from Agent 3 (for TC numbering sequence)
- prompts/framework-config.json  — object prefix and specFile name per object
- Existing tests/{object}.spec.ts (if present — append AI-generated blocks, do not overwrite manual tests)

PROCESS — SCENARIOS
1. For each AC, generate at minimum:
   - 1 Positive scenario (happy path)
   - 1 Negative scenario (validation, missing required field, wrong data type)
   - 1 Edge Case (boundary value, duplicate, special character, empty state)
2. Assign TC IDs sequentially per object prefix.
3. Save to: generated/test-scenarios/{object}-scenarios.md

PROCESS — SPEC FILES
1. Translate each scenario into a Playwright test block.
2. Follow ALL rules from SHARED GROUND RULES — apply before writing the first line of code.
3. Each test must:
   - Begin with: // TC-{PREFIX}-{NUMBER} | AC Reference: AC-XXX-XX
   - Use a timestamp-based test data name: e.g., `AutoAcc-${Date.now()}`
   - Use native Playwright locators inline (no SalesforceFormHandler, no POM)
   - Include dismissAuraError() in beforeEach and after every navigation
   - Scope all modal interactions through the standard modal selector
4. Wrap AI-generated blocks in markers so the pipeline can identify and update them:
   // [AI-GENERATED START: TC-{PREFIX}-{NUMBER}]
   ...test code...
   // [AI-GENERATED END: TC-{PREFIX}-{NUMBER}]
5. Append generated blocks to the existing spec file — do not overwrite manually authored tests.

OUTPUT
- generated/test-scenarios/{object}-scenarios.md  (one file per object)
- tests/{object}.spec.ts                          (appended AI-generated blocks)

CONSTRAINTS
- Do not hand-edit files in generated/ — they will be overwritten on the next run.
- Do not remove or alter existing [AI-GENERATED] markers.
- No hardcoded credentials or URLs in spec files — always read from process.env.

═══════════════════════════════════════════════════════════════
AGENT 5 — TEST EXECUTOR
═══════════════════════════════════════════════════════════════

ROLE
Run the full Playwright test suite and produce a structured results output consumed by Agents 6 and 7.

INPUTS
- tests/*.spec.ts       — all spec files (in execution order)
- auth/session.json     — Salesforce session state
- .env                  — SF_SANDBOX_URL and credentials

PROCESS
1. Verify auth/session.json exists. If missing or expired, halt and prompt the user to re-authenticate:
   npx playwright codegen --save-storage=auth/session.json {SF_SANDBOX_URL}
2. Load .env environment variables.
3. Run the full suite in this order: Account → Contact → Opportunity → Quote.
   Command: npx playwright test --reporter=list,json --output-folder=reports
4. For each test, record: TC ID | Status (Passed/Failed/Skipped) | Duration | Error message (if failed) | Screenshot path (if failed).
5. Write raw results to reports/results.json.
6. Print a summary table to stdout: Total | Passed | Failed | Skipped.

OUTPUT
- reports/results.json   — raw Playwright JSON results
- Stdout summary table

CONSTRAINTS
- Workers must stay at 1 (sequential). Do not change playwright.config.ts workers.
- Do not retry tests here — retries are Agent 6's job.
- Do not stop the run on first failure — execute all tests, then hand off.

═══════════════════════════════════════════════════════════════
AGENT 6 — SELF-HEALER
═══════════════════════════════════════════════════════════════

ROLE
Analyse failed tests, classify the failure, apply a targeted fix to the spec file, and re-run to confirm the patch works. Repeat up to 3 rounds.

INPUTS
- reports/results.json          — failure list from Agent 5
- tests/{object}.spec.ts        — spec files to patch
- Domain context from Agent 1   — correct field names, selectors, and known gotchas
- Playwright trace files         — in test-results/ for failed tests (if available)

PROCESS
1. Read results.json. Identify all failed tests by TC ID.
2. For each failure, classify:
   - selector_failure   — locator returned 0 or >1 elements, or timed out finding an element
   - timing_failure     — action timed out; page was not ready
   - data_failure       — test data precondition not met (e.g., lookup record doesn't exist)
   - environment_failure — session expired, network error, Salesforce org issue
3. For selector_failure and timing_failure:
   a. Re-check the SHARED GROUND RULES — most common failures are already handled there.
   b. If not covered, write a temporary probe-{object}-{TC}.ts script to navigate to the failing page state and dump the target area's innerHTML to probe-{object}-{TC}.txt.
   c. Read the DOM dump. Identify the correct locator from real data.
   d. Load the relevant domain file from Agent 1 context to verify field naming.
   e. Patch the inline locator in tests/{object}.spec.ts within the [AI-GENERATED] block.
   f. Re-run the patched test: npx playwright test --grep "TC-{PREFIX}-{NUMBER}"
   g. If it passes, mark as healed. If it fails again, increment round counter.
4. For data_failure: diagnose the missing precondition. Add a createSupportingRecord() helper inside the spec if needed. Re-run.
5. For environment_failure: do not auto-fix. Write diagnosis to reports/healing-report.md and notify the user.
6. Repeat up to 3 rounds total. After round 3, mark remaining failures as unresolved.
7. Delete all probe-*.ts and probe-*.txt files after healing is complete.

OUTPUT
- Patched tests/{object}.spec.ts files
- reports/healing-report.md  — per-failure classification, fix applied, and final status

CONSTRAINTS
- Only patch code within [AI-GENERATED START / END] markers. Never modify manually authored tests.
- Do not use SalesforceFormHandler in any patch.
- Do not attempt more than 3 rounds — flag unresolved failures for human review.
- Probes are temporary — always delete before handing off to Agent 7.

═══════════════════════════════════════════════════════════════
AGENT 7 — DASHBOARD & REPORTER
═══════════════════════════════════════════════════════════════

ROLE
Aggregate all pipeline outputs into a live HTML dashboard, a pipeline state tracker, a healing summary, and a PowerPoint report. Optionally push everything to GitHub.

INPUTS
- reports/results.json           — final test results (post-healing)
- reports/healing-report.md      — healing outcomes from Agent 6
- generated/test-plan.md         — from Agent 3
- prompts/framework-config.json  — app identity, object colours and icons
- prompts/dashboard-spec.md      — MUST READ before modifying DashboardReporter or PipelineTracker

PROCESS
1. Read dashboard-spec.md in full before touching any reporter code.
2. Update reports/pipeline-state.json with the final status of all 7 pipeline steps.
3. Invoke utils/DashboardReporter to regenerate reports/dashboard.html.
   - Dashboard auto-refreshes every 2 seconds — do not break this behaviour.
   - Colour-code results per object using accent values from framework-config.json.
4. Generate the PowerPoint report:
   Command: node scripts/generate-ppt.js
   Output:  reports/SalesforceE2E-Framework-Overview.pptx
5. Print final pipeline summary to stdout:
   - Steps completed / failed
   - Test totals: Passed | Failed | Skipped
   - Healed: X of Y failures resolved
6. If GITHUB_TOKEN is set:
   a. Delete any remaining probe-*.ts and probe-*.txt files.
   b. Stage all files except .env and auth/session.json.
   c. Commit: chore: QA run {YYYY-MM-DD} — {passed}/{total} tests passing
   d. Push to GITHUB_BRANCH.

OUTPUT
- reports/dashboard.html
- reports/pipeline-state.json
- reports/SalesforceE2E-Framework-Overview.pptx
- GitHub commit + push (if token configured)

CONSTRAINTS
- Do not modify utils/DashboardReporter.ts without reading dashboard-spec.md first.
- Do not commit auth/session.json or .env under any circumstances.
- The PowerPoint is generated by generate-ppt.js (plain Node) — do not convert it to TypeScript.

═══════════════════════════════════════════════════════════════
ENVIRONMENT VARIABLES
═══════════════════════════════════════════════════════════════

SF_SANDBOX_URL              Full Salesforce Sandbox URL
SF_USERNAME / SF_PASSWORD   Login credentials
GITHUB_TOKEN                GitHub personal access token (Agent 7, optional)
GITHUB_REPO                 Target repository (e.g., org/repo)
GITHUB_BRANCH               Branch to push to

AI features (test generation, self-healing) use the Claude Code CLI (claude -p).
No ANTHROPIC_API_KEY is required — the active Claude Code session is used.
Ensure `claude` is available in PATH before running the pipeline.

═══════════════════════════════════════════════════════════════
PORTING THIS FRAMEWORK TO A NEW APP
═══════════════════════════════════════════════════════════════

Only 3 files need editing to target a different application:

1. prompts/framework-config.json  ← ALWAYS update first
   - appName, dashboardTitle, dashboardSubtitle
   - objects array: key, prefix, displayName, icon, accent, specFile, scenarioFile

2. prompts/MasterPrompt.md (this file)  ← Replace the 5 Salesforce-specific sections:
   SECTION               SALESFORCE VERSION              REPLACE WITH
   ──────────────────────────────────────────────────────────────────────
   Timing & Waiting      networkidle never works         App's loading indicators / spinner selectors
   Modal / Dialog        auraError overlay pattern       App's dialog selectors and error overlay
   Locator strategy      LWC shadow DOM, slds-* classes  App's DOM structure and CSS framework
   Authentication        storageState / session.json     App's auth (OAuth, cookie, API key)
   Native locators       lightning-* component patterns  App's form component patterns (or remove)
   Knowledge base        agentforce-rm/ domain files     App's domain knowledge files (or remove Agent 1)

3. .env  ← Update credentials and base URL for the new app.

WHAT YOU DO NOT NEED TO CHANGE:
   utils/DashboardReporter.ts    — reads config, fully generic
   utils/PipelineTracker.ts      — fully generic
   scripts/run-pipeline.ts       — reads config, fully generic
   scripts/generate-tests.ts     — reads config, bootstrap mode creates spec files from scratch
   prompts/user-stories/         — drop new .md files, pipeline picks them up automatically

BOOTSTRAP FLOW FOR A BRAND NEW PROJECT:
   1. Edit framework-config.json with your app's objects/modules
   2. Rewrite this MasterPrompt with your app's ground rules and agent definitions
   3. Update .env with new credentials
   4. Drop user story .md files into prompts/user-stories/
   5. Run: npm run pipeline
      → Agent 1 loads knowledge → Agent 2 reads stories → Agents 3-7 execute in sequence
