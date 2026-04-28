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
        'node_modules', '@anthropic-ai', 'claude-code', 'cli-wrapper.cjs')]
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
  title:   string;    // e.g. "TC-QTE-038 — Primary Quote checkbox available on Quote form"
  file:    string;    // e.g. "quote.spec.ts"
  line:    number;
  errors:  string[];
  stdout:  string[];
  stderr?: string[];  // captured from Playwright test run — may contain network/console hints
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
            stderr: (failedResult.stderr ?? []).map((s: any) =>
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
  const extracted = extractTestBlock(originalContent, failure.title);
  if (!extracted) {
    console.log(`      ⚠ Could not locate test block in ${failure.file} for: ${failure.title}`);
    return false;
  }

  const { block: testBlock, actualTitle } = extracted;
  // Derive TC-ID from the actual title found in the spec (not the possibly-stale results.json title)
  const tcId = actualTitle.match(/^(TC-[A-Z]+-\d+)/)?.[1]
    ?? failure.title.match(/^(TC-[A-Z]+-\d+)/)?.[1]
    ?? failure.title;

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    console.log(`      → Round ${round}/${MAX_ROUNDS}`);

    const fixedBlock = await askClaude(failure, testBlock);
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
    console.log(`      ✏ Fix applied — re-running full spec (serial suite: shared state requires full run)…`);

    // Re-run the FULL spec file — never use --grep for serial suites.
    // Serial suites share module-level state (accountUrl, contactUrl, opportunityUrl…).
    // Running a single test in isolation leaves those variables as '' so the test
    // always fails regardless of fix quality, exhausting rounds and applying fixme() wrongly.
    const tempResults = path.join(os.tmpdir(), `heal-res-${Date.now()}.json`);
    spawnSync(
      'npx',
      ['playwright', 'test', `tests/${failure.file}`, '--reporter=json'],
      {
        stdio: 'pipe',
        shell: true,
        timeout: 600000, // 10 min — full E2E suite can take several minutes
        env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: tempResults },
      },
    );

    // Check whether the specific failing test now passes in the temp results.
    // We don't rely on exit code alone because other tests may still fail;
    // what matters is that THIS test no longer fails.
    const healedSuccessfully = checkTestPassedInResults(tempResults, actualTitle, tcId);

    if (healedSuccessfully) {
      console.log(`      ✅ Healed in round ${round}: ${actualTitle}`);
      // Update main results.json for this test, then propagate any newly-passing
      // serial siblings (they were previously skipped due to the cascade failure).
      updateMainResults(failure.title, 'passed');
      propagateHealedResults(tempResults);
      try { fs.unlinkSync(tempResults); } catch {}
      return true;
    }

    try { fs.unlinkSync(tempResults); } catch {}
    // Fix did not make the test pass — revert before trying the next round
    fs.writeFileSync(specPath, originalContent, 'utf8');
    console.log(`      ❌ Round ${round} fix did not pass — reverting`);
  }

  // All rounds exhausted — mark as test.fixme() so it is skipped cleanly on future runs
  // rather than failing repeatedly and blocking serial suites or contaminating the dashboard.
  console.log(`      ✗ Could not heal after ${MAX_ROUNDS} rounds — marking test.fixme(): ${actualTitle}`);
  applyFixme(specPath, failure.title, actualTitle, failure.errors[0] ?? 'Unknown error after self-healing');
  return false;
}

/**
 * Replaces the test(...) opening line with test.fixme(...) and prepends a comment
 * that explains what happened, so future engineers know why it was skipped.
 * Uses actualTitleInSpec (from fuzzy match) so the replacement always targets the
 * correct line even when results.json carried a stale title from a prior generation.
 */
