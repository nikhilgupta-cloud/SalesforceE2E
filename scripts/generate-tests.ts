/**
 * generate-tests.ts — AI-powered test generation with smart change detection
 *
 * Drop a .md file into prompts/user-stories/ following _template.md.
 * On every pipeline run (or watch-stories.ts) this script:
 *   • NEW story   → generates scenarios + Playwright tests, stores content hash
 *   • CHANGED story → removes old generated blocks, regenerates, updates hash
 *   • UNCHANGED   → skips (hash match)
 *
 * Generated blocks are wrapped in markers so they can be found/replaced safely:
 *   Spec files:     // ── US-013 START ── ... // ── US-013 END ──
 *   Scenario files: natural ## US-013: heading section
 *
 * Hash store: prompts/user-stories/.story-hashes.json
 *
 * AI backend: Claude Code CLI (claude -p) — no ANTHROPIC_API_KEY required.
 *
 * Usage (standalone):  npx ts-node scripts/generate-tests.ts
 * Usage (pipeline):    called automatically as Step 0
 * Usage (watch mode):  npm run watch:stories
 */
import * as crypto from 'crypto';
import * as fs     from 'fs';
import * as os     from 'os';
import * as path   from 'path';
import { spawn }   from 'child_process';
import { getObjectMap } from '../utils/FrameworkConfig';


// ── Claude Code CLI helper ────────────────────────────────────────────────────

interface ClaudeResult { 
    text: string; 
    tokensIn: number; 
    tokensOut: number;
}

let _totalTokensIn  = 0;
let _totalTokensOut = 0;

// ── Terminal spinner ──────────────────────────────────────────────────────────

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

function startSpinner(label: string): NodeJS.Timeout {
  let i = 0;
  if (process.stdout.isTTY) {
    process.stdout.write(`[generate] ${SPINNER_FRAMES[0]} ${label}`);
    return setInterval(() => {
      i = (i + 1) % SPINNER_FRAMES.length;
      process.stdout.write(`\r[generate] ${SPINNER_FRAMES[i]} ${label}`);
    }, 80);
  }
  process.stdout.write(`[generate] ⟳ ${label}...\n`);
  return setInterval(() => {}, 9999999);
}

function stopSpinner(timer: NodeJS.Timeout, finalMsg: string): void {
  clearInterval(timer);
  if (process.stdout.isTTY) {
    process.stdout.write(`\r[generate] ${finalMsg}\n`);
  } else {
    process.stdout.write(`[generate] ${finalMsg}\n`);
  }
}





async function callClaudeCode(systemPrompt: string, userPrompt: string, label = 'Calling Claude CLI'): Promise<ClaudeResult | null> {
  const spinner = startSpinner(label);
  const start   = Date.now();
  const sysFile = path.join(os.tmpdir(), `sf-gen-sys-${Date.now()}.txt`);

  const isWin      = process.platform === 'win32';
  const claudeArgs = isWin
    ? [path.join(os.homedir(), 'AppData', 'Roaming', 'npm',
        'node_modules', '@anthropic-ai', 'claude-code', 'cli-wrapper.cjs')]
    : [] as string[];
  const claudeExe  = isWin ? 'node' : 'claude';

  fs.writeFileSync(sysFile, systemPrompt, 'utf8');

  const childEnv = { ...process.env };
  for (const key of Object.keys(childEnv)) {
    if (key.startsWith('CLAUDE') || key.startsWith('VSCODE_') || key === 'ELECTRON_RUN_AS_NODE') {
      delete childEnv[key];
    }
  }

  return new Promise<ClaudeResult | null>(resolve => {
    const child = spawn(
      claudeExe,
      [...claudeArgs, '--system-prompt-file', sysFile, '--no-session-persistence', '--output-format', 'json', '-p'],
      { shell: false, env: childEnv },
    );

    let stdout = '';
    let stderr = '';
    const MAX = 10 * 1024 * 1024; // 10 MB guard

    child.stdin.write(userPrompt);
    child.stdin.end();

    child.stdout.on('data', (chunk: Buffer) => {
      if (stdout.length < MAX) stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk: Buffer) => {
      if (stderr.length < 4096) stderr += chunk.toString();
    });

    const timeout = setTimeout(() => {
      child.kill();
      stopSpinner(spinner, `✗ ${label} — timed out after 10 min`);
      console.error('[generate] ⚠ Claude CLI timed out');
      try { fs.unlinkSync(sysFile); } catch {}
      resolve(null);
    }, 600000);

    child.on('error', (err: Error) => {
      clearTimeout(timeout);
      stopSpinner(spinner, `✗ ${label} — failed`);
      console.error('[generate] ⚠ spawn error:', err.message);
      try { fs.unlinkSync(sysFile); } catch {}
      resolve(null);
    });

    child.on('close', (code: number | null) => {
      clearTimeout(timeout);
      try { fs.unlinkSync(sysFile); } catch {}

      const elapsed = ((Date.now() - start) / 1000).toFixed(1);

      if (code !== 0 || !stdout.trim()) {
        stopSpinner(spinner, `✗ ${label} — failed`);
        console.error(`[generate] ⚠ Claude CLI failed — exit: ${code}, stderr: ${stderr.trim().slice(0, 400) || '(empty)'}`);
        resolve(null);
        return;
      }

      let text: string;
      let tokensIn  = 0;
      let tokensOut = 0;
      try {
        const parsed = JSON.parse(stdout.trim());
        text      = typeof parsed.result === 'string' ? parsed.result : stdout.trim();
        tokensIn  = parsed.usage?.input_tokens  ?? 0;
        tokensOut = parsed.usage?.output_tokens ?? 0;
      } catch {
        text = stdout.trim();
      }

      stopSpinner(spinner, `✓ ${label} (${elapsed}s, ${tokensIn}→${tokensOut} tokens)`);
      resolve({ text, tokensIn, tokensOut });
    });
  });
}

