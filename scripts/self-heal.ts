/**
 * self-heal.ts — AI-powered test failure healer
 *
 * For each failed test found in reports/results.json:
 *   1. Extract the failing test block from the spec file
 *   2. Call Claude API with the error details + test code
 *   3. Apply the suggested fix
 *   4. Re-run that single test to verify the fix
 *   5. Keep the fix if it passes; revert and retry up to MAX_ROUNDS times
 *
 * Called automatically from run-pipeline.ts step 4 when ANTHROPIC_API_KEY is set.
 */
import Anthropic from '@anthropic-ai/sdk';
import * as fs   from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';

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
  healed:  string[];   // tests that were fixed and now pass
  failed:  string[];   // tests where healing was attempted but still fails
  skipped: string[];   // tests skipped (no API key or could not extract block)
}

// ── Main entry point ──────────────────────────────────────────────────────────

export async function selfHeal(): Promise<HealResult> {
  const resultsFile = path.join('reports', 'results.json');
  if (!fs.existsSync(resultsFile)) {
    return { healed: [], failed: [], skipped: [] };
  }

  const raw      = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
  const failures = collectFailures(raw);

  if (failures.length === 0) {
    return { healed: [], failed: [], skipped: [] };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.log('      ⚠ ANTHROPIC_API_KEY not set — skipping AI healing');
    return { healed: [], failed: [], skipped: failures.map(f => f.title) };
  }

  const client = new Anthropic({ apiKey });
  const result: HealResult = { healed: [], failed: [], skipped: [] };

  for (const failure of failures) {
    console.log(`\n   🔧 Healing: ${failure.title}`);
    const ok = await healTest(client, failure);
    if (ok) {
      result.healed.push(failure.title);
    } else {
      result.failed.push(failure.title);
    }
  }

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

async function healTest(client: Anthropic, failure: FailedTest): Promise<boolean> {
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

  const formHandlerSnippet = readFormHandlerSnippet();

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    console.log(`      → Round ${round}/${MAX_ROUNDS}`);

    const fixedBlock = await askClaude(client, failure, testBlock, formHandlerSnippet);
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

// ── Read the beginning of SalesforceFormHandler for Claude's context ──────────

function readFormHandlerSnippet(): string {
  const p = path.join('utils', 'SalesforceFormHandler.ts');
  if (!fs.existsSync(p)) return '';
  return fs.readFileSync(p, 'utf8').substring(0, 2500);
}

// ── Ask Claude API for a fix ──────────────────────────────────────────────────

async function askClaude(
  client:          Anthropic,
  failure:         FailedTest,
  testCode:        string,
  formHandlerCode: string,
): Promise<string | null> {

  const errorText  = failure.errors.join('\n').substring(0, 1200);
  const stdoutText = failure.stdout.join('').substring(0, 600);

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

### SalesforceFormHandler API (first 2500 chars — for reference)
\`\`\`typescript
${formHandlerCode}
\`\`\`

## Fix rules
- Keep the same TC-ID and the exact test name string
- Make the MINIMAL change that fixes the root cause
- NEVER use waitForLoadState('networkidle') — Salesforce never goes idle
- ALWAYS use .waitFor({ state: 'visible', timeout: 30000 }) for element waits
- Modal selector: '[role="dialog"]:not([id="auraError"]):not([aria-hidden="true"])'
- Call dismissAuraError(page) after every page.goto()
- For lookup-not-found errors: add \`await page.waitForTimeout(3000)\` immediately before the failing fillLookup call — Salesforce's search index can lag after data is created
- For timing failures: increase timeout on the relevant waitFor or add an explicit wait before the failing step
- For selector failures: try alternate locator strategies (see SalesforceFormHandler patterns)
- Return the COMPLETE fixed test function from \`test(\` through the closing \`});\``;

  try {
    const response = await client.messages.create({
      model:      'claude-opus-4-6',
      max_tokens: 4096,
      system:     'You are a Salesforce CPQ QA automation engineer who writes concise, reliable Playwright TypeScript tests. Return only raw TypeScript code — never use markdown code fences, never add explanations.',
      messages:   [{ role: 'user', content: userPrompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : null;
    if (!text) return null;

    // Strip accidental markdown fences if the model added them anyway
    return text
      .replace(/^```typescript\n?/, '')
      .replace(/^```\n?/, '')
      .replace(/\n?```$/, '')
      .trim();

  } catch (e: any) {
    console.log(`      ⚠ Claude API error: ${e.message}`);
    return null;
  }
}
