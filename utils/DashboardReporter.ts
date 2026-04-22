/**
 * DashboardReporter — Stunning live HTML dashboard for Playwright + Pipeline.
 * Generates reports/dashboard.html after every test. Auto-refreshes every 3s.
 */
import type {
  Reporter, FullConfig, Suite, TestCase, TestResult, FullResult,
} from '@playwright/test/reporter';
import * as fs from 'fs';
import * as path from 'path';
import { PipelineTracker, type StepState } from './PipelineTracker';
import { getSuiteMeta, loadConfig } from './FrameworkConfig';

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
  accent: string;
  tests: TestInfo[];
}

// Loaded from prompts/framework-config.json — add/remove objects there, not here.
const SUITE_META: Record<string, { displayName: string; icon: string; accent: string }> = getSuiteMeta();

function extractSuiteKey(filePath: string): string {
  const base = path.basename(filePath, '.spec.ts').toLowerCase();
  return Object.keys(SUITE_META).find(k => base.includes(k)) ?? base;
}

function extractTestId(title: string): string {
  return title.match(/TC-[A-Z]+-\d+/)?.[0] ?? '';
}

function esc(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

class DashboardReporter implements Reporter {
  private suites = new Map<string, SuiteData>();
  private startTime = Date.now();
  private isComplete = false;
  private overallStatus: 'running' | 'passed' | 'failed' = 'running';
  private activityLog: { time: string; msg: string; type: string }[] = [];
  private readonly out = path.join('reports', 'dashboard.html');

  private log(msg: string, type = 'info') {
    const t = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    this.activityLog.unshift({ time: t, msg, type });
    if (this.activityLog.length > 40) this.activityLog.pop();
  }

  onBegin(_: FullConfig, root: Suite): void {
    fs.mkdirSync('reports', { recursive: true });
    PipelineTracker.start(4, `Running ${root.allTests().length} tests…`);
    this.log(`Run started — ${root.allTests().length} tests queued`, 'start');

    for (const test of root.allTests()) {
      const key = extractSuiteKey(test.location.file);
      const meta = SUITE_META[key] ?? { displayName: key, icon: '🧪', accent: '#64748b' };
      if (!this.suites.has(key)) this.suites.set(key, { ...meta, tests: [] });
      this.suites.get(key)!.tests.push({
        id: extractTestId(test.title), title: test.title, status: 'pending', duration: 0,
      });
    }
    this.render();
  }

  onTestBegin(test: TestCase): void {
    const suite = this.suites.get(extractSuiteKey(test.location.file));
    const t = suite?.tests.find(x => x.title === test.title);
    if (t) t.status = 'running';
    this.log(`▶ ${extractTestId(test.title)} — ${test.title.replace(/^TC-[A-Z]+-\d+\s*[—-]\s*/,'')}`, 'run');
    this.render();
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const suite = this.suites.get(extractSuiteKey(test.location.file));
    const t = suite?.tests.find(x => x.title === test.title);
    if (t) {
      t.status = result.status === 'passed' ? 'passed' : result.status === 'skipped' ? 'skipped' : 'failed';
      t.duration = result.duration;
      if (t.status === 'failed') t.error = result.errors?.[0]?.message?.split('\n')[0]?.substring(0, 100);
    }
    const id = extractTestId(test.title);
    const dur = `${(result.duration / 1000).toFixed(1)}s`;
    this.log(
      result.status === 'passed' ? `✅ ${id} passed (${dur})` : `❌ ${id} failed (${dur})`,
      result.status === 'passed' ? 'pass' : 'fail',
    );
    this.render();
  }

  onEnd(result: FullResult): void {
    this.isComplete = true;
    this.overallStatus = result.status === 'passed' ? 'passed' : 'failed';
    const st = this.stats();
    PipelineTracker[result.status === 'passed' ? 'complete' : 'fail'](
      4, `${st.passed}/${st.total} tests passed`
    );
    this.log(
      result.status === 'passed'
        ? `🎉 All ${st.total} tests passed in ${st.elapsedStr}`
        : `⚠ ${st.failed} test(s) failed — ${st.passed}/${st.total} passed`,
      result.status === 'passed' ? 'done' : 'fail',
    );
    this.render();
    console.log(`\n📊 Dashboard → file:///${path.resolve(this.out).replace(/\\/g,'/')}\n`);
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  private stats() {
    let total=0, passed=0, failed=0, running=0, pending=0;
    for (const s of this.suites.values())
      for (const t of s.tests) {
        total++;
        if (t.status==='passed') passed++;
        else if (t.status==='failed') failed++;
        else if (t.status==='running') running++;
        else if (t.status==='pending') pending++;
      }
    const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
    const mm = String(Math.floor(elapsed/60)).padStart(2,'0');
    const ss = String(elapsed%60).padStart(2,'0');
    return { total, passed, failed, running, pending, elapsed, elapsedStr:`${mm}:${ss}` };
  }

  // ── Render ────────────────────────────────────────────────────────────────

  private render(): void { fs.writeFileSync(this.out, this.html(), 'utf8'); }

  // ── HTML ──────────────────────────────────────────────────────────────────

  private html(): string {
    const st      = this.stats();
    const rate    = st.total > 0 ? Math.round((st.passed/st.total)*100) : 0;
    const steps   = PipelineTracker.loadSteps();
    // Keep refresh alive even after Playwright finishes — steps 4/5/6 still run after onEnd().
    // patchPipelineSteps() removes the tag once every pipeline step is complete/failed.
    const refresh = '<meta http-equiv="refresh" content="3">';

    const statusLabel = this.isComplete
      ? (this.overallStatus==='passed' ? 'ALL TESTS PASSED' : 'FAILURES DETECTED')
      : 'RUNNING';
    const statusCls = this.isComplete
      ? (this.overallStatus==='passed' ? 'badge-pass' : 'badge-fail')
      : 'badge-run';

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
${refresh}
<title>${loadConfig().appName} · QA Dashboard</title>
<style>
/* ── Variables ───────────────────────────────── */
:root{
  --bg:#03060f;--bg2:#080d1a;--bg3:#0d1528;
  --glass:rgba(255,255,255,0.04);--glass2:rgba(255,255,255,0.07);
  --border:rgba(255,255,255,0.08);--border2:rgba(255,255,255,0.12);
  --text:#f0f4ff;--muted:#6b7fa3;--muted2:#4a5568;
  --pass:#22d3a5;--fail:#f43f5e;--run:#f59e0b;--pend:#334155;--skip:#818cf8;
  --p1:#7c3aed;--p2:#2563eb;--p3:#06b6d4;
  --r:16px;--r2:12px;--r3:8px;
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html{height:100%;scroll-behavior:smooth;}
body{
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;
  background:var(--bg);color:var(--text);min-height:100vh;
  overflow-x:hidden;
}

/* ── Animated BG ─────────────────────────────── */
body::before{
  content:'';position:fixed;inset:0;pointer-events:none;z-index:0;
  background:
    radial-gradient(ellipse 80% 60% at 10% 20%, rgba(124,58,237,.12) 0%,transparent 60%),
    radial-gradient(ellipse 60% 50% at 90% 10%, rgba(37,99,235,.10) 0%,transparent 60%),
    radial-gradient(ellipse 70% 60% at 50% 90%, rgba(6,182,212,.07) 0%,transparent 60%);
  animation:bgPulse 10s ease-in-out infinite alternate;
}
@keyframes bgPulse{0%{opacity:.7}100%{opacity:1}}

/* Floating orbs */
body::after{
  content:'';position:fixed;width:600px;height:600px;
  top:-200px;right:-200px;border-radius:50%;pointer-events:none;z-index:0;
  background:radial-gradient(circle,rgba(124,58,237,.06) 0%,transparent 70%);
  animation:orbFloat 15s ease-in-out infinite;
}
@keyframes orbFloat{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-60px,60px) scale(1.1)}}

/* ── Layout ──────────────────────────────────── */
.wrap{position:relative;z-index:1;max-width:1440px;margin:0 auto;padding:0 32px 60px;}

/* ── Header ──────────────────────────────────── */
.header{
  padding:28px 0 0;display:flex;align-items:flex-start;
  justify-content:space-between;gap:20px;flex-wrap:wrap;margin-bottom:32px;
}
.brand{display:flex;align-items:center;gap:16px;}
.brand-mark{
  width:52px;height:52px;border-radius:14px;flex-shrink:0;
  background:linear-gradient(135deg,var(--p1),var(--p2));
  display:flex;align-items:center;justify-content:center;font-size:26px;
  box-shadow:0 0 30px rgba(124,58,237,.5),0 4px 20px rgba(0,0,0,.4);
}
.brand-info h1{font-size:22px;font-weight:800;letter-spacing:-.5px;line-height:1.2;}
.brand-info p{font-size:12px;color:var(--muted);margin-top:4px;letter-spacing:.3px;}
.header-right{text-align:right;font-size:12px;color:var(--muted);line-height:2;}
.header-right strong{color:var(--text);}

/* ── Status Badge ────────────────────────────── */
.status-wrap{display:flex;align-items:center;gap:10px;margin-top:20px;}
.badge{
  display:inline-flex;align-items:center;gap:8px;
  padding:9px 20px;border-radius:999px;font-size:12px;font-weight:700;letter-spacing:.8px;
}
.badge-run{background:rgba(245,158,11,.12);color:var(--run);border:1px solid rgba(245,158,11,.3);}
.badge-pass{background:rgba(34,211,165,.12);color:var(--pass);border:1px solid rgba(34,211,165,.3);}
.badge-fail{background:rgba(244,63,94,.12);color:var(--fail);border:1px solid rgba(244,63,94,.3);}
.dot{width:7px;height:7px;border-radius:50%;background:currentColor;animation:dotPulse 1.2s ease-in-out infinite;}
@keyframes dotPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.3;transform:scale(.6)}}

/* ── Stat Chips ──────────────────────────────── */
.chips{display:flex;flex-wrap:wrap;gap:8px;margin-left:auto;}
.chip{
  display:flex;align-items:center;gap:7px;padding:8px 16px;
  border-radius:var(--r3);font-size:13px;font-weight:600;
  background:var(--glass2);border:1px solid var(--border);
  transition:transform .15s;
}
.chip:hover{transform:translateY(-2px);}
.chip.c-pass{color:var(--pass);}
.chip.c-fail{color:var(--fail);}
.chip.c-run {color:var(--run);}
.chip.c-pend{color:var(--muted);}
.chip.c-rate{
  background:linear-gradient(135deg,rgba(124,58,237,.15),rgba(37,99,235,.15));
  color:#c4b5fd;border-color:rgba(124,58,237,.3);
}
.chip.c-time{color:#7dd3fc;}
.chip.c-heal{color:#fbbf24;border-color:rgba(251,191,36,.3);background:rgba(251,191,36,.08);}

/* ── Section Title ───────────────────────────── */
.sec{
  font-size:10px;font-weight:700;letter-spacing:2px;color:var(--muted);
  text-transform:uppercase;margin-bottom:18px;
  display:flex;align-items:center;gap:12px;
}
.sec::after{content:'';flex:1;height:1px;background:var(--border);}

/* ── Pipeline Timeline ───────────────────────── */
.pipeline{
  background:var(--glass);border:1px solid var(--border);
  border-radius:var(--r);padding:28px 32px;margin-bottom:36px;
  position:relative;overflow:hidden;
}
.pipeline::before{
  content:'';position:absolute;inset:0;
  background:linear-gradient(135deg,rgba(124,58,237,.04),transparent 60%);
  pointer-events:none;
}
.pipe-steps{display:flex;align-items:flex-start;gap:0;position:relative;}
.pipe-step{
  flex:1;display:flex;flex-direction:column;align-items:center;
  position:relative;cursor:default;
}
/* connector line */
.pipe-step:not(:last-child)::after{
  content:'';position:absolute;top:22px;left:calc(50% + 22px);
  right:calc(-50% + 22px);height:2px;
  background:var(--border2);
  transition:background .4s;
}
.pipe-step.done:not(:last-child)::after{
  background:linear-gradient(90deg,var(--pass),rgba(34,211,165,.4));
}
.pipe-step.running:not(:last-child)::after{
  background:linear-gradient(90deg,var(--run),var(--border2));
}
.step-circle{
  width:44px;height:44px;border-radius:50%;
  display:flex;align-items:center;justify-content:center;
  font-size:18px;position:relative;z-index:1;
  background:var(--bg3);border:2px solid var(--border2);
  transition:all .3s;flex-shrink:0;
}
.pipe-step.done   .step-circle{
  background:rgba(34,211,165,.15);border-color:var(--pass);
  box-shadow:0 0 20px rgba(34,211,165,.25);
}
.pipe-step.running .step-circle{
  background:rgba(245,158,11,.15);border-color:var(--run);
  box-shadow:0 0 20px rgba(245,158,11,.3);
  animation:stepGlow 2s ease-in-out infinite;
}
.pipe-step.failed  .step-circle{
  background:rgba(244,63,94,.15);border-color:var(--fail);
}
@keyframes stepGlow{0%,100%{box-shadow:0 0 20px rgba(245,158,11,.3)}50%{box-shadow:0 0 40px rgba(245,158,11,.6)}}
.step-num{
  position:absolute;top:-6px;right:-6px;
  width:18px;height:18px;border-radius:50%;
  background:var(--bg3);border:1px solid var(--border2);
  font-size:9px;font-weight:700;color:var(--muted);
  display:flex;align-items:center;justify-content:center;
}
.pipe-step.done  .step-num{background:var(--pass);color:#000;border-color:var(--pass);}
.pipe-step.running .step-num{background:var(--run);color:#000;border-color:var(--run);}
.step-label{
  font-size:11px;font-weight:700;color:var(--text);
  margin-top:10px;text-align:center;line-height:1.3;
}
.pipe-step.pending .step-label{color:var(--muted);}
.step-detail{
  font-size:10px;color:var(--muted);margin-top:4px;
  text-align:center;line-height:1.3;min-height:14px;
}
.pipe-step.done   .step-detail{color:var(--pass);}
.pipe-step.running .step-detail{color:var(--run);}
.pipe-step.failed  .step-detail{color:var(--fail);}
.step-time{font-size:9px;color:var(--muted2);margin-top:3px;text-align:center;}

/* ── Step meta badges (duration + tokens) ────── */
.step-meta{display:flex;gap:4px;justify-content:center;flex-wrap:wrap;margin-top:5px;}
.step-badge{
  font-size:9px;font-weight:600;padding:2px 6px;border-radius:99px;
  background:rgba(255,255,255,.06);border:1px solid var(--border);color:var(--muted);
  white-space:nowrap;
}
.step-badge.sb-time{color:#7dd3fc;border-color:rgba(125,211,252,.2);}
.step-badge.sb-tok {color:#a78bfa;border-color:rgba(167,139,250,.2);}
.pipe-step.running .step-badge.sb-time{color:var(--run);border-color:rgba(245,158,11,.3);}

/* ── Indeterminate progress bar (running step) ─ */
.step-progress{
  width:80%;height:3px;background:rgba(255,255,255,.06);border-radius:99px;
  overflow:hidden;margin-top:7px;
}
.step-progress-bar{
  height:100%;width:45%;border-radius:99px;
  background:linear-gradient(90deg,transparent,var(--run),transparent);
  animation:stepSweep 1.4s ease-in-out infinite;
}
@keyframes stepSweep{0%{transform:translateX(-120%)}100%{transform:translateX(320%)}}

/* ── Main Grid ───────────────────────────────── */
.main-grid{
  display:grid;
  grid-template-columns:1fr 320px;
  gap:24px;margin-bottom:32px;
}
@media(max-width:1024px){.main-grid{grid-template-columns:1fr;}}

/* ── Suite Cards ─────────────────────────────── */
.suite-grid{
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(200px,1fr));
  gap:16px;margin-bottom:24px;
}
.suite-card{
  background:var(--glass);border:1px solid var(--border);
  border-radius:var(--r);padding:24px 20px;
  transition:transform .2s,box-shadow .2s;position:relative;overflow:hidden;
}
.suite-card:hover{transform:translateY(-4px);box-shadow:0 12px 40px rgba(0,0,0,.4);}
.suite-card::before{
  content:'';position:absolute;inset:0;
  background:linear-gradient(160deg,rgba(255,255,255,.03) 0%,transparent 60%);
  pointer-events:none;
}
.sc-pass{border-color:rgba(34,211,165,.2);}
.sc-fail{border-color:rgba(244,63,94,.3);}
.sc-run {border-color:rgba(245,158,11,.3);animation:cardBlink 2s ease-in-out infinite;}
@keyframes cardBlink{0%,100%{border-color:rgba(245,158,11,.3)}50%{border-color:rgba(245,158,11,.7)}}

/* Ring */
.ring-wrap{position:relative;width:72px;height:72px;margin-bottom:16px;}
.ring-wrap svg{transform:rotate(-90deg);}
.ring-bg{fill:none;stroke:rgba(255,255,255,.06);stroke-width:5;}
.ring-fg{fill:none;stroke-width:5;stroke-linecap:round;transition:stroke-dasharray .6s cubic-bezier(.4,0,.2,1);}
.ring-icon{
  position:absolute;inset:0;display:flex;align-items:center;
  justify-content:center;font-size:26px;
}
.sc-name{font-size:14px;font-weight:700;margin-bottom:6px;}
.sc-count{font-size:24px;font-weight:800;margin-bottom:2px;}
.sc-sub{font-size:11px;color:var(--muted);}

/* Overall bar */
.overall{
  background:var(--glass);border:1px solid var(--border);
  border-radius:var(--r);padding:20px 24px;margin-bottom:24px;
}
.ov-label{display:flex;justify-content:space-between;font-size:12px;color:var(--muted);margin-bottom:10px;}
.ov-label strong{color:var(--text);font-size:14px;}
.ov-track{height:8px;background:rgba(255,255,255,.06);border-radius:99px;overflow:hidden;}
.ov-fill{
  height:100%;border-radius:99px;
  background:linear-gradient(90deg,var(--p1),var(--p2),var(--p3));
  transition:width .6s cubic-bezier(.4,0,.2,1);
  box-shadow:0 0 16px rgba(124,58,237,.5);
}

/* ── Activity Feed ───────────────────────────── */
.feed{
  background:var(--glass);border:1px solid var(--border);
  border-radius:var(--r);padding:20px;
  max-height:420px;display:flex;flex-direction:column;
}
.feed-title{font-size:13px;font-weight:700;margin-bottom:16px;
  display:flex;align-items:center;gap:8px;}
.feed-title .live-dot{
  width:7px;height:7px;border-radius:50%;background:var(--run);
  animation:dotPulse 1s ease-in-out infinite;
}
.feed-list{overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:6px;}
.feed-list::-webkit-scrollbar{width:4px;}
.feed-list::-webkit-scrollbar-track{background:transparent;}
.feed-list::-webkit-scrollbar-thumb{background:var(--border2);border-radius:99px;}
.feed-item{
  display:flex;gap:10px;padding:8px 10px;border-radius:var(--r3);
  font-size:11px;line-height:1.4;
  background:rgba(255,255,255,.02);
  animation:feedIn .3s ease;
}
@keyframes feedIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
.feed-time{color:var(--muted2);flex-shrink:0;font-variant-numeric:tabular-nums;padding-top:1px;}
.feed-msg{color:var(--muted);flex:1;}
.fi-pass .feed-msg{color:rgba(34,211,165,.9);}
.fi-fail .feed-msg{color:rgba(244,63,94,.9);}
.fi-run  .feed-msg{color:var(--muted);}
.fi-start .feed-msg,.fi-done .feed-msg{color:var(--text);}

/* ── Test Case Tiles ─────────────────────────── */
.suite-section{margin-bottom:32px;}
.ss-header{
  display:flex;align-items:center;gap:10px;margin-bottom:14px;
  padding-bottom:12px;border-bottom:1px solid var(--border);
}
.ss-icon{font-size:20px;}
.ss-name{font-size:15px;font-weight:700;}
.ss-badge{
  padding:3px 12px;border-radius:99px;font-size:11px;font-weight:700;
  background:rgba(34,211,165,.1);color:var(--pass);border:1px solid rgba(34,211,165,.2);
  margin-left:auto;
}
.tile-grid{
  display:grid;
  grid-template-columns:repeat(auto-fill,minmax(290px,1fr));
  gap:8px;
}
.tile{
  display:flex;align-items:flex-start;gap:12px;
  padding:12px 14px;border-radius:var(--r3);
  border:1px solid var(--border);background:var(--glass);
  transition:transform .15s,box-shadow .15s;position:relative;overflow:hidden;
}
.tile:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(0,0,0,.3);}
.t-pass{border-color:rgba(34,211,165,.18);}
.t-fail{border-color:rgba(244,63,94,.3);background:rgba(244,63,94,.04);}
.t-running{
  border-color:rgba(245,158,11,.4);background:rgba(245,158,11,.04);
  animation:tileGlow 2s ease-in-out infinite;
}
.t-pending{opacity:.35;}
.t-healed{border-color:rgba(251,191,36,.35);background:rgba(251,191,36,.05);}
@keyframes tileGlow{0%,100%{box-shadow:0 0 0 rgba(245,158,11,0)}50%{box-shadow:0 0 20px rgba(245,158,11,.15)}}
/* shimmer on running */
.t-running::before{
  content:'';position:absolute;top:0;left:-100%;width:50%;height:100%;
  background:linear-gradient(90deg,transparent,rgba(245,158,11,.07),transparent);
  animation:shimmer 1.8s ease-in-out infinite;
}
@keyframes shimmer{to{left:200%}}
.t-icon{font-size:16px;flex-shrink:0;margin-top:2px;}
.t-running .t-icon{animation:spin 1.2s linear infinite;display:inline-block;}
@keyframes spin{to{transform:rotate(360deg)}}
.t-body{flex:1;min-width:0;}
.t-id{font-size:9px;font-weight:700;letter-spacing:1.5px;color:var(--muted);margin-bottom:3px;text-transform:uppercase;}
.t-title{font-size:12px;font-weight:500;line-height:1.4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.t-err{font-size:10px;color:rgba(244,63,94,.9);margin-top:4px;line-height:1.4;word-break:break-word;white-space:normal;}
.t-dur{font-size:10px;color:var(--muted);flex-shrink:0;font-variant-numeric:tabular-nums;margin-top:3px;}

/* ── MCP Integration ─────────────────────────── */
.mcp-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;margin-bottom:36px;}
.mcp-card{background:var(--glass);border:1px solid var(--border);border-radius:var(--r2);padding:20px;display:flex;align-items:flex-start;gap:14px;transition:transform .15s,border-color .15s;}
.mcp-card:hover{transform:translateY(-2px);border-color:var(--border2);}
.mcp-card.mcp-active{border-color:rgba(34,211,165,.25);}
.mcp-icon{font-size:28px;flex-shrink:0;}
.mcp-info{flex:1;min-width:0;}
.mcp-name{font-size:13px;font-weight:700;color:var(--text);margin-bottom:2px;}
.mcp-pkg{font-size:10px;color:var(--muted);font-family:monospace;margin-bottom:6px;}
.mcp-role{font-size:11px;color:var(--muted);line-height:1.4;}
.mcp-badge{font-size:10px;font-weight:700;padding:4px 10px;border-radius:999px;flex-shrink:0;letter-spacing:.5px;white-space:nowrap;}
.mcp-ok {background:rgba(34,211,165,.12);color:var(--pass);border:1px solid rgba(34,211,165,.3);}
.mcp-cfg{background:rgba(245,158,11,.12);color:var(--run); border:1px solid rgba(245,158,11,.3);}
.mcp-off{background:var(--glass2);          color:var(--muted);border:1px solid var(--border);}

/* ── Footer ──────────────────────────────────── */
.footer{text-align:center;padding:32px 0 0;font-size:11px;color:var(--muted2);}
.footer a{color:var(--p1);text-decoration:none;}
.footer a:hover{color:#a78bfa;}
</style>
</head>
<body>
<div class="wrap">

<!-- ── Header ───────────────────────────────────── -->
<div class="header">
  <div class="brand">
    <div class="brand-mark">🚀</div>
    <div class="brand-info">
      <h1>${loadConfig().dashboardTitle}</h1>
      <p>${loadConfig().dashboardSubtitle} · ${st.total} Tests across ${loadConfig().objects.map(o => o.displayName).join(' · ')}</p>
      <div class="status-wrap">
<!-- BADGE-START -->
        <div class="badge ${statusCls}">
          ${!this.isComplete ? '<div class="dot"></div>' : ''}
          ${statusLabel}
        </div>
<!-- BADGE-END -->
        <div class="chips">
          <div class="chip">📦 ${st.total}</div>
          <div class="chip c-pass">✅ ${st.passed} Passed</div>
          ${st.failed>0 ? `<div class="chip c-fail">❌ ${st.failed} Failed</div>` : ''}
          ${st.running>0 ? `<div class="chip c-run">⟳ ${st.running} Running</div>` : ''}
          ${st.pending>0 ? `<div class="chip c-pend">○ ${st.pending} Pending</div>` : ''}
          <div class="chip c-time">⏱ ${st.elapsedStr}</div>
          <div class="chip c-rate">📈 ${rate}%</div>
        </div>
      </div>
    </div>
  </div>
  <div class="header-right">
    <div>Run: <strong>${new Date().toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}</strong></div>
    <div>Engine: <strong>Playwright ${st.total > 0 ? 'v1.58' : '—'}</strong></div>
    <div>Browser: <strong>Chromium</strong></div>
  </div>
</div>

<!-- ── Pipeline Steps ────────────────────────────── -->
<div class="sec">QA Pipeline — ${steps.length} Steps</div>
<div class="pipeline">
  <div class="pipe-steps" id="pipe-steps">
<!-- PIPE-STEPS-START -->
${steps.map(s => this.renderStep(s)).join('')}
<!-- PIPE-STEPS-END -->
  </div>
</div>
<script>
(function(){
  function esc(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function fmtDur(ms){if(ms<1000)return ms+'ms';if(ms<60000)return(ms/1000).toFixed(1)+'s';var m=Math.floor(ms/60000);return m+'m '+(Math.floor((ms%60000)/1000))+'s';}
  function fmtTok(n){return n>=1000?(n/1000).toFixed(1)+'k':''+n;}
  function renderStep(s){
    var cls=s.status==='completed'?'done':s.status==='running'?'running':s.status==='failed'?'failed':'pending';
    var icon=s.status==='completed'?'✅':s.status==='running'?'⟳':s.status==='failed'?'❌':esc(s.icon||'');
    var elapsedMs=s.status==='running'&&s.startedAtMs?Date.now()-s.startedAtMs:(s.durationMs||0);
    var meta='';
    if(elapsedMs>0)meta+='<span class="step-badge sb-time">⏱ '+fmtDur(elapsedMs)+'</span>';
    if((s.tokensIn||0)>0||(s.tokensOut||0)>0)meta+='<span class="step-badge sb-tok">▲ '+fmtTok(s.tokensIn||0)+' / ▼ '+fmtTok(s.tokensOut||0)+'</span>';
    var progress=s.status==='running'?'<div class="step-progress"><div class="step-progress-bar"></div></div>':'';
    return '<div class="pipe-step '+cls+'">'
      +'<div class="step-circle">'+icon+'<div class="step-num">'+s.n+'</div></div>'
      +'<div class="step-label">'+esc(s.label||'')+'</div>'
      +'<div class="step-detail">'+esc(s.detail||(s.status==='pending'?'Waiting…':''))+'</div>'
      +'<div class="step-time">'+(s.timestamp||'')+'</div>'
      +(meta?'<div class="step-meta">'+meta+'</div>':'')
      +progress+'</div>';
  }
  function refresh(){
    fetch('pipeline-state.json?_='+Date.now())
      .then(function(r){return r.json();})
      .then(function(d){
        var el=document.getElementById('pipe-steps');
        if(!el||!d.steps)return;
        el.innerHTML='<!-- PIPE-STEPS-START -->\n'+(d.steps.map(renderStep).join(''))+'\n<!-- PIPE-STEPS-END -->';
      })
      .catch(function(){});
  }
  refresh();
  setInterval(refresh,3000);
})();
</script>

<!-- ── Overall Progress ───────────────────────────── -->
<div class="overall">
  <div class="ov-label">
    <span>Overall Test Progress</span>
    <strong>${st.passed} / ${st.total} tests passing</strong>
  </div>
  <div class="ov-track"><div class="ov-fill" style="width:${rate}%"></div></div>
</div>

<!-- ── Main Grid: Suites + Activity ──────────────── -->
<div class="sec">Test Suites</div>
<div class="main-grid">
  <div>
    <div class="suite-grid">
      ${[...this.suites.entries()].map(([,s]) => this.renderSuiteCard(s)).join('')}
    </div>
  </div>
  <div>
    <div class="feed">
      <div class="feed-title">
        ${!this.isComplete ? '<div class="live-dot"></div>' : ''}
        Activity Feed
      </div>
      <div class="feed-list">
        ${this.activityLog.map(a => `
          <div class="feed-item fi-${a.type}">
            <span class="feed-time">${a.time}</span>
            <span class="feed-msg">${esc(a.msg)}</span>
          </div>`).join('')}
        ${this.activityLog.length===0 ? '<div style="color:var(--muted2);font-size:11px;padding:8px">Waiting for test execution…</div>' : ''}
      </div>
    </div>
  </div>
</div>

<!-- ── MCP Integration ────────────────────────────── -->
<div class="sec">MCP Integration</div>
<div class="mcp-grid">
${this.renderMcpCards()}
</div>

<!-- ── Test Cases ─────────────────────────────────── -->
<div class="sec">Test Cases</div>
${[...this.suites.entries()].map(([,s]) => this.renderSuiteSection(s)).join('')}

<div class="footer">
  ${this.isComplete ? '✅ Run complete' : '⟳ Auto-refreshes every 3s'} ·
  Generated by DashboardReporter ·
  <a href="https://playwright.dev" target="_blank">Playwright</a>
</div>

</div><!-- /wrap -->
</body></html>`;
  }

  // ── Sub-renderers ─────────────────────────────────────────────────────────

  private fmtDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  }

  private fmtTokens(n: number): string {
    return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;
  }

  private renderStep(s: StepState): string {
    const cls = s.status === 'completed' ? 'done'
              : s.status === 'running'   ? 'running'
              : s.status === 'failed'    ? 'failed'
              : 'pending';
    const icon = s.status === 'completed' ? '✅'
               : s.status === 'running'   ? '⟳'
               : s.status === 'failed'    ? '❌'
               : s.icon;

    // Duration: live elapsed for running, final for completed/failed
    const elapsedMs = s.status === 'running' && s.startedAtMs
      ? Date.now() - s.startedAtMs
      : (s.durationMs ?? 0);
    const showDuration = elapsedMs > 0;

    // Token badges
    const hasTokens = (s.tokensIn ?? 0) > 0 || (s.tokensOut ?? 0) > 0;

    const metaBadges = (showDuration || hasTokens) ? `
        <div class="step-meta">
          ${showDuration ? `<span class="step-badge sb-time">⏱ ${this.fmtDuration(elapsedMs)}</span>` : ''}
          ${hasTokens ? `<span class="step-badge sb-tok">▲ ${this.fmtTokens(s.tokensIn ?? 0)} / ▼ ${this.fmtTokens(s.tokensOut ?? 0)}</span>` : ''}
        </div>` : '';

    const progressBar = s.status === 'running' ? `
        <div class="step-progress"><div class="step-progress-bar"></div></div>` : '';

    return `
      <div class="pipe-step ${cls}">
        <div class="step-circle">
          ${icon}
          <div class="step-num">${s.n}</div>
        </div>
        <div class="step-label">${esc(s.label)}</div>
        <div class="step-detail">${esc(s.detail || (s.status==='pending'?'Waiting…':''))}</div>
        <div class="step-time">${s.timestamp||''}</div>
        ${metaBadges}
        ${progressBar}
      </div>`;
  }

  private renderSuiteCard(s: SuiteData): string {
    const tot = s.tests.length;
    const pas = s.tests.filter(t=>t.status==='passed').length;
    const fai = s.tests.filter(t=>t.status==='failed').length;
    const run = s.tests.filter(t=>t.status==='running').length;
    const pct = tot>0 ? Math.round((pas/tot)*100) : 0;
    const dash = `${pct}, 100`;
    const cls  = fai>0 ? 'sc-fail' : run>0 ? 'sc-run' : pas===tot&&tot>0 ? 'sc-pass' : '';
    const ringColor = fai>0 ? '#f43f5e' : run>0 ? '#f59e0b' : s.accent;
    return `
      <div class="suite-card ${cls}">
        <div class="ring-wrap">
          <svg viewBox="0 0 36 36" width="72" height="72">
            <circle class="ring-bg" cx="18" cy="18" r="15.9"/>
            <circle class="ring-fg" cx="18" cy="18" r="15.9"
              stroke="${ringColor}" stroke-dasharray="${dash}" stroke-dashoffset="0"/>
          </svg>
          <div class="ring-icon">${s.icon}</div>
        </div>
        <div class="sc-name">${s.displayName}</div>
        <div class="sc-count" style="color:${ringColor}">${pas}<span style="font-size:14px;color:var(--muted)">/${tot}</span></div>
        <div class="sc-sub">
          ${fai>0?`<span style="color:var(--fail)">${fai} failed · </span>`:''}
          ${run>0?`<span style="color:var(--run)">${run} running · </span>`:''}
          ${pct}% complete
        </div>
      </div>`;
  }

  private renderSuiteSection(s: SuiteData): string {
    const pas = s.tests.filter(t=>t.status==='passed').length;
    const tiles = s.tests.map(t => {
      const icon = t.status==='passed'?'✅':t.status==='failed'?'❌':t.status==='running'?'⟳':t.status==='skipped'?'⏭':'○';
      const dur  = t.duration>0 ? `${(t.duration/1000).toFixed(1)}s` : '';
      return `
        <div class="tile t-${t.status}" data-tc="${t.id}">
          <span class="t-icon">${icon}</span>
          <div class="t-body">
            <div class="t-id">${t.id}</div>
            <div class="t-title" title="${esc(t.title)}">${esc(t.title.replace(/^TC-[A-Z]+-\d+\s*[—-]\s*/,''))}</div>
            ${t.error?`<div class="t-err">${esc(t.error)}</div>`:''}
          </div>
          <div class="t-dur">${dur}</div>
        </div>`;
    }).join('');
    return `
      <div class="suite-section">
        <div class="ss-header">
          <span class="ss-icon">${s.icon}</span>
          <span class="ss-name">${s.displayName}</span>
          <span class="ss-badge">${pas} / ${s.tests.length}</span>
        </div>
        <div class="tile-grid">${tiles}</div>
      </div>`;
  }

  private renderMcpCards(): string {
    const localPath = path.join('.claude', 'settings.local.json');
    const basePath  = path.join('.claude', 'settings.json');

    let configured: string[] = [];
    for (const p of [basePath, localPath]) {
      try {
        const s = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (s.mcpServers) configured = Object.keys(s.mcpServers);
      } catch { /* file absent or malformed */ }
    }
    const hasSecrets = fs.existsSync(localPath);

    const servers = [
      { key: 'playwright', icon: '🎭', name: 'Playwright MCP',  pkg: '@playwright/mcp',                        role: 'Live DOM inspection · Selector healing · Locator discovery' },
      { key: 'github',     icon: '🐙', name: 'GitHub MCP',      pkg: '@modelcontextprotocol/server-github',    role: 'Issue creation · PR status · Report push' },
      { key: 'jira',       icon: '📋', name: 'Jira MCP',        pkg: 'mcp-atlassian',                          role: 'Story sync · AC pull · Result write-back' },
      { key: 'salesforce', icon: '☁️', name: 'Salesforce MCP',  pkg: '@salesforce/mcp',                        role: 'API test data · Field metadata · Record validation' },
    ];

    return servers.map(s => {
      const isCfg  = configured.includes(s.key);
      const cls    = isCfg && hasSecrets ? 'mcp-ok' : isCfg ? 'mcp-cfg' : 'mcp-off';
      const label  = isCfg && hasSecrets ? '● Connected' : isCfg ? '○ Configured' : '○ Not set';
      return `  <div class="mcp-card${isCfg ? ' mcp-active' : ''}">
    <div class="mcp-icon">${s.icon}</div>
    <div class="mcp-info">
      <div class="mcp-name">${s.name}</div>
      <div class="mcp-pkg">${esc(s.pkg)}</div>
      <div class="mcp-role">${s.role}</div>
    </div>
    <div class="mcp-badge ${cls}">${label}</div>
  </div>`;
    }).join('\n');
  }
}

/**
 * Write a fresh dashboard.html BEFORE tests run.
 * Pre-populates all 44 test tiles as "pending" from the last results.json so
 * suite cards are immediately visible — Playwright then fills them in live.
 */
export function initDashboardForRun(): void {
  const r = new DashboardReporter() as any;

  const resultsPath = path.join('reports', 'results.json');
  if (fs.existsSync(resultsPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));

      function walk(suite: any) {
        const file  = suite.file ?? '';
        const key   = extractSuiteKey(file) ||
          (Object.keys(SUITE_META).find(k =>
            (suite.title ?? '').toLowerCase().includes(k)) ?? '');
        for (const spec of suite.specs ?? []) {
          if (key && SUITE_META[key]) {
            if (!r.suites.has(key)) r.suites.set(key, { ...SUITE_META[key], tests: [] });
            r.suites.get(key).tests.push({
              id: (spec.title.match(/TC-[A-Z]+-\d+/) ?? [])[0] ?? '',
              title: spec.title,
              status: 'pending',
              duration: 0,
            });
          }
        }
        for (const child of suite.suites ?? []) walk(child);
      }
      (raw.suites ?? []).forEach(walk);
    } catch { /* no prior results — render empty */ }
  }

  r.render();
}

/**
 * Call from outside Playwright BEFORE Playwright runs (steps 1 & 2 only).
 * Writes a blank dashboard with updated pipeline steps.
 */
export function refreshDashboard(): void {
  const r = new DashboardReporter() as any;
  // Pre-populate suite cards from SUITE_META so they always appear in the
  // dashboard even before Playwright runs (empty tile grids with 0 tests each).
  for (const [key, meta] of Object.entries(SUITE_META)) {
    if (!r.suites.has(key)) {
      r.suites.set(key, { ...meta, tests: [] });
    }
  }
  r.render();
}

/**
 * Patch pipeline-steps AND the status badge in an existing dashboard.html
 * WITHOUT touching test data, suite cards, or the activity feed.
 * Call this after steps 4, 5, 6 to keep the full Playwright output intact.
 */
export function patchPipelineSteps(): void {
  const htmlPath = path.join('reports', 'dashboard.html');
  if (!fs.existsSync(htmlPath)) return;

  const steps  = PipelineTracker.loadSteps();
  const r      = new DashboardReporter() as any;
  let   html   = fs.readFileSync(htmlPath, 'utf8');

  // ── 1. Patch pipeline steps bar ─────────────────────────────────────────
  const PS = '<!-- PIPE-STEPS-START -->';
  const PE = '<!-- PIPE-STEPS-END -->';
  const psi = html.indexOf(PS);
  const pei = html.indexOf(PE);

  if (psi === -1 || pei === -1) {
    // Markers missing (old HTML) — fall back to full rewrite
    refreshDashboard();
    return;
  }

  const newSteps = steps.map((s: any) => r.renderStep(s)).join('');
  html = html.slice(0, psi + PS.length) + '\n' + newSteps + '\n' + html.slice(pei);

  // ── 2. Patch status badge ────────────────────────────────────────────────
  const BS = '<!-- BADGE-START -->';
  const BE = '<!-- BADGE-END -->';
  const bsi = html.indexOf(BS);
  const bei = html.indexOf(BE);

  if (bsi !== -1 && bei !== -1) {
    // Step n=4 is Execute E2E Tests — it drives the pass/fail badge
    const step4 = steps.find((s: any) => s.n === 4);
    let badgeHtml = '';

    if (step4?.status === 'completed') {
      badgeHtml = `\n        <div class="badge badge-pass">ALL TESTS PASSED</div>\n`;
    } else if (step4?.status === 'failed') {
      badgeHtml = `\n        <div class="badge badge-fail">FAILURES DETECTED</div>\n`;
    } else if (step4?.status === 'pending' || step4?.status === 'skipped') {
      // Playwright never ran or was aborted
      badgeHtml = `\n        <div class="badge badge-fail">ABORTED</div>\n`;
    }

    if (badgeHtml) {
      html = html.slice(0, bsi + BS.length) + badgeHtml + html.slice(bei);
    }
  }

  // ── 3. Remove auto-refresh once every step is settled (complete/failed/skipped) ──
  const allSettled = steps.every(
    (s: any) => s.status === 'completed' || s.status === 'failed' || s.status === 'skipped',
  );
  if (allSettled) {
    html = html.replace(/<meta http-equiv="refresh"[^>]*>\n?/gi, '');
  }

  fs.writeFileSync(htmlPath, html, 'utf8');
}

/**
 * Patch healed tests in the dashboard after step 4.
 * For each healed title:
 *   - Flips tile class from t-fail → t-healed (amber)
 *   - Swaps the ❌ icon to 🔧
 *   - Removes the inline error message
 * Also updates the stats chips (passed / failed counts).
 */
export function patchHealedTests(healedTitles: string[]): void {
  if (healedTitles.length === 0) return;
  const htmlPath = path.join('reports', 'dashboard.html');
  if (!fs.existsSync(htmlPath)) return;

  let html = fs.readFileSync(htmlPath, 'utf8');
  let count = 0;

  for (const title of healedTitles) {
    const tcId = title.match(/^(TC-[A-Z]+-\d+)/)?.[1];
    if (!tcId) continue;

    // 1. Flip tile class t-fail → t-healed
    const before = html;
    html = html.replace(
      new RegExp(`class="tile t-fail" data-tc="${tcId}"`),
      `class="tile t-healed" data-tc="${tcId}"`,
    );
    if (html === before) continue; // tile not found — skip

    // 2. Swap ❌ icon → 🔧 (first occurrence after the tile's data-tc marker)
    const anchorIdx = html.indexOf(`data-tc="${tcId}"`);
    if (anchorIdx !== -1) {
      const iconStart = html.indexOf('<span class="t-icon">❌</span>', anchorIdx);
      const nextTile  = html.indexOf('<div class="tile', anchorIdx + 10);
      if (iconStart !== -1 && (nextTile === -1 || iconStart < nextTile)) {
        html = html.slice(0, iconStart)
          + '<span class="t-icon">🔧</span>'
          + html.slice(iconStart + '<span class="t-icon">❌</span>'.length);
      }

      // 3. Remove inline error div (if present) within this tile
      const anchorIdx2 = html.indexOf(`data-tc="${tcId}"`);
      const errStart   = html.indexOf('<div class="t-err">', anchorIdx2);
      const nextTile2  = html.indexOf('<div class="tile', anchorIdx2 + 10);
      if (errStart !== -1 && (nextTile2 === -1 || errStart < nextTile2)) {
        const errEnd = html.indexOf('</div>', errStart) + '</div>'.length;
        html = html.slice(0, errStart) + html.slice(errEnd);
      }
    }

    count++;
  }

  if (count === 0) { fs.writeFileSync(htmlPath, html, 'utf8'); return; }

  // 4. Update stats chips: bump Passed, reduce Failed
  const passMatch = html.match(/<div class="chip c-pass">✅ (\d+) Passed<\/div>/);
  const failMatch = html.match(/<div class="chip c-fail">❌ (\d+) Failed<\/div>/);
  if (passMatch) {
    html = html.replace(passMatch[0],
      `<div class="chip c-pass">✅ ${parseInt(passMatch[1]) + count} Passed</div>`);
  }
  if (failMatch) {
    const newFailed = parseInt(failMatch[1]) - count;
    html = html.replace(failMatch[0],
      newFailed > 0
        ? `<div class="chip c-fail">❌ ${newFailed} Failed</div>`
        : `<div class="chip c-heal">🔧 ${count} Healed</div>`);
  }

  fs.writeFileSync(htmlPath, html, 'utf8');
}

export default DashboardReporter;