// ── Scraped locator map ───────────────────────────────────────────────────────
const SCRAPED_LOCATORS_PATH = path.join('knowledge', 'scraped-locators.json');

/**
 * Load the verified locator map for a given object key.
 * Generated by: npx ts-node scripts/scrape-locators.ts
 * Returns a formatted string injected into the Claude system prompt so that
 * AI-generated tests use real DOM selectors instead of guessed label text.
 */
function loadScrapedLocators(objKey: string): string {
  if (!fs.existsSync(SCRAPED_LOCATORS_PATH)) return '';
  try {
    const db = JSON.parse(fs.readFileSync(SCRAPED_LOCATORS_PATH, 'utf8'));
    const entry = db[objKey];
    if (!entry?.fields?.length) return '';

    const lines = entry.fields.map((f: {
      label: string; componentTag: string; inputType: string;
      selector: string; apiName: string | null;
    }) => {
      const apiPart = f.apiName ? ` [api: ${f.apiName}]` : '';
      return `  - "${f.label}"${apiPart}: ${f.selector}`;
    });

    return `\n\n--- VERIFIED LOCATORS (scraped from live org ${entry.scrapedAt}) ---\n` +
           `Use ONLY these selectors for ${objKey} fields — do NOT guess or invent locators:\n` +
           lines.join('\n') + '\n--- END VERIFIED LOCATORS ---';
  } catch {
    return '';
  }
}

// ── Knowledge base — maps object keys to domain files ────────────────────────
const KNOWLEDGE_DIR = path.join('knowledge', 'agentforce-rm');

/** Domain files to load per object key. First match wins for primary; all others are secondary. */
const OBJECT_KNOWLEDGE_MAP: Record<string, string[]> = {
  account:     ['foundations-and-coexistence.md'],
  contact:     ['foundations-and-coexistence.md'],
  opportunity: ['foundations-and-coexistence.md', 'quote-lifecycle.md'],
  quote:       ['quote-lifecycle.md', 'pricing.md', 'approvals.md'],
  product:     ['product-modeling.md', 'pricing.md'],
  contract:    ['contract-lifecycle.md', 'amendments.md'],
  order:       ['order-management.md'],
  asset:       ['contract-lifecycle.md', 'order-management.md'],
};

/**
 * Load knowledge base context for a given object key.
 * Returns concatenated domain file content (capped to avoid token overflow).
 */
function loadKnowledgeContext(objKey: string): string {
  const files = OBJECT_KNOWLEDGE_MAP[objKey] ?? [];
  if (files.length === 0) return '';

  const sections: string[] = [];
  for (const file of files) {
    const filePath = path.join(KNOWLEDGE_DIR, file);
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath, 'utf8');
    // Cap each domain file at 3000 chars to stay within token budget
    sections.push(`\n\n--- DOMAIN KNOWLEDGE: ${file} ---\n${content.slice(0, 3000)}`);
  }
  return sections.join('');
}

// ── Object registry — driven by prompts/framework-config.json ─────────────────
const OBJECT_MAP = getObjectMap();

// ── Hash store ────────────────────────────────────────────────────────────────

interface StoryRecord {
  hash:   string;   // MD5 of the story file content at last process
  objKey: string;   // e.g. "account"
}

type HashStore = Record<string, StoryRecord>; // keyed by US-XXX

const HASH_STORE_PATH = path.join('prompts', 'user-stories', '.story-hashes.json');

/** Track which US-IDs have been purged from all object files in this run to avoid duplicates */
const purgedUsIds = new Set<string>();

function loadHashStore(): HashStore {
  try { return JSON.parse(fs.readFileSync(HASH_STORE_PATH, 'utf8')); }
  catch { return {}; }
}

function saveHashStore(store: HashStore): void {
  fs.writeFileSync(HASH_STORE_PATH, JSON.stringify(store, null, 2));
}

/**
 * Returns true if every test belonging to the given spec file is currently passing
 * in the last reports/results.json. Used to guard against regenerating working tests
 * when only story metadata changed.
 *
 * Treats cascade-skipped tests (expectedStatus='passed' but status='skipped', caused by
 * a prior serial failure) as failures so the guard does not incorrectly block regeneration
 * when downstream tests never ran. Intentional skips (test.fixme/test.skip) have
 * expectedStatus='skipped' and are excluded from the failure check.
 */
function allTestsPassingInSpec(specFileName: string): boolean {
  const resultsPath = path.join('reports', 'results.json');
  if (!fs.existsSync(resultsPath)) return false;

  try {
    const raw = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
    let hasTests  = false;
    let hasFailed = false;

    function walk(suite: any) {
      for (const spec of suite.specs ?? []) {
        if (!spec.file?.endsWith(specFileName)) continue;
        for (const t of spec.tests ?? []) {
          hasTests = true;
          const isCascadeSkip = t.status === 'skipped' && t.expectedStatus !== 'skipped';
          if (t.status === 'unexpected' || t.status === 'failed' || isCascadeSkip) hasFailed = true;
        }
      }
      for (const child of suite.suites ?? []) walk(child);
    }
    (raw.suites ?? []).forEach(walk);

    return hasTests && !hasFailed;
  } catch {
    return false;
  }
}

/**
 * Returns TC-IDs of tests that are currently failing or cascade-skipped in results.json.
 * Used by callClaude() UPDATE mode to prevent Claude from copying buggy test code as
 * "stable" — only passing tests are safe to copy verbatim.
 */
