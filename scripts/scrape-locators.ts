/**
 * scrape-locators.ts — CDP-based Salesforce Lightning locator scraper
 *
 * Navigates to Salesforce object pages (New/Edit forms) using your existing
 * auth session, then uses Playwright's CDP access + DOM evaluation to extract
 * all lightning-* component locators from the live page, piercing Shadow DOMs.
 *
 * Output: knowledge/scraped-locators.json
 *
 * Usage:
 * npx ts-node scripts/scrape-locators.ts            # scrape all objects
 * npx ts-node scripts/scrape-locators.ts account    # scrape one object
 */

import { chromium, type Page, type BrowserContext } from '@playwright/test';
import * as fs   from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config();

// ── Types ────────────────────────────────────────────────────────────────────

interface LocatorEntry {
  label:        string;
  componentTag: string;   // e.g. "lightning-input"
  inputType:    string;   // "text" | "combobox" | "lookup" | "checkbox" | "date" | "unknown"
  selector:     string;   // Playwright-ready selector
  apiName:      string | null; // data-field-api-name if present
}

interface ObjectLocatorMap {
  scrapedAt: string;
  pageUrl:   string;
  fields:    LocatorEntry[];
}

type LocatorDatabase = Record<string, ObjectLocatorMap>;

// ── Config ───────────────────────────────────────────────────────────────────

const SF = process.env.SF_SANDBOX_URL!;
const OUTPUT_PATH = path.join(__dirname, '../knowledge/scraped-locators.json');
const SESSION_FILE = path.join(__dirname, '../auth/session.json');

/**
 * Object → New-record URL mapping.
 * The New form is the richest target — it shows all editable fields.
 */
const OBJECT_URLS: Record<string, string> = {
  account:     '/lightning/o/Account/new',
  contact:     '/lightning/o/Contact/new',
  opportunity: '/lightning/o/Opportunity/new',
  quote:       '/lightning/o/Quote/new',
};

// ── DOM Extraction (runs inside browser context) ──────────────────────────────

/**
 * Injected into the page via page.evaluate().
 * Walks the DOM and Shadow DOMs to find all lightning-* components.
 * Must be a plain function (no closure over Node.js variables).
 */
function extractLocatorsFromDOM(): LocatorEntry[] {
  const results: LocatorEntry[] = [];
  const seenLabels = new Set<string>();

  // Recursive function to pierce Shadow DOM boundaries
  function walk(node: Document | Element | ShadowRoot) {
    if (!node) return;

    const tagName = (node as Element).tagName?.toLowerCase();
    
    // Process lightning components
    if (tagName && tagName.startsWith('lightning-')) {
      const el = node as HTMLElement;
      
      // Find label (might be in light DOM or shadow DOM)
      const labelEl = el.querySelector('label') || el.shadowRoot?.querySelector('label');
      const label = labelEl?.innerText?.trim() ?? '';
      
      // Climb the DOM tree to find the API name if it's on a wrapper
      let apiName = el.getAttribute('data-field-api-name') ?? el.getAttribute('field-name');
      if (!apiName) {
        let parent: HTMLElement | null = el.parentElement;
        while (parent && !apiName) {
          apiName = parent.getAttribute('data-field-api-name') ?? parent.getAttribute('field-name');
          parent = parent.parentElement;
        }
      }

      if (label && !seenLabels.has(label)) {
        seenLabels.add(label);
        
        let inputType = 'unknown';
        let fallbackSelector = '';

        if (tagName === 'lightning-input') {
          const typeAttr = el.getAttribute('type') || (el.querySelector('input')?.type);
          inputType = typeAttr === 'checkbox' ? 'checkbox' : typeAttr === 'date' ? 'date' : 'text';
          fallbackSelector = `lightning-input:has-text("${label}") input`;
        } 
        else if (tagName === 'lightning-combobox') {
          inputType = 'combobox';
          fallbackSelector = `lightning-combobox:has-text("${label}") button`;
        } 
        else if (tagName === 'lightning-lookup') {
          inputType = 'lookup';
          fallbackSelector = `lightning-lookup:has-text("${label}") input`;
        }
        else if (tagName === 'lightning-textarea') {
          inputType = 'text';
          fallbackSelector = `lightning-textarea:has-text("${label}") textarea`;
        }
        else if (tagName === 'lightning-input-field') {
          inputType = 'unknown';
          fallbackSelector = `lightning-input-field:has-text("${label}") input`;
        }

        if (fallbackSelector) {
          results.push({
            label,
            componentTag: tagName,
            inputType,
            selector: apiName ? `[data-field-api-name="${apiName}"] input` : fallbackSelector,
            apiName: apiName ?? null,
          });
        }
      }
    }

    // Traverse light DOM children
    const children = (node as Element).children;
    if (children) {
      for (let i = 0; i < children.length; i++) {
        walk(children[i]);
      }
    }
    
    // CRITICAL: Step inside the shadow root if it exists
    if ((node as Element).shadowRoot) {
      walk((node as Element).shadowRoot!);
    }
  }

  walk(document);
  return results;
}

// ── Scraper Helpers ───────────────────────────────────────────────────────────

async function waitForModal(page: Page): Promise<boolean> {
  try {
    const modal = page.locator('[role="dialog"]:not([id="auraError"]):not([aria-hidden="true"])');
    await modal.waitFor({ state: 'visible', timeout: 20000 });
    await page.waitForTimeout(2000); // Wait for LWC rendering to settle
    return true;
  } catch {
    return false;
  }
}

