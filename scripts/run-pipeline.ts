/**
 * run-pipeline.ts — FINAL QA Pipeline Orchestrator (Agent-Aligned)
 *
 * Usage:
 *   npx ts-node scripts/run-pipeline.ts
 *
 * PIPELINE FLOW (Agent-Aligned)
 * ─────────────────────────────────────────────
 * Pre-Step   → Jira Sync (optional)
 * Step 0     → Locator Scraping (CDP)
 * Step 1     → Agent 1 (Knowledge Load) + Agent 2/4 (Test Generation)
 * Step 2     → Scenario Validation
 * Step 3     → Agent 3 (Test Plan)
 * Step 4     → Agent 5 (Execution)
 * Step 5     → Agent 6 (Self-Healing)
 * Step 6     → Reporting + Export
 * Step 7     → Git Push
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync, spawnSync } from 'child_process';
import * as dotenv from 'dotenv';
dotenv.config();

import { PipelineTracker } from '../utils/PipelineTracker';
import {
  refreshDashboard,
  initDashboardForRun,
  patchPipelineSteps,
  patchHealedTests
} from '../utils/DashboardReporter';

import { generateTestsFromUserStories } from './generate-tests';
import { generateTestPlan } from './generate-test-plan';
import { fetchJiraStories } from './fetch-jira-stories';
import type { JiraStoryEntry } from './fetch-jira-stories';
import { selfHeal } from './self-heal';
import { scrapeLocators } from './scrape-locators';
import { exportToCsv } from './export-to-csv';
import { auditOrphans } from './audit-orphans';
import { loadConfig } from '../utils/FrameworkConfig';

// ─────────────────────────────────────────────
// Logger
// ─────────────────────────────────────────────
function log(msg: string) {
  const t = new Date().toLocaleTimeString('en-GB');
  console.log(`\n[pipeline ${t}] ${msg}`);
}

// Stories fetched from Jira — passed directly to stepGenerate to skip file I/O
let _jiraStories: JiraStoryEntry[] = [];

// ─────────────────────────────────────────────
// STEP -1 — Jira Sync
// ─────────────────────────────────────────────
async function stepJira() {
  if (!process.env.JIRA_BASE_URL) {
    log('STEP -1 — Jira sync skipped');
    return;
  }

  log('STEP -1 — Fetching user stories from Jira...');
  try {
    const result = await fetchJiraStories();
    _jiraStories = result.stories;
    log(`STEP -1 — Done ✅ (${result.fetched} issue(s), ${_jiraStories.length} story entries)`);
  } catch (e: any) {
    log(`STEP -1 — Failed ⚠ ${e.message}`);
  }
}

// ─────────────────────────────────────────────
// STEP 0 — Locator Scraping
// ─────────────────────────────────────────────
async function stepScrape() {
  PipelineTracker.start(0, 'Scraping locators...');
  log('STEP 0 — Locator Scraper');

  try {
    const res = await scrapeLocators();
    if (res.skipped) {
      PipelineTracker.skip(0, res.reason);
    } else {
      PipelineTracker.complete(0, 'Locators ready');
    }
  } catch (e: any) {
    PipelineTracker.skip(0, 'Using cached locators');
  }
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/**
 * Returns true if at least one spec file already contains generated test() calls.
 * Used to decide whether we can skip generation when stories are unchanged.
 */
