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
import { spawn }     from 'child_process';
import { getObjectMap, loadConfig } from '../utils/FrameworkConfig';

// ── Claude Code CLI helper ────────────────────────────────────────────────────

interface ClaudeResult { text: string; tokensIn: number; tokensOut: number }

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
        'node_modules', '@anthropic-ai', 'claude-code', 'cli.js')]
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

function loadHashStore(): HashStore {
  try { return JSON.parse(fs.readFileSync(HASH_STORE_PATH, 'utf8')); }
  catch { return {}; }
}

function saveHashStore(store: HashStore): void {
  fs.writeFileSync(HASH_STORE_PATH, JSON.stringify(store, null, 2));
}

function md5(str: string): string {
  return crypto.createHash('md5').update(str).digest('hex');
}

// ── Section marker helpers ────────────────────────────────────────────────────

const SPEC_START = (usId: string) =>
  `  // ── ${usId} START ─────────────────────────────────────────────────────`;
const SPEC_END = (usId: string) =>
  `  // ── ${usId} END ───────────────────────────────────────────────────────`;

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

  let currentObjKey = '';
  let currentUsId   = '';
  let currentLines: string[] = [];

  const flush = () => {
    if (currentUsId && currentLines.length > 0) {
      stories.push({ usId: currentUsId, objKey: currentObjKey, storyContent: currentLines.join('\n').trim() });
    }
  };

  for (const line of lines) {
    // "OBJECT 1: ACCOUNT" or "OBJECT 2: CONTACT" — update current object
    const objMatch = line.match(/^OBJECT\s+\d+:\s*(\w+)/i);
    if (objMatch) {
      const objName = objMatch[1].toLowerCase();
      for (const key of Object.keys(OBJECT_MAP)) {
        if (objName.startsWith(key)) { currentObjKey = key; break; }
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

// ── Claude-backed generation ──────────────────────────────────────────────────

async function callClaude(
  storyContent:      string,
  objKey:            string,
  startId:           number,
  existingScenarios: string,  // empty string means NEW, non-empty means UPDATE
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

  const idStr    = `TC-${obj.prefix}-${String(startId).padStart(3, '0')}`;
  const isUpdate = existingScenarios.length > 0;

  const knowledgeContext  = loadKnowledgeContext(objKey);
  const scrapedLocators   = loadScrapedLocators(objKey);

  const system = `You are a Salesforce Revenue Cloud QA engineer writing Playwright TypeScript tests.
Rules (apply to every line of code):
- NEVER use waitForLoadState('networkidle') — Salesforce never goes idle.
- ALWAYS use .waitFor({ state: 'visible', timeout: 30000 }), NEVER isVisible().
- Modal selector: '[role="dialog"]:not([id="auraError"]):not([aria-hidden="true"])'.
- Call dismissAuraError(page) after every page.goto().
- Use exact button matching: getByRole('button', { name: 'Save', exact: true }).
- Use .first() on any locator that could match multiple elements.
- actionTimeout is 30000ms.
- Use native Playwright locators (lightning-input, lightning-combobox, lightning-lookup) — do not import or use SalesforceFormHandler.${scrapedLocators}${knowledgeContext}`;

  const updateContext = isUpdate ? `
IMPORTANT — this is an UPDATE. The story was previously processed and these scenario rows already exist:
--- EXISTING SCENARIOS ---
${existingScenarios}
--- END EXISTING ---
Your job:
- Keep TC-IDs whose AC criteria are UNCHANGED (copy their existing rows and test code exactly).
- Add new TC-IDs for ADDED acceptance criteria (starting at ${idStr}).
- OMIT tests for REMOVED acceptance criteria entirely.
- UPDATE test logic for CHANGED acceptance criteria (keep the TC-ID if possible).
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

  const cfg          = loadConfig();
  const masterPrompt = fs.existsSync(path.join('prompts', 'MasterPrompt.md'))
    ? fs.readFileSync(path.join('prompts', 'MasterPrompt.md'), 'utf8').slice(0, 3000)
    : '';

  const header = await callClaudeCode(
    'You are a QA automation engineer. Generate only the FILE HEADER for a Playwright TypeScript spec file — imports, constants, and helper functions. Do NOT include any test() calls. End with the opening line of the test.describe block (opening brace on same line). No closing brace.',
    `App: ${cfg.appName}
Base URL env var: ${process.env.SF_SANDBOX_URL ? 'SF_SANDBOX_URL' : 'BASE_URL'}
Object under test: ${obj.displayName}
Spec file name: ${obj.specFile}

Ground rules from MasterPrompt:
${masterPrompt}

Generate the spec file header following the exact patterns in the ground rules.
End your output with: test.describe('${obj.displayName} Tests', () => {
Do not include any test() blocks.`,
    `Bootstrapping spec file — ${obj.specFile}`,
  );

  if (!header) {
    console.error(`[generate] ❌ Failed to bootstrap ${obj.specFile}`);
    return;
  }
  _totalTokensIn  += header.tokensIn;
  _totalTokensOut += header.tokensOut;

  fs.mkdirSync('tests', { recursive: true });
  fs.writeFileSync(specPath, header.text.trim() + '\n\n', 'utf8');
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

  // Use "${usId}:${objKey}" as the hash key so the same story can generate
  // independently for each object (E2E stories span Account+Contact+Opp+Quote).
  const hashKey     = `${usId}:${objKey}`;
  const currentHash = md5(storyContent);
  const stored      = hashStore[hashKey];

  if (stored && stored.hash === currentHash) {
    console.log(`[generate] ${usId} (${objKey}) unchanged — skipping`);
    return 'skipped';
  }

  const obj          = OBJECT_MAP[objKey];
  const scenarioPath = path.join('generated', 'test-scenarios', obj.scenarioFile);
  const specPath     = path.join('tests', obj.specFile);
  const isNew        = !stored;

  console.log(`[generate] ${isNew ? 'NEW' : 'CHANGED'} ${usId} → ${obj.displayName}`);

  if (!isNew) {
    console.log(`[generate]   Removing old generated blocks for ${usId}…`);
    removeScenarioSection(scenarioPath, usId);
    removeSpecSection(specPath, usId);
  }

  bootstrapScenarioFile(scenarioPath, obj);
  await bootstrapSpecFile(objKey);

  const startId           = nextTcId(obj.prefix, scenarioPath);
  const existingScenarios = isNew ? '' : extractExistingScenarios(scenarioPath, usId);

  const result = await callClaude(storyContent, objKey, startId, existingScenarios);
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

export async function generateTestsFromUserStories(): Promise<GenerateResult> {
  // Reset module-level token accumulators for this run
  _totalTokensIn  = 0;
  _totalTokensOut = 0;

  const hashStore = loadHashStore();
  let added     = 0;
  let updated   = 0;
  let skipped   = 0;
  let failed    = 0;
  let anyChange = false;

  // ── 1. Scan prompts/user-stories/ — one file per user story ──────────────
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

  // ── 2. Scan user-stories/ — multi-story files (e.g. CPQ_User_stories.md) ─
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

  if (added === 0 && updated === 0 && skipped === 0 && failed === 0) {
    return { added: 0, updated: 0, skipped: 0, failed: 0 };
  }

  if (anyChange) updateTestPlanCounts();

  return { added, updated, skipped, failed, tokensIn: _totalTokensIn, tokensOut: _totalTokensOut };
}

// ── Standalone entry-point ────────────────────────────────────────────────────

if (require.main === module) {
  import('dotenv').then(d => d.config()).then(async () => {
    const r = await generateTestsFromUserStories();
    if (r.notice) console.log(`[generate] ℹ ${r.notice}`);
    console.log(`[generate] Done — ${r.added} new, ${r.updated} updated, ${r.skipped} skipped.`);
  });
}
