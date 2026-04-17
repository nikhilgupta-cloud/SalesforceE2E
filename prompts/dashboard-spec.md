# Dashboard Specification — QA Pipeline Live Dashboard

## Purpose

The dashboard is a **self-contained, server-free HTML file** (`reports/dashboard.html`) that displays real-time QA pipeline status. It works as a `file://` URL in any browser — no web server, no WebSockets, no JavaScript fetch calls.

Auto-refresh during a run is handled by a `<meta http-equiv="refresh" content="3">` tag embedded in the HTML. The tag is removed once all pipeline steps have settled (completed, failed, or skipped), so the browser stops refreshing on its own.

---

## Architecture

Two utilities collaborate to produce the dashboard:

### `utils/PipelineTracker.ts`
- Single source of truth for pipeline state
- Persists state to `reports/pipeline-state.json` (JSON — survives process restarts)
- API: `init()`, `start(n, msg)`, `complete(n, msg)`, `fail(n, msg)`, `skip(n, msg)`
- Steps are 0-indexed, **8 steps total (0–7)**: Step 0 = Scrape Locators, Step 1 = AI Test Generation, Step 2 = Verify Scenarios, Step 3 = Draft Test Plan, Step 4 = Execute E2E Tests, Step 5 = Self-Heal Failures, Step 6 = Generate Final Scripts, Step 7 = Push to GitHub
- Status badge in dashboard header is driven by **step n=4 (Execute E2E Tests)** — not by the plan step

### `utils/DashboardReporter.ts`
- A **Playwright custom reporter** (implements `Reporter` interface from `@playwright/test/reporter`)
- Also exports standalone functions used by `scripts/run-pipeline.ts`:
  - `refreshDashboard()` — full re-render of `dashboard.html` from current pipeline state
  - `initDashboardForRun()` — re-render with test tiles pre-populated as pending (called before Step 3)
  - `patchPipelineSteps()` — surgical in-place update of just the pipeline bar in the existing HTML

### Config integration
- `DashboardReporter` reads `prompts/framework-config.json` via `utils/FrameworkConfig.ts`
- Dashboard title, subtitle, and all suite cards are driven by the config — nothing is hardcoded
- `SUITE_META` is built from `getSuiteMeta()`: maps object key → `{ displayName, icon, accent }`

---

## Data Flow

```
pipeline run starts
  │
  ├─ run-pipeline.ts: PipelineTracker.init()
  ├─ run-pipeline.ts: refreshDashboard()           ← full render, all steps = pending
  │
  ├─ Step 0 (AI Generation)
  │   PipelineTracker.start(0) / .complete(0) / .fail(0)
  │   run-pipeline.ts: refreshDashboard()           ← step 0 result visible
  │
  ├─ Steps 1 & 2 (verify files)
  │   PipelineTracker.start/complete/fail
  │   run-pipeline.ts: refreshDashboard()           ← after each step
  │
  ├─ initDashboardForRun()                          ← renders test tiles as pending
  │
  ├─ Step 3 — Playwright runs (DashboardReporter is active as a Playwright reporter)
  │   onBegin()      → PipelineTracker.start(3), render()
  │   onTestBegin()  → add "started" tile + feed entry, render()
  │   onTestEnd()    → update tile (pass/fail), ring chart, feed entry, render()
  │   onEnd()        → PipelineTracker.complete/fail(3), render()
  │                    NOTE: does NOT remove meta refresh tag here
  │
  ├─ Steps 4, 5, 6 (heal / archive / push)
  │   PipelineTracker.start/complete/fail
  │   run-pipeline.ts: patchPipelineSteps()         ← patches pipeline bar only
  │
  └─ finally: patchPipelineSteps()
      └─ if all steps settled → removes <meta refresh> tag
         browser stops auto-refreshing
```

---

## Key Features

### 1. Pipeline Bar (8 steps)
- Steps 0–7, each with status badge: `pending` / `running` / `completed` / `failed` / `skipped`
- Labels and step count driven by `PipelineTracker.STEP_DEFAULTS` array
- Updated by both `refreshDashboard()` (full render) and `patchPipelineSteps()` (surgical patch)

