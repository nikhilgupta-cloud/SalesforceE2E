/**
 * Generates a management-level PowerPoint presentation for the
 * Salesforce E2E AI-Powered Testing Framework.
 *
 * Run: node scripts/generate-ppt.js
 * Output: reports/SalesforceE2E-Framework-Overview.pptx
 */

const PptxGenJS = require('pptxgenjs');
const path = require('path');

const pptx = new PptxGenJS();
pptx.layout = 'LAYOUT_WIDE'; // 13.33" x 7.5"

// ── Brand colours ──────────────────────────────────────────────────────────
const C = {
  navy:    '003366',
  blue:    '0070D2',   // Salesforce Lightning blue
  teal:    '00A1BE',
  green:   '2E844A',
  orange:  'E8610C',
  white:   'FFFFFF',
  offWhite:'F4F6F9',
  gray:    '6E7A8A',
  darkGray:'3E4B5B',
  lightBg: 'EAF3FB',
  gold:    'FFB75D',
};

// ── Shared helpers ──────────────────────────────────────────────────────────
function addBackground(slide, color = C.white) {
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: '100%', h: '100%',
    fill: { color },
    line: { color, width: 0 },
  });
}

function addAccentBar(slide, color = C.blue, h = 0.08) {
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 7.5 - h, w: '100%', h,
    fill: { color },
    line: { color, width: 0 },
  });
}

function addTopStripe(slide, color = C.navy, h = 0.12) {
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: '100%', h,
    fill: { color },
    line: { color, width: 0 },
  });
}

function sectionLabel(slide, text, x = 0.4, y = 0.18) {
  slide.addText(text, {
    x, y, w: 12, h: 0.3,
    fontSize: 9, bold: true, color: C.teal,
    fontFace: 'Calibri', charSpacing: 2,
  });
}

function slideTitle(slide, text, x = 0.4, y = 0.42) {
  slide.addText(text, {
    x, y, w: 12.4, h: 0.55,
    fontSize: 26, bold: true, color: C.navy,
    fontFace: 'Calibri',
  });
}

function divider(slide, y = 1.08, color = C.blue) {
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.4, y, w: 12.4, h: 0.03,
    fill: { color },
    line: { color, width: 0 },
  });
}

function card(slide, x, y, w, h, fillColor = C.lightBg, lineColor = C.blue) {
  slide.addShape(pptx.ShapeType.rect, {
    x, y, w, h,
    fill: { color: fillColor },
    line: { color: lineColor, width: 1.5 },
    rectRadius: 0.08,
  });
}

