# CLAUDE.md — Salesforce E2E Test Framework

This file gives Claude Code persistent context about the project. Read it before making any changes.

---

## Project Overview

An AI-enhanced, end-to-end Salesforce test automation framework built on **Playwright + TypeScript**. It combines deterministic automation with AI-driven test generation and self-healing.

**Salesforce Objects Under Test**: Account, Contact, Opportunity, Quote (Revenue Cloud / CPQ flow)

---

## Knowledge Base

The `knowledge/agentforce-rm/` directory contains the Agentforce Revenue Management domain knowledge base.
The `knowledge/FLow/Flow.mp4` file contains the end-to-end user journey video.

### Mandatory Usage Rules
1. ALWAYS start from `knowledge/agentforce-rm/INDEX.md`
2. Review `knowledge/FLow/Flow.mp4` to understand the step-by-step UI interactions and transitions.
3. Load relevant domain file(s) based on object under test
4. Use domain knowledge for:
   - Field names
   - UI patterns
   - Salesforce limitations
   - CPQ lifecycle behavior

### Object → Domain Mapping

| Object | Domain Files |
|--------|-------------|
| Quote, QuoteLineItem | `quote-lifecycle.md`, `pricing.md` |
| Product | `product-modeling.md` |
| Pricing | `pricing.md` |
| Contract | `contract-lifecycle.md` |
| Order | `order-management.md` |
| Approvals | `approvals.md` |
| Amendments | `amendments.md` |
| Renewals | `renewals.md` |
| Account, Contact, Opportunity | `foundations-and-coexistence.md` |

❌ DO NOT generate tests without loading domain knowledge  
❌ DO NOT invent field names  

---

## User Story Input Handling (CRITICAL)

User stories may come in ANY format:
- Plain text
- Jira export
- Bullet points
- Excel-like data

### Rules:
1. Detect Acceptance Criteria using:
   - `AC-\d+`
   - "Acceptance Criteria"
   - Given / When / Then
2. If AC IDs missing:
   - Generate TEMP IDs: `TEMP-AC-001`
3. Normalize BEFORE parsing
4. NEVER reject story due to format

---

## Test Data Strategy (MANDATORY)

Test data may come from:
- JSON (`getTestData`)
- Inline AC values
- Runtime generation

### ⚠️ EXACT KEY NAMES — DO NOT INVENT OR CAMELCASE (CRITICAL)

`getTestData()` returns a typed `TestData` object. Always use these exact keys:

| Object | Correct Key | ❌ Wrong (never use) |
|--------|------------|----------------------|
| account | `data.account.Account_Name` | `data.account.name`, `data.account.accountName` |
| contact | `data.contact.First_Name` | `data.contact.firstName`, `data.contact.first_name` |
| contact | `data.contact.Last_Name` | `data.contact.lastName`, `data.contact.last_name` |
| contact | `data.contact.Email` | `data.contact.email` |
| contact | `data.contact.Phone` | `data.contact.phone` |
| contact | `data.contact.Full_Name` | `data.contact.fullName` |
| opportunity | `data.opportunity.Name` | `data.opportunity.name`, `data.opportunity.oppName` |
| opportunity | `data.opportunity.Stage` | `data.opportunity.stage` |
| opportunity | `data.opportunity.Close_Date` | `data.opportunity.closeDate`, `data.opportunity.close_date` |
| quote | `data.quote.Name` | `data.quote.name`, `data.quote.quoteName` |
| quote | `data.quote.Contract_Type` | `data.quote.contractType` |

Fields **not in test-data.json** (use hardcoded fallbacks, never read from `data`):
- `priceBook` → `'Standard Price Book'`
- `expirationDate` / `expiryDate` → `'12/31/2026'`

❌ NEVER use optional chaining (`?.`) when accessing typed `TestData` fields — the keys always exist  
❌ NEVER invent keys not in the `TestData` interface in `utils/test-data.ts`

### Rules:
1. Map data to objects:
   - `data.account` → Account
   - `data.contact` → Contact
   - `data.opportunity` → Opportunity
2. If data missing:

AutoAcc-${Date.now()}

3. NEVER hardcode business data
4. ALWAYS keep tests reusable

---

## Multi-Object Flow Handling (VERY IMPORTANT)

Salesforce flows are sequential:


Account → Contact → Opportunity → Quote → Contract → Order


### Rules:
- Maintain state across objects
- Reuse existing records
- Avoid duplicate creation
- Support E2E lifecycle flows

---

## Tech Stack

| Tool | Role |
|------|------|
| Playwright | Test runner |
| TypeScript | Language |
| Claude API | AI generation + healing |
| dotenv | Environment config |

---

## Key Commands