function getFailingOrSkippedTcIds(specFileName: string): Set<string> {
  const resultsPath = path.join('reports', 'results.json');
  const failing     = new Set<string>();
  if (!fs.existsSync(resultsPath)) return failing;
  try {
    const raw = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
    function walk(suite: any) {
      for (const spec of suite.specs ?? []) {
        if (!spec.file?.endsWith(specFileName)) continue;
        const tcId = (spec.title ?? '').match(/^(TC-[A-Z]+-\d+)/)?.[1];
        if (!tcId) continue;
        for (const t of spec.tests ?? []) {
          const isCascadeSkip = t.status === 'skipped' && t.expectedStatus !== 'skipped';
          if (t.status === 'unexpected' || t.status === 'failed' || isCascadeSkip) failing.add(tcId);
        }
      }
      for (const child of suite.suites ?? []) walk(child);
    }
    (raw.suites ?? []).forEach(walk);
  } catch {}
  return failing;
}

/**
 * Normalize story content to ensure minor formatting/whitespace/line-ending 
 * differences do not trigger a hash mismatch and costly regeneration.
 * 
 * Specifically ignores:
 *   - "Source: Jira ... fetched 2026-04-27" lines (volatile date)
 *   - "<!-- Jira: SCRUM-5 -->" comments (traceability is good, but doesn't change the test logic)
 */
function normalizeStoryContent(str: string): string {
  return str
    .replace(/\r\n/g, '\n')                             // Normalize line endings
    .replace(/^Source: Jira.*fetched.*$/gim, '')         // Ignore Jira fetch date line
    .replace(/<!-- Jira:.*-->/gim, '')                  // Ignore Jira traceability comments
    .replace(/[ \t]+$/gm, '')                           // Remove trailing whitespace per line
    .trim();                                            // Remove leading/trailing newlines
}

function md5(str: string): string {
  return crypto.createHash('md5').update(normalizeStoryContent(str)).digest('hex');
}

// ── Section marker helpers ────────────────────────────────────────────────────

const SPEC_START = (usId: string) =>
  `  // ── ${usId} START ─────────────────────────────────────────────────────`;
const SPEC_END = (usId: string) =>
  `  // ── ${usId} END ───────────────────────────────────────────────────────`;

/**
 * Checks if a spec file already contains the generated markers for a specific US-ID.
 */
function specHasUsId(specPath: string, usId: string): boolean {
  if (!fs.existsSync(specPath)) return false;
  const content = fs.readFileSync(specPath, 'utf8');
  return content.includes(SPEC_START(usId)) && content.includes(SPEC_END(usId));
}

/**
 * Checks if a scenario file already contains the heading for a specific US-ID.
 */
function scenarioHasUsId(scenarioPath: string, usId: string): boolean {
  if (!fs.existsSync(scenarioPath)) return false;
  const content = fs.readFileSync(scenarioPath, 'utf8');
  return new RegExp(`^## ${usId}:`, 'm').test(content);
}

/**
 * Remove the generated scenario section for a US from a scenario file.
 * Finds "## US-013:" to the next "## US-" heading (or EOF).
 */
function removeScenarioSection(scenarioPath: string, usId: string): void {
  if (!fs.existsSync(scenarioPath)) return;
  let content = fs.readFileSync(scenarioPath, 'utf8');
  // Match from \n## US-013: through everything up to (but not including) the next \n## US- or end
  const re = new RegExp(`\\n## ${usId}:[\\s\\S]*?(?=\\n## US-|\\s*$)`, 'g');
  content = content.replace(re, '');
  // Collapse triple+ blank lines left behind
  content = content.replace(/\n{3,}/g, '\n\n');
  fs.writeFileSync(scenarioPath, content.trimEnd() + '\n', 'utf8');
}

/**
 * Remove the generated spec section for a US from a spec file.
 * Finds "// ── US-013 START" to "// ── US-013 END" inclusive.
 */
function removeSpecSection(specPath: string, usId: string): void {
  if (!fs.existsSync(specPath)) return;
  const content = fs.readFileSync(specPath, 'utf8');
  const startMark = SPEC_START(usId);
  const endMark   = SPEC_END(usId);

  const si = content.indexOf(startMark);
  const ei = content.indexOf(endMark);
  if (si === -1 || ei === -1) return;

  // Also consume the newline(s) immediately before the start marker
  const removeFrom = (content[si - 1] === '\n' && content[si - 2] === '\n') ? si - 1 : si;
  const endOfLine  = content.indexOf('\n', ei);
  const removeTo   = endOfLine === -1 ? content.length : endOfLine + 1;

  fs.writeFileSync(specPath, content.slice(0, removeFrom) + content.slice(removeTo), 'utf8');
}

// ── TC-ID helpers ─────────────────────────────────────────────────────────────

/** Find the highest TC-PREFIX-NNN used in a scenario file → return next available */
function nextTcId(prefix: string, scenarioFilePath: string): number {
  if (!fs.existsSync(scenarioFilePath)) return 1;
  const content = fs.readFileSync(scenarioFilePath, 'utf8');
  const hits    = [...content.matchAll(new RegExp(`TC-${prefix}-(\\d+)`, 'g'))];
  if (hits.length === 0) return 1;
  return Math.max(...hits.map(m => parseInt(m[1], 10))) + 1;
}

// ── Object / scenario extraction ──────────────────────────────────────────────

