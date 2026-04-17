/**
 * export-to-csv.ts — Post-run CSV exporter
 *
 * Reads:
 *   reports/results.json          — Playwright JSON reporter output
 *   generated/test-scenarios/*.md — Scenario tables (TC-ID, US-ID, AC refs)
 *
 * Writes:
 *   reports/test-results.csv      — One row per test (execution results)
 *   reports/scenario-matrix.csv   — Full traceability matrix joined with run results
 *
 * Usage (standalone):  npx ts-node scripts/export-to-csv.ts
 * Usage (pipeline):    called automatically as Step 5.5 (after healing, before copy)
 *
 * Both files can be opened directly in Excel / Google Sheets for review.
 */

import * as fs   from 'fs';
import * as path from 'path';
import { loadConfig } from '../utils/FrameworkConfig';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TestRow {
  tcId:       string;   // TC-ACC-001
  object:     string;   // Account
  title:      string;   // Full test title
  status:     string;   // passed | failed | skipped | timedOut
  durationS:  string;   // e.g. "12.34"
  errorMsg:   string;   // First line of error message, sanitised for CSV
  acRef:      string;   // From scenario file, e.g. "AC-001-01"
  usId:       string;   // US-001
  scenario:   string;   // Scenario description
  expected:   string;   // Expected result
  file:       string;   // account.spec.ts
  line:       number;
  runDate:    string;   // ISO date
}

interface ScenarioRow {
  tcId:       string;
  object:     string;
  usId:       string;
  scenario:   string;
  expected:   string;
  acRef:      string;
}

export interface CsvExportResult {
  testRows:     number;
  scenarioRows: number;
  resultsPath:  string;
  matrixPath:   string;
}

// ── CSV helpers ───────────────────────────────────────────────────────────────

/**
 * Escape a single CSV cell value.
 * Wraps in quotes if value contains commas, quotes, or newlines.
 */
function csvCell(value: string | number): string {
  const s = String(value ?? '');
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function csvRow(cells: (string | number)[]): string {
  return cells.map(csvCell).join(',');
}

// ── Parse Playwright results.json ─────────────────────────────────────────────

interface RawSpec {
  title:   string;
  ok:      boolean;
  file:    string;
  line:    number;
  tests:   { results: { status: string; duration: number; error?: { message?: string } }[] }[];
}

interface FlatResult {
  title:     string;
  file:      string;
  line:      number;
  status:    string;
  durationMs: number;
  errorMsg:  string;
}

function flattenResults(resultsPath: string): FlatResult[] {
  if (!fs.existsSync(resultsPath)) return [];
  const raw = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));

  const out: FlatResult[] = [];

  function walkSuite(suite: any) {
    for (const spec of (suite.specs ?? []) as RawSpec[]) {
      const firstResult = spec.tests?.[0]?.results?.[0];
      if (!firstResult) continue;

      const rawMsg = firstResult.error?.message ?? '';
      // Strip ANSI escape codes and keep first 200 chars
      const cleanMsg = rawMsg
        .replace(/\u001b\[[0-9;]*m/g, '')
        .split('\n')[0]
        .slice(0, 200);

      out.push({
        title:      spec.title,
        file:       path.basename(spec.file ?? ''),
        line:       spec.line,
        status:     firstResult.status,
        durationMs: firstResult.duration ?? 0,
        errorMsg:   cleanMsg,
      });
    }
    for (const child of suite.suites ?? []) walkSuite(child);
  }

  for (const suite of raw.suites ?? []) walkSuite(suite);
  return out;
}

// ── Parse scenario markdown files ─────────────────────────────────────────────

/**
 * Parse a scenario file like:
 *   ## US-005: Quote Execution Status
 *   | TC-QTE-038 | Scenario text | Expected result | AC-005-01 |
 */
