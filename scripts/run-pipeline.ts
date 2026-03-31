/**
 * run-pipeline.ts — Full QA Pipeline Orchestrator
 * Drives all 7 steps and keeps dashboard.html in sync throughout.
 *
 * Usage:  npx ts-node scripts/run-pipeline.ts
 *
 * Step 0 (AI Test Generation) calls Claude API to turn user stories into tests.
 * Step 3 (Execute Tests) is handled internally by DashboardReporter —
 * this script only needs to spawn Playwright; the reporter updates the tracker.
 */
import * as fs   from 'fs';
import * as path from 'path';
import { execSync, spawnSync } from 'child_process';
import * as dotenv from 'dotenv';
dotenv.config();

import { PipelineTracker } from '../utils/PipelineTracker';
import { refreshDashboard, initDashboardForRun, patchPipelineSteps, patchHealedTests } from '../utils/DashboardReporter';
import { generateTestsFromUserStories } from './generate-tests';
import { selfHeal } from './self-heal';
import { loadConfig } from '../utils/FrameworkConfig';

// ── tiny logger ───────────────────────────────────────────────────────────────
function log(msg: string) {
  const t = new Date().toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
  console.log(`\n[pipeline ${t}] ${msg}`);
}

// ── STEP 0 — AI Test Generation from User Stories ────────────────────────────
async function step0(): Promise<void> {
  PipelineTracker.start(0, 'Scanning prompts/user-stories/ for new stories…');
  log('STEP 0 — AI Test Generation');

  const result = await generateTestsFromUserStories();

  if (result.notice) {
    PipelineTracker.complete(0, result.notice);
    log(`STEP 0 — Skipped (${result.notice})`);
    return;
  }

  if (result.added === 0 && result.updated === 0 && result.skipped === 0) {
    PipelineTracker.complete(0, 'No user story files found');
    log('STEP 0 — Done (no story files in prompts/user-stories/)');
    return;
  }

  if (result.added === 0 && result.updated === 0) {
    PipelineTracker.complete(0, `All ${result.skipped} user stories unchanged — nothing to regenerate`);
    log('STEP 0 — Done (all stories up to date)');
    return;
  }

  const parts: string[] = [];
  if (result.added)   parts.push(`${result.added} new`);
  if (result.updated) parts.push(`${result.updated} updated`);
  if (result.skipped) parts.push(`${result.skipped} unchanged`);
  PipelineTracker.complete(0, `Tests generated — ${parts.join(' · ')}`);
  log(`STEP 0 — Done ✅ (${parts.join(', ')})`);
}

// ── STEP 1 — Verify test scenarios exist ──────────────────────────────────────
function step1(): void {
  PipelineTracker.start(1, 'Verifying test scenario files…');
  log('STEP 1 — Checking generated/test-scenarios/');

  const cfg     = loadConfig();
  const dir     = path.join('generated', 'test-scenarios');
  const missing = cfg.objects.filter(o => !fs.existsSync(path.join(dir, o.scenarioFile)));

  if (missing.length) {
    PipelineTracker.fail(1, `Missing: ${missing.map(o => o.scenarioFile).join(', ')}`);
    throw new Error(`STEP 1 failed — missing scenario files: ${missing.map(o => o.scenarioFile).join(', ')}`);
  }

  // Count scenarios dynamically
  const total = cfg.objects.reduce((sum, o) => {
    const content = fs.readFileSync(path.join(dir, o.scenarioFile), 'utf8');
    return sum + (content.match(/^\| TC-/gm) ?? []).length;
  }, 0);

  PipelineTracker.complete(1, `${total} scenarios confirmed across ${cfg.objects.map(o => o.displayName).join(' · ')}`);
  log('STEP 1 — Done ✅');
}