function detectObject(content: string): string | null {
  const explicit = content.match(/^\*{0,2}Object:\*{0,2}\s*(.+)/mi)?.[1]?.trim().toLowerCase() ?? '';
  for (const key of Object.keys(OBJECT_MAP)) {
    if (explicit.includes(key)) return key;
  }
  // Keyword fallback (last resort)
  const lower = content.toLowerCase();
  for (const key of Object.keys(OBJECT_MAP)) {
    if (lower.includes(key)) return key;
  }
  return null;
}

/**
 * Given a story's text, determine which ACTIVE objects the ACs actually operate on.
 *
 * The "OBJECT N: NAME" header names the business domain of the epic, but an E2E
 * story like "Order Activation" may have ACs that only touch Account / Contact /
 * Opportunity — with no steps on the Order record itself.  Blindly trusting the
 * header produces tests for the wrong object.
 *
 * Logic (AC-content driven — header is never scored):
 *  1. Extract only AC lines (lines matching /^AC-\d+/i).
 *  2. Score each ACTIVE object key by how many AC lines mention it.
 *  3. Return every object with score > 0 (deduplicated, order = config order).
 *  4. Final fallback: if nothing scored, honour the header object.
 */
function resolveStoryObjects(storyContent: string, headerObjKey: string): string[] {
  // If we have an explicit header object (from the "OBJECT N: NAME" section),
  // use it as the definitive source. This prevents the same story from being
  // duplicated across every object mentioned in its Acceptance Criteria.
  if (headerObjKey) {
    return [headerObjKey];
  }

  // Extract the AC lines specifically — ignore title, header, and prose
  const acLines = storyContent
    .split('\n')
    .filter(l => /^AC-\d+/i.test(l.trim()))
    .join('\n')
    .toLowerCase();

  if (!acLines) return []; // No ACs and no header — cannot map

  const activeKeys = Object.keys(OBJECT_MAP);
  const scored = activeKeys.filter(key => new RegExp(`\\b${key}\\b`).test(acLines));

  return scored;
}

/**
 * Parse a multi-story file (e.g. CPQ_User_stories.md) that contains multiple
 * ## US-NNN sections across multiple objects.
 *
 * Handles both formats:
 *   ## US-001 — Title   (em-dash, used in CPQ_User_stories.md)
 *   # US-001: Title     (colon, used in prompts/user-stories/ files)
 *
 * Object context is tracked from "OBJECT N: NAME" section headers.
 */
