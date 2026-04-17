/**
 * audit-orphans.ts — Story Traceability Enforcer
 *
 * Scans every Playwright spec file in tests/ and flags any test() call that is
 * NOT inside a  // ── US-XXX START ──  ...  // ── US-XXX END ──  marker block.
 *
 * A test without a story marker is an "orphan" — it runs in Playwright and
 * appears in the dashboard, but it has no backing user story (Jira or local).
 * This violates the rule: "Only Jira-sourced stories should drive what is tested."
 *
 * Outputs:
 *   - Console report (always)
 *   - reports/orphan-report.md (always)
 *
 * Exit codes:
 *   0 — no orphans (all tests are story-backed)
 *   1 — orphans found (when called with --fail flag)
 *   0 — orphans found but --warn-only (default; pipeline does not stop)
 *
 * Usage:
 *   npx ts-node scripts/audit-orphans.ts            # warn-only (default)
 *   npx ts-node scripts/audit-orphans.ts --fail     # fail pipeline on orphans
 */

import * as fs   from 'fs';
import * as path from 'path';
import { loadConfig } from '../utils/FrameworkConfig';

const FAIL_ON_ORPHAN = process.argv.includes('--fail');

// ── Types ─────────────────────────────────────────────────────────────────────

interface OrphanTest {
  tcId:      string;   // TC-ACC-001 (extracted from title) or '—'
  title:     string;   // Full test title
  specFile:  string;   // account.spec.ts
  line:      number;   // approx line number (1-based)
  storyHint: string;   // AC Reference comment if present
}

interface AuditResult {
  totalTests:    number;
  backTests:     number;   // backed by a story marker
  orphanTests:   number;
  orphans:       OrphanTest[];
  storyIds:      string[]; // US-IDs found in markers
}

// ── Marker regex ──────────────────────────────────────────────────────────────