function specFilesHaveTests(): boolean {
  const cfg = loadConfig();
  return cfg.objects.some(obj => {
    const specPath = path.join('tests', obj.specFile);
    if (!fs.existsSync(specPath)) return false;
    return /^\s*test\s*\(/m.test(fs.readFileSync(specPath, 'utf8'));
  });
}

// ─────────────────────────────────────────────
// STEP 1 — Agent 1 + Agent 2/4
// Returns true if generation was skipped (no changes), false if it ran.
// ─────────────────────────────────────────────
async function stepGenerate(): Promise<boolean> {
  PipelineTracker.start(1, 'Checking for story changes...');
  log('STEP 1 — Agent 1 (Knowledge) + Agent 2/4 (Generation)');

  // callClaudeCode now uses async spawn (non-blocking), so the event loop is
  // free during generation. Patch the dashboard every 3 s so the browser's
  // meta-refresh always picks up the live "running + elapsed time" state.
  const dashInterval = setInterval(() => patchPipelineSteps(), 3000);

  try {
    const result = await generateTestsFromUserStories(_jiraStories);

    // All stories unchanged AND tests already exist → skip AI steps, go straight to execution
    const allSkipped = result.added === 0 && result.updated === 0 && result.failed === 0 && result.skipped > 0;
    if (allSkipped && specFilesHaveTests()) {
      PipelineTracker.skip(1, `No changes — ${result.skipped} stories unchanged`);
      log(`STEP 1 — No story changes detected (${result.skipped} stories unchanged) → skipping to execution`);
      return true;   // caller will skip Steps 2 & 3
    }

    if (result.failed > 0 && result.added === 0 && result.updated === 0) {
      PipelineTracker.fail(1, 'Test generation failed');
      throw new Error('Generation failed');
    }

    const detail = `${result.added} new, ${result.updated} updated, ${result.skipped} unchanged`;
    PipelineTracker.complete(1, `Tests generated — ${detail}`);
    return false;
  } finally {
    clearInterval(dashInterval);
  }
}

// ─────────────────────────────────────────────
// STEP 2 — Scenario Validation
// ─────────────────────────────────────────────
function stepScenarios() {
  PipelineTracker.start(2, 'Validating scenarios...');
  log('STEP 2 — Scenario Validation');

  const dir = 'generated/test-scenarios';
  if (!fs.existsSync(dir)) {
    throw new Error('No scenarios found');
  }

  PipelineTracker.complete(2, 'Scenarios validated');
}

// ─────────────────────────────────────────────
// STEP 3 — Agent 3 (Test Plan)
// ─────────────────────────────────────────────
async function stepPlan() {
  PipelineTracker.start(3, 'Generating test plan...');
  log('STEP 3 — Agent 3 (Test Plan)');

  const res = await generateTestPlan();

  if (res.status === 'failed') {
    throw new Error('Test plan failed');
  }

  PipelineTracker.complete(3, 'Test plan ready');
}

// ─────────────────────────────────────────────
// STEP 4 — Agent 5 (Execution)
// ─────────────────────────────────────────────
function stepExecution(): boolean {
  log('STEP 4 — Agent 5 (Execution)');

  const specFiles = loadConfig().objects
    .map(obj => `tests/${obj.specFile}`)
    .filter(file => fs.existsSync(file));

  const result = spawnSync(
    'npx',
    ['playwright', 'test', ...specFiles, '--headed'],
    { stdio: 'inherit', shell: true }
  );

  return result.status === 0;
}

// ─────────────────────────────────────────────
// STEP 5 — Agent 6 (Self-Healing)
// ─────────────────────────────────────────────
async function stepHeal(allPassed: boolean) {
  PipelineTracker.start(5, 'Self-healing...');
  log('STEP 5 — Agent 6 (Self-Healing, max 3 rounds)');

  if (allPassed) {
    PipelineTracker.complete(5, 'No failures');
    return;
  }

  const res = await selfHeal();

  if (res.healed.length > 0) {
    patchHealedTests(res.healed);
  }

  if (res.failed.length === 0) {
    PipelineTracker.complete(5, 'All healed');
  } else {
    PipelineTracker.fail(5, 'Some failures remain');
  }
}

// ─────────────────────────────────────────────
// STEP 6 — Reporting
// ─────────────────────────────────────────────
function stepReport() {
  log('STEP 6 — Reporting');

  try {
    exportToCsv();
    log('Reports generated ✅');
  } catch {
    log('Report generation failed ⚠');
  }
}

// ─────────────────────────────────────────────
// STEP 7 — Git Push
// ─────────────────────────────────────────────
function stepGit() {
  PipelineTracker.start(7, 'Git push...');
  log('STEP 7 — Git Push');

  try {
    execSync('git add .');
    execSync('git commit -m "QA Pipeline Run" --allow-empty');
    execSync('git push');

    PipelineTracker.complete(7, 'Pushed to GitHub');
  } catch (e: any) {
    PipelineTracker.fail(7, e.message);
    log('⚠ Git push failed — manual intervention required');
  }
}

// ─────────────────────────────────────────────
// PRE-STEP — Session Check & Refresh
// ─────────────────────────────────────────────
const SESSION_FILE = 'auth/session.json';
const SESSION_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

async function stepEnsureSession() {
  const exists = fs.existsSync(SESSION_FILE);
  const tooOld = exists
    ? Date.now() - fs.statSync(SESSION_FILE).mtimeMs > SESSION_MAX_AGE_MS
    : true;

  if (!exists || tooOld) {
    const reason = !exists ? 'session.json missing' : 'session older than 1 hour';
    log(`PRE-STEP — ${reason}. Refreshing Salesforce session...`);
    const result = spawnSync(
      'npx',
      ['ts-node', 'scripts/refresh-session.ts'],
      { stdio: 'inherit', shell: true }
    );
    if (result.status !== 0) {
      throw new Error('Session refresh failed — check SF credentials in .env and re-run');
    }
    log('PRE-STEP — Session refreshed ✅');
  } else {
    const ageMin = Math.round((Date.now() - fs.statSync(SESSION_FILE).mtimeMs) / 60000);
    log(`PRE-STEP — Session is valid (${ageMin}m old) — skipping refresh`);
  }
}

// ─────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────
async function main() {
  log('════════ QA PIPELINE START ════════');

  PipelineTracker.init();
  refreshDashboard();

  try {
    await stepEnsureSession();

    await stepJira();

    await stepScrape();
    refreshDashboard();          // show step 0 result (completed / skipped)

    const generationSkipped = await stepGenerate();
    refreshDashboard();          // show step 1 result (completed / skipped)

    if (!generationSkipped) {
      // Stories changed — validate scenarios and regenerate test plan
      stepScenarios();
      refreshDashboard();        // show step 2 result

      await stepPlan();
      refreshDashboard();        // show step 3 result
    } else {
      // Nothing changed — mark Steps 2 & 3 as skipped and go straight to execution
      PipelineTracker.skip(2, 'No story changes — skipped');
      PipelineTracker.skip(3, 'No story changes — skipped');
      refreshDashboard();
      log('STEP 2+3 — Skipped (no story changes)');
    }

    initDashboardForRun();       // pre-populate test tiles as pending

    const passed = stepExecution();
    patchPipelineSteps();        // patch step 4 status without clobbering test tiles

    await stepHeal(passed);
    patchPipelineSteps();        // patch step 5

    stepReport();
    stepGit();

    log('STEP 8 — Orphan Audit');
    auditOrphans();

    log('════════ QA PIPELINE COMPLETE ════════');
  } catch (e: any) {
    console.error('FATAL:', e.message);
    process.exit(1);
  } finally {
    patchPipelineSteps();        // always settle the final state
  }
}

main();