function parseMultiStoryFile(content: string): Array<{ usId: string; objKey: string; storyContent: string }> {
  const lines = content.split('\n');
  const stories: Array<{ usId: string; objKey: string; storyContent: string }> = [];

  let headerObjKey  = '';
  let currentUsId   = '';
  let currentLines: string[] = [];

  const flush = () => {
    if (!currentUsId || currentLines.length === 0) return;
    const storyContent = currentLines.join('\n').trim();
    const objKeys = resolveStoryObjects(storyContent, headerObjKey);
    for (const objKey of objKeys) {
      stories.push({ usId: currentUsId, objKey, storyContent });
    }
  };

  for (const line of lines) {
    // "OBJECT 1: ACCOUNT" or "OBJECT 2: ORDER" — captures the epic-level label
    // Using trim() to handle leading whitespace or formatting marks
    const objMatch = line.trim().match(/^OBJECT\s+\d+:\s*(\w+)/i);
    if (objMatch) {
      const objName = objMatch[1].toLowerCase();
      for (const key of Object.keys(OBJECT_MAP)) {
        if (objName.startsWith(key)) { headerObjKey = key; break; }
      }
      continue;
    }

    // "## US-001 — Title" or "# US-001: Title" — start a new story section
    const usMatch = line.match(/^#{1,2}\s+(US-\d+)/);
    if (usMatch) {
      flush();
      currentUsId   = usMatch[1];
      currentLines  = [line];
      continue;
    }

    if (currentUsId) {
      currentLines.push(line);
    }
  }
  flush();

  return stories;
}

/** Extract existing scenario rows for a specific US from a scenario file */
function extractExistingScenarios(scenarioPath: string, usId: string): string {
  if (!fs.existsSync(scenarioPath)) return '';
  const content = fs.readFileSync(scenarioPath, 'utf8');
  const re = new RegExp(`(## ${usId}:[\\s\\S]*?)(?=\\n## US-|\\s*$)`);
  return content.match(re)?.[1]?.trim() ?? '';
}

/** Extract existing test(...) blocks for a specific US from a spec file */
function extractExistingTestCode(specPath: string, usId: string): string {
  if (!fs.existsSync(specPath)) return '';
  const content = fs.readFileSync(specPath, 'utf8');
  const startMark = SPEC_START(usId);
  const endMark   = SPEC_END(usId);
  const si = content.indexOf(startMark);
  const ei = content.indexOf(endMark);
  if (si === -1 || ei === -1) return '';
  return content.slice(si + startMark.length, ei).trim();
}

// ── Claude-backed generation ──────────────────────────────────────────────────

async function callClaude(
  storyContent:      string,
  objKey:            string,
  startId:           number,
  existingScenarios: string,  // empty string means NEW
  existingTestCode:  string,  // empty string means NEW
): Promise<{ scenarios: string; testCode: string } | null> {

  const obj          = OBJECT_MAP[objKey];
  const specPath     = path.join('tests', obj.specFile);
  const scenarioPath = path.join('generated', 'test-scenarios', obj.scenarioFile);

  const specSample = fs.existsSync(specPath)
    ? fs.readFileSync(specPath, 'utf8').split('\n').slice(0, 90).join('\n')
    : '';
  const scenarioSample = fs.existsSync(scenarioPath)
    ? fs.readFileSync(scenarioPath, 'utf8').slice(0, 1500)
    : '';

  const idStr        = `TC-${obj.prefix}-${String(startId).padStart(3, '0')}`;
  const isUpdate     = existingScenarios.length > 0;
  // TC-IDs that failed or were cascade-skipped in the last run — must be regenerated, not copied.
  const failingTcIds = isUpdate ? getFailingOrSkippedTcIds(obj.specFile) : new Set<string>();

  const knowledgeContext  = loadKnowledgeContext(objKey);
  const scrapedLocators   = loadScrapedLocators(objKey);

  const system = `You are a Salesforce Revenue Cloud QA engineer writing Playwright TypeScript tests.
Rules (apply to every line of code):
- Adhere STRICTLY to the SHARED GROUND RULES in MasterPrompt.md.
- ALWAYS import { SFUtils } from '../utils/SFUtils';
- Use SFUtils.goto(page, url) instead of page.goto().
- Use SFUtils.waitForLoading(page) instead of manual spinner waits.
- Use SFUtils.fillField(root, 'ApiNameOrLabel', value) for all standard inputs.
- Use SFUtils.fillName(root, 'firstName'|'lastName', value) for Name fields.
- Use SFUtils.selectCombobox(page, root, 'ApiNameOrLabel', label) for all dropdowns.
- Use SFUtils.fillLookup(page, root, 'ApiNameOrLabel', value) for all lookups.
- VERIFIED LOCATORS: Use the exact selectors provided in the "VERIFIED LOCATORS" section below.
- Do NOT guess or invent field names. If a field is not in VERIFIED LOCATORS, use the exact Label string from the story.
- Call dismissAuraError(page) after every SFUtils.goto().
- Use exact button matching: getByRole('button', { name: 'Save', exact: true }).
- TAB NAVIGATION: Always call clickTab(page, 'Details') before accessing fields on a record page.
- TEST DATA: Use data from tests/fixtures/test-data.json via the 'data' constant.
- E2E FLOW VIDEO: If knowledge/FLow/Flow.mp4 exists, review it to understand the visual flow and transitions.
${scrapedLocators}${knowledgeContext}`;

  const updateContext = isUpdate ? `
IMPORTANT — this is an UPDATE. The story was previously processed.

--- EXISTING SCENARIO ROWS ---
${existingScenarios}

--- EXISTING TEST CODE ---
${existingTestCode}

Test status from the last pipeline run:
- FAILING / SKIPPED TC-IDs (must be fully regenerated — do NOT copy): ${failingTcIds.size > 0 ? [...failingTcIds].join(', ') : 'none'}
- All other TC-IDs are currently PASSING and must be preserved exactly.

Rules:
1. **Regenerate Failing Tests:** For every TC-ID in the FAILING/SKIPPED list, write completely new, correct test code from scratch. Do NOT copy existing logic — it is broken.
2. **Preserve Passing Tests:** For TC-IDs NOT in the failing list, copy the existing test() block verbatim to maintain stability.
3. **Handle Changed ACs:** Rewrite the test() block for any AC whose criteria changed in the story, regardless of current pass/fail status.
4. **Add New Tests:** Add new TC-IDs only for genuinely new acceptance criteria absent from the existing scenarios.
5. **Logic Consistency:** Keep SFUtils helper calls, URL capture patterns, and shared variable names (accountUrl, contactUrl, opportunityUrl, quoteUrl, contractUrl, orderUrl) consistent with the passing tests.
` : '';

  const user = `${isUpdate ? 'UPDATE' : 'NEW'} user story:
---
${storyContent}
---
${updateContext}
Scenario file (for ID range context):
${scenarioSample.slice(0, 1200)}

Spec file pattern to replicate (first 90 lines):
${specSample}

Generate 3–5 test scenarios matching the acceptance criteria.
${isUpdate ? '' : `TC IDs start at ${idStr}.`}
testCode must be indented 2 spaces — it will be inserted inside an existing test.describe block.

Respond using EXACTLY this format — no JSON, no markdown fences, no extra text outside the delimiters:

===SCENARIOS===
## US-XXX: Title

| TC ID | Scenario | Expected Result | AC Ref |
|-------|----------|-----------------|--------|
| TC-${obj.prefix}-NNN | description | expected | AC-XXX-01 |
===END_SCENARIOS===

===TESTCODE===
  // TC-${obj.prefix}-NNN | AC Reference: AC-XXX-01
  test('TC-${obj.prefix}-NNN — description', async ({ page }) => {
    // test body
  });
===END_TESTCODE===`;

  const rawResult = await callClaudeCode(system, user, `Generating scenarios+tests — ${objKey} (${isUpdate ? 'UPDATE' : 'NEW'})`);
  if (!rawResult) {
    console.error('[generate] ⚠ Claude CLI returned empty/null — ensure Claude Code CLI is installed and authenticated');
    return null;
  }
  _totalTokensIn  += rawResult.tokensIn;
  _totalTokensOut += rawResult.tokensOut;

  // Parse delimited sections — immune to JSON escaping issues
  const txt = rawResult.text;
  const scenariosMatch = txt.match(/===SCENARIOS===\r?\n([\s\S]*?)\r?\n===END_SCENARIOS===/);
  const testCodeMatch  = txt.match(/===TESTCODE===\r?\n([\s\S]*?)\r?\n===END_TESTCODE===/);

  if (!scenariosMatch || !testCodeMatch) {
    console.error('[generate] ⚠ Missing delimiters in Claude response. First 300 chars:', txt.slice(0, 300));
    return null;
  }

  return {
    scenarios: scenariosMatch[1].trim(),
    testCode:  testCodeMatch[1],          // preserve indentation exactly
  };
}

// ── Markdown stripper ────────────────────────────────────────────────────────

/**
 * Strip markdown prose that Claude sometimes wraps around generated code.
 * Priority: extract the first ```typescript / ```ts / ``` fenced block.
 * Fallback: remove lines that are clearly markdown (tables, bold, headings,
 * blockquotes, horizontal rules) so only TypeScript survives.
 */
function cleanGeneratedCode(text: string): string {
  // 1. Extract first fenced code block (```typescript, ```ts, or plain ```)
  const fenceMatch = text.match(/```(?:typescript|ts)?\r?\n([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trimEnd();

  // 2. No fence found — strip obvious markdown lines line-by-line
  return text
    .split('\n')
    .filter(line => {
      const t = line.trim();
      if (t.startsWith('|'))   return false; // table row / divider
      if (t.startsWith('**'))  return false; // bold prose
      if (t.startsWith('> '))  return false; // blockquote
      if (/^#{1,6} /.test(t)) return false; // heading
      if (/^---+$/.test(t))   return false; // horizontal rule
      return true;
    })
    .join('\n')
    .trimEnd();
}

// ── Bootstrap: create spec + scenario files from scratch ─────────────────────

/**
 * Called the very first time a spec file is needed for an object.
 * Asks Claude to generate the full file header (imports, helpers, describe wrapper)
 * so the generated test blocks can be appended into a valid TypeScript file.
 */
async function bootstrapSpecFile(objKey: string): Promise<void> {
  const obj      = OBJECT_MAP[objKey];
  const specPath = path.join('tests', obj.specFile);
  if (fs.existsSync(specPath)) return; // already exists

  // --- UPDATED LOGIC FOR HEADER GENERATION ---

const headerPrompt = `
Generate the FILE HEADER for a Playwright TypeScript spec file.
Requirements:
1. Import { test, expect, Page } from '@playwright/test'.
2. Import { SFUtils } from '../utils/SFUtils';
3. Import * as fs and * as path.
4. Define data: const data = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'tests', 'fixtures', 'test-data.json'), 'utf8'));
5. Define SF URL: const SF = process.env.SF_SANDBOX_URL || process.env.SF_LOGIN_URL || '';
6. End with: test.describe('\${obj.displayName} Lifecycle', () => {
`;

const header = await callClaudeCode(
    'You are a Lead SDET. Generate ONLY imports and the opening describe block. No closing braces. No test() blocks.',
    headerPrompt,
    `Bootstrapping spec file — ${obj.specFile}`,
);

if (!header) {
    console.error(`[generate] ❌ Failed to bootstrap ${obj.specFile}`);
    return;
}

// Clean up tokens tracking
_totalTokensIn  += header.tokensIn;
_totalTokensOut += header.tokensOut;

fs.mkdirSync('tests', { recursive: true });
// Strip markdown fences / prose that Claude sometimes wraps around the code
const cleanHeader = cleanGeneratedCode(header.text);
fs.writeFileSync(specPath, cleanHeader + '\n\n', 'utf8');
console.log(`[generate] ✅ Created ${obj.specFile} header`);
}

/**
 * Called the first time a scenario file is needed for an object.
 */
function bootstrapScenarioFile(scenarioPath: string, obj: typeof OBJECT_MAP[string]): void {
  if (fs.existsSync(scenarioPath)) return;
  fs.mkdirSync(path.dirname(scenarioPath), { recursive: true });
  const today = new Date().toISOString().split('T')[0];
  fs.writeFileSync(
    scenarioPath,
    `# Test Scenarios — ${obj.displayName}\n**Generated:** ${today}\n\n---\n`,
    'utf8',
  );
  console.log(`[generate] ✅ Created ${path.basename(scenarioPath)}`);
}

