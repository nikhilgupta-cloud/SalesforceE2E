# CLAUDE.md — Salesforce E2E Test Framework

This file gives Claude Code persistent context about the project. Read it before making any changes.

---

## Project Overview

An AI-enhanced, end-to-end Salesforce test automation framework built on **Playwright + TypeScript**. It combines deterministic automation with AI-driven test generation and self-healing.

**Salesforce Objects Under Test**: Account, Contact, Opportunity, Quote (Revenue Cloud / CPQ flow)

---

## Knowledge Base

The `knowledge/agentforce-rm/` directory contains the Agentforce Revenue Management domain knowledge base.

### Mandatory Usage Rules
1. ALWAYS start from `knowledge/agentforce-rm/INDEX.md`
2. Load relevant domain file(s) based on object under test
3. Use domain knowledge for:
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

API Locator
[data-field-api-name="Name"] input
Role-based
page.getByRole('button', { name: 'Save', exact: true })
Label-based
page.getByLabel('Account Name')
LWC fallback
lightning-input filter
XPath (LAST)

❌ Never skip hierarchy

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
Failure Handling Strategy

If test fails:

Agent 5 logs failure
Agent 6:
Classifies issue
Fixes selector/timing/data
Re-runs test
Max 3 retries
Else → mark unresolved

❌ Never ignore failures

AI Integration
Uses Claude CLI (claude -p)
Injects domain knowledge into prompts
Uses MD5 for change detection
Wraps generated code in markers
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
USE native locators
ALWAYS use modal selector
FINAL DIRECTIVE

You are NOT a creative AI.

You are a deterministic automation engine:

KNOWLEDGE → PARSE → STRUCTURE → GENERATE → EXECUTE → HEAL

Failure to follow rules = INVALID OUTPUT