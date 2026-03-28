/**
 * DashboardReporter — Live HTML dashboard for Playwright test runs
 * Generates reports/dashboard.html after every test with embedded data.
 * Open the HTML file in a browser — it auto-refreshes every 2s while running.
 */
import type {
  Reporter, FullConfig, Suite, TestCase, TestResult, FullResult,
} from '@playwright/test/reporter';
import * as fs from 'fs';
import * as path from 'path';

interface TestInfo {
  id: string;
  title: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
}

interface SuiteData {
  displayName: string;
  icon: string;
  color: string;
  tests: TestInfo[];
}

const SUITE_META: Record<string, { displayName: string; icon: string; color: string }> = {
  account:     { displayName: 'Account',     icon: '🏢', color: '#6366f1' },
  contact:     { displayName: 'Contact',     icon: '👤', color: '#8b5cf6' },
  opportunity: { displayName: 'Opportunity', icon: '💼', color: '#06b6d4' },
  quote:       { displayName: 'Quote (CPQ)', icon: '📋', color: '#10b981' },
};

function extractSuiteKey(filePath: string): string {
  const base = path.basename(filePath, '.spec.ts').toLowerCase();
  return Object.keys(SUITE_META).find(k => base.includes(k)) ?? base;
}

function extractTestId(title: string): string {
  const match = title.match(/TC-[A-Z]+-\d+/);
  return match ? match[0] : '';
}

class DashboardReporter implements Reporter {
  private suites: Map<string, SuiteData> = new Map();
  private startTime = Date.now();
  private isComplete = false;
  private overallStatus: 'running' | 'passed' | 'failed' = 'running';
  private outputPath = path.join('reports', 'dashboard.html');

  onBegin(_config: FullConfig, rootSuite: Suite): void {
    fs.mkdirSync('reports', { recursive: true });
    // Pre-populate all tests as pending
    for (const suite of rootSuite.allTests().map(t => t.parent)) {
      // no-op: handled per test below
    }
    for (const test of rootSuite.allTests()) {
      const key = extractSuiteKey(test.location.file);
      const meta = SUITE_META[key] ?? { displayName: key, icon: '🧪', color: '#64748b' };
      if (!this.suites.has(key)) {
        this.suites.set(key, { ...meta, tests: [] });
      }
      this.suites.get(key)!.tests.push({
        id: extractTestId(test.title),
        title: test.title,
        status: 'pending',
        duration: 0,
      });
    }
    this.render();
  }

  onTestBegin(test: TestCase): void {
    const key = extractSuiteKey(test.location.file);
    const suite = this.suites.get(key);
    if (!suite) return;
    const t = suite.tests.find(x => x.title === test.title);
    if (t) t.status = 'running';
    this.render();
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const key = extractSuiteKey(test.location.file);
    const suite = this.suites.get(key);
    if (!suite) return;
    const t = suite.tests.find(x => x.title === test.title);
    if (t) {
      t.status = result.status === 'passed' ? 'passed'
               : result.status === 'skipped' ? 'skipped'
               : 'failed';
      t.duration = result.duration;
      if (result.status === 'failed' && result.errors?.length) {
        t.error = result.errors[0].message?.split('\n')[0]?.substring(0, 120);
      }
    }
    this.render();
  }

  onEnd(result: FullResult): void {
    this.isComplete = true;
    this.overallStatus = result.status === 'passed' ? 'passed' : 'failed';
    this.render();
    const dashPath = path.resolve(this.outputPath);
    console.log(`\n📊 Dashboard: file:///${dashPath.replace(/\\/g, '/')}\n`);
  }

  // ── HTML Generation ────────────────────────────────────────────────────────

  private render(): void {
    const html = this.buildHtml();
    fs.writeFileSync(this.outputPath, html, 'utf8');
  }