// ── File write helpers ────────────────────────────────────────────────────────

function writeScenarioSection(scenarioPath: string, scenarioBlock: string): void {
  fs.appendFileSync(scenarioPath, `\n${scenarioBlock.trimEnd()}\n`);
}

function writeSpecSection(specPath: string, usId: string, testCode: string): void {
  const content    = fs.readFileSync(specPath, 'utf8');
  const lastClose  = content.lastIndexOf('\n});');
  const block      = `\n${SPEC_START(usId)}\n${testCode.trimEnd()}\n${SPEC_END(usId)}`;
  if (lastClose === -1) {
    fs.appendFileSync(specPath, block + '\n');
  } else {
    fs.writeFileSync(
      specPath,
      content.slice(0, lastClose) + '\n' + block + '\n' + content.slice(lastClose),
      'utf8',
    );
  }
}

// ── test-plan.md updater ──────────────────────────────────────────────────────

function updateTestPlanCounts(): void {
  const planPath = path.join('generated', 'test-plan.md');
  if (!fs.existsSync(planPath)) return;

  let total = 0;
  const counts: Record<string, number> = {};
  for (const [key, obj] of Object.entries(OBJECT_MAP)) {
    const sp = path.join('tests', obj.specFile);
    const n  = fs.existsSync(sp)
      ? (fs.readFileSync(sp, 'utf8').match(/^\s*test\(/gm) ?? []).length : 0;
    counts[key] = n;
    total += n;
  }
  const usCounts: Record<string, number> = {};
  let totalUs = 0;
  for (const [key, obj] of Object.entries(OBJECT_MAP)) {
    const sp = path.join('generated', 'test-scenarios', obj.scenarioFile);
    const n  = fs.existsSync(sp)
      ? (fs.readFileSync(sp, 'utf8').match(/^## US-/gm) ?? []).length : 0;
    usCounts[key] = n;
    totalUs += n;
  }

  let plan = fs.readFileSync(planPath, 'utf8');
  for (const [, obj] of Object.entries(OBJECT_MAP)) {
    plan = plan.replace(
      new RegExp(`(\\|\\s*${obj.displayName}\\s*\\|[^|]*\\|\\s*)\\d+(\\s*\\|)`, 'i'),
      `$1${counts[Object.keys(OBJECT_MAP).find(k => OBJECT_MAP[k] === obj)!]}$2`,
    );
  }
  plan = plan.replace(/(\|\s*\*\*Total\*\*[^|]*\|[^|]*\|\s*)\*\*\d+\*\*/, `$1**${total}**`);
  plan = plan.replace(/\b\d+ test cases?\b/,   `${total} test cases`);
  plan = plan.replace(/\b\d+ tests\b/,          `${total} tests`);
  plan = plan.replace(/\b\d+ user stories\b/,  `${totalUs} user stories`);
  fs.writeFileSync(planPath, plan, 'utf8');
  console.log(`[generate] test-plan.md → ${total} tests, ${totalUs} user stories`);
}

// ── Main export ───────────────────────────────────────────────────────────────

export interface GenerateResult {
  added:      number;   // New stories generated
  updated:    number;   // Changed stories regenerated
  skipped:    number;   // Unchanged (hash match)
  failed:     number;   // Claude CLI returned null (PATH issue, auth, etc.)
  notice?:    string;   // Non-fatal info
  tokensIn?:  number;   // Total Claude input tokens consumed
  tokensOut?: number;   // Total Claude output tokens generated
}

/**
 * Process a single user story (one US-XXX block) against the hash store.
 * Shared by both the prompts/user-stories/ single-file flow and the
 * user-stories/ multi-story file flow.
 *
 * Returns 'added' | 'updated' | 'skipped'.
 */
async function processStory(
  usId:         string,
  storyContent: string,
  objKeyHint:   string | null,   // object detected from file context (multi-story)
  hashStore:    HashStore,
): Promise<'added' | 'updated' | 'skipped' | 'failed'> {
  const objKey = objKeyHint ?? detectObject(storyContent) ?? null;
  if (!objKey) {
    console.warn(`[generate] Cannot detect object for ${usId} — skipping`);
    return 'skipped';
  }

const strictLeash = `
*** CRITICAL SYSTEM DIRECTIVE: REDUCE OUTPUT TOKENS ***
You are a headless code generator. Your output is piped directly into a .ts file.
1. OUTPUT RAW TYPESCRIPT CODE ONLY.
2. NO EXPLANATIONS, NO CHAT, NO GREETINGS.
3. NO MARKDOWN TABLES, NO "Here is your code" summaries, NO test plans.
4. DO NOT repeat the Acceptance Criteria in plain text.
5. Generate a MAXIMUM of 5 focused test scenarios.
Failure to follow these rules will cause a syntax error and crash the pipeline.
`;

  // Normalize and hash
  const currentHash = md5(storyContent);
  const hashKey     = `${usId}:${objKey}`;
  const stored      = hashStore[hashKey];

  const obj          = OBJECT_MAP[objKey];
  const scenarioPath = path.join('generated', 'test-scenarios', obj.scenarioFile);
  const specPath     = path.join('tests', obj.specFile);

  // ── Smart Audit ──
  // If hash matches AND the files physically contain the US-ID, skip.
  if (stored && stored.hash === currentHash && specHasUsId(specPath, usId) && scenarioHasUsId(scenarioPath, usId)) {
    console.log(`[generate] ${usId} (${objKey}) unchanged and present — skipping`);
    return 'skipped';
  }

  const isNew = !stored;
  console.log(`[generate] ${isNew ? 'NEW' : 'CHANGED'} ${usId} → ${obj.displayName}`);

  // ── Passing-tests guard ──────────────────────────────────────────────────────
  // If this is an update (not a brand-new story) AND all tests in the spec file are
  // currently passing, treat the story change as metadata-only (e.g. a Jira comment
  // edit, whitespace, sprint annotation). Just sync the hash and skip regeneration
  // to protect working test code from being overwritten.
  if (!isNew && specHasUsId(specPath, usId) && scenarioHasUsId(scenarioPath, usId) && allTestsPassingInSpec(obj.specFile)) {
    console.log(`[generate] ${usId} (${objKey}) story metadata changed but all tests passing — syncing hash only, not regenerating`);
    hashStore[hashKey] = { hash: currentHash, objKey };
    saveHashStore(hashStore);
    return 'skipped';
  }

  // 1. Purge the current object files (always)
  removeScenarioSection(scenarioPath, usId);
  removeSpecSection(specPath, usId);

  // 2. GLOBAL PURGE: If this is the first time we see this US-ID in this run,
  // clean it out of ALL OTHER object files. This fixes the "duplicate tests"
  // issue where a story might have moved from one object to another or was
  // previously (erroneously) mapped to multiple objects.
  if (!purgedUsIds.has(usId)) {
    for (const key of Object.keys(OBJECT_MAP)) {
      if (key === objKey) continue;
      const o = OBJECT_MAP[key];
      const otherScenarioPath = path.join('generated', 'test-scenarios', o.scenarioFile);
      const otherSpecPath     = path.join('tests', o.specFile);
      removeScenarioSection(otherScenarioPath, usId);
      removeSpecSection(otherSpecPath, usId);
    }
    purgedUsIds.add(usId);
  }

  bootstrapScenarioFile(scenarioPath, obj);
  await bootstrapSpecFile(objKey);

  const startId           = nextTcId(obj.prefix, scenarioPath);
  const existingScenarios = isNew ? '' : extractExistingScenarios(scenarioPath, usId);
  const existingTestCode  = isNew ? '' : extractExistingTestCode(specPath, usId);

  const result = await callClaude(storyContent, objKey, startId, existingScenarios, existingTestCode);
  if (!result) {
    console.error(`[generate] ❌ Generation failed for ${usId} (${objKey}) — Claude CLI returned null`);
    return 'failed';
  }

  writeScenarioSection(scenarioPath, result.scenarios);
  writeSpecSection(specPath, usId, result.testCode);

  hashStore[hashKey] = { hash: currentHash, objKey };
  saveHashStore(hashStore);

  const tcCount = (result.scenarios.match(/\| TC-[A-Z]+-\d+/g) ?? []).length;
  console.log(`[generate] ✅ ${usId} (${objKey}) → ${tcCount} scenario(s) written to ${obj.specFile}`);

  return isNew ? 'added' : 'updated';
}



/**
 * Main entry point for the Test Generation Agent
 */
export async function generateTestsFromUserStories(jiraStories: any[]) {
    
    // 1. Initialize tracking variables
    const hashStore = loadHashStore();
    let added     = 0;
    let updated   = 0;
    let skipped   = 0;
    let failed    = 0;
    let anyChange = false;

    // 3. Optional: Add logic here if you need to bootstrap empty spec files
    // (This is where the 'header' logic we discussed would live if needed)

    // 4. FINAL RETURN: This must be the absolute last line of the function
    // (final return occurs after all input sources have been processed)
  // ── 1. Jira stories passed directly — no file read needed ────────────────
  if (jiraStories.length > 0) {
    console.log(`[generate] Processing ${jiraStories.length} stories direct from Jira`);
    for (const { usId, objKey, storyContent } of jiraStories) {
      const r = await processStory(usId, storyContent, objKey, hashStore);
      if (r === 'added')   { added++;   anyChange = true; }
      if (r === 'updated') { updated++; anyChange = true; }
      if (r === 'skipped') { skipped++; }
      if (r === 'failed')  { failed++; }
    }
  }

  // ── 2. Scan prompts/user-stories/ — manual single-file stories ───────────
  const promptsDir = path.join('prompts', 'user-stories');
  if (fs.existsSync(promptsDir)) {
    const files = fs.readdirSync(promptsDir).filter(
      f => f.endsWith('.md') && !f.startsWith('_') && fs.statSync(path.join(promptsDir, f)).isFile(),
    );

    for (const file of files) {
      const storyContent = fs.readFileSync(path.join(promptsDir, file), 'utf8');
      const usId         = storyContent.match(/^#{1,2}\s+(US-\d+)/m)?.[1];

      if (!usId) {
        console.warn(`[generate] No US-XXX heading in ${file} — skipping`);
        skipped++;
        continue;
      }

      const r = await processStory(usId, storyContent, null, hashStore);
      if (r === 'added')   { added++;   anyChange = true; }
      if (r === 'updated') { updated++; anyChange = true; }
      if (r === 'skipped') { skipped++; }
      if (r === 'failed')  { failed++; }
    }
  }

  // ── 3. Scan user-stories/ — only when NOT coming from Jira directly ───────
  //    (avoids double-processing the audit file that fetchJiraStories writes)
  if (jiraStories.length === 0) {
    const extraDir = 'user-stories';
    if (fs.existsSync(extraDir)) {
      const files = fs.readdirSync(extraDir).filter(
        f => f.endsWith('.md') && !f.startsWith('_') && fs.statSync(path.join(extraDir, f)).isFile(),
      );

      for (const file of files) {
        const content = fs.readFileSync(path.join(extraDir, file), 'utf8');
        const stories = parseMultiStoryFile(content);

        if (stories.length === 0) {
          console.warn(`[generate] No US-XXX sections found in user-stories/${file} — skipping`);
          skipped++;
          continue;
        }

        for (const { usId, objKey, storyContent } of stories) {
          const r = await processStory(usId, storyContent, objKey || null, hashStore);
          if (r === 'added')   { added++;   anyChange = true; }
          if (r === 'updated') { updated++; anyChange = true; }
          if (r === 'skipped') { skipped++; }
          if (r === 'failed')  { failed++; }
        }
      }
    }
  }

  // ── 4. SAFELY CLOSE ALL DESCRIBE BLOCKS ──────────────────────────────────
  if (anyChange) {
    const testsDir = 'tests';
    if (fs.existsSync(testsDir)) {
      const specFiles = fs.readdirSync(testsDir).filter(f => f.endsWith('.spec.ts'));
      for (const file of specFiles) {
        const filePath = path.join(testsDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        
        // If the file has code but doesn't end properly, close it!
        if (content.includes('test.describe') && !content.trim().endsWith('});')) {
          fs.appendFileSync(filePath, `\n});\n`, 'utf8');
          console.log(`[generate] 🔧 Closed describe block in ${file}`);
        }
      }
    }
  }

 if (added === 0 && updated === 0 && skipped === 0 && failed === 0) {
    return { added: 0, updated: 0, skipped: 0, failed: 0 };
  }

  if (anyChange) updateTestPlanCounts();

  return { added, updated, skipped, failed, tokensIn: _totalTokensIn, tokensOut: _totalTokensOut };
}

// ── Standalone entry-point ────────────────────────────────────────────────────

if (require.main === module) {
  import('dotenv').then(d => d.config()).then(async () => {
    const r = await generateTestsFromUserStories([]);
    if ((r as any).notice) console.log(`[generate] ℹ ${(r as any).notice}`);
  //  if (r.notice) console.log(`[generate] ℹ ${r.notice}`);
    console.log(`[generate] Done — ${r.added} new, ${r.updated} updated, ${r.skipped} skipped.`);
  });
}