### 2. Suite Cards
- One card per object in `framework-config.json`
- Each card shows: icon, display name, accent colour, ring chart (pass/fail/pending ratio), and test tile grid
- Ring chart is an SVG circle with `stroke-dasharray` calculated from pass percentage

### 3. Test Tiles
- One tile per `test()` block discovered by Playwright
- States: `pending` (grey), `running` (blue pulse), `passed` (green), `failed` (red)
- Clicking a tile does nothing (display only) — tiles are identified by sanitised test title

### 4. Activity Feed
- Chronological list of events: pipeline step changes, test start, test pass/fail
- Feed item types and colours (CSS classes on `.feed-item`):
  - `fi-pass`  — green (test passed)
  - `fi-fail`  — red (test failed / pipeline step failed)
  - `fi-run`   — grey/muted (test started — intentionally subdued)
  - `fi-start` — white/text (run started event)
  - `fi-done`  — white/text (run completed event)
  - `info`     — muted (general info messages)
- Feed is capped to the most recent 40 entries to keep HTML size manageable

### 5. Summary Bar
- Total / Passed / Failed / Skipped counts
- Duration (HH:MM:SS) from run start
- Status badge: `RUNNING` / `ALL PASSED` / `FAILURES` / `ABORTED`

---

## Auto-Refresh Lifecycle

| Phase | Meta Refresh Tag | Who Controls |
|---|---|---|
| Before run starts | absent | n/a |
| Run initialised (`refreshDashboard`) | present | `refreshDashboard()` always injects it |
| During Playwright execution | present | `render()` always injects it |
| After steps 4/5/6 settle | removed | `patchPipelineSteps()` removes when all steps settled |
| If pipeline is killed (SIGTERM) | may remain | user must manually close browser tab or edit HTML |

**Rule:** `render()` and `refreshDashboard()` always write the tag. Only `patchPipelineSteps()` may remove it, and only once all 7 steps are in a terminal state.

---

## Constraints

- Must work as `file://` URL — no fetch, no WebSockets, no `<script src="...">` from CDN
- All CSS and JS is inlined in the single HTML file
- No build step — the HTML is generated at runtime by TypeScript string templates
- Do not use `document.write()` or dynamic imports in the embedded JS
- The auto-refresh tag must be in `<head>` for browsers to honour it

---

## File Locations

| File | Purpose |
|---|---|
| `reports/dashboard.html` | The live dashboard — open this in a browser |
| `reports/pipeline-state.json` | Persisted pipeline step state (JSON) |
| `reports/results.json` | Playwright JSON test results (written by `json` reporter) |
| `utils/DashboardReporter.ts` | Reporter + render engine |
| `utils/PipelineTracker.ts` | Pipeline step state manager |
| `prompts/framework-config.json` | App identity + object list (drives titles and suite cards) |

---

## Extending the Dashboard

### Add a new pipeline step
1. Add the step to `PipelineTracker.STEPS` array (keep 0-indexed, label and icon)
2. Call `PipelineTracker.start(n)` / `complete(n)` / `fail(n)` at the right point in `run-pipeline.ts`
3. Call `patchPipelineSteps()` after the step completes

### Add a new suite / object
1. Add the object to `prompts/framework-config.json` (key, prefix, displayName, icon, accent, specFile, scenarioFile)
2. Create the spec file in `tests/` and scenario file in `generated/test-scenarios/`
3. Dashboard picks it up automatically — no code changes needed

### Change dashboard colours or layout
- All styles are in the `<style>` block inside `DashboardReporter.ts` → `render()` function
- CSS variables at `:root` control the colour palette — update those first before touching individual rules
- The ring chart SVG parameters are in the `suiteCard()` helper function

### Port to a new app
- Update `prompts/framework-config.json` with new `appName`, `dashboardTitle`, `dashboardSubtitle`, and `objects`
- The dashboard will reflect the new app name and object suite cards automatically
- No changes needed to `DashboardReporter.ts` or `PipelineTracker.ts`
