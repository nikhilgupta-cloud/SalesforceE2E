/**
 * generate-tests.ts — AI-powered test generation with smart change detection
 *
 * Drop a .md file into prompts/user-stories/ following _template.md.
 * On every pipeline run this script:
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
 * Usage (standalone):  npx ts-node scripts/generate-tests.ts
 * Usage (pipeline):    called automatically as Step 0
 */
import Anthropic from '@anthropic-ai/sdk';
import * as crypto from 'crypto';
import * as fs     from 'fs';
import * as path   from 'path';
import { getObjectMap, loadConfig } from '../utils/FrameworkConfig';

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

/** Extract existing scenario rows for a specific US from a scenario file */
function extractExistingScenarios(scenarioPath: string, usId: string): string {
  if (!fs.existsSync(scenarioPath)) return '';
  const content = fs.readFileSync(scenarioPath, 'utf8');
  const re = new RegExp(`(## ${usId}:[\\s\\S]*?)(?=\\n## US-|\\s*$)`);
  return content.match(re)?.[1]?.trim() ?? '';
}

// ── Claude API ────────────────────────────────────────────────────────────────

async function callClaude(
  client:            Anthropic,
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

  const idStr  = `TC-${obj.prefix}-${String(startId).padStart(3, '0')}`;
  const isUpdate = existingScenarios.length > 0;

  const system = `You are a Salesforce CPQ QA engineer writing Playwright TypeScript tests.
Rules (apply to every line of code):
- NEVER use waitForLoadState('networkidle') — Salesforce never goes idle.
- ALWAYS use .waitFor({ state: 'visible', timeout: 30000 }), NEVER isVisible().
- Modal selector: '[role="dialog"]:not([id="auraError"]):not([aria-hidden="true"])'.
- Call dismissAuraError(page) after every page.goto().
- Use exact button matching: getByRole('button', { name: 'Save', exact: true }).
- Use .first() on any locator that could match multiple elements.
- actionTimeout is 30000ms.`;

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

Return ONLY valid JSON, no markdown, no extra text:
{
  "scenarios": "## US-XXX: Title\\n\\n| TC ID | Scenario | Expected Result | AC Ref |\\n|-------|----------|-----------------|--------|\\n| TC-${obj.prefix}-NNN | ... | ... | AC-XXX-01 |",
  "testCode": "  // TC-${obj.prefix}-NNN | AC Reference: AC-XXX-01\\n  test('TC-${obj.prefix}-NNN — ...', async ({ page }) => {\\n    ...\\n  });"
}`;

  const msg = await client.messages.create({
    model:      'claude-opus-4-6',
    max_tokens: 4096,
    system,
    messages:   [{ role: 'user', content: user }],
  });

  const raw     = msg.content[0].type === 'text' ? msg.content[0].text : '';
  const cleaned = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```\s*$/m, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    console.error('[generate] ⚠ Claude JSON parse failed. First 300 chars:', cleaned.slice(0, 300));
    return null;
  }
}

// ── Bootstrap: create spec + scenario files from scratch ─────────────────────

/**
 * Called the very first time a spec file is needed for an object.
 * Asks Claude to generate the full file header (imports, helpers, describe wrapper)
 * so the generated test blocks can be appended into a valid TypeScript file.
 */
async function bootstrapSpecFile(
  client:  Anthropic,
  objKey:  string,
): Promise<void> {
  const obj      = OBJECT_MAP[objKey];
  const specPath = path.join('tests', obj.specFile);
  if (fs.existsSync(specPath)) return; // already exists

  const cfg        = loadConfig();
  const masterPrompt = fs.existsSync(path.join('prompts', 'MasterPrompt.md'))
    ? fs.readFileSync(path.join('prompts', 'MasterPrompt.md'), 'utf8').slice(0, 3000)
    : '';

  console.log(`[generate] Bootstrapping new spec file: ${obj.specFile}…`);

  const msg = await client.messages.create({
    model:      'claude-opus-4-6',
    max_tokens: 2048,
    system:     'You are a QA automation engineer. Generate only the FILE HEADER for a Playwright TypeScript spec file — imports, constants, and helper functions. Do NOT include any test() calls. End with the opening line of the test.describe block (opening brace on same line). No closing brace.',
    messages: [{
      role: 'user',
      content: `App: ${cfg.appName}
Base URL env var: ${process.env.SF_SANDBOX_URL ? 'SF_SANDBOX_URL' : 'BASE_URL'}
Object under test: ${obj.displayName}
Spec file name: ${obj.specFile}

Ground rules from MasterPrompt:
${masterPrompt}

Generate the spec file header following the exact patterns in the ground rules.
End your output with: test.describe('${obj.displayName} Tests', () => {
Do not include any test() blocks.`,
    }],
  });

  const header = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '';
  fs.mkdirSync('tests', { recursive: true });
  fs.writeFileSync(specPath, header + '\n\n', 'utf8');
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
  added:   number;   // New stories generated
  updated: number;   // Changed stories regenerated
  skipped: number;   // Unchanged (hash match)
  notice?: string;   // Non-fatal info
}