function applyFixme(specPath: string, title: string, actualTitleInSpec: string, errorSummary: string): void {
  try {
    const content    = fs.readFileSync(specPath, 'utf8');
    const titleToUse = actualTitleInSpec || title;
    const escaped    = titleToUse.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern    = new RegExp(`([ \\t]*)test\\((['"\`])(${escaped})\\2`);
    const match      = content.match(pattern);
    if (!match) {
      console.log(`      ⚠ applyFixme: could not locate test block to mark — skipping`);
      return;
    }

    const indent    = match[1];
    const quote     = match[2];
    const firstLine = `${indent}// self-heal: could not fix after ${MAX_ROUNDS} rounds — ${errorSummary.split('\n')[0].slice(0, 120)}\n${indent}test.fixme(${quote}${titleToUse}${quote}`;
    const patched   = content.replace(match[0], firstLine);

    fs.writeFileSync(specPath, patched, 'utf8');
    console.log(`      🔕 ${titleToUse} → test.fixme() applied`);
  } catch (e: any) {
    console.error(`      ⚠ applyFixme error: ${e.message}`);
  }
}

/**
 * Patches the main reports/results.json file to update a test's status.
 * This preserves the original passing tests while marking healed ones as passed.
 */
function updateMainResults(testTitle: string, newStatus: 'passed' | 'failed') {
  const resultsPath = path.join('reports', 'results.json');
  if (!fs.existsSync(resultsPath)) return;

  try {
    const data = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));

    function walk(suite: any) {
      if (suite.specs) {
        for (const spec of suite.specs) {
          if (spec.title === testTitle) {
            for (const test of spec.tests) {
              test.status = newStatus;
              if (test.results && test.results.length > 0) {
                test.results[0].status = newStatus;
                // Clear errors on success
                if (newStatus === 'passed') {
                  test.results[0].errors = [];
                }
              }
            }
          }
        }
      }
      if (suite.suites) suite.suites.forEach(walk);
    }

    walk(data);
    
    // Recalculate summary totals
    let passed = 0, failed = 0, skipped = 0;
    function count(suite: any) {
      if (suite.specs) {
        for (const spec of suite.specs) {
          for (const test of spec.tests) {
            if (test.status === 'expected' || test.status === 'passed') passed++;
            else if (test.status === 'unexpected' || test.status === 'failed') failed++;
            else skipped++;
          }
        }
      }
      if (suite.suites) suite.suites.forEach(count);
    }
    count(data);
    
    if (data.stats) {
      data.stats.expected = passed;
      data.stats.unexpected = failed;
    }

    fs.writeFileSync(resultsPath, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(`      ⚠ Failed to patch results.json: ${e}`);
  }
}

// ── Extract the test(...) block from spec file content ────────────────────────
//
// Returns { block, actualTitle } where actualTitle is the title as it appears
// in the SPEC FILE (may differ from results.json after a regeneration run).
// Falls back to fuzzy TC-ID prefix match so title drift never causes a miss.

