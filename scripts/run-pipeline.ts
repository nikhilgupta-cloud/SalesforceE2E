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

// ─────────────────────────────────────────────
// STEP -1 — Jira Sync
// ─────────────────────────────────────────────
async function stepJira() {
  if (!process.env.JIRA_BASE_URL) {
    log('STEP -1 — Jira sync skipped');
    return;
  }

  log('STEP -1 — Fetching user stories...');
  try {
    await fetchJiraStories();
    log('STEP -1 — Done ✅');
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
// STEP 1 — Agent 1 + Agent 2/4
// ─────────────────────────────────────────────
async function stepGenerate() {
  PipelineTracker.start(1, 'Generating tests...');
  log('STEP 1 — Agent 1 (Knowledge) + Agent 2/4 (Generation)');

  log('Pre-step — Loading domain knowledge (Agent 1)');

  const result = await generateTestsFromUserStories();

  if (result.failed > 0 && result.added === 0) {
    PipelineTracker.fail(1, 'Test generation failed');
    throw new Error('Generation failed');
  }

  PipelineTracker.complete(1, 'Tests generated');
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

  const executionOrder = ['account', 'contact', 'opportunity', 'quote'];

  const specFiles = executionOrder
    .map(key => {
      const obj = loadConfig().objects.find(o => o.key === key);
      return obj ? `tests/${obj.specFile}` : null;
    })
    .filter(Boolean) as string[];

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
// MAIN
// ─────────────────────────────────────────────
async function main() {
  log('════════ QA PIPELINE START ════════');

  PipelineTracker.init();
  refreshDashboard();

  try {
    await stepJira();

    await stepScrape();
    refreshDashboard();          // show step 0 result (completed / skipped)

    await stepGenerate();
    refreshDashboard();          // show step 1 result

    stepScenarios();
    refreshDashboard();          // show step 2 result

    await stepPlan();
    refreshDashboard();          // show step 3 result

    initDashboardForRun();       // pre-populate test tiles as pending

    const passed = stepExecution();
    patchPipelineSteps();        // patch step 4 status without clobbering test tiles

    await stepHeal(passed);
    patchPipelineSteps();        // patch step 5

    stepReport();
    stepGit();

    log('════════ QA PIPELINE COMPLETE ════════');
  } catch (e: any) {
    console.error('FATAL:', e.message);
    process.exit(1);
  } finally {
    patchPipelineSteps();        // always settle the final state
  }
}

main();