function iconBox(slide, icon, x, y, size = 0.42, bg = C.blue) {
  slide.addShape(pptx.ShapeType.rect, {
    x, y, w: size, h: size,
    fill: { color: bg },
    line: { color: bg, width: 0 },
    rectRadius: 0.06,
  });
  slide.addText(icon, {
    x, y: y + 0.02, w: size, h: size - 0.04,
    fontSize: 18, align: 'center', valign: 'middle',
    fontFace: 'Segoe UI Emoji',
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 1 — Title / Cover
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  addBackground(s, C.navy);

  // Left accent panel
  s.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: 0.5, h: '100%',
    fill: { color: C.blue }, line: { color: C.blue, width: 0 },
  });
  // Bottom stripe
  s.addShape(pptx.ShapeType.rect, {
    x: 0, y: 6.8, w: '100%', h: 0.7,
    fill: { color: C.blue }, line: { color: C.blue, width: 0 },
  });

  // Decorative circle
  s.addShape(pptx.ShapeType.ellipse, {
    x: 10.5, y: -1.2, w: 4.5, h: 4.5,
    fill: { color: C.teal, transparency: 85 },
    line: { color: C.teal, width: 0 },
  });

  s.addText('AI-POWERED E2E TESTING FRAMEWORK', {
    x: 0.9, y: 1.4, w: 11, h: 0.45,
    fontSize: 13, bold: true, color: C.teal,
    fontFace: 'Calibri', charSpacing: 3,
  });

  s.addText('Salesforce CPQ\nTest Automation', {
    x: 0.9, y: 1.9, w: 11, h: 1.8,
    fontSize: 44, bold: true, color: C.white,
    fontFace: 'Calibri', lineSpacingMultiple: 1.1,
  });

  s.addText('Playwright  ·  Claude AI  ·  TypeScript', {
    x: 0.9, y: 3.75, w: 8, h: 0.4,
    fontSize: 16, color: C.gold,
    fontFace: 'Calibri', italic: true,
  });

  // Bottom bar text
  s.addText('Management Overview  |  April 2026', {
    x: 0.9, y: 6.88, w: 8, h: 0.46,
    fontSize: 12, color: C.white, fontFace: 'Calibri',
  });
  s.addText('Nikhil Gupta', {
    x: 10, y: 6.88, w: 3, h: 0.46,
    fontSize: 11, color: C.white, fontFace: 'Calibri', align: 'right',
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 2 — Agenda
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  addBackground(s, C.white);
  addTopStripe(s);
  addAccentBar(s);

  sectionLabel(s, 'OVERVIEW');
  slideTitle(s, 'Agenda');
  divider(s);

  const items = [
    ['01', 'The Problem',          'Why we needed a smarter approach to Salesforce testing'],
    ['02', 'Solution Architecture','How Playwright + Claude AI work together'],
    ['03', 'AI Test Generation',   'From user stories to test code automatically'],
    ['04', 'AI Self-Healing',      'Autonomous repair of broken tests'],
    ['05', 'Pipeline & Dashboard', '7-step orchestration with live reporting'],
    ['06', 'Results & Coverage',   '44 tests · 4 modules · 100 % pass rate'],
    ['07', 'Business Value',       'Speed, cost, and quality impact'],
  ];

  items.forEach(([num, title, desc], i) => {
    const y = 1.25 + i * 0.77;
    s.addShape(pptx.ShapeType.rect, {
      x: 0.4, y, w: 0.55, h: 0.5,
      fill: { color: C.blue }, line: { color: C.blue, width: 0 }, rectRadius: 0.05,
    });
    s.addText(num, {
      x: 0.4, y: y + 0.07, w: 0.55, h: 0.36,
      fontSize: 13, bold: true, color: C.white,
      fontFace: 'Calibri', align: 'center',
    });
    s.addText(title, {
      x: 1.1, y: y + 0.02, w: 3.8, h: 0.25,
      fontSize: 13, bold: true, color: C.navy, fontFace: 'Calibri',
    });
    s.addText(desc, {
      x: 1.1, y: y + 0.25, w: 11, h: 0.22,
      fontSize: 10, color: C.gray, fontFace: 'Calibri', italic: true,
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 3 — The Problem
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  addBackground(s, C.white);
  addTopStripe(s);
  addAccentBar(s);

  sectionLabel(s, 'CHALLENGE');
  slideTitle(s, 'The Problem We Solved');
  divider(s);

  const pains = [
    ['⏱', 'Slow Manual Testing',       'Salesforce CPQ regression cycles took days; frequent UI changes broke existing scripts instantly.'],
    ['🔧', 'Brittle Selectors',         'Shadow DOM & Lightning Web Components (LWC) made traditional XPath/CSS selectors unreliable.'],
    ['📝', 'High Authoring Cost',       'Writing maintainable Playwright tests for Salesforce required deep LWC DOM knowledge.'],
    ['🔁', 'Constant Breakage',         'Every Salesforce release or org change could silently break dozens of test steps.'],
    ['🚫', 'No Feedback Loop',          'Teams had no live visibility into test status, failures, or pipeline health.'],
  ];

  pains.forEach(([icon, title, detail], i) => {
    const row = Math.floor(i / 3);
    const col = i % 3;
    const x = 0.4 + col * 4.35;
    const y = 1.25 + row * 2.2;
    const w = 4.1;
    const h = 1.95;

    card(s, x, y, w, h, C.lightBg, C.blue);
    iconBox(s, icon, x + 0.18, y + 0.18, 0.5, C.navy);
    s.addText(title, {
      x: x + 0.78, y: y + 0.22, w: w - 0.95, h: 0.3,
      fontSize: 12, bold: true, color: C.navy, fontFace: 'Calibri',
    });
    s.addText(detail, {
      x: x + 0.18, y: y + 0.72, w: w - 0.32, h: 1.1,
      fontSize: 10, color: C.darkGray, fontFace: 'Calibri',
      wrap: true,
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 4 — Solution Architecture
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  addBackground(s, C.white);
  addTopStripe(s);
  addAccentBar(s);

  sectionLabel(s, 'ARCHITECTURE');
  slideTitle(s, 'Solution Architecture');
  divider(s);

  // Three columns: Inputs → Framework Engine → Outputs
  const cols = [
    { x: 0.35, label: 'INPUTS', color: C.teal, items: ['User Stories (.md)', 'Salesforce Sandbox', 'Framework Config JSON', 'Environment Variables'] },
    { x: 4.65, label: 'FRAMEWORK ENGINE', color: C.blue, items: ['Claude AI (test gen + healing)', 'Playwright (browser automation)', '7-Step Pipeline Orchestrator', 'Smart Change Detection', 'SalesforceFormHandler (LWC)'] },
    { x: 9.0,  label: 'OUTPUTS', color: C.green, items: ['44 TypeScript Test Specs', 'Live HTML Dashboard', 'Pipeline State JSON', 'Self-Healed Test Code', 'Git Push to Repository'] },
  ];

  cols.forEach(({ x, label, color, items }) => {
    const w = 4.1;
    // Header
    s.addShape(pptx.ShapeType.rect, {
      x, y: 1.2, w, h: 0.42,
      fill: { color }, line: { color, width: 0 }, rectRadius: 0.06,
    });
    s.addText(label, {
      x, y: 1.22, w, h: 0.38,
      fontSize: 11, bold: true, color: C.white,
      fontFace: 'Calibri', align: 'center', charSpacing: 1,
    });
    // Body card
    card(s, x, 1.65, w, 5.35, C.offWhite, color);
    items.forEach((txt, i) => {
      s.addShape(pptx.ShapeType.rect, {
        x: x + 0.18, y: 1.82 + i * 0.88, w: 0.06, h: 0.28,
        fill: { color }, line: { color, width: 0 },
      });
      s.addText(txt, {
        x: x + 0.35, y: 1.82 + i * 0.88, w: w - 0.5, h: 0.3,
        fontSize: 11, color: C.darkGray, fontFace: 'Calibri',
      });
    });
  });

  // Arrows between columns
  [4.2, 8.55].forEach(ax => {
    s.addShape(pptx.ShapeType.rightArrow, {
      x: ax + 0.05, y: 3.4, w: 0.55, h: 0.45,
      fill: { color: C.gold }, line: { color: C.gold, width: 0 },
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 5 — AI Test Generation
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  addBackground(s, C.white);
  addTopStripe(s);
  addAccentBar(s);

  sectionLabel(s, 'AI CAPABILITY 1 OF 2');
  slideTitle(s, 'AI-Powered Test Generation');
  divider(s);

  // Flow steps
  const steps = [
    { icon: '📄', label: 'User Story\n(.md file)' },
    { icon: '🔍', label: 'Change\nDetection' },
    { icon: '🤖', label: 'Claude AI\nAPI Call' },
    { icon: '📋', label: 'Scenario\nTable (MD)' },
    { icon: '🧪', label: 'Playwright\nSpec (.ts)' },
  ];

  steps.forEach(({ icon, label }, i) => {
    const x = 0.5 + i * 2.58;
    card(s, x, 1.35, 2.25, 1.95, C.lightBg, C.blue);
    s.addText(icon, { x, y: 1.45, w: 2.25, h: 0.6, fontSize: 24, align: 'center', fontFace: 'Segoe UI Emoji' });
    s.addText(label, {
      x, y: 2.1, w: 2.25, h: 0.7,
      fontSize: 11, bold: true, color: C.navy,
      fontFace: 'Calibri', align: 'center',
    });
    if (i < steps.length - 1) {
      s.addShape(pptx.ShapeType.rightArrow, {
        x: x + 2.25, y: 1.98, w: 0.35, h: 0.35,
        fill: { color: C.blue }, line: { color: C.blue, width: 0 },
      });
    }
  });

  // Key points
  const pts = [
    ['🔁  Smart Change Detection', 'MD5 hashing of each user story. Only regenerates tests when a story is new or modified — no wasted API calls.'],
    ['🏷  Marker-Based Injection', 'Generated test blocks are wrapped in // ── US-013 START/END ── markers, enabling safe in-place replacement.'],
    ['📊  Output: Scenario Tables', 'Claude produces a markdown table (TC ID · Scenario · Expected Result · AC Ref) for each object before writing code.'],
    ['⚡  Zero Manual Effort', '12 user stories → 44 TypeScript test cases generated automatically, ready to execute.'],
  ];

  pts.forEach(([title, detail], i) => {
    const y = 3.55 + i * 0.85;
    iconBox(s, ['🔁','🏷','📊','⚡'][i], 0.4, y, 0.44, C.navy);
    s.addText(title, {
      x: 1.0, y: y + 0.02, w: 11.7, h: 0.27,
      fontSize: 12, bold: true, color: C.navy, fontFace: 'Calibri',
    });
    s.addText(detail, {
      x: 1.0, y: y + 0.28, w: 11.7, h: 0.35,
      fontSize: 10, color: C.darkGray, fontFace: 'Calibri',
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 6 — AI Self-Healing
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  addBackground(s, C.white);
  addTopStripe(s);
  addAccentBar(s);

  sectionLabel(s, 'AI CAPABILITY 2 OF 2');
  slideTitle(s, 'AI Self-Healing for Failed Tests');
  divider(s);

  // Healing loop diagram
  const loop = [
    { icon: '❌', label: 'Test Fails', x: 0.4,  y: 1.5  },
    { icon: '📤', label: 'Error + Code\nsent to Claude', x: 3.3,  y: 1.5  },
    { icon: '🤖', label: 'Claude\nAnalyses & Fixes', x: 6.15, y: 1.5  },
    { icon: '🔧', label: 'Patch Applied\nto Spec File', x: 9.05, y: 1.5  },
    { icon: '✅', label: 'Re-run\nTest', x: 11.0, y: 1.5  },
  ];

  loop.forEach(({ icon, label, x, y }, i) => {
    card(s, x, y, 2.4, 1.7, C.lightBg, i === 2 ? C.orange : C.blue);
    s.addText(icon, { x, y: y + 0.15, w: 2.4, h: 0.55, fontSize: 22, align: 'center', fontFace: 'Segoe UI Emoji' });
    s.addText(label, {
      x, y: y + 0.75, w: 2.4, h: 0.7,
      fontSize: 10, bold: true, color: C.navy,
      fontFace: 'Calibri', align: 'center',
    });
    if (i < loop.length - 1) {
      s.addShape(pptx.ShapeType.rightArrow, {
        x: x + 2.4, y: y + 0.62, w: 0.38, h: 0.38,
        fill: { color: C.blue }, line: { color: C.blue, width: 0 },
      });
    }
  });

  // Retry annotation
  s.addText('Up to 3 retry rounds — reverts if still failing', {
    x: 0.4, y: 3.3, w: 12.5, h: 0.28,
    fontSize: 10, color: C.gray, italic: true, fontFace: 'Calibri', align: 'center',
  });

  // Key points
  const pts = [
    ['🎯  Targeted Repair', 'Only the failing test block is extracted and sent — surgical fix, not a full file rewrite.'],
    ['🧠  Context-Rich Prompt', 'Claude receives: error message, stack trace, the failing test code, and Salesforce DOM context.'],
    ['🔐  Safety First', 'If the re-run still fails after 3 rounds, the original code is restored and failure is logged.'],
    ['📋  Healing Report', 'Every fix attempt is documented in reports/healing-report.md for audit and review.'],
  ];

  pts.forEach(([title, detail], i) => {
    const y = 3.68 + i * 0.82;
    iconBox(s, ['🎯','🧠','🔐','📋'][i], 0.4, y, 0.44, C.navy);
    s.addText(title, {
      x: 1.0, y: y + 0.02, w: 11.7, h: 0.27,
      fontSize: 12, bold: true, color: C.navy, fontFace: 'Calibri',
    });
    s.addText(detail, {
      x: 1.0, y: y + 0.27, w: 11.7, h: 0.32,
      fontSize: 10, color: C.darkGray, fontFace: 'Calibri',
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 7 — 7-Step Pipeline
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  addBackground(s, C.white);
  addTopStripe(s);
  addAccentBar(s);

  sectionLabel(s, 'PIPELINE');
  slideTitle(s, '7-Step Automated Pipeline');
  divider(s);

  const steps = [
    { n: '0', label: 'AI Test\nGeneration',     icon: '🤖', color: C.teal   },
    { n: '1', label: 'Verify\nScenarios',        icon: '📋', color: C.blue   },
    { n: '2', label: 'Verify\nTest Plan',         icon: '📝', color: C.blue   },
    { n: '3', label: 'Execute\nE2E Tests',        icon: '▶️', color: C.navy   },
    { n: '4', label: 'Self-Heal\nFailures',       icon: '🔧', color: C.orange },
    { n: '5', label: 'Generate\nFinal Scripts',   icon: '📦', color: C.green  },
    { n: '6', label: 'Push to\nGitHub',           icon: '🚀', color: C.navy   },
  ];

  steps.forEach(({ n, label, icon, color }, i) => {
    const x = 0.32 + i * 1.88;
    // Number circle
    s.addShape(pptx.ShapeType.ellipse, {
      x: x + 0.58, y: 1.28, w: 0.55, h: 0.55,
      fill: { color }, line: { color, width: 0 },
    });
    s.addText(n, {
      x: x + 0.58, y: 1.3, w: 0.55, h: 0.5,
      fontSize: 13, bold: true, color: C.white,
      fontFace: 'Calibri', align: 'center',
    });
    // Card
    card(s, x, 1.9, 1.7, 2.0, C.offWhite, color);
    s.addText(icon, { x, y: 2.0, w: 1.7, h: 0.5, fontSize: 20, align: 'center', fontFace: 'Segoe UI Emoji' });
    s.addText(label, {
      x, y: 2.55, w: 1.7, h: 0.9,
      fontSize: 10, bold: true, color: C.navy,
      fontFace: 'Calibri', align: 'center',
    });
    // Arrow
    if (i < steps.length - 1) {
      s.addShape(pptx.ShapeType.rightArrow, {
        x: x + 1.68, y: 2.58, w: 0.28, h: 0.28,
        fill: { color: C.gray }, line: { color: C.gray, width: 0 },
      });
    }
  });

  // Command box
  s.addShape(pptx.ShapeType.rect, {
    x: 0.4, y: 4.2, w: 12.5, h: 0.52,
    fill: { color: C.navy }, line: { color: C.navy, width: 0 }, rectRadius: 0.06,
  });
  s.addText('$ npm run pipeline', {
    x: 0.4, y: 4.23, w: 12.5, h: 0.46,
    fontSize: 14, color: C.gold, bold: true,
    fontFace: 'Courier New', align: 'center',
  });

  // Description
  s.addText('Single command triggers the full lifecycle — from AI test generation through execution, self-healing, and Git push.', {
    x: 0.4, y: 4.84, w: 12.5, h: 0.4,
    fontSize: 11, color: C.gray, fontFace: 'Calibri', italic: true, align: 'center',
  });

  // Two detail cards
  const details = [
    ['📊 Live State Tracking', 'Each step writes its status, detail, and timestamp to pipeline-state.json — enabling real-time dashboard updates and post-run audits.'],
    ['⚙️ Config-Driven', 'Swap the app by editing framework-config.json. The entire pipeline adapts — no code changes required to target a different Salesforce org or module.'],
  ];
  details.forEach(([title, body], i) => {
    const x = 0.4 + i * 6.35;
    card(s, x, 5.35, 5.95, 1.65, C.lightBg, C.blue);
    s.addText(title, {
      x: x + 0.18, y: 5.45, w: 5.6, h: 0.3,
      fontSize: 11, bold: true, color: C.navy, fontFace: 'Calibri',
    });
    s.addText(body, {
      x: x + 0.18, y: 5.78, w: 5.6, h: 1.0,
      fontSize: 10, color: C.darkGray, fontFace: 'Calibri', wrap: true,
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 8 — Live Dashboard
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  addBackground(s, C.white);
  addTopStripe(s);
  addAccentBar(s);

  sectionLabel(s, 'REPORTING');
  slideTitle(s, 'Live HTML Dashboard');
  divider(s);

  const features = [
    ['📊', 'Per-Module Pass/Fail Rates',  'Real-time card per object (Account · Contact · Opportunity · Quote) showing pass counts, fail counts, and percentage.'],
    ['🔴', 'Live Test Status Icons',       'Each test case shows ✅ passed · ❌ failed · ⏭ skipped, updated after every run.'],
    ['📝', 'Activity Log',                 '40-entry rotating buffer capturing every test event with timestamp, giving a full chronological audit trail.'],
    ['🔧', 'Pipeline Step Progress',       'Visual 7-step progress tracker with timestamps — see exactly where the pipeline is at a glance.'],
    ['❗', 'Error Snippets',               'Failed tests show the first 100 characters of the error message directly on the dashboard card.'],
    ['📁', 'Zero Extra Server Needed',     'Dashboard is a single self-contained HTML file at reports/dashboard.html — open in any browser.'],
  ];

  features.forEach(([icon, title, desc], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.35 + col * 6.45;
    const y = 1.25 + row * 1.85;
    card(s, x, y, 6.1, 1.65, C.offWhite, C.teal);
    iconBox(s, icon, x + 0.15, y + 0.15, 0.45, C.teal);
    s.addText(title, {
      x: x + 0.72, y: y + 0.18, w: 5.2, h: 0.3,
      fontSize: 12, bold: true, color: C.navy, fontFace: 'Calibri',
    });
    s.addText(desc, {
      x: x + 0.18, y: y + 0.58, w: 5.75, h: 0.9,
      fontSize: 10, color: C.darkGray, fontFace: 'Calibri', wrap: true,
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 9 — Results & Coverage
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  addBackground(s, C.white);
  addTopStripe(s);
  addAccentBar(s);

  sectionLabel(s, 'RESULTS');
  slideTitle(s, 'Test Results & Coverage');
  divider(s);

  // Big KPI row
  const kpis = [
    { value: '44', label: 'Total Tests', icon: '🧪', color: C.blue  },
    { value: '100%', label: 'Pass Rate', icon: '✅', color: C.green  },
    { value: '4',   label: 'SF Modules', icon: '☁', color: C.teal   },
    { value: '12',  label: 'User Stories', icon: '📄', color: C.navy },
    { value: '0',   label: 'Failures',   icon: '❌', color: C.orange },
  ];

  kpis.forEach(({ value, label, icon, color }, i) => {
    const x = 0.35 + i * 2.62;
    card(s, x, 1.25, 2.4, 1.85, C.offWhite, color);
    s.addText(icon, { x, y: 1.3, w: 2.4, h: 0.5, fontSize: 22, align: 'center', fontFace: 'Segoe UI Emoji' });
    s.addText(value, {
      x, y: 1.82, w: 2.4, h: 0.65,
      fontSize: 30, bold: true, color,
      fontFace: 'Calibri', align: 'center',
    });
    s.addText(label, {
      x, y: 2.5, w: 2.4, h: 0.3,
      fontSize: 10, color: C.darkGray,
      fontFace: 'Calibri', align: 'center',
    });
  });

  // Module breakdown table header
  s.addShape(pptx.ShapeType.rect, {
    x: 0.35, y: 3.28, w: 12.6, h: 0.42,
    fill: { color: C.navy }, line: { color: C.navy, width: 0 },
  });
  ['Salesforce Module', 'Test Cases', 'Scenarios Covered', 'Status'].forEach((h, i) => {
    s.addText(h, {
      x: [0.5, 4.2, 6.6, 10.2][i], y: 3.32, w: [3.6, 2.2, 3.4, 2.7][i], h: 0.34,
      fontSize: 11, bold: true, color: C.white, fontFace: 'Calibri',
    });
  });

  const rows = [
    ['Account',     '13', 'Create · Edit · Delete · Search · Validation',    '✅  All Passing'],
    ['Contact',     '10', 'Create · Edit · Link to Account · Role Assignment','✅  All Passing'],
    ['Opportunity', '11', 'Create · Stage Transitions · Forecasting',         '✅  All Passing'],
    ['Quote (CPQ)', '10', 'CPQ Quote Lifecycle · Line Items · Approval',      '✅  All Passing'],
  ];

  rows.forEach((row, ri) => {
    const y = 3.74 + ri * 0.68;
    s.addShape(pptx.ShapeType.rect, {
      x: 0.35, y, w: 12.6, h: 0.62,
      fill: { color: ri % 2 === 0 ? C.offWhite : C.white },
      line: { color: C.offWhite, width: 0.5 },
    });
    [row[0], row[1], row[2], row[3]].forEach((cell, ci) => {
      s.addText(cell, {
        x: [0.5, 4.2, 6.6, 10.2][ci], y: y + 0.15, w: [3.6, 2.2, 3.4, 2.7][ci], h: 0.35,
        fontSize: 11, color: ci === 3 ? C.green : C.darkGray,
        fontFace: 'Calibri', bold: ci === 3,
      });
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 10 — Technical Highlights
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  addBackground(s, C.white);
  addTopStripe(s);
  addAccentBar(s);

  sectionLabel(s, 'TECHNICAL HIGHLIGHTS');
  slideTitle(s, 'How We Handled Salesforce Complexity');
  divider(s);

  const items = [
    ['🕸', 'Shadow DOM & LWC',          'SalesforceFormHandler.ts uses a 4-strategy fallback (ARIA role → Label → DOM walk → aria-label) to reliably fill Lightning Web Component fields — no brittle XPath.'],
    ['⏳', 'Smart Waits (No networkidle)','Salesforce never reaches networkidle state. We wait for specific SLDS landmark elements (.slds-page-header) instead, eliminating thousands of timeout failures.'],
    ['🔒', 'Session Caching',            'auth/session.json stores the authenticated Salesforce session via Playwright storageState. Tests skip login entirely — saving 10–20 s per test run.'],
    ['💥', 'Aura Error Dismissal',       'A global beforeEach hook detects and closes Salesforce\'s "Sorry to interrupt" (#auraError) overlay before every test, preventing ghost failures.'],
    ['📦', 'Config-Driven Portability',  'framework-config.json defines all objects, spec files, icons, and colors. Swap it to a new Salesforce org — zero code changes required.'],
    ['🔑', 'TypeScript + ts-node',       'End-to-end TypeScript pipeline: tests, utils, scripts, and orchestrator all type-safe — IDE autocomplete, refactoring, and compile-time safety.'],
  ];

  items.forEach(([icon, title, desc], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.35 + col * 6.5;
    const y = 1.25 + row * 1.9;
    card(s, x, y, 6.1, 1.72, C.offWhite, C.navy);
    iconBox(s, icon, x + 0.15, y + 0.15, 0.44, C.navy);
    s.addText(title, {
      x: x + 0.72, y: y + 0.17, w: 5.2, h: 0.3,
      fontSize: 12, bold: true, color: C.navy, fontFace: 'Calibri',
    });
    s.addText(desc, {
      x: x + 0.18, y: y + 0.57, w: 5.75, h: 1.0,
      fontSize: 10, color: C.darkGray, fontFace: 'Calibri', wrap: true,
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 11 — Business Value
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  addBackground(s, C.white);
  addTopStripe(s);
  addAccentBar(s);

  sectionLabel(s, 'BUSINESS VALUE');
  slideTitle(s, 'Why This Matters');
  divider(s);

  // Left column: benefit cards
  const benefits = [
    ['⚡', '80 %+ Faster Regression', 'What took days of manual testing now runs in minutes — automatically.'],
    ['💰', 'Lower QA Cost',            'AI generates and repairs tests; manual script maintenance overhead is eliminated.'],
    ['🛡', 'Higher Confidence',         '100 % automated coverage of critical CPQ workflows before every release.'],
    ['🔄', 'Continuous Validation',     'Pipeline can be triggered on any code push or org change — shift-left testing.'],
  ];

  benefits.forEach(([icon, title, desc], i) => {
    const y = 1.28 + i * 1.45;
    card(s, 0.35, y, 6.2, 1.28, C.lightBg, C.blue);
    iconBox(s, icon, 0.52, y + 0.12, 0.46, C.blue);
    s.addText(title, {
      x: 1.12, y: y + 0.14, w: 5.2, h: 0.3,
      fontSize: 13, bold: true, color: C.navy, fontFace: 'Calibri',
    });
    s.addText(desc, {
      x: 1.12, y: y + 0.5, w: 5.2, h: 0.55,
      fontSize: 10, color: C.darkGray, fontFace: 'Calibri',
    });
  });

  // Right column: future roadmap
  card(s, 6.8, 1.28, 5.95, 5.72, C.offWhite, C.teal);
  s.addShape(pptx.ShapeType.rect, {
    x: 6.8, y: 1.28, w: 5.95, h: 0.48,
    fill: { color: C.teal }, line: { color: C.teal, width: 0 },
  });
  s.addText('FUTURE ROADMAP', {
    x: 6.8, y: 1.3, w: 5.95, h: 0.44,
    fontSize: 11, bold: true, color: C.white,
    fontFace: 'Calibri', align: 'center', charSpacing: 1,
  });

  const roadmap = [
    ['🔗', 'CI/CD Integration',      'Plug pipeline into GitHub Actions / Azure DevOps for automatic test runs on every PR.'],
    ['🌐', 'Multi-Org Support',       'Extend config to support dev, staging, and production sandboxes in parallel.'],
    ['📱', 'Salesforce Mobile',       'Expand coverage to Salesforce mobile and community portal flows.'],
    ['📈', 'Trend Analytics',         'Historical pass-rate trending and flakiness scoring per test.'],
    ['🧩', 'Additional Objects',      'Extend to Cases, Products, Contracts, and Service Cloud with zero framework changes.'],
  ];

  roadmap.forEach(([icon, title, desc], i) => {
    const y = 1.9 + i * 0.96;
    iconBox(s, icon, 7.0, y, 0.38, C.teal);
    s.addText(title, {
      x: 7.5, y: y + 0.02, w: 5.0, h: 0.25,
      fontSize: 11, bold: true, color: C.navy, fontFace: 'Calibri',
    });
    s.addText(desc, {
      x: 7.5, y: y + 0.28, w: 5.0, h: 0.42,
      fontSize: 10, color: C.darkGray, fontFace: 'Calibri',
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 12 — Thank You / Q&A
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  addBackground(s, C.navy);

  // Left accent
  s.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: 0.5, h: '100%',
    fill: { color: C.teal }, line: { color: C.teal, width: 0 },
  });
  // Bottom stripe
  s.addShape(pptx.ShapeType.rect, {
    x: 0, y: 6.8, w: '100%', h: 0.7,
    fill: { color: C.blue }, line: { color: C.blue, width: 0 },
  });
  // Decorative circle
  s.addShape(pptx.ShapeType.ellipse, {
    x: 10.0, y: -1.5, w: 5.5, h: 5.5,
    fill: { color: C.teal, transparency: 88 },
    line: { color: C.teal, width: 0 },
  });

  s.addText('Thank You', {
    x: 0.9, y: 1.8, w: 10, h: 1.1,
    fontSize: 52, bold: true, color: C.white, fontFace: 'Calibri',
  });

  s.addText('Questions & Discussion', {
    x: 0.9, y: 2.95, w: 8, h: 0.55,
    fontSize: 20, color: C.gold, fontFace: 'Calibri', italic: true,
  });

  s.addText('Built with  Playwright  ·  Claude AI  ·  TypeScript\nNikhil Gupta  |  April 2026', {
    x: 0.9, y: 4.1, w: 9, h: 0.8,
    fontSize: 13, color: C.teal, fontFace: 'Calibri',
    lineSpacingMultiple: 1.6,
  });

  // Summary pill
  s.addShape(pptx.ShapeType.rect, {
    x: 0.9, y: 5.1, w: 5.5, h: 1.35,
    fill: { color: C.blue, transparency: 30 },
    line: { color: C.teal, width: 1 },
    rectRadius: 0.1,
  });
  s.addText('44 Tests  ·  4 Modules  ·  100 % Pass Rate\n12 User Stories  ·  AI Generated & Self-Healed', {
    x: 0.9, y: 5.22, w: 5.5, h: 1.1,
    fontSize: 12, color: C.white, fontFace: 'Calibri',
    align: 'center', lineSpacingMultiple: 1.7,
  });
}

// ── Save ────────────────────────────────────────────────────────────────────
const outputPath = path.join(__dirname, '..', 'reports', 'SalesforceE2E-Framework-Overview.pptx');
pptx.writeFile({ fileName: outputPath })
  .then(() => console.log(`\n✅  Saved: ${outputPath}\n`))
  .catch(err => { console.error('Error:', err); process.exit(1); });