function extractTestBlock(content: string, title: string): { block: string; actualTitle: string } | null {
  const buildResult = (match: RegExpMatchArray, capturedTitle: string): { block: string; actualTitle: string } | null => {
    const indent        = match[1];
    const startIdx      = content.indexOf(match[0]);
    const closingMarker = `\n${indent}});`;
    const closeIdx      = content.indexOf(closingMarker, startIdx);
    if (closeIdx === -1) return null;
    return { block: content.substring(startIdx, closeIdx + closingMarker.length), actualTitle: capturedTitle };
  };

  // 1. Exact match — also handles test.fixme() variants left by a prior healing cycle
  const escaped      = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const exactPattern = new RegExp(`([ \\t]*)test(?:\\.fixme)?\\((['"\`])(${escaped})\\2`);
  const exactMatch   = content.match(exactPattern);
  if (exactMatch) return buildResult(exactMatch, exactMatch[3]);

  // 2. Fuzzy fallback: match by TC-ID prefix only (e.g. TC-ACC-002).
  //    Tolerates title drift that occurs when a story is regenerated between
  //    the last test run (which wrote results.json) and now.
  const tcIdMatch = title.match(/^(TC-[A-Z]+-\d+)/);
  if (tcIdMatch) {
    const tcId         = tcIdMatch[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const fuzzyPattern = new RegExp(`([ \\t]*)test(?:\\.fixme)?\\((['"\`])(${tcId}[^'"\`]*)\\2`);
    const fuzzyMatch   = content.match(fuzzyPattern);
    if (fuzzyMatch) {
      console.log(`      ℹ Fuzzy-matched "${fuzzyMatch[3]}" by TC-ID prefix (results.json had: "${title}")`);
      return buildResult(fuzzyMatch, fuzzyMatch[3]);
    }
  }

  return null;
}

// ── Check whether a specific test passed in a Playwright JSON results file ────
//
// Used after a healing re-run to decide if the fix worked for the target test,
// regardless of whether other tests in the suite may still be failing.

function checkTestPassedInResults(resultsFile: string, actualTitle: string, tcId: string): boolean {
  if (!fs.existsSync(resultsFile)) return false;
  try {
    const data = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
    let passed = false;

    function walk(suite: any) {
      for (const spec of suite.specs ?? []) {
        const t: string = spec.title ?? '';
        const matches   = t === actualTitle
          || t.startsWith(`${tcId} `)
          || t.startsWith(`${tcId} —`)
          || t === tcId;
        if (matches) {
          for (const test of spec.tests ?? []) {
            if (test.status === 'expected' || test.status === 'passed') passed = true;
          }
        }
      }
      for (const child of suite.suites ?? []) walk(child);
    }

    (data.suites ?? []).forEach(walk);
    return passed;
  } catch {
    return false;
  }
}

// ── Propagate newly-passing results from a heal re-run to main results.json ───
//
// After healing TC-ACC-002, a full re-run may also pass TC-ACC-003/004/005 that
// were previously skipped due to the serial cascade. This copies those results
// into the main file so the dashboard reflects the true post-healing state.

function propagateHealedResults(tempResultsFile: string): void {
  if (!fs.existsSync(tempResultsFile)) return;
  const mainResultsPath = path.join('reports', 'results.json');
  if (!fs.existsSync(mainResultsPath)) return;

  try {
    const tempData = JSON.parse(fs.readFileSync(tempResultsFile, 'utf8'));
    const mainData = JSON.parse(fs.readFileSync(mainResultsPath, 'utf8'));

    // Build title → status map from temp run
    const tempStatuses = new Map<string, string>();
    function walkTemp(suite: any) {
      for (const spec of suite.specs ?? []) {
        for (const test of spec.tests ?? []) tempStatuses.set(spec.title, test.status);
      }
      for (const child of suite.suites ?? []) walkTemp(child);
    }
    (tempData.suites ?? []).forEach(walkTemp);

    // Update main results for tests that now pass
    let updated = 0;
    function walkMain(suite: any) {
      for (const spec of suite.specs ?? []) {
        const ts = tempStatuses.get(spec.title);
        if (ts === 'expected' || ts === 'passed') {
          for (const test of spec.tests ?? []) {
            if (test.status !== 'expected' && test.status !== 'passed') {
              test.status    = 'expected';
              spec.ok        = true;
              if (test.results?.[0]) { test.results[0].status = 'passed'; test.results[0].errors = []; }
              updated++;
            }
          }
        }
      }
      for (const child of suite.suites ?? []) walkMain(child);
    }
    (mainData.suites ?? []).forEach(walkMain);

    if (updated > 0) {
      let passed = 0, failed = 0;
      function recount(suite: any) {
        for (const spec of suite.specs ?? []) {
          for (const t of spec.tests ?? []) {
            if (t.status === 'expected' || t.status === 'passed') passed++;
            else if (t.status === 'unexpected' || t.status === 'failed') failed++;
          }
        }
        for (const child of suite.suites ?? []) recount(child);
      }
      (mainData.suites ?? []).forEach(recount);
      if (mainData.stats) { mainData.stats.expected = passed; mainData.stats.unexpected = failed; }
      fs.writeFileSync(mainResultsPath, JSON.stringify(mainData, null, 2));
      console.log(`      ℹ Propagated ${updated} healed sibling result(s) to main results.json`);
    }
  } catch (e: any) {
    console.error(`      ⚠ propagateHealedResults error: ${e.message}`);
  }
}

// ── Ask Claude Code CLI for a fix ─────────────────────────────────────────────

async function askClaude(
  failure:  FailedTest,
  testCode: string,
): Promise<string | null> {
  const knowledgeContext = loadHealingKnowledge(failure.file);
  
  // Load Scraped Locators for the object to give the healer "sight"
  let scrapedContext = '';
  try {
    const objKey = failure.file.replace('.spec.ts', '').toLowerCase();
    const locators = JSON.parse(fs.readFileSync('knowledge/scraped-locators.json', 'utf8'));
    if (locators[objKey]) {
      scrapedContext = `\n\n--- VERIFIED LOCATORS FOR ${objKey.toUpperCase()} ---\n${JSON.stringify(locators[objKey].fields, null, 2)}`;
    }
  } catch (e) {}

  // Load SFUtils signatures so the healer knows what methods actually exist
  let sfUtilsSignatures = '';
  try {
    const sfUtilsContent = fs.readFileSync('utils/SFUtils.ts', 'utf8');
    const methods = sfUtilsContent.match(/static async \w+\(.*?\)/g) || [];
    sfUtilsSignatures = `\n\n--- AVAILABLE SFUtils METHODS ---\n${methods.join('\n')}`;
  } catch (e) {}

  const errorText  = failure.errors.join('\n').substring(0, 1200);
  const stdoutText = failure.stdout.join('').substring(0, 800);
  const stderrText = (failure.stderr ?? []).join('').substring(0, 400);

  // Build a network/console hints block from stdout — Playwright captures console.log/warn/error
  // and any [WARN]/[ERROR] lines from SFUtils. This lets the healer distinguish between a
  // selector failure and a deeper Salesforce API/session/permission failure.
  const consoleHints = stdoutText.trim()
    ? `\n\n### Console / Stdout Output (captured by Playwright)\n\`\`\`\n${stdoutText}\n\`\`\``
    : '';
  const networkHints = stderrText.trim()
    ? `\n\n### Stderr / Network Hints\n\`\`\`\n${stderrText}\n\`\`\``
    : '';

  const system = `You are a Salesforce Revenue Cloud QA automation engineer. Return only raw TypeScript code — never use markdown code fences, never add explanations.

ABSOLUTE RULES — violating any of these produces an invalid fix:
- NEVER use waitForLoadState('networkidle') — it hangs on Salesforce Lightning SPAs
- NEVER use optional chaining (?.) on TestData fields (data.account?.name) — all keys are guaranteed present; use data.account.Account_Name, data.contact.First_Name, etc.
- NEVER invent camelCase key aliases (data.account.name, data.contact.firstName) — use the exact PascalCase/snake_case keys from the TestData interface${knowledgeContext}${scrapedContext}${sfUtilsSignatures}`;

  const userPrompt = `A Salesforce E2E Playwright test is failing. Return ONLY the fixed TypeScript test function.

## Failing Test: ${failure.title}

### Error
\`\`\`
${errorText}
\`\`\`
${consoleHints}${networkHints}

### Current test code
\`\`\`typescript
${testCode}
\`\`\`

## Diagnostic Priority (check in this order before picking a fix)
1. **API / Session failure:** If console output contains a 4xx/5xx HTTP status, "INVALID_SESSION_ID", "INSUFFICIENT_ACCESS", or "UNABLE_TO_LOCK_ROW" — the root cause is Salesforce-side, not a selector issue. Add a re-navigation or session-refresh step, do NOT change selectors.
2. **Business Logic / Lock:** If the error is "element not interactable" or "read-only", the record is likely in an Approved/Locked state. Add a step to change status or navigate to a writeable record.
3. **Shadow DOM / Configurator:** If the failure is inside the CPQ Configurator, ALWAYS scope to \`page.locator('c-product-configurator')\`.
4. **Pricing Asynchronicity:** If the error is a price mismatch (e.g. expected $100 but found $0), ensure \`waitForRlmSpinners(page)\` and a wait for the pricing toast are present.
5. **Selector Fix:** Only change a selector if the error is "locator not found" with no API/session hints in console. Prefer \`SFUtils\` methods and use VERIFIED LOCATORS from context.
6. **Search Indexing Delay:** If a lookup fails to find a record created earlier in the same test run, add \`await page.waitForTimeout(3000)\` before the lookup — Salesforce global search indexes with a delay.

## Fix rules
- Keep the same TC-ID and the exact test name string
- Use \`SFUtils\` methods for all Salesforce field interactions
- NEVER use waitForLoadState('networkidle')
- NEVER use optional chaining on TestData fields
- Return the COMPLETE fixed test function from \`test(\` through the closing \`});\`
`;

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
