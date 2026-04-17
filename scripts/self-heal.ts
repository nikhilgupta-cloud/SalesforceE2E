/**
 * self-heal.ts — AI-powered test failure healer
 *
 * For each failed test found in reports/results.json:
 *   1. Extract the failing test block from the spec file
 *   2. Call Claude Code CLI with the error details + test code
 *   3. Apply the suggested fix
 *   4. Re-run that single test to verify the fix
 *   5. Keep the fix if it passes; revert and retry up to MAX_ROUNDS times
 *
 * AI backend: Claude Code CLI (claude -p) — no ANTHROPIC_API_KEY required.
 *
 * Called automatically from run-pipeline.ts step 4.
 */
import * as fs   from 'fs';
import * as os   from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';

// ── Claude Code CLI helper ────────────────────────────────────────────────────

/**
 * Call Claude Code CLI in non-interactive print mode.
 * System prompt goes to a temp file; user prompt piped via stdin.
 *
 * Windows fix: call `node cli.js` directly instead of claude.cmd because
 * cmd.exe /d /s /c (used by shell:true) does not forward piped stdin to
 * .cmd children reliably, causing ETIMEDOUT. Spawning node directly with
 * shell:false keeps stdin flowing correctly.
 *
 * VS Code fix: strip CLAUDE_CODE_* / VSCODE_* / ELECTRON_RUN_AS_NODE env
 * vars so the child process does not attempt to connect back to the IDE host.
 */
interface ClaudeResult { text: string; tokensIn: number; tokensOut: number }

let _totalTokensIn  = 0;
let _totalTokensOut = 0;

