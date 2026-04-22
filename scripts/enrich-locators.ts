/**
 * enrich-locators.ts — Backfill scraped-locators.json with real Salesforce field API names
 *
 * Auth strategy (in priority order):
 *   1. auth/session.json  — reuses the existing Playwright session (sid cookie).
 *      Works even when SOAP API login is disabled on the org.
 *   2. SOAP login fallback — only attempted if session.json is missing or the sid is stale.
 *
 * Run: npx ts-node scripts/enrich-locators.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const SF_URL  = (process.env.SF_SANDBOX_URL || '').replace(/\/$/, '');
const SF_USER = process.env.SF_USERNAME!;
const SF_PASS = process.env.SF_PASSWORD!;

const LOCATORS_PATH = path.join(__dirname, '..', 'knowledge', 'scraped-locators.json');
const SESSION_PATH  = path.join(__dirname, '..', 'auth', 'session.json');
const API_VERSION   = 'v59.0';

// ── Auth ──────────────────────────────────────────────────────────────────────

async function getSessionId(): Promise<{ sessionId: string; instanceUrl: string }> {
  // Strategy 1: reuse Playwright auth/session.json (sid cookie = SF access token)
  if (fs.existsSync(SESSION_PATH)) {
    try {
      const session = JSON.parse(fs.readFileSync(SESSION_PATH, 'utf8'));
      const sid = (session.cookies as Array<{ name: string; value: string; domain: string }> | undefined)
        ?.find(c => c.name === 'sid');
      if (sid?.value) {
        const instanceUrl = `https://${sid.domain}`;
        // Quick probe to confirm the session is still live
        const probe = await fetch(
          `${instanceUrl}/services/data/${API_VERSION}/`,
          { headers: { Authorization: `Bearer ${sid.value}` } },
        );
        if (probe.ok) {
          console.log('[enrich-locators] ✓ Using existing Playwright session (auth/session.json)');
          return { sessionId: sid.value, instanceUrl };
        }
        console.warn('[enrich-locators] ⚠ Session cookie expired — falling back to SOAP login');
      }
    } catch {
      console.warn('[enrich-locators] ⚠ Could not parse session.json — falling back to SOAP login');
    }
  }

  // Strategy 2: SOAP login (requires SOAP API to be enabled on the org)
  if (!SF_URL || !SF_USER || !SF_PASS) {
    throw new Error('No valid session found and SF_SANDBOX_URL/SF_USERNAME/SF_PASSWORD not set');
  }

  const soapBody = `<?xml version="1.0" encoding="utf-8" ?>
<env:Envelope xmlns:xsd="http://www.w3.org/2001/XMLSchema"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:env="http://schemas.xmlsoap.org/soap/envelope/">
  <env:Body>
    <n1:login xmlns:n1="urn:partner.soap.sforce.com">
      <n1:username>${SF_USER}</n1:username>
      <n1:password>${SF_PASS}</n1:password>
    </n1:login>
  </env:Body>
</env:Envelope>`;

  const loginUrl = `${SF_URL}/services/Soap/u/59.0`;
  const res = await fetch(loginUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml', SOAPAction: 'login' },
    body: soapBody,
  });

  const xml = await res.text();
  const sessionId = xml.match(/<sessionId>(.+?)<\/sessionId>/)?.[1];
  const serverUrl = xml.match(/<serverUrl>(.+?)<\/serverUrl>/)?.[1];

  if (!sessionId || !serverUrl) {
    const fault = xml.match(/<faultstring>(.+?)<\/faultstring>/)?.[1] ?? 'unknown';
    throw new Error(`SOAP login failed: ${fault}`);
  }

  return { sessionId, instanceUrl: new URL(serverUrl).origin };
}

// ── Describe ──────────────────────────────────────────────────────────────────

interface FieldMeta { apiName: string; fieldType: string }

async function describeObject(
  instanceUrl: string,
  sessionId: string,
  objectName: string,
): Promise<Map<string, FieldMeta>> {
  const url = `${instanceUrl}/services/data/${API_VERSION}/sobjects/${objectName}/describe`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${sessionId}` } });

  if (!res.ok) throw new Error(`describe(${objectName}) → HTTP ${res.status}`);

  const data = await res.json() as { fields: Array<{ label: string; name: string; type: string }> };
  const map  = new Map<string, FieldMeta>();

  for (const f of data.fields) {
    const meta: FieldMeta = { apiName: f.name, fieldType: f.type };
    // Index by exact label and by label stripped of leading asterisk (required marker)
    map.set(f.label.trim().toLowerCase(), meta);
    map.set(f.label.replace(/^\*/, '').trim().toLowerCase(), meta);
  }
  return map;
}

// ── Selector builder ──────────────────────────────────────────────────────────

function buildSelector(apiName: string, inputType: string): string {
  // Combobox/picklist: trigger button lives inside the wrapper
  if (inputType === 'combobox') return `[data-field-api-name="${apiName}"] button`;
  // All text/number/date/email/phone inputs
  return `[data-field-api-name="${apiName}"] input`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

const OBJECT_MAP: Record<string, string> = {
  account:     'Account',
  contact:     'Contact',
  opportunity: 'Opportunity',
  quote:       'Quote',
};

async function main() {
  console.log('[enrich-locators] Authenticating to Salesforce...');
  const { sessionId, instanceUrl } = await getSessionId();
  console.log(`[enrich-locators] ✓ Connected → ${instanceUrl}\n`);

  const locators = JSON.parse(fs.readFileSync(LOCATORS_PATH, 'utf8'));

  for (const [key, sfObject] of Object.entries(OBJECT_MAP)) {
    if (!locators[key]?.fields?.length) {
      console.log(`[enrich-locators] Skipping ${key} — no fields scraped`);
      continue;
    }

    console.log(`[enrich-locators] Describing ${sfObject}...`);
    const fieldMap = await describeObject(instanceUrl, sessionId, sfObject);

    let enriched = 0;
    for (const field of locators[key].fields as Array<{
      label: string; inputType: string; selector: string; apiName: string | null
    }>) {
      const normalised = field.label.replace(/^\*/, '').trim().toLowerCase();
      const meta = fieldMap.get(normalised);
      if (meta) {
        field.apiName  = meta.apiName;
        field.selector = buildSelector(meta.apiName, field.inputType);
        enriched++;
      }
    }
    console.log(`  → ${enriched}/${locators[key].fields.length} fields enriched for ${sfObject}`);
  }

  fs.writeFileSync(LOCATORS_PATH, JSON.stringify(locators, null, 2));
  console.log('\n[enrich-locators] ✅ knowledge/scraped-locators.json updated');
}

main().catch(e => { console.error('[enrich-locators] ✗', e.message); process.exit(1); });
