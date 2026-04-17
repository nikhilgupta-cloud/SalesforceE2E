/**
 * fetch-jira-stories.ts — Pull user stories from Jira and write them to
 * user-stories/CPQ_User_stories.md in the format expected by generate-tests.ts.
 *
 * Run standalone:  npx ts-node scripts/fetch-jira-stories.ts
 * Run via pipeline: called automatically as Step -1 when JIRA_BASE_URL is set.
 *
 * Required .env vars:
 *   JIRA_BASE_URL      https://yourorg.atlassian.net
 *   JIRA_EMAIL         you@company.com
 *   JIRA_API_TOKEN     your_personal_api_token
 *   JIRA_PROJECT_KEY   CPQ
 *
 * Optional .env vars:
 *   JIRA_JQL           Override default JQL (default: project = KEY AND issuetype = Story)
 *   JIRA_AC_FIELD      Custom field ID for Acceptance Criteria (e.g. customfield_10016)
 *   JIRA_OBJECT_FIELD  Custom field ID that identifies the Salesforce object (e.g. customfield_10020)
 *   JIRA_OUTPUT_FILE   Override output path (default: user-stories/CPQ_User_stories.md)
 *
 * Object detection priority (first match wins):
 *   1. JIRA_OBJECT_FIELD custom field value
 *   2. Jira component name matching a framework-config object key
 *   3. Jira label matching sf-{key} or salesforce-{key}
 *   4. Keyword scan of summary + description
 */

import * as fs    from 'fs';
import * as https from 'https';
import * as http  from 'http';
import * as path  from 'path';
import * as dotenv from 'dotenv';
import { loadConfig, getObjectKeys } from '../utils/FrameworkConfig';

dotenv.config();

// ── Config ────────────────────────────────────────────────────────────────────

const JIRA_BASE_URL   = (process.env.JIRA_BASE_URL   ?? '').replace(/\/$/, '');
const JIRA_EMAIL      = process.env.JIRA_EMAIL        ?? '';
const JIRA_API_TOKEN  = process.env.JIRA_API_TOKEN    ?? '';
const JIRA_PROJECT    = process.env.JIRA_PROJECT_KEY  ?? '';
const JIRA_AC_FIELD   = process.env.JIRA_AC_FIELD     ?? '';      // e.g. customfield_10016
const JIRA_OBJ_FIELD  = process.env.JIRA_OBJECT_FIELD ?? '';      // e.g. customfield_10020
const OUTPUT_FILE     = process.env.JIRA_OUTPUT_FILE  ?? path.join('user-stories', 'CPQ_User_stories.md');

const DEFAULT_JQL = process.env.JIRA_JQL
  ?? `project = ${JIRA_PROJECT} AND issuetype = Story ORDER BY created ASC`;

// ── Jira REST API helper ──────────────────────────────────────────────────────