function callClaudeCode(systemPrompt: string, userPrompt: string): ClaudeResult | null {
  const sysFile = path.join(os.tmpdir(), `sf-heal-sys-${Date.now()}.txt`);

  const isWin = process.platform === 'win32';
  const claudeArgs: string[] = isWin
    ? [path.join(os.homedir(), 'AppData', 'Roaming', 'npm',
        'node_modules', '@anthropic-ai', 'claude-code', 'cli.js')]
    : [];
  const claudeExe = isWin ? 'node' : 'claude';

  try {
    fs.writeFileSync(sysFile, systemPrompt, 'utf8');

    const childEnv = { ...process.env };
    for (const key of Object.keys(childEnv)) {
      if (
        key.startsWith('CLAUDE') ||
        key.startsWith('VSCODE_') ||
        key === 'ELECTRON_RUN_AS_NODE'
      ) {
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
        timeout:   300000,         // 5 min — healing with knowledge base can be slow
        maxBuffer: 10 * 1024 * 1024,
        env:       childEnv,
      },
    );

    if (result.status !== 0 || !result.stdout?.trim()) {
      console.error(`[heal] ⚠ Claude CLI failed — status: ${result.status}, stderr: ${result.stderr?.trim()?.slice(0, 400) || '(empty)'}`);
      if (result.error) console.error('[heal] ⚠ spawn error:', result.error.message);
      return null;
    }

    // Parse JSON output from --output-format json to extract text + token usage
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

// ── Knowledge base — load domain context for healing ─────────────────────────
const KNOWLEDGE_DIR = path.join('knowledge', 'agentforce-rm');

const OBJECT_KNOWLEDGE_MAP: Record<string, string[]> = {
  account:     ['foundations-and-coexistence.md'],
  contact:     ['foundations-and-coexistence.md'],
  opportunity: ['quote-lifecycle.md'],
  quote:       ['quote-lifecycle.md', 'pricing.md', 'approvals.md'],
  product:     ['product-modeling.md', 'pricing.md'],
  contract:    ['contract-lifecycle.md', 'amendments.md'],
  order:       ['order-management.md'],
  asset:       ['contract-lifecycle.md', 'order-management.md'],
};

function loadHealingKnowledge(specFileName: string): string {
  // Derive object key from spec file name (e.g. "quote.spec.ts" → "quote")
  const objKey = specFileName.replace('.spec.ts', '').toLowerCase();
  const files  = OBJECT_KNOWLEDGE_MAP[objKey] ?? [];
  if (files.length === 0) return '';

  const sections: string[] = [];
  for (const file of files) {
    const filePath = path.join(KNOWLEDGE_DIR, file);
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath, 'utf8');
    sections.push(`\n\n--- DOMAIN KNOWLEDGE: ${file} ---\n${content.slice(0, 2500)}`);
  }
  return sections.join('');
}

const MAX_ROUNDS = 3;

// ── Types ─────────────────────────────────────────────────────────────────────

interface FailedTest {
  title:  string;   // e.g. "TC-QTE-038 — Primary Quote checkbox available on Quote form"
  file:   string;   // e.g. "quote.spec.ts"
  line:   number;
  errors: string[];
  stdout: string[];
}

export interface HealResult {
  healed:     string[];   // tests that were fixed and now pass
  failed:     string[];   // tests where healing was attempted but still fails
  skipped:    string[];   // tests skipped (could not extract block or find file)
  tokensIn?:  number;     // Total Claude input tokens consumed
  tokensOut?: number;     // Total Claude output tokens generated
}

// ── Main entry point ──────────────────────────────────────────────────────────

export async function selfHeal(): Promise<HealResult> {
  // Reset token accumulators for this run
  _totalTokensIn  = 0;
  _totalTokensOut = 0;

  const resultsFile = path.join('reports', 'results.json');
  if (!fs.existsSync(resultsFile)) {
    return { healed: [], failed: [], skipped: [] };
  }

  const raw      = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
  const failures = collectFailures(raw);

  if (failures.length === 0) {
    return { healed: [], failed: [], skipped: [] };
  }

  const result: HealResult = { healed: [], failed: [], skipped: [] };

  for (const failure of failures) {
    console.log(`\n   🔧 Healing: ${failure.title}`);
    const ok = await healTest(failure);
    if (ok) {
      result.healed.push(failure.title);
    } else {
      result.failed.push(failure.title);
    }
  }

  result.tokensIn  = _totalTokensIn;
  result.tokensOut = _totalTokensOut;
  return result;
}

// ── Collect failures from results.json ───────────────────────────────────────

function collectFailures(raw: any): FailedTest[] {
  const failures: FailedTest[] = [];

  function walk(suite: any) {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        const failedResult = test.results?.find((r: any) => r.status === 'failed');
        if (failedResult) {
          failures.push({
            title:  spec.title,
            file:   spec.file,
            line:   spec.line,
            errors: (failedResult.errors ?? []).map((e: any) =>
              typeof e === 'string' ? e : (e.message ?? JSON.stringify(e))
            ),
            stdout: (failedResult.stdout ?? []).map((s: any) =>
              typeof s === 'string' ? s : (s.text ?? '')
            ),
          });
        }
      }
    }
    for (const child of suite.suites ?? []) walk(child);
  }

  (raw.suites ?? []).forEach(walk);
  return failures;
}

// ── Heal a single failing test ────────────────────────────────────────────────

async function healTest(failure: FailedTest): Promise<boolean> {
  const specPath = path.join('tests', failure.file);
  if (!fs.existsSync(specPath)) {
    console.log(`      ⚠ Spec file not found: ${specPath}`);
    return false;
  }

  const originalContent = fs.readFileSync(specPath, 'utf8');
  const testBlock = extractTestBlock(originalContent, failure.title);
  if (!testBlock) {
    console.log(`      ⚠ Could not locate test block in ${failure.file} for: ${failure.title}`);
    return false;
  }

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    console.log(`      → Round ${round}/${MAX_ROUNDS}`);

    const fixedBlock = askClaude(failure, testBlock);
    if (!fixedBlock || fixedBlock.trim() === testBlock.trim()) {
      console.log(`      ⚠ No change suggested in round ${round}`);
      continue;
    }

    // Apply the fix
    const newContent = originalContent.replace(testBlock, fixedBlock);
    if (newContent === originalContent) {
      console.log(`      ⚠ Fix could not be applied (pattern not matched in round ${round})`);
      continue;
    }

    fs.writeFileSync(specPath, newContent, 'utf8');
    console.log(`      ✏ Fix applied — re-running test…`);

    // Re-run only this test using its TC-ID as the grep pattern
    const tcId = failure.title.match(/^(TC-[A-Z]+-\d+)/)?.[1] ?? failure.title;
    const runResult = spawnSync(
      'npx',
      ['playwright', 'test', `tests/${failure.file}`, '--grep', tcId, '--headed'],
      { stdio: 'inherit', shell: true },
    );

    if (runResult.status === 0) {
      console.log(`      ✅ Healed in round ${round}: ${failure.title}`);
      return true;
    }

    // Fix did not make the test pass — revert before trying the next round
    fs.writeFileSync(specPath, originalContent, 'utf8');
    console.log(`      ❌ Round ${round} fix did not pass — reverting`);
  }

  // All rounds exhausted without a passing fix
  console.log(`      ✗ Could not heal after ${MAX_ROUNDS} rounds: ${failure.title}`);
  return false;
}

// ── Extract the test(...) block from spec file content ────────────────────────
//
// Finds `<indent>test('<title>', ...)` then returns everything up to and
// including the first `\n<indent>});` after it.
// Works because the closing `});` at the same indent level is unique per test.

function extractTestBlock(content: string, title: string): string | null {
  const escaped  = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern  = new RegExp(`([ \\t]*)test\\((['"\`])${escaped}\\2`);
  const match    = content.match(pattern);
  if (!match) return null;

  const indent   = match[1];                      // e.g. "  " (2 spaces)
  const startIdx = content.indexOf(match[0]);

  // The test block closes at the first `\n<indent>});` after the opening line
  const closingMarker = `\n${indent}});`;
  const closeIdx = content.indexOf(closingMarker, startIdx);
  if (closeIdx === -1) return null;

  return content.substring(startIdx, closeIdx + closingMarker.length);
}

// ── Ask Claude Code CLI for a fix ─────────────────────────────────────────────

function askClaude(
  failure:  FailedTest,
  testCode: string,
): string | null {
  const knowledgeContext = loadHealingKnowledge(failure.file);

  const errorText  = failure.errors.join('\n').substring(0, 1200);
  const stdoutText = failure.stdout.join('').substring(0, 600);

  const system = `You are a Salesforce Revenue Cloud QA automation engineer who writes concise, reliable Playwright TypeScript tests. Return only raw TypeScript code — never use markdown code fences, never add explanations.${knowledgeContext}`;

  const userPrompt = `A Salesforce E2E Playwright test is failing. Return ONLY the fixed TypeScript test function — no markdown fences, no explanation, no extra text.

## Failing Test: ${failure.title}

### Error
\`\`\`
${errorText}
\`\`\`

### Console output during the test run
\`\`\`
${stdoutText}
\`\`\`

### Current test code
\`\`\`typescript
${testCode}
\`\`\`

## Fix rules
- Keep the same TC-ID and the exact test name string
- Make the MINIMAL change that fixes the root cause
- NEVER use waitForLoadState('networkidle') — Salesforce never goes idle
- ALWAYS use .waitFor({ state: 'visible', timeout: 30000 }) for element waits
- Modal selector: '[role="dialog"]:not([id="auraError"]):not([aria-hidden="true"])'
- Call dismissAuraError(page) after every page.goto()
- Use native Playwright locators (lightning-input, lightning-combobox, lightning-lookup) — do not use SalesforceFormHandler
- For lookup-not-found errors: add \`await page.waitForTimeout(3000)\` immediately before the failing lookup — Salesforce's search index can lag after data is created
- For timing failures: increase timeout on the relevant waitFor or add an explicit wait before the failing step
- Return the COMPLETE fixed test function from \`test(\` through the closing \`});\``;

  try {
    const result = callClaudeCode(system, userPrompt);
    if (!result) return null;
    _totalTokensIn  += result.tokensIn;
    _totalTokensOut += result.tokensOut;

    // Strip accidental markdown fences if the model added them anyway
    return result.text
      .replace(/^```typescript\n?/, '')
      .replace(/^```\n?/, '')
      .replace(/\n?```$/, '')
      .trim();

  } catch (e: any) {
    console.log(`      ⚠ Claude CLI error: ${e.message}`);
    return null;
  }
}