export async function generateTestsFromUserStories(): Promise<GenerateResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { added: 0, updated: 0, skipped: 0, notice: 'ANTHROPIC_API_KEY not set — skipping AI generation' };
  }

  const storiesDir = path.join('prompts', 'user-stories');
  if (!fs.existsSync(storiesDir)) {
    return { added: 0, updated: 0, skipped: 0 };
  }

  // Only pick up .md files that are NOT the template and NOT inside a subfolder
  const files = fs.readdirSync(storiesDir).filter(
    f => f.endsWith('.md') && !f.startsWith('_') && fs.statSync(path.join(storiesDir, f)).isFile(),
  );
  if (files.length === 0) {
    return { added: 0, updated: 0, skipped: 0 };
  }

  const client    = new Anthropic({ apiKey });
  const hashStore = loadHashStore();
  let added   = 0;
  let updated = 0;
  let skipped = 0;
  let anyChange = false;

  for (const file of files) {
    const filePath     = path.join(storiesDir, file);
    const storyContent = fs.readFileSync(filePath, 'utf8');
    const usId         = storyContent.match(/^#\s+(US-\d+)/m)?.[1];

    if (!usId) {
      console.warn(`[generate] No US-XXX heading found in ${file} — skipping. Add "# US-013: Title".`);
      skipped++;
      continue;
    }

    const currentHash = md5(storyContent);
    const stored      = hashStore[usId];

    // ── UNCHANGED ────────────────────────────────────────────────────────────
    if (stored && stored.hash === currentHash) {
      console.log(`[generate] ${usId} unchanged — skipping`);
      skipped++;
      continue;
    }

    // ── Detect object ─────────────────────────────────────────────────────────
    const objKey = detectObject(storyContent) ?? stored?.objKey;
    if (!objKey) {
      console.warn(`[generate] Cannot detect object in ${file}. Add "**Object:** ${Object.keys(OBJECT_MAP).join(' | ')}" line.`);
      skipped++;
      continue;
    }
    const obj          = OBJECT_MAP[objKey];
    const scenarioPath = path.join('generated', 'test-scenarios', obj.scenarioFile);
    const specPath     = path.join('tests', obj.specFile);

    const isNew    = !stored;
    const label    = isNew ? 'NEW' : 'CHANGED';
    console.log(`[generate] ${label} ${usId} → ${obj.displayName}`);

    // ── CHANGED: remove old blocks ────────────────────────────────────────────
    if (!isNew) {
      console.log(`[generate]   Removing old generated blocks for ${usId}…`);
      removeScenarioSection(scenarioPath, usId);
      removeSpecSection(specPath, usId);
    }

    // ── Bootstrap files if this is a brand-new project ───────────────────────
    bootstrapScenarioFile(scenarioPath, obj);
    await bootstrapSpecFile(client, objKey);

    // ── Generate via Claude ───────────────────────────────────────────────────
    const startId          = nextTcId(obj.prefix, scenarioPath);
    const existingScenarios = isNew ? '' : extractExistingScenarios(scenarioPath, usId);

    const result = await callClaude(client, storyContent, objKey, startId, existingScenarios);
    if (!result) {
      console.error(`[generate] ❌ Generation failed for ${usId} — skipping`);
      skipped++;
      continue;
    }

    // ── Write generated content ───────────────────────────────────────────────
    writeScenarioSection(scenarioPath, result.scenarios);
    writeSpecSection(specPath, usId, result.testCode);

    // ── Update hash store ─────────────────────────────────────────────────────
    hashStore[usId] = { hash: currentHash, objKey };
    saveHashStore(hashStore);

    const tcCount = (result.scenarios.match(/\| TC-[A-Z]+-\d+/g) ?? []).length;
    console.log(`[generate] ✅ ${usId} → ${tcCount} scenario(s) written to ${obj.specFile}`);

    anyChange = true;
    isNew ? added++ : updated++;
  }

  if (anyChange) updateTestPlanCounts();

  return { added, updated, skipped };
}

// ── Standalone entry-point ────────────────────────────────────────────────────

if (require.main === module) {
  import('dotenv').then(d => d.config()).then(async () => {
    const r = await generateTestsFromUserStories();
    if (r.notice) console.log(`[generate] ℹ ${r.notice}`);
    console.log(`[generate] Done — ${r.added} new, ${r.updated} updated, ${r.skipped} skipped.`);
  });
}
