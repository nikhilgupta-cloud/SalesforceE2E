/**
 * FrameworkConfig.ts — Shared config loader for the QA pipeline.
 * Reads prompts/framework-config.json once (cached) and exposes typed helpers
 * used by DashboardReporter, generate-tests, and run-pipeline.
 */
import * as fs   from 'fs';
import * as path from 'path';

export interface ObjectConfig {
  key:              string;          // e.g. "account"
  prefix:           string;          // e.g. "ACC"  (used in TC-ACC-001)
  displayName:      string;          // e.g. "Account"
  icon:             string;          // e.g. "🏢"
  accent:           string;          // e.g. "#6366f1"  (ring/card colour on dashboard)
  specFile:         string;          // e.g. "account.spec.ts"
  scenarioFile:     string;          // e.g. "account-scenarios.md"
  sfApiName?:       string;          // Salesforce object API name for URL derivation (e.g. "Account", "SBQQ__Quote__c")
  recordType?:      string;          // Preferred Record Type label to select when the New-form modal prompts
  extraScrapeUrls?: string[];        // Additional page paths to scrape (e.g. QLE editor — requires a live record ID)
}

export interface AppConfig {
  appName:          string;
  dashboardTitle:   string;
  dashboardSubtitle: string;
  objects:          ObjectConfig[];
}

const CONFIG_PATH = path.join('prompts', 'framework-config.json');
let _cache: AppConfig | null = null;

export function loadConfig(): AppConfig {
  if (_cache) return _cache;
  try {
    _cache = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) as AppConfig;
    return _cache;
  } catch {
    throw new Error(
      `[FrameworkConfig] Cannot read ${CONFIG_PATH}.\n` +
      `Create it by copying the template from an existing project and updating the values.`,
    );
  }
}

/** Active objects only — those without an "_inactive" marker in the config JSON. */
function activeObjects(): ObjectConfig[] {
  const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) as AppConfig & {
    objects: (ObjectConfig & { _inactive?: string })[];
  };
  return raw.objects.filter(o => !('_inactive' in o));
}

/** Record keyed by object key → full config (for generate-tests OBJECT_MAP) */
export function getObjectMap(): Record<string, ObjectConfig> {
  return Object.fromEntries(activeObjects().map(o => [o.key, o]));
}

/** Record keyed by object key → dashboard display meta (for DashboardReporter SUITE_META) */
export function getSuiteMeta(): Record<string, { displayName: string; icon: string; accent: string }> {
  return Object.fromEntries(
    activeObjects().map(o => [o.key, { displayName: o.displayName, icon: o.icon, accent: o.accent }]),
  );
}

/** Ordered list of object keys, e.g. ["account","contact","opportunity","quote"] */
export function getObjectKeys(): string[] {
  return activeObjects().map(o => o.key);
}