function jiraPost(apiPath: string, body: Record<string, any>): Promise<any> {
  const url     = `${JIRA_BASE_URL}/rest/api/3${apiPath}`;
  const auth    = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64');
  const payload = JSON.stringify(body);
  const parsed  = new URL(url);
  const lib     = parsed.protocol === 'https:' ? https : http as unknown as typeof https;

  return new Promise((resolve, reject) => {
    const req = lib.request(
      url,
      {
        method:  'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept':        'application/json',
          'Content-Type':  'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`Jira API ${res.statusCode} on ${apiPath}: ${data.slice(0, 300)}`));
            return;
          }
          try { resolve(JSON.parse(data)); }
          catch { reject(new Error(`Jira API returned non-JSON: ${data.slice(0, 200)}`)); }
        });
      },
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ── Fetch all matching stories (handles pagination) ───────────────────────────

interface JiraIssue {
  key:    string;       // e.g. CPQ-123
  fields: Record<string, any>;
}

async function fetchAllIssues(): Promise<JiraIssue[]> {
  const issues: JiraIssue[] = [];
  const maxResults = 100;
  let nextPageToken: string | undefined;

  const fields = [
    'summary', 'description', 'components', 'labels', 'status',
    'priority', 'assignee',
    ...(JIRA_AC_FIELD  ? [JIRA_AC_FIELD]  : []),
    ...(JIRA_OBJ_FIELD ? [JIRA_OBJ_FIELD] : []),
  ];

  do {
    const body: Record<string, any> = { jql: DEFAULT_JQL, maxResults, fields };
    if (nextPageToken) body.nextPageToken = nextPageToken;

    const page = await jiraPost('/search/jql', body);

    if (!page.issues || page.issues.length === 0) break;

    issues.push(...page.issues);
    nextPageToken = page.nextPageToken;

    console.log(`[jira] Fetched ${issues.length} stories…`);
  } while (nextPageToken);

  return issues;
}

// ── Atlassian Document Format (ADF) → plain text ─────────────────────────────

function adfToText(node: any, listDepth = 0): string {
  if (!node) return '';

  // Leaf text node
  if (node.type === 'text') return node.text ?? '';

  // Hard line break
  if (node.type === 'hardBreak') return '\n';

  const children = (node.content ?? []) as any[];

  switch (node.type) {
    case 'doc':
      return children.map(c => adfToText(c)).join('');

    case 'paragraph':
      return children.map(c => adfToText(c)).join('') + '\n';

    case 'heading':
      return children.map(c => adfToText(c)).join('') + '\n';

    case 'bulletList':
    case 'orderedList':
      return children.map(c => adfToText(c, listDepth + 1)).join('');

    case 'listItem': {
      const indent = '  '.repeat(listDepth - 1);
      const inner  = children.map(c => adfToText(c, listDepth)).join('').trim();
      return `${indent}• ${inner}\n`;
    }

    case 'blockquote':
      return children.map(c => adfToText(c)).join('');

    case 'codeBlock':
      return children.map(c => adfToText(c)).join('') + '\n';

    case 'rule':
      return '---\n';

    // ── Table support ─────────────────────────────────────────────────────────
    case 'table':
      return children.map(c => adfToText(c)).join('') + '\n';

    case 'tableRow': {
      const cells = children.map(c => adfToText(c));
      return '| ' + cells.join(' | ') + ' |\n';
    }

    case 'tableHeader':
    case 'tableCell': {
      // Flatten all paragraph/text content in the cell to a single line
      const cellText = children.map(c => adfToText(c)).join('').replace(/\n/g, ' ').trim();
      return cellText;
    }

    // ── Jira-specific inline/block nodes ──────────────────────────────────────
    case 'panel':
    case 'expand':
    case 'nestedExpand':
      // Render panel/expand content inline (ignore panel type / title)
      return children.map(c => adfToText(c)).join('');

    case 'inlineCard':
    case 'blockCard':
      return (node.attrs?.url ?? '') + '\n';

    case 'mention':
      return (node.attrs?.text ?? node.attrs?.id ?? '@mention') + ' ';

    case 'emoji':
      return (node.attrs?.text ?? '') + ' ';

    default:
      return children.map(c => adfToText(c, listDepth)).join('');
  }
}

/**
 * Extract plain text from a Jira description field.
 * Handles ADF (v3 API object) and plain string (legacy).
 */
function descriptionToText(desc: any): string {
  if (!desc) return '';
  if (typeof desc === 'string') return desc;
  if (typeof desc === 'object' && desc.type === 'doc') return adfToText(desc);
  return String(desc);
}

// ── Acceptance Criteria extraction ───────────────────────────────────────────

/**
 * Extract AC bullet points from the full description text.
 *
 * Handles all Jira AC formats:
 *   1. "Acceptance Criteria:" heading → flat bullet list beneath it
 *   2. "2. Acceptance Criteria" numbered section heading → bullets beneath it
 *   3. "AC N: <Group Title>" headings (e.g. "AC 2: Opportunity & Contact Role Management")
 *   4. Bullet-prefixed headings: "• Acceptance Criteria:" (ADF ordered-list artefact)
 *   5. No heading — any bullet points in the description
 *
 * Stops at:
 *   - A second "Acceptance Criteria" heading (Jira sometimes duplicates the section)
 *   - Any "Technical …" / "Implementation …" / "Test Data …" heading (with or without bullet prefix)
 *   - A numbered section heading that is NOT about acceptance criteria (e.g. "3. Technical Test Data")
 *
 * Deduplicates by content. Skips placeholder bullets (`--`, `-`, empty).
 *
 * KEY RULE: all heading/stop checks operate on `bare` (line with leading bullet + number stripped),
 * so bullet-prefixed headings ("• Technical Test Steps:") are caught the same as plain ones.
 */
function extractACsFromText(rawText: string, usNum: number): string[] {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);

  /** Strip leading bullet char (•, -, *) and/or leading "N. " from a line for semantic checks. */
  const bare = (l: string) => l.replace(/^[•\-\*]\s*/, '').replace(/^\d+\.\s*/, '').trim();

  // Non-AC sections — keyword-based (checked against `bare`)
  const STOP_KW   = /^(technical|implementation|test steps|test data|notes?|appendix)/i;
  // "3. Technical Test Data" style — a numbered heading that is NOT about acceptance criteria
  const STOP_NUM  = /^\d+\.\s+\w/;

  // "AC N:" group heading (e.g. "AC 2: Opportunity & Contact Role Management")
  const AC_GROUP  = /^AC\s*\d+\s*[:\-]/i;

  /**
   * Returns true if this line is a STOP line (end of AC section).
   * Ignores lines that mention "acceptance criteria" — those are AC headings, not stop signals.
   */
  const isStop = (l: string): boolean => {
    const b = bare(l);
    if (/acceptance criteria/i.test(b)) return false;   // never stop on an AC heading
    return STOP_KW.test(b) || STOP_NUM.test(b);
  };

  /** Returns true if line (after stripping) is an "Acceptance Criteria" section heading. */
  const isACHeading = (l: string): boolean => {
    const b = bare(l);
    return /acceptance criteria/i.test(b) && !AC_GROUP.test(b);
  };

  /** Returns true if line (after stripping) is an "AC N:" group heading. */
  const isACGroup = (l: string): boolean => AC_GROUP.test(bare(l));

  // ── Find start of the AC region ─────────────────────────────────────────────
  let acStart = -1;
  for (let i = 0; i < lines.length; i++) {
    if (isACHeading(lines[i]) || isACGroup(lines[i])) {
      acStart = i;
      break;
    }
  }

  // ── Collect raw bullet lines ─────────────────────────────────────────────────
  const rawBullets: string[] = [];

  if (acStart === -1) {
    // No AC section heading found — collect all bullets in description, stop at stop sections
    for (const line of lines) {
      if (isStop(line)) break;
      if (/^[•\-\*]/.test(line)) rawBullets.push(line);
    }
  } else {
    let acHeadingsSeen = 0;

    for (let i = acStart; i < lines.length; i++) {
      const line = lines[i];

      if (isStop(line)) break;

      if (isACHeading(line)) {
        acHeadingsSeen++;
        if (acHeadingsSeen > 1) break;   // second copy of AC section → stop (Jira duplication)
        continue;                         // skip the heading line itself
      }

      if (isACGroup(line)) continue;      // "AC N: Title" label — skip, collect bullets beneath

      if (/^[•\-\*]/.test(line)) rawBullets.push(line);
    }
  }

  // ── Clean, deduplicate, filter placeholders ──────────────────────────────────
  const seen    = new Set<string>();
  const cleaned: string[] = [];

  for (const bullet of rawBullets) {
    const content = bullet.replace(/^[•\-\*]\s*/, '').trim();
    if (!content || /^--?$/.test(content)) continue;   // skip empty / placeholder "--"
    if (seen.has(content)) continue;                    // skip duplicates
    seen.add(content);
    cleaned.push(content);
  }

  if (cleaned.length === 0) return [];

  // ── Number and format ────────────────────────────────────────────────────────
  return cleaned.map((content, idx) => {
    // Already labelled "AC-005-01: ..." — keep as-is
    if (/^AC-\d{3}-\d{2}/.test(content)) return `• ${content}`;
    const acNum = `AC-${String(usNum).padStart(3, '0')}-${String(idx + 1).padStart(2, '0')}`;
    return `• ${acNum}: ${content}`;
  });
}