async function dismissAuraError(page: Page) {
  const err = page.locator('#auraError');
  if (await err.isVisible({ timeout: 2000 }).catch(() => false)) {
    await err.locator('button').first().click().catch(() => {});
    await err.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
  }
}

async function scrapeObject(
  page: Page,
  objectKey: string,
  urlPath: string,
): Promise<ObjectLocatorMap> {
  console.log(`\n[scrape] → ${objectKey}: ${SF}${urlPath}`);

  await page.goto(`${SF}${urlPath}`, { waitUntil: 'domcontentloaded' });
  await dismissAuraError(page);

  // 1. Bypass "Select Record Type" modal if it exists
  const nextBtn = page.getByRole('button', { name: 'Next', exact: true });
  if (await nextBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log(`[scrape] ℹ Record Type modal detected for ${objectKey}. Clicking Next...`);
    await nextBtn.click();
  }

  // 2. Wait for the actual data entry modal
  const modalFound = await waitForModal(page);
  if (!modalFound) {
    console.warn(`[scrape] ⚠ No data-entry modal found for ${objectKey}.`);
  }

  // 3. Wait for spinners to die (Crucial for Revenue Cloud)
  const spinner = page.locator('.slds-spinner_container, .forceVisualMessageQueue');
  if (await spinner.first().isVisible().catch(() => false)) {
    await spinner.first().waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});
  }

  // Extra wait for lazy-loaded LWC components
  await page.waitForTimeout(2000);

  // Execute Shadow-Piercing evaluator
  const fields = await page.evaluate(extractLocatorsFromDOM);

  console.log(`[scrape] ✓ ${fields.length} unique fields found for ${objectKey}`);
  fields.forEach(f => console.log(`         ${f.componentTag.padEnd(25)} | ${f.label} ${f.apiName ? `(api: ${f.apiName})` : ''}`));

  return {
    scrapedAt: new Date().toISOString(),
    pageUrl:   `${SF}${urlPath}`,
    fields:    fields,
  };
}

// ── Exported pipeline function ────────────────────────────────────────────────

const CACHE_TTL_HOURS = 24;

export async function scrapeLocators(opts: { force?: boolean } = {}): Promise<{
  skipped: boolean;
  reason:  string;
  objects: string[];
}> {
  if (!fs.existsSync(SESSION_FILE)) {
    return { skipped: true, reason: 'No auth/session.json — run refresh-session.ts first', objects: [] };
  }

  if (!opts.force && fs.existsSync(OUTPUT_PATH)) {
    const stat   = fs.statSync(OUTPUT_PATH);
    const ageMs  = Date.now() - stat.mtimeMs;
    const ageMins = Math.round(ageMs / 60000);
    if (ageMs < CACHE_TTL_HOURS * 60 * 60 * 1000) {
      return {
        skipped: true,
        reason:  `Locator map is ${ageMins}m old (< ${CACHE_TTL_HOURS}h) — using cache`,
        objects: Object.keys(OBJECT_URLS),
      };
    }
  }

  let db: LocatorDatabase = {};
  if (fs.existsSync(OUTPUT_PATH)) {
    try { db = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8')); } catch {}
  }

  const browser = await chromium.launch({ headless: false });
  const context: BrowserContext = await browser.newContext({
    storageState: SESSION_FILE,
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  const scraped: string[] = [];
  try {
    for (const [key, urlPath] of Object.entries(OBJECT_URLS)) {
      db[key] = await scrapeObject(page, key, urlPath);
      scraped.push(key);
    }
  } finally {
    await browser.close();
  }

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(db, null, 2), 'utf8');

  return { skipped: false, reason: 'Scraped successfully', objects: scraped };
}

// ── Standalone CLI entry point ────────────────────────────────────────────────

async function main() {
  const targetArg = process.argv[2]?.toLowerCase();

  if (targetArg && !OBJECT_URLS[targetArg]) {
    console.error(`[scrape] Unknown object: ${targetArg}. Valid: ${Object.keys(OBJECT_URLS).join(', ')}`);
    process.exit(1);
  }

  if (!fs.existsSync(SESSION_FILE)) {
    console.error('[scrape] No auth/session.json found. Run: npx ts-node scripts/refresh-session.ts');
    process.exit(1);
  }

  const objectsToScrape = targetArg
    ? { [targetArg]: OBJECT_URLS[targetArg] }
    : OBJECT_URLS;

  let db: LocatorDatabase = {};
  if (fs.existsSync(OUTPUT_PATH)) {
    try { db = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8')); } catch {}
  }

  const browser = await chromium.launch({ headless: false });
  const context: BrowserContext = await browser.newContext({
    storageState: SESSION_FILE,
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  try {
    for (const [key, urlPath] of Object.entries(objectsToScrape)) {
      db[key] = await scrapeObject(page, key, urlPath);
    }
  } finally {
    await browser.close();
  }

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(db, null, 2), 'utf8');
  console.log(`\n[scrape] Locator map saved → ${OUTPUT_PATH}`);
}

if (require.main === module) {
  main().catch(err => {
    console.error('[scrape] Fatal:', err);
    process.exit(1);
  });
}