function parseScenarioFile(content: string, objectName: string): ScenarioRow[] {
  const rows: ScenarioRow[] = [];
  let currentUsId = '';

  for (const line of content.split('\n')) {
    const usMatch = line.match(/^##\s+(US-\d+)/);
    if (usMatch) {
      currentUsId = usMatch[1];
      continue;
    }

    // Match table data rows (not header, not separator)
    const tableMatch = line.match(/^\|\s*(TC-[A-Z]+-\d+)\s*\|([^|]*)\|([^|]*)\|([^|]*)\|/);
    if (tableMatch) {
      rows.push({
        tcId:     tableMatch[1].trim(),
        object:   objectName,
        usId:     currentUsId,
        scenario: tableMatch[2].trim(),
        expected: tableMatch[3].trim(),
        acRef:    tableMatch[4].trim(),
      });
    }
  }

  return rows;
}

function loadAllScenarios(cfg: ReturnType<typeof loadConfig>): Map<string, ScenarioRow> {
  const map = new Map<string, ScenarioRow>();

  for (const obj of cfg.objects) {
    const scenarioPath = path.join('generated', 'test-scenarios', obj.scenarioFile);
    if (!fs.existsSync(scenarioPath)) continue;

    const content = fs.readFileSync(scenarioPath, 'utf8');
    const rows    = parseScenarioFile(content, obj.displayName);
    for (const row of rows) map.set(row.tcId, row);
  }

  return map;
}

// ── Detect object from file name ───────────────────────────────────────────────

function objectFromFile(file: string, cfg: ReturnType<typeof loadConfig>): string {
  for (const obj of cfg.objects) {
    if (obj.specFile === file) return obj.displayName;
  }
  return file.replace('.spec.ts', '');
}

// ── Extract TC-ID from test title ─────────────────────────────────────────────

function extractTcId(title: string): string {
  const m = title.match(/TC-[A-Z]+-\d+/);
  return m ? m[0] : '';
}

// ── Main export function ───────────────────────────────────────────────────────

export function exportToCsv(): CsvExportResult {
  const cfg         = loadConfig();
  const resultsPath = path.join('reports', 'results.json');
  const runDate     = new Date().toISOString().split('T')[0];

  fs.mkdirSync('reports', { recursive: true });

  // 1. Load execution results
  const flatResults  = flattenResults(resultsPath);
  const resultsByTcId = new Map<string, FlatResult>();
  const resultsByTitle = new Map<string, FlatResult>();

  for (const r of flatResults) {
    const tcId = extractTcId(r.title);
    if (tcId) resultsByTcId.set(tcId, r);
    resultsByTitle.set(r.title, r);
  }

  // 2. Load scenario metadata
  const scenarioMap = loadAllScenarios(cfg);

  // 3. Build unified test rows (one per test result)
  const testRows: TestRow[] = [];

  for (const r of flatResults) {
    const tcId    = extractTcId(r.title);
    const scenario = tcId ? scenarioMap.get(tcId) : undefined;
    const obj     = objectFromFile(r.file, cfg);

    testRows.push({
      tcId:      tcId || '—',
      object:    scenario?.object ?? obj,
      title:     r.title,
      status:    r.status,
      durationS: (r.durationMs / 1000).toFixed(2),
      errorMsg:  r.errorMsg,
      acRef:     scenario?.acRef   ?? '',
      usId:      scenario?.usId    ?? '',
      scenario:  scenario?.scenario ?? '',
      expected:  scenario?.expected ?? '',
      file:      r.file,
      line:      r.line,
      runDate,
    });
  }

  // 4. Write reports/test-results.csv
  const resultsOut = path.join('reports', 'test-results.csv');
  const resultsHeader = csvRow([
    'TC ID', 'Object', 'User Story', 'Title', 'Status',
    'Duration (s)', 'AC Reference', 'Error Message', 'File', 'Line', 'Run Date',
  ]);
  const resultsLines = testRows.map(r => csvRow([
    r.tcId, r.object, r.usId, r.title, r.status,
    r.durationS, r.acRef, r.errorMsg, r.file, r.line, r.runDate,
  ]));
  fs.writeFileSync(resultsOut, [resultsHeader, ...resultsLines].join('\n') + '\n', 'utf8');

  // 5. Build scenario matrix (all scenarios + joined run status)
  const matrixRows: ScenarioRow[] = [];
  for (const obj of cfg.objects) {
    const scenarioPath = path.join('generated', 'test-scenarios', obj.scenarioFile);
    if (!fs.existsSync(scenarioPath)) continue;
    const rows = parseScenarioFile(fs.readFileSync(scenarioPath, 'utf8'), obj.displayName);
    matrixRows.push(...rows);
  }

  const matrixOut = path.join('reports', 'scenario-matrix.csv');
  const matrixHeader = csvRow([
    'TC ID', 'Object', 'User Story', 'Scenario', 'Expected Result',
    'AC Reference', 'Test Status', 'Duration (s)', 'Error Message', 'Run Date',
  ]);
  const matrixLines = matrixRows.map(s => {
    const exec = resultsByTcId.get(s.tcId);
    return csvRow([
      s.tcId, s.object, s.usId, s.scenario, s.expected, s.acRef,
      exec?.status     ?? 'not run',
      exec ? (exec.durationMs / 1000).toFixed(2) : '',
      exec?.errorMsg   ?? '',
      runDate,
    ]);
  });
  fs.writeFileSync(matrixOut, [matrixHeader, ...matrixLines].join('\n') + '\n', 'utf8');

  console.log(`[csv] ✅ test-results.csv    — ${testRows.length} rows → ${resultsOut}`);
  console.log(`[csv] ✅ scenario-matrix.csv — ${matrixRows.length} rows → ${matrixOut}`);

  return {
    testRows:     testRows.length,
    scenarioRows: matrixRows.length,
    resultsPath:  resultsOut,
    matrixPath:   matrixOut,
  };
}

// ── Standalone entry-point ────────────────────────────────────────────────────

if (require.main === module) {
  import('dotenv').then(d => d.config()).then(() => {
    const r = exportToCsv();
    console.log(`[csv] Done — ${r.testRows} test rows · ${r.scenarioRows} scenario rows`);
  });
}