// ── Object key detection ──────────────────────────────────────────────────────

const OBJECT_KEYS = getObjectKeys(); // ordered list from framework-config.json

function detectObjectKey(issue: JiraIssue): string {
  const fields = issue.fields;

  // 1. Custom field configured via JIRA_OBJECT_FIELD
  if (JIRA_OBJ_FIELD && fields[JIRA_OBJ_FIELD]) {
    const val = String(fields[JIRA_OBJ_FIELD]?.value ?? fields[JIRA_OBJ_FIELD]).toLowerCase();
    const match = OBJECT_KEYS.find(k => val.includes(k));
    if (match) return match;
  }

  // 2. Jira components
  const components: string[] = (fields.components ?? []).map((c: any) => c.name?.toLowerCase() ?? '');
  for (const key of OBJECT_KEYS) {
    if (components.some(c => c.includes(key))) return key;
  }

  // 3. Jira labels — supports "sf-account", "salesforce-account", "account"
  const labels: string[] = (fields.labels ?? []).map((l: string) => l.toLowerCase());
  for (const key of OBJECT_KEYS) {
    if (labels.some(l => l === key || l === `sf-${key}` || l === `salesforce-${key}`)) return key;
  }

  // 4. Keyword scan of summary first, then full description
  // Uses word-boundary regex to avoid "account" matching inside "acceptance" etc.
  const summary     = (fields.summary ?? '').toLowerCase();
  const description = descriptionToText(fields.description).toLowerCase();

  // Check summary first (more reliable signal)
  for (const key of OBJECT_KEYS) {
    if (new RegExp(`\\b${key}\\b`).test(summary)) return key;
  }
  // Fall back to description
  for (const key of OBJECT_KEYS) {
    if (new RegExp(`\\b${key}\\b`).test(description)) return key;
  }

  return 'unknown';
}