```bash
npm run pipeline
npm run watch:stories
npx playwright test
npx ts-node scripts/refresh-session.ts
npx ts-node scripts/generate-tests.ts
npx ts-node scripts/self-heal.ts
Directory Structure
knowledge/          → Domain knowledge
tests/              → Playwright specs
utils/              → Helpers
scripts/            → Pipeline scripts
prompts/            → Config + user stories
generated/          → AI output (DO NOT EDIT)
reports/            → Results
auth/session.json   → Auth state
.env                → Secrets
Architecture Patterns
Locator Strategy (STRICT)

Priority order:

### STEP 1: Use XPath (PRIMARY — always prefer)
Define XPath strings in a locator map with `{PLACEHOLDER}` tokens, then export typed helper functions:

```typescript
// locators/account.locators.ts
const locatorMap = {
  accountName: `//input[@data-field-api-name='Name']`,
  relatedContact: `//a[contains(@title,'{CONTACT_NAME}')]`,
  saveButton: `//button[normalize-space()='Save']`,
};

export const relatedContact = (contactName: string) =>
  getLocator(locatorMap.relatedContact.replace('{CONTACT_NAME}', contactName));
```

Rules:
- Store all XPaths in a `locatorMap` constant — never inline raw XPath strings in test code
- Use `{PLACEHOLDER}` for dynamic segments; replace via `.replace()` before passing to `getLocator()`
- Use `//` (descendant) axes; prefer `@data-*` attributes, `normalize-space()`, and `contains()` over positional indices
- Wrap every XPath in a typed export: `export const locatorName = (param?: string) => getLocator(...)`

### STEP 2: API Attribute Locator (fallback when no XPath anchor exists)
`[data-field-api-name="Name"] input`

### STEP 3: Role-based (fallback)
`page.getByRole('button', { name: 'Save', exact: true })`

### STEP 4: Label-based (fallback)
`page.getByLabel('Account Name')`

### STEP 5: LWC tag fallback
`lightning-input` filter

❌ Never skip the hierarchy — always attempt STEP 1 first
❌ Never inline raw XPath strings directly in test files — always route through the locator map + typed export

Modal Handling
const modal = page.locator('[role="dialog"]:not([id="auraError"]):not([aria-hidden="true"])');
Spinner Handling
await page.locator('.slds-spinner').waitFor({ state: 'hidden' }).catch(() => {});
Navigation Helpers
await page.goto(process.env.SF_SANDBOX_URL);
await page.waitForLoadState('domcontentloaded');
AI Pipeline (7 Steps)
Agent 1 → Knowledge
Agent 2 → AC Parsing
Agent 3 → Test Plan
Agent 4 → Test Generation
Agent 5 → Execution
Agent 6 → Self-Healing
Agent 7 → Reporting
Traceability Rule (MANDATORY)

Every test MUST map:

AC → TC → Code

Example:

// TC-QTE-001 | AC Reference: AC-005-01

❌ No AC → NO test

Test Naming Convention
Item	Format
TC ID	TC-ACC-001
Prefix	ACC, CON, OPP, QTE
Data	AutoAcc-${Date.now()}
Playwright Rules
Workers = 1 ONLY
No networkidle
No isVisible() for logic
Always .first()
Always exact: true
Never use global search (SFUtils.searchAndOpen) to navigate to a record saved in the same test run — Salesforce search indexing has a minutes-long delay; use the Related list link or success toast link instead
Use SFUtils.searchExists() (10s timeout) for existence checks — never searchAndOpen() (30s timeout) when the record may not exist
URL contains /Contact/ or /Opportunity/ is the reliable navigation proof — heading text is locale-dependent and unreliable
Failure Handling Strategy

If test fails:

Agent 5 logs failure
Agent 6:
Classifies issue (selector / timing / data / Salesforce API error)
Checks console output + stderr for 4xx/5xx HTTP codes before changing selectors
Fixes selector/timing/data
Re-runs test
Max 3 retries
Else → apply test.fixme() with error comment — test is skipped cleanly, suite continues

❌ Never ignore failures
❌ Never change selectors when console shows INVALID_SESSION_ID / INSUFFICIENT_ACCESS / HTTP 5xx

AI Integration
Uses Claude CLI (claude -p)
Injects domain knowledge into prompts
Uses MD5 for change detection
Wraps generated code in markers
Passing-test protection: if all tests in a spec file are currently passing, a story metadata change (Jira comment edit, whitespace, sprint annotation) does NOT trigger regeneration — hash is synced silently
Story hash store: prompts/user-stories/.story-hashes.json — resync manually with node if stale
Reports
File	Purpose
dashboard.html	Live results
results.json	Raw results
pipeline-state.json	Execution tracking
Environment Variables
SF_SANDBOX_URL=
SF_USERNAME=
SF_PASSWORD=
GITHUB_TOKEN=
Critical Constraints
DO NOT edit generated/
DO NOT commit .env or session.json
DO NOT increase workers
ALWAYS use XPath via locator map + typed export (STEP 1) — never skip to native locators without trying XPath first
ALWAYS use modal selector
FINAL DIRECTIVE

You are NOT a creative AI.

You are a deterministic automation engine:

KNOWLEDGE → PARSE → STRUCTURE → GENERATE → EXECUTE → HEAL

Failure to follow rules = INVALID OUTPUT