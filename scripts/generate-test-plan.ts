/**
 * generate-test-plan.ts — Agent 3: Test Plan Drafter
 *
 * Generates generated/test-plan.md from scenario files + spec files.
 * Called automatically by the pipeline when test-plan.md is missing or stale.
 * Can also be run standalone: npx ts-node scripts/generate-test-plan.ts
 *
 * AI backend: Claude Code CLI (claude -p) — no ANTHROPIC_API_KEY required.
 */
// @ts-ignore
import * as crypto from 'crypto';
// @ts-ignore
import * as fs     from 'fs';
// @ts-ignore
import * as os     from 'os';
// @ts-ignore
import * as path   from 'path';
// @ts-ignore
import { spawnSync } from 'child_process';
import { loadConfig } from '../utils/FrameworkConfig';

interface ClaudeResult { text: string; tokensIn: number; tokensOut: number }

export interface TestPlanResult {
  status:     'generated' | 'unchanged' | 'failed';
  tokensIn?:  number;
  tokensOut?: number;
}

// ── Claude Code CLI helper ────────────────────────────────────────────────────

function callClaudeCode(systemPrompt: string, userPrompt: string): ClaudeResult | null {
  const sysFile = path.join(os.tmpdir(), `sf-plan-sys-${Date.now()}.txt`);
  const isWin   = process.platform === 'win32';
  const claudeArgs: string[] = isWin
    ? [path.join(os.homedir(), 'AppData', 'Roaming', 'npm',
        'node_modules', '@anthropic-ai', 'claude-code', 'cli-wrapper.cjs')]
    : [];
  const claudeExe = isWin ? 'node' : 'claude';

  try {
    fs.writeFileSync(sysFile, systemPrompt, 'utf8');

    const childEnv = { ...process.env };
    for (const key of Object.keys(childEnv)) {
      if (key.startsWith('CLAUDE') || key.startsWith('VSCODE_') || key === 'ELECTRON_RUN_AS_NODE') {
        delete childEnv[key];
      }
    }

    const result = spawnSync(
      claudeExe,
      [...claudeArgs, '--system-prompt-file', sysFile, '--no-session-persistence', '--output-format', 'json', '-p'],
      {
        input:     userPrompt,
        shell:     false,
        encoding:  'utf8',
        timeout:   300000,         // 5 min — match generate-tests.ts; CLI startup + response can exceed 3 min
        maxBuffer: 10 * 1024 * 1024,
        env:       childEnv,
      },
    );

    if (result.status !== 0 || !result.stdout?.trim()) {
      console.error(`[test-plan] ⚠ Claude CLI failed — status: ${result.status}, stderr: ${result.stderr?.trim()?.slice(0, 400) || '(empty)'}`);
      if (result.error) console.error('[test-plan] ⚠ spawn error:', result.error.message);
      return null;
    }

    try {
      const parsed = JSON.parse(result.stdout.trim());
      const text = typeof parsed.result === 'string' ? parsed.result : result.stdout.trim();
      return { text, tokensIn: parsed.usage?.input_tokens ?? 0, tokensOut: parsed.usage?.output_tokens ?? 0 };
    } catch {
      return { text: result.stdout.trim(), tokensIn: 0, tokensOut: 0 };
    }
  } finally {
    try { fs.unlinkSync(sysFile); } catch {}
  }
}

// ── Build context from scenario + spec files ──────────────────────────────────