// ── Test Data extraction ──────────────────────────────────────────────────────

/**
 * Extract the "Technical Test Data" section from the full description text.
 * Looks for headings containing "test data" or "technical" followed by table rows
 * or key-value bullet pairs. Returns a markdown-formatted string of the data,
 * or '' if nothing is found.
 */
function extractTestData(text: string): string {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // Heading patterns that indicate the start of a test data section
  const START = /test data|technical test|tc_\d{3}/i;
  // Section heading that would end the test data block
  const END_HDG = /^(acceptance criteria|user story|as a\b)/i;

  let dataStart = -1;
  for (let i = 0; i < lines.length; i++) {
    const b = lines[i].replace(/^[•\-\*\d.]\s*/, '').trim();
    if (START.test(b)) { dataStart = i; break; }
  }

  if (dataStart === -1) return '';

  const dataLines: string[] = [];
  for (let i = dataStart + 1; i < lines.length; i++) {
    const line = lines[i];
    const b    = line.replace(/^[•\-\*\d.]\s*/, '').trim();
    if (END_HDG.test(b)) break;
    // Include table rows, bullet pairs, and plain text lines
    if (line.startsWith('|') || /^[•\-\*]/.test(line) || b.length > 0) {
      dataLines.push(line);
    }
  }

  return dataLines.join('\n').trim();
}

// ── Issue number extraction ───────────────────────────────────────────────────

/** CPQ-123 → 123 */
function issueNumber(key: string): number {
  const m = key.match(/(\d+)$/);
  return m ? parseInt(m[1], 10) : 0;
}

// ── Markdown builder ──────────────────────────────────────────────────────────

interface StoryBlock {
  usId:     string;   // US-123
  title:    string;
  body:     string;   // As a... / So that...
  acs:      string[]; // formatted AC lines
  testData: string;   // extracted Technical Test Data section (tables, key-value pairs)
  jiraKey:  string;   // original CPQ-123 for traceability
}

function buildMarkdown(grouped: Map<string, StoryBlock[]>): string {
  const cfg   = loadConfig();
  const today = new Date().toISOString().split('T')[0];
  const lines: string[] = [
    `${cfg.appName} — User Stories & Acceptance Criteria`,
    `Application: ${cfg.appName}`,
    `Source: Jira ${JIRA_PROJECT} — fetched ${today}`,
    `Flow: ${cfg.objects.map(o => o.displayName).join(' → ')}`,
    '________________________________________',
  ];

  let objIndex = 1;
  for (const obj of cfg.objects) {
    const stories = grouped.get(obj.key) ?? [];
    if (stories.length === 0) continue;

    lines.push(`OBJECT ${objIndex++}: ${obj.displayName.toUpperCase().split(' ')[0]}`);
    lines.push('');

    for (const story of stories) {
      lines.push(`## ${story.usId} — ${story.title}`);
      if (story.body) lines.push(story.body);
      if (story.acs.length > 0) {
        lines.push('Acceptance Criteria:');
        lines.push(...story.acs);
      }
      if (story.testData) {
        lines.push('');
        lines.push('Technical Test Data:');
        lines.push(story.testData);
      }
      lines.push(`<!-- Jira: ${story.jiraKey} -->`);
      lines.push('');
    }

    lines.push('________________________________________');
  }

  // Unresolved stories — written as comments only so the parser ignores them
  const unknown = grouped.get('unknown') ?? [];
  if (unknown.length > 0) {
    lines.push('');
    lines.push('<!--');
    lines.push('  ⚠ UNRESOLVED STORIES — Salesforce object could not be detected.');
    lines.push('  Add a Jira component matching one of: ' + OBJECT_KEYS.join(', '));
    lines.push('  or set a label sf-{object} (e.g. sf-quote) on the ticket.');
    lines.push('');
    for (const story of unknown) {
      lines.push(`  ${story.jiraKey} | ${story.usId} — ${story.title}`);
    }
    lines.push('-->');
  }

  return lines.join('\n');
}

// ── Main ──────────────────────────────────────────────────────────────────────