// ── STEP 2 — Verify test plan exists ─────────────────────────────────────────
function step2(): void {
  PipelineTracker.start(2, 'Verifying test plan…');
  log('STEP 2 — Checking generated/test-plan.md');

  const planFile = path.join('generated', 'test-plan.md');
  if (!fs.existsSync(planFile)) {
    PipelineTracker.fail(2, 'test-plan.md not found');
    throw new Error('STEP 2 failed — test-plan.md not found');
  }

  // Count tests + user stories dynamically from spec/scenario files
  const cfg2      = loadConfig();
  const testCount = cfg2.objects.reduce((n, o) => {
    const sp = path.join('tests', o.specFile);
    if (!fs.existsSync(sp)) return n;
    return n + (fs.readFileSync(sp, 'utf8').match(/^\s*test\(/gm) ?? []).length;
  }, 0);
  const usCount = cfg2.objects.reduce((n, o) => {
    const fp = path.join('generated', 'test-scenarios', o.scenarioFile);
    if (!fs.existsSync(fp)) return n;
    return n + (fs.readFileSync(fp, 'utf8').match(/^## US-/gm) ?? []).length;
  }, 0);

  PipelineTracker.complete(2, `Test plan confirmed — ${testCount} tests · ${usCount} user stories · ${cfg2.objects.length} objects`);
  log('STEP 2 — Done ✅');
}

// ── STEP 3 — Run Playwright (DashboardReporter updates tracker internally) ────
function step3(): boolean {
  log('STEP 3 — Launching Playwright in headed mode…');
  // NOTE: DashboardReporter.onBegin calls PipelineTracker.start(3)
  //       DashboardReporter.onEnd  calls PipelineTracker.complete/fail(3)
  //       Do NOT call PipelineTracker for step 3 here.
  const specFiles = loadConfig().objects
    .map(o => `tests/${o.specFile}`)           // forward slashes — Playwright requires them
    .filter(sp => fs.existsSync(sp));

  const result = spawnSync(
    'npx',
    ['playwright', 'test', ...specFiles, '--headed'],
    { stdio: 'inherit', shell: true },
  );
  const passed = result.status === 0;
  log(`STEP 3 — ${passed ? 'All tests passed ✅' : 'Some tests failed ⚠'}`);
  return passed;
}

// ── STEP 4 — Self-heal failures ──────────────────────────────────────────────
async function step4(allPassed: boolean): Promise<void> {
  PipelineTracker.start(4, allPassed ? 'No failures detected' : 'Analysing failures…');
  log('STEP 4 — Self-heal check');

  const resultsFile = path.join('reports', 'results.json');
  if (!fs.existsSync(resultsFile)) {
    PipelineTracker.complete(4, 'No results.json — nothing to heal');
    log('STEP 4 — No results file, skipped.');
    return;
  }

  // Collect initially-failed test titles
  const raw = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
  const initialFailed: string[] = [];

  function collect(suite: any) {
    for (const spec of suite.specs  ?? []) {
      for (const test of spec.tests ?? []) {
        if (test.results?.some((r: any) => r.status === 'failed')) {
          initialFailed.push(spec.title);
        }
      }
    }
    for (const child of suite.suites ?? []) collect(child);
  }
  (raw.suites ?? []).forEach(collect);

  if (initialFailed.length === 0) {
    PipelineTracker.complete(4, 'No failures — healing not required');
    log('STEP 4 — Done ✅ (nothing to heal)');
    return;
  }

  log(`STEP 4 — ${initialFailed.length} failure(s) detected — attempting AI healing…`);

  // Run AI healer
  const healResult = await selfHeal();
  const { healed, failed, skipped } = healResult;

  // Patch dashboard tiles for healed tests immediately
  if (healResult.healed.length > 0) patchHealedTests(healResult.healed);

  // Write healing report
  const today = new Date().toLocaleDateString('en-GB');
  const lines: string[] = [`# Healing Report — ${today}`, ''];

  if (healed.length > 0) {
    lines.push(`**Healed (${healed.length}):**`, ...healed.map(f => `- ✅ ${f}`), '');
  }
  if (failed.length > 0) {
    lines.push(`**Still failing (${failed.length}):**`, ...failed.map(f => `- ❌ ${f}`), '');
  }
  if (skipped.length > 0) {
    lines.push(`**Skipped — ANTHROPIC_API_KEY not set (${skipped.length}):**`, ...skipped.map(f => `- ⚠ ${f}`), '');
  }
  if (failed.length > 0 || skipped.length > 0) {
    lines.push(
      '**Next steps for remaining failures:**',
      '1. Classify each failure: selector_failure | timing_failure | data_failure | environment_failure',
      '2. For selector/timing: re-probe DOM, update SalesforceFormHandler or spec locator.',
      '3. Re-run: `npx playwright test --headed --grep "<TC-ID>"`',
      '4. Repeat up to 3 rounds before escalating.',
    );
  }

  fs.mkdirSync('reports', { recursive: true });
  fs.writeFileSync(path.join('reports', 'healing-report.md'), lines.join('\n'));

  const remaining = failed.length + skipped.length;
  if (remaining === 0) {
    PipelineTracker.complete(4, `All ${healed.length} failure(s) healed ✅`);
    log(`STEP 4 — Done ✅ (healed ${healed.length}/${initialFailed.length})`);
  } else if (healed.length > 0) {
    PipelineTracker.fail(4, `Healed ${healed.length} · ${remaining} remaining — see reports/healing-report.md`);
    log(`STEP 4 — Partial heal (${healed.length} fixed, ${remaining} remaining)`);
  } else {
    PipelineTracker.fail(4, `${initialFailed.length} failure(s) unhealed — see reports/healing-report.md`);
    log(`STEP 4 — ${initialFailed.length} failure(s) could not be healed`);
  }
}

// ── STEP 5 — Copy final scripts ───────────────────────────────────────────────
function step5(): void {
  PipelineTracker.start(5, 'Copying production scripts…');
  log('STEP 5 — Copying specs → generated/scripts/');

  const dest = path.join('generated', 'scripts');
  fs.mkdirSync(dest, { recursive: true });

  const cfg5   = loadConfig();
  let   copied = 0;
  for (const o of cfg5.objects) {
    const src = path.join('tests', o.specFile);
    if (fs.existsSync(src)) { fs.copyFileSync(src, path.join(dest, o.specFile)); copied++; }
  }

  PipelineTracker.complete(5, `${copied} production script${copied !== 1 ? 's' : ''} saved → generated/scripts/`);
  log('STEP 5 — Done ✅');
}

// ── STEP 6 — Git commit & push ────────────────────────────────────────────────
function step6(): void {
  PipelineTracker.start(6, 'Committing and pushing to GitHub…');
  log('STEP 6 — Git push');

  // Delete any lingering probe scripts
  try {
    fs.readdirSync('tests')
      .filter(f => f.startsWith('probe-'))
      .forEach(f => fs.unlinkSync(path.join('tests', f)));
  } catch {}

  // Build commit message from results
  let passed = 0, total = 0;
  try {
    const raw = JSON.parse(fs.readFileSync(path.join('reports', 'results.json'), 'utf8'));
    function count(suite: any) {
      for (const spec of suite.specs  ?? []) {
        for (const test of spec.tests ?? []) {
          total++;
          if (test.results?.some((r: any) => r.status === 'passed')) passed++;
        }
      }
      for (const child of suite.suites ?? []) count(child);
    }
    (raw.suites ?? []).forEach(count);
  } catch {}

  const date   = new Date().toISOString().split('T')[0];
  const msg    = `chore: QA run ${date} — ${passed}/${total} tests passing`;
  const branch = process.env.GITHUB_BRANCH ?? 'main';

  try {
    // Stage everything except secrets
    exec('git add generated/ reports/pipeline-state.json');
    // Stage optional report files — ignore errors if they don't exist
    for (const f of ['reports/results.json', 'reports/healing-report.md', 'reports/dashboard.html']) {
      if (fs.existsSync(f)) exec(`git add "${f}"`);
    }
    exec(`git commit -m "${msg}" --allow-empty`);
    exec(`git push origin ${branch}`);

    PipelineTracker.complete(6, `Pushed — "${msg}"`);
    log('STEP 6 — Done ✅');
  } catch (e: any) {
    const errMsg = e.message?.split('\n')[0] ?? String(e);
    PipelineTracker.fail(6, `Git error: ${errMsg}`);
    log(`STEP 6 — Failed: ${errMsg}`);
  }
}

function exec(cmd: string) {
  execSync(cmd, { stdio: 'inherit' });
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
  log('═══════════════════════════════════════');
  log('  QA Pipeline Starting — 7 Steps');
  log('═══════════════════════════════════════');

  PipelineTracker.init();   // Reset dashboard to all-pending with today's date
  refreshDashboard();        // Write fresh HTML immediately so browser sees the reset

  try {
    await step0();             // AI: generate tests from new user stories
    refreshDashboard();        // Step 0 result → HTML
    step1();                   // Verify scenario files exist
    refreshDashboard();        // Step 1 result → HTML
    step2();                   // Verify test plan
    initDashboardForRun();     // Step 2 result → HTML with test tiles pre-populated as pending
    const allPassed = step3();        // Run Playwright (DashboardReporter drives Step 3)
    await step4(allPassed);           // Self-heal failures with AI
    patchPipelineSteps();      // Step 4 result → patch pipeline bar only
    step5();                   // Copy final scripts
    patchPipelineSteps();      // Step 5 result → patch pipeline bar only
    step6();                   // Push to GitHub
    patchPipelineSteps();      // Step 6 result → patch pipeline bar only

    log('═══════════════════════════════════════');
    log('  QA Pipeline Complete');
    log('═══════════════════════════════════════');
  } finally {
    // Always patch the dashboard on exit so it never stays "RUNNING" if interrupted
    patchPipelineSteps();
  }
}

main().catch(e => {
  console.error('\n[pipeline] FATAL:', e.message);
  process.exit(1);
});