const START_RE = /\/\/\s*──\s*(US-\d+)\s*START/;
const END_RE   = /\/\/\s*──\s*(US-\d+)\s*END/;
const TEST_RE  = /^\s*test\s*\(/;
const TITLE_RE = /^\s*test\s*\(\s*['"`](.*?)['"`]/;
const TC_RE    = /TC-[A-Z]+-\d+/;
const AC_RE    = /AC Reference:\s*(AC-\d+-\d+)/i;

// ── Parse a single spec file ───────────────────────────────────────────────────

function auditFile(specPath: string): { tests: number; orphans: OrphanTest[]; storyIds: string[] } {
  if (!fs.existsSync(specPath)) return { tests: 0, orphans: [], storyIds: [] };

  const lines    = fs.readFileSync(specPath, 'utf8').split('\n');
  const orphans: OrphanTest[] = [];
  const storyIds: string[]    = [];
  let   insideStory = false;
  let   totalTests  = 0;
  let   prevComment = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track story markers
    const startMatch = line.match(START_RE);
    if (startMatch) {
      insideStory = true;
      if (!storyIds.includes(startMatch[1])) storyIds.push(startMatch[1]);
      continue;
    }
    if (END_RE.test(line)) {
      insideStory = false;
      continue;
    }

    // Remember AC Reference comments for context
    const acMatch = line.match(AC_RE);
    if (acMatch) prevComment = acMatch[1];

    // Detect test() calls
    if (TEST_RE.test(line)) {
      totalTests++;
      if (!insideStory) {
        const titleMatch = line.match(TITLE_RE);
        const title      = titleMatch ? titleMatch[1] : line.trim().slice(0, 80);
        const tcId       = title.match(TC_RE)?.[0] ?? '—';
        orphans.push({
          tcId,
          title,
          specFile: path.basename(specPath),
          line:     i + 1,
          storyHint: prevComment,
        });
      }
      prevComment = ''; // reset after seeing a test
    }
  }

  return { tests: totalTests, orphans, storyIds };
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function auditOrphans(): AuditResult {
  const cfg = loadConfig();

  let totalTests = 0;
  let totalOrphans = 0;
  const allOrphans: OrphanTest[] = [];
  const allStoryIds: string[]    = [];

  for (const obj of cfg.objects) {
    const specPath = path.join('tests', obj.specFile);
    const { tests, orphans, storyIds } = auditFile(specPath);
    totalTests   += tests;
    totalOrphans += orphans.length;
    allOrphans.push(...orphans);
    for (const s of storyIds) if (!allStoryIds.includes(s)) allStoryIds.push(s);

    if (orphans.length === 0) {
      console.log(`[orphan-audit] ✅ ${obj.specFile} — all ${tests} test(s) are story-backed`);
    } else {
      console.warn(`[orphan-audit] ⚠ ${obj.specFile} — ${orphans.length} orphan(s) detected:`);
      for (const o of orphans) {
        console.warn(`  line ${o.line}: ${o.title}`);
      }
    }
  }

  const result: AuditResult = {
    totalTests,
    backTests:   totalTests - totalOrphans,
    orphanTests: totalOrphans,
    orphans:     allOrphans,
    storyIds:    allStoryIds.sort(),
  };

  // ── Write orphan report ───────────────────────────────────────────────────
  const today = new Date().toISOString().split('T')[0];
  const lines: string[] = [
    `# Orphan Test Report — ${today}`,
    '',
    `**Total tests:** ${totalTests}  `,
    `**Story-backed:** ${result.backTests}  `,
    `**Orphans:** ${totalOrphans}  `,
    `**Active story markers:** ${allStoryIds.join(', ') || 'none'}`,
    '',
  ];

  if (totalOrphans === 0) {
    lines.push('✅ All tests are backed by a user story. No orphans detected.');
  } else {
    lines.push(
      `## ⚠ Orphan Tests (${totalOrphans})`,
      '',
      'These tests have **no backing user story marker** (`// ── US-XXX START ──`).',
      'They run in Playwright and appear in the dashboard but cannot be traced to a Jira story.',
      '',
      '| TC ID | Spec File | Line | Test Title | AC Hint |',
      '|-------|-----------|------|-----------|---------|',
      ...allOrphans.map(o =>
        `| ${o.tcId} | ${o.specFile} | ${o.line} | ${o.title.slice(0, 60)} | ${o.storyHint} |`,
      ),
      '',
      '## How to Fix',
      '',
      '1. **For each orphan**, identify which Jira story it belongs to.',
      '2. Wrap the test(s) in story markers:',
      '   ```ts',
      '   // ── US-001 START ─────────────────────────────────────────────────────',
      '   test(\'TC-ACC-001 — ...\', async ({ page }) => { ... });',
      '   // ── US-001 END ───────────────────────────────────────────────────────',
      '   ```',
      '3. Create a matching user story file in `prompts/user-stories/US_001_xxx.md`.',
      '4. Re-run `npm run pipeline` — the story will be tracked and the orphan removed.',
    );
  }

  fs.mkdirSync('reports', { recursive: true });
  fs.writeFileSync(path.join('reports', 'orphan-report.md'), lines.join('\n') + '\n', 'utf8');

  console.log(`[orphan-audit] Report written → reports/orphan-report.md`);
  return result;
}

// ── Standalone entry-point ────────────────────────────────────────────────────

if (require.main === module) {
  import('dotenv').then(d => d.config()).then(() => {
    const r = auditOrphans();
    console.log(`\n[orphan-audit] Summary: ${r.backTests}/${r.totalTests} backed · ${r.orphanTests} orphan(s)`);
    if (r.orphanTests > 0 && FAIL_ON_ORPHAN) {
      console.error('[orphan-audit] ❌ Orphans detected — pipeline halted (--fail mode)');
      process.exit(1);
    }
    if (r.orphanTests > 0) {
      console.warn('[orphan-audit] ⚠ Orphans detected — see reports/orphan-report.md (--fail to block pipeline)');
    }
  });
}