export async function fetchJiraStories(): Promise<{ fetched: number; written: string }> {
  // Validate config
  if (!JIRA_BASE_URL || !JIRA_EMAIL || !JIRA_API_TOKEN || !JIRA_PROJECT) {
    throw new Error(
      '[jira] Missing required env vars. Set JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN, JIRA_PROJECT_KEY in .env',
    );
  }

  console.log(`[jira] Connecting to ${JIRA_BASE_URL}`);
  console.log(`[jira] JQL: ${DEFAULT_JQL}`);

  const issues = await fetchAllIssues();
  if (issues.length === 0) {
    console.log('[jira] No stories returned by JQL query.');
    return { fetched: 0, written: OUTPUT_FILE };
  }

  // Group stories by object key
  const grouped = new Map<string, StoryBlock[]>();
  for (const key of [...OBJECT_KEYS, 'unknown']) grouped.set(key, []);

  let unresolved = 0;

  for (const issue of issues) {
    const objKey = detectObjectKey(issue);
    if (objKey === 'unknown') {
      unresolved++;
      console.warn(`[jira] ⚠ Cannot detect SF object for ${issue.key} — "${issue.fields.summary?.slice(0, 60)}"`);
    }

    const usNum  = issueNumber(issue.key);
    const usId   = `US-${String(usNum).padStart(3, '0')}`;

    // Extract description body (strip AC section — we handle that separately)
    const fullText  = descriptionToText(issue.fields.description);
    const acIdx     = fullText.toLowerCase().indexOf('acceptance criteria');
    const bodyRaw   = (acIdx > -1 ? fullText.slice(0, acIdx) : fullText).trim();
    // Strip stray ADF artefacts: standalone list numbers ("1.", "2.") on their own line
    const bodyText  = bodyRaw.split('\n').filter(l => !/^\d+\.\s*$/.test(l.trim())).join('\n').trim();

    // Extract ACs — prefer custom field, fall back to description
    let acs: string[];
    if (JIRA_AC_FIELD && issue.fields[JIRA_AC_FIELD]) {
      const acText = descriptionToText(issue.fields[JIRA_AC_FIELD]);
      acs = extractACsFromText(`Acceptance Criteria:\n${acText}`, usNum);
    } else {
      acs = extractACsFromText(fullText, usNum);
    }

    if (acs.length === 0) {
      console.warn(`[jira] ⚠ No ACs found for ${issue.key} — story will be skipped by generator`);
    }

    const testData = extractTestData(fullText);

    const block: StoryBlock = {
      usId,
      title:    issue.fields.summary ?? '(no title)',
      body:     bodyText,
      acs,
      testData,
      jiraKey:  issue.key,
    };

    // E2E stories may span multiple objects — add the story to every detected object
    // so the generator can create tests for each object's ACs.
    // detectObjectKey() returns the PRIMARY object; we also scan ACs for secondary objects.
    const objectsForStory = new Set<string>([objKey]);
    if (objKey !== 'unknown') {
      for (const key of OBJECT_KEYS) {
        if (key === objKey) continue;
        const regex = new RegExp(`\\b${key}\\b`, 'i');
        if (acs.some(ac => regex.test(ac))) objectsForStory.add(key);
      }
      if (objectsForStory.size > 1) {
        console.log(`[jira] ℹ E2E story ${issue.key} spans [${[...objectsForStory].join(', ')}] — adding to all`);
      }
    }

    for (const key of objectsForStory) {
      grouped.get(key)!.push(block);
    }
  }

  // Sort each group by US number
  for (const stories of grouped.values()) {
    stories.sort((a, b) => parseInt(a.usId.slice(3)) - parseInt(b.usId.slice(3)));
  }

  const markdown = buildMarkdown(grouped);

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, markdown, 'utf8');

  console.log(`[jira] ✅ ${issues.length} stories written to ${OUTPUT_FILE}`);
  if (unresolved > 0) {
    console.warn(`[jira] ⚠ ${unresolved} stories could not be mapped to a Salesforce object — check the UNRESOLVED section at the bottom of the file`);
  }

  return { fetched: issues.length, written: OUTPUT_FILE };
}

// ── Standalone entry ──────────────────────────────────────────────────────────

if (require.main === module) {
  fetchJiraStories()
    .then(({ fetched, written }) => {
      console.log(`[jira] Done — ${fetched} stories → ${written}`);
      console.log('[jira] Run "npm run pipeline" to generate tests from the fetched stories.');
    })
    .catch(err => {
      console.error('[jira] ❌', err.message);
      process.exit(1);
    });
}