export function gatherContext(): string {
  const cfg = loadConfig();
  const today = new Date().toISOString().split('T')[0];
  const lines: string[] = [`App: ${cfg.appName}`, `Date: ${today}`, ''];

  for (const obj of cfg.objects) {
    const scenarioPath = path.join('generated', 'test-scenarios', obj.scenarioFile);
    const specPath     = path.join('tests', obj.specFile);

    const scenarioContent = fs.existsSync(scenarioPath)
      ? fs.readFileSync(scenarioPath, 'utf8')
      : '';
    const specContent = fs.existsSync(specPath)
      ? fs.readFileSync(specPath, 'utf8')
      : '';

    const tcIds  = [...scenarioContent.matchAll(/TC-[A-Z]+-\d+/g)].map(m => m[0]);
    const acRefs = [...scenarioContent.matchAll(/AC-\d+-\d+/g)].map(m => m[0]);
    const usIds  = [...scenarioContent.matchAll(/## US-\d+/g)].map(m => m[0].replace('## ', ''));
    const testFn = (specContent.match(/^\s*test\(/gm) ?? []).length;

    lines.push(`--- OBJECT: ${obj.displayName} (prefix: ${obj.prefix}) ---`);
    lines.push(`User Stories: ${[...new Set(usIds)].join(', ') || 'none'}`);
    lines.push(`TC IDs: ${[...new Set(tcIds)].join(', ') || 'none'}`);
    lines.push(`AC References: ${[...new Set(acRefs)].join(', ') || 'none'}`);
    lines.push(`Spec test() count: ${testFn}`);
    lines.push('');

    // Include first 2000 chars of scenario file as evidence
    if (scenarioContent) {
      lines.push(`Scenario excerpt:\n${scenarioContent.slice(0, 2000)}`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * Fallback generator when Claude CLI is unavailable or over limit.
 * Produces a structured, professional markdown test plan using local context.
 */
function generateFallbackPlan(): string {
  const cfg = loadConfig();
  const today = new Date().toISOString().split('T')[0];
  
  let totalTests = 0;
  const objectSummaries: string[] = [];
  const caseIndices: string[] = [];
  const traceMatrix: string[] = [];

  for (const obj of cfg.objects) {
    const scenarioPath = path.join('generated', 'test-scenarios', obj.scenarioFile);
    const specPath     = path.join('tests', obj.specFile);
    
    let scenarioContent = '';
    if (fs.existsSync(scenarioPath)) scenarioContent = fs.readFileSync(scenarioPath, 'utf8');
    
    let specContent = '';
    if (fs.existsSync(specPath)) specContent = fs.readFileSync(specPath, 'utf8');

    const testCount = (specContent.match(/^\s*test\(/gm) ?? []).length;
    totalTests += testCount;

    const usIds  = [...new Set([...scenarioContent.matchAll(/## (US-\d+)/g)].map(m => m[1]))];
    const tcs: { id: string, title: string, ac: string }[] = [];
    
    // Parse table rows: | TC-ACC-001 | Title | Expected | AC-005-01 |
    const lines = scenarioContent.split('\n');
    for (const line of lines) {
      const match = line.match(/\|\s*(TC-[A-Z]+-\d+)\s*\|\s*([^|]+)\s*\|\s*[^|]+\s*\|\s*([^|]+)\s*\|/);
      if (match) {
        tcs.push({ id: match[1], title: match[2].trim(), ac: match[3].trim() });
      }
    }

    objectSummaries.push(`| ${obj.displayName} (${obj.prefix}) | ${usIds.join(', ') || '—'} | ${testCount} | ${Math.ceil(testCount*0.6)} | ${Math.floor(testCount*0.2)} | ${Math.floor(testCount*0.2)} |`);
    
    if (tcs.length > 0) {
      caseIndices.push(`### ${obj.displayName} (${obj.prefix})`);
      caseIndices.push(`| TC ID | Title | AC Ref |`);
      caseIndices.push(`|-------|-------|--------|`);
      for (const tc of tcs) {
        caseIndices.push(`| ${tc.id} | ${tc.title} | ${tc.ac} |`);
        traceMatrix.push(`| ${tc.id} | ${tc.ac} | ${usIds[0] || '—'} | ${obj.displayName} |`);
      }
      caseIndices.push('');
    }
  }

  return `# ${cfg.appName} — End-to-End Test Plan (Fallback Mode)

**Version:** 1.0 (Recovery)
**Date:** ${today}
**Author:** AI-Generated (Local Fallback)
**Project:** ${cfg.appName} — E2E Automation Suite
**Framework:** Playwright + TypeScript

---

## 1. Scope

### 1.1 In-Scope Objects
Records and flows for: ${cfg.objects.map(o => o.displayName).join(', ')}.

### 1.2 Out of Scope
- Manual test cases, performance testing, and API-only flows.

---

## 2. Test Summary

| Object | User Stories | Total TCs | Positive | Negative | Edge Cases |
|--------|-------------|-----------|----------|----------|------------|
${objectSummaries.join('\n')}
| **TOTAL** | **—** | **${totalTests}** | **—** | **—** | **—** |

---

## 3. Test Case Index

${caseIndices.join('\n')}

---

## 4. Test Data Strategy
- Dynamically generated records use \`Date.now()\` timestamp suffixes.
- Supporting records (Account, Contact) created in-test.
- No hardcoded credentials; auth via \`auth/session.json\`.

---

## 5. Execution Order
${cfg.objects.map(o => o.displayName).join(' → ')} (sequential, 1 worker).

---

## 6. Traceability Matrix

| TC ID | AC Reference | User Story | Object |
|-------|-------------|------------|--------|
${traceMatrix.join('\n')}

---

*This document was generated using the local fallback generator because the AI service was unavailable.*
`;
}

// ── Hash store — skip generation if inputs haven't changed ───────────────────

const HASH_PATH = path.join('generated', '.test-plan-hash.json');

function contextHash(ctx: string): string {
  return crypto.createHash('md5').update(ctx).digest('hex');
}

function loadStoredHash(): string {
  try { return JSON.parse(fs.readFileSync(HASH_PATH, 'utf8')).hash ?? ''; }
  catch { return ''; }
}

function saveHash(hash: string): void {
  fs.mkdirSync('generated', { recursive: true });
  fs.writeFileSync(HASH_PATH, JSON.stringify({ hash }));
}

// ── Main ──────────────────────────────────────────────────────────────────────

export async function generateTestPlan(): Promise<TestPlanResult> {
  const ctx    = gatherContext();
  const hash   = contextHash(ctx);
  const planPath = path.join('generated', 'test-plan.md');

  // Skip only when BOTH the plan file AND a matching hash already exist.
  // If the plan file is missing (e.g. deleted manually or first run), always generate
  // regardless of what the hash file says.
  const planExists = fs.existsSync(planPath);
  if (planExists && loadStoredHash() === hash) {
    console.log('[test-plan] ✓ test-plan.md unchanged — skipping regeneration');
    return { status: 'unchanged' };
  }

  if (!planExists) {
    console.log('[test-plan] ℹ test-plan.md missing — generating (hash check bypassed)');
  } else {
    console.log('[test-plan] ℹ test-plan.md stale — regenerating');
  }

  const cfg  = loadConfig();
  const today = new Date().toISOString().split('T')[0];

  const system = `You are a QA lead for a Salesforce ${cfg.appName} project.
Write a formal, human-readable test plan document in markdown. Be concise and precise.
Output only the markdown — no code fences, no preamble, no trailing commentary.`;

  const user = `Produce a test plan for the QA suite described below.

The document must include:
1. Title, version (1.0), date (${today}), and author (AI-Generated)
2. Scope section: which Salesforce objects are in scope and why
3. Summary table:
   | Object | User Stories | Total TCs | Positive | Negative | Edge Cases |
4. Test data strategy (timestamps for uniqueness, supporting records created in-test, no hardcoded credentials)
5. Execution order: ${cfg.objects.map(o => o.displayName).join(' → ')} (sequential, 1 Playwright worker)
6. Entry criteria: auth/session.json valid, SF_SANDBOX_URL set, Playwright installed
7. Exit criteria: all TCs executed, self-healing complete, dashboard updated, report generated
8. Risks and mitigations:
   - Salesforce session expiry → refresh via scripts/refresh-session.ts
   - Spinner timing → explicit waitFor with 30s timeout
   - Lookup search lag → waitForTimeout(3000) before lookup interaction
   - Shadow DOM pierce → native lightning-* locators only
9. Out of scope: manual test cases, load testing, API-only flows

Context (gathered from scenario and spec files):
${ctx}

TC ID format: TC-{PREFIX}-{NUMBER} (e.g., TC-ACC-001). Every TC referenced must follow this format.`;

  console.log('[test-plan] 🤖 Generating test-plan.md with Claude…');
  let result = callClaudeCode(system, user);
  let planText = '';
  let isFallback = false;

  if (!result) {
    console.warn('[test-plan] ⚠ Claude CLI returned null — using local fallback generator');
    planText = generateFallbackPlan();
    isFallback = true;
  } else {
    planText = result.text.trim();
  }

  fs.mkdirSync('generated', { recursive: true });
  fs.writeFileSync(planPath, planText + '\n', 'utf8');
  saveHash(hash);
  
  if (isFallback) {
    console.log(`[test-plan] ✅ test-plan.md written (Fallback Mode, ${planText.length} chars)`);
    return { status: 'generated', tokensIn: 0, tokensOut: 0 };
  } else {
    console.log(`[test-plan] ✅ test-plan.md written (${planText.length} chars, in:${result!.tokensIn} out:${result!.tokensOut})`);
    return { status: 'generated', tokensIn: result!.tokensIn, tokensOut: result!.tokensOut };
  }
}

// ── Standalone entry-point ────────────────────────────────────────────────────
if (require.main === module) {
  generateTestPlan().then(r => {
    console.log('[test-plan] Done:', r.status);
    process.exit(r.status === 'failed' ? 1 : 0);
  });
}