  private stats() {
    let total = 0, passed = 0, failed = 0, running = 0, pending = 0;
    for (const s of this.suites.values()) {
      for (const t of s.tests) {
        total++;
        if (t.status === 'passed')  passed++;
        else if (t.status === 'failed')  failed++;
        else if (t.status === 'running') running++;
        else if (t.status === 'pending') pending++;
      }
    }
    const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
    const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const ss = String(elapsed % 60).padStart(2, '0');
    return { total, passed, failed, running, pending, elapsed, elapsedStr: `${mm}:${ss}` };
  }

  private buildHtml(): string {
    const st = this.stats();
    const passRate = st.total > 0 ? Math.round((st.passed / st.total) * 100) : 0;
    const refreshMeta = this.isComplete ? '' : '<meta http-equiv="refresh" content="2">';
    const statusLabel = this.isComplete
      ? (this.overallStatus === 'passed' ? 'COMPLETED ✅' : 'COMPLETED WITH FAILURES ❌')
      : 'RUNNING…';
    const statusClass = this.isComplete
      ? (this.overallStatus === 'passed' ? 'status-pass' : 'status-fail')
      : 'status-running';

    const suiteCards = [...this.suites.entries()].map(([, s]) => {
      const tot = s.tests.length;
      const pas = s.tests.filter(t => t.status === 'passed').length;
      const fai = s.tests.filter(t => t.status === 'failed').length;
      const run = s.tests.filter(t => t.status === 'running').length;
      const pct = tot > 0 ? Math.round((pas / tot) * 100) : 0;
      const cardClass = fai > 0 ? 'card-fail' : run > 0 ? 'card-running' : pas === tot ? 'card-pass' : 'card-idle';
      return `
        <div class="suite-card ${cardClass}">
          <div class="suite-icon">${s.icon}</div>
          <div class="suite-name">${s.displayName}</div>
          <div class="suite-counts">
            <span class="cnt-pass">${pas}</span>/<span class="cnt-total">${tot}</span>
            ${fai > 0 ? `<span class="cnt-fail"> · ${fai} failed</span>` : ''}
            ${run > 0 ? `<span class="cnt-run"> · ${run} running</span>` : ''}
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width:${pct}%; background:${s.color}"></div>
          </div>
          <div class="suite-pct">${pct}%</div>
        </div>`;
    }).join('');

    const testRows = [...this.suites.entries()].map(([, s]) => {
      const rows = s.tests.map(t => {
        const icon = t.status === 'passed'  ? '✅'
                   : t.status === 'failed'  ? '❌'
                   : t.status === 'running' ? '⟳'
                   : t.status === 'skipped' ? '⏭'
                   : '○';
        const cls = `tile tile-${t.status}`;
        const dur = t.duration > 0 ? `${(t.duration / 1000).toFixed(1)}s` : '';
        const errHtml = t.error ? `<div class="tile-error">${escHtml(t.error)}</div>` : '';
        return `
          <div class="${cls}">
            <span class="tile-icon">${icon}</span>
            <div class="tile-body">
              <div class="tile-id">${t.id}</div>
              <div class="tile-title">${escHtml(t.title.replace(/^TC-[A-Z]+-\d+\s*[—-]\s*/, ''))}</div>
              ${errHtml}
            </div>
            <div class="tile-dur">${dur}</div>
          </div>`;
      }).join('');
      return `
        <div class="suite-section">
          <div class="section-header">
            <span class="section-icon">${s.icon}</span>
            <span class="section-title">${s.displayName}</span>
            <span class="section-badge">${s.tests.filter(t => t.status === 'passed').length}/${s.tests.length}</span>
          </div>
          <div class="tile-grid">${rows}</div>
        </div>`;
    }).join('');

    const runDate = new Date().toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${refreshMeta}
<title>SF CPQ QA Dashboard</title>
<style>
  /* ── Reset & Base ───────────────────────────── */
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg:        #050914;
    --bg2:       #0d1225;
    --bg3:       #111827;
    --glass:     rgba(255,255,255,0.04);
    --glass2:    rgba(255,255,255,0.07);
    --border:    rgba(255,255,255,0.08);
    --text:      #f1f5f9;
    --muted:     #94a3b8;
    --pass:      #10b981;
    --fail:      #ef4444;
    --run:       #f59e0b;
    --skip:      #6366f1;
    --pend:      #374151;
    --accent1:   #7c3aed;
    --accent2:   #2563eb;
    --radius:    14px;
    --shadow:    0 8px 32px rgba(0,0,0,0.4);
  }
  html { height: 100%; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
    padding: 0 0 60px;
  }

  /* ── Header ─────────────────────────────────── */
  .header {
    background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
    border-bottom: 1px solid var(--border);
    padding: 28px 40px 24px;
    position: sticky; top: 0; z-index: 100;
    backdrop-filter: blur(20px);
  }
  .header-top {
    display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;
  }
  .brand { display: flex; align-items: center; gap: 14px; }
  .brand-logo {
    width: 48px; height: 48px;
    background: linear-gradient(135deg, var(--accent1), var(--accent2));
    border-radius: 12px;
    display: flex; align-items: center; justify-content: center;
    font-size: 24px; box-shadow: 0 4px 20px rgba(124,58,237,0.5);
  }
  .brand-text h1 { font-size: 20px; font-weight: 700; letter-spacing: -0.5px; }
  .brand-text p  { font-size: 12px; color: var(--muted); margin-top: 2px; }
  .header-meta { font-size: 12px; color: var(--muted); text-align: right; line-height: 1.8; }

  /* ── Status Pill ─────────────────────────────── */
  .status-pill {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 8px 18px; border-radius: 999px; font-size: 13px; font-weight: 600;
    margin-top: 16px;
  }
  .status-running { background: rgba(245,158,11,0.15); color: var(--run); border: 1px solid rgba(245,158,11,0.3); }
  .status-pass    { background: rgba(16,185,129,0.15); color: var(--pass); border: 1px solid rgba(16,185,129,0.3); }
  .status-fail    { background: rgba(239,68,68,0.15);  color: var(--fail); border: 1px solid rgba(239,68,68,0.3); }
  .pulse { width: 8px; height: 8px; border-radius: 50%; background: currentColor; animation: pulse 1.2s ease-in-out infinite; }
  @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(0.7)} }

  /* ── Stat Bar ────────────────────────────────── */
  .stat-bar {
    display: flex; align-items: center; gap: 8px; margin-top: 20px; flex-wrap: wrap;
  }
  .stat-chip {
    padding: 6px 14px; border-radius: 8px; font-size: 13px; font-weight: 600;
    display: flex; align-items: center; gap: 6px;
  }
  .chip-total   { background: var(--glass2); color: var(--text); }
  .chip-pass    { background: rgba(16,185,129,0.15); color: var(--pass); }
  .chip-fail    { background: rgba(239,68,68,0.15);  color: var(--fail); }
  .chip-run     { background: rgba(245,158,11,0.15); color: var(--run); }
  .chip-pend    { background: rgba(100,116,139,0.15); color: var(--muted); }
  .chip-time    { background: rgba(99,102,241,0.15); color: #a5b4fc; }
  .chip-rate    { background: linear-gradient(135deg,rgba(124,58,237,0.2),rgba(37,99,235,0.2)); color: #c4b5fd; border: 1px solid rgba(124,58,237,0.3); }
  .divider { width: 1px; height: 20px; background: var(--border); }

  /* ── Main Content ────────────────────────────── */
  .main { max-width: 1400px; margin: 0 auto; padding: 32px 40px 0; }

  /* ── Section Label ───────────────────────────── */
  .label {
    font-size: 11px; font-weight: 700; letter-spacing: 1.5px;
    color: var(--muted); text-transform: uppercase; margin-bottom: 16px;
    display: flex; align-items: center; gap: 10px;
  }
  .label::after { content:''; flex:1; height:1px; background: var(--border); }

  /* ── Suite Cards ─────────────────────────────── */
  .suite-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 16px; margin-bottom: 40px;
  }
  .suite-card {
    background: var(--glass); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 22px 20px;
    transition: transform .2s, box-shadow .2s;
    position: relative; overflow: hidden;
  }
  .suite-card::before {
    content: ''; position: absolute; inset: 0;
    background: linear-gradient(135deg, rgba(255,255,255,0.03), transparent);
    pointer-events: none;
  }
  .suite-card:hover { transform: translateY(-3px); box-shadow: var(--shadow); }
  .card-pass    { border-color: rgba(16,185,129,0.25);  }
  .card-fail    { border-color: rgba(239,68,68,0.35);   }
  .card-running { border-color: rgba(245,158,11,0.3); animation: borderPulse 2s ease-in-out infinite; }
  .card-idle    { border-color: var(--border); }
  @keyframes borderPulse {
    0%,100%{ border-color: rgba(245,158,11,0.3); }
    50%    { border-color: rgba(245,158,11,0.7); }
  }
  .suite-icon   { font-size: 28px; margin-bottom: 8px; }
  .suite-name   { font-size: 15px; font-weight: 700; margin-bottom: 6px; }
  .suite-counts { font-size: 22px; font-weight: 800; margin-bottom: 14px; color: var(--text); }
  .cnt-pass     { color: var(--pass); }
  .cnt-total    { color: var(--muted); }
  .cnt-fail     { font-size: 13px; color: var(--fail); font-weight: 600; }
  .cnt-run      { font-size: 13px; color: var(--run);  font-weight: 600; }
  .progress-track {
    height: 6px; background: rgba(255,255,255,0.08); border-radius: 99px; overflow: hidden; margin-bottom: 8px;
  }
  .progress-fill {
    height: 100%; border-radius: 99px;
    transition: width 0.6s cubic-bezier(0.4,0,0.2,1);
    box-shadow: 0 0 8px currentColor;
  }
  .suite-pct { font-size: 12px; color: var(--muted); font-weight: 600; }

  /* ── Overall Progress Bar ────────────────────── */
  .overall-bar { margin-bottom: 40px; }
  .overall-track {
    height: 10px; background: rgba(255,255,255,0.06); border-radius: 99px;
    overflow: hidden; position: relative;
  }
  .overall-fill {
    height: 100%; border-radius: 99px;
    background: linear-gradient(90deg, var(--accent1), var(--accent2));
    transition: width 0.6s cubic-bezier(0.4,0,0.2,1);
    box-shadow: 0 0 12px rgba(124,58,237,0.6);
  }
  .overall-labels {
    display: flex; justify-content: space-between;
    font-size: 12px; color: var(--muted); margin-top: 8px;
  }

  /* ── Suite Sections ──────────────────────────── */
  .suite-section { margin-bottom: 36px; }
  .section-header {
    display: flex; align-items: center; gap: 10px;
    margin-bottom: 14px;
  }
  .section-icon  { font-size: 20px; }
  .section-title { font-size: 16px; font-weight: 700; }
  .section-badge {
    padding: 3px 10px; border-radius: 99px; font-size: 12px; font-weight: 700;
    background: var(--glass2); color: var(--pass);
    border: 1px solid rgba(16,185,129,0.2);
  }

  /* ── Test Tiles ──────────────────────────────── */
  .tile-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(310px, 1fr));
    gap: 10px;
  }
  .tile {
    display: flex; align-items: flex-start; gap: 12px;
    padding: 14px 16px; border-radius: 10px;
    border: 1px solid var(--border);
    background: var(--glass);
    transition: transform .15s, box-shadow .15s;
    position: relative; overflow: hidden;
  }
  .tile:hover { transform: translateY(-2px); box-shadow: 0 4px 16px rgba(0,0,0,0.3); }
  .tile-passed  { border-color: rgba(16,185,129,0.2); }
  .tile-failed  { border-color: rgba(239,68,68,0.3); background: rgba(239,68,68,0.05); }
  .tile-running {
    border-color: rgba(245,158,11,0.4);
    background: rgba(245,158,11,0.05);
    animation: tileGlow 2s ease-in-out infinite;
  }
  .tile-skipped { border-color: rgba(99,102,241,0.2); opacity: 0.7; }
  .tile-pending { opacity: 0.45; }
  @keyframes tileGlow {
    0%,100%{ box-shadow: 0 0 0 rgba(245,158,11,0); }
    50%    { box-shadow: 0 0 16px rgba(245,158,11,0.2); }
  }
  .tile-running::before {
    content: ''; position: absolute; top: 0; left: -100%;
    width: 60%; height: 100%;
    background: linear-gradient(90deg, transparent, rgba(245,158,11,0.08), transparent);
    animation: shimmer 1.6s ease-in-out infinite;
  }
  @keyframes shimmer { to { left: 200%; } }
  .tile-icon { font-size: 18px; flex-shrink: 0; margin-top: 1px; }
  .tile-running .tile-icon { animation: spin 1.2s linear infinite; display: inline-block; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .tile-body { flex: 1; min-width: 0; }
  .tile-id    { font-size: 10px; font-weight: 700; letter-spacing: 1px; color: var(--muted); margin-bottom: 3px; }
  .tile-title { font-size: 13px; font-weight: 500; line-height: 1.4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tile-error { font-size: 11px; color: var(--fail); margin-top: 5px; line-height: 1.4; opacity: 0.9; word-break: break-word; white-space: normal; }
  .tile-dur   { font-size: 11px; color: var(--muted); flex-shrink: 0; font-variant-numeric: tabular-nums; }

  /* ── Footer ──────────────────────────────────── */
  .footer {
    text-align: center; padding: 40px 20px 20px;
    font-size: 12px; color: var(--muted);
  }
  .footer a { color: #7c3aed; text-decoration: none; }

  /* ── Responsive ──────────────────────────────── */
  @media (max-width: 768px) {
    .header { padding: 20px; }
    .main   { padding: 20px; }
    .tile-grid { grid-template-columns: 1fr; }
  }
</style>
</head>
<body>

<div class="header">
  <div class="header-top">
    <div class="brand">
      <div class="brand-logo">🚀</div>
      <div class="brand-text">
        <h1>Salesforce CPQ — QA Dashboard</h1>
        <p>Playwright E2E · Chromium · ${st.total} Tests across 4 Objects</p>
      </div>
    </div>
    <div class="header-meta">
      <div>Run started: ${runDate}</div>
      <div>Elapsed: <strong>${st.elapsedStr}</strong></div>
    </div>
  </div>

  <div class="stat-bar">
    <div class="status-pill ${statusClass}">
      ${!this.isComplete ? '<div class="pulse"></div>' : ''}
      ${statusLabel}
    </div>
    <div class="divider"></div>
    <div class="stat-chip chip-total">📦 ${st.total} Total</div>
    <div class="stat-chip chip-pass">✅ ${st.passed} Passed</div>
    ${st.failed  > 0 ? `<div class="stat-chip chip-fail">❌ ${st.failed} Failed</div>` : ''}
    ${st.running > 0 ? `<div class="stat-chip chip-run">⟳ ${st.running} Running</div>` : ''}
    ${st.pending > 0 ? `<div class="stat-chip chip-pend">○ ${st.pending} Pending</div>` : ''}
    <div class="divider"></div>
    <div class="stat-chip chip-time">⏱ ${st.elapsedStr}</div>
    <div class="stat-chip chip-rate">📈 ${passRate}% Pass Rate</div>
  </div>
</div>

<div class="main">

  <div class="label">Overall Progress</div>
  <div class="overall-bar">
    <div class="overall-track">
      <div class="overall-fill" style="width:${passRate}%"></div>
    </div>
    <div class="overall-labels">
      <span>${st.passed} / ${st.total} tests completed</span>
      <span>${passRate}%</span>
    </div>
  </div>

  <div class="label">Test Suites</div>
  <div class="suite-grid">${suiteCards}</div>

  <div class="label">Test Cases</div>
  ${testRows}

</div>

<div class="footer">
  Auto-refreshes every 2s while running · Generated by DashboardReporter ·
  <a href="https://playwright.dev" target="_blank">Playwright</a>
</div>

</body>
</html>`;
  }
}

function escHtml(str: string): string {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

export default DashboardReporter;
