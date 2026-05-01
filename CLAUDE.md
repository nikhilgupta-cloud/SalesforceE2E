CLAUDE.md — Salesforce E2E Test Framework (API-Driven)

This file gives Claude Code persistent context. Read it before making any changes.

1. Project Overview & Core Strategy

An AI-enhanced, end-to-end Salesforce test automation framework using Playwright + TypeScript.
Core Strategy: Use Salesforce API Metadata (knowledge/scraped-locators.json) for 100% deterministic field interaction via SFUtils.

2. Navigation & Record Creation (MANDATORY)

Salesforce UI layouts (Related Lists) are dynamic and cause test timeouts.

❌ NEVER click "New" buttons inside Related Lists (e.g., Contacts under Account).

✅ ALWAYS use Direct URL Navigation to create records to bypass UI layout issues.

Example (Contact): await SFUtils.goto(page, \${SF}/lightning/o/Contact/new`);`

Example (Opportunity): await SFUtils.goto(page, \${SF}/lightning/o/Opportunity/new`);`

Example (Quote): await SFUtils.goto(page, \${SF}/lightning/o/Quote/new`);`

3. Locator & UI Strategy (MANDATORY)

RULE #1: Always use SFUtils with API Names.

Primary (Fields): await SFUtils.fillField(page, root, 'API_Name__c', value);

Dynamic Waits: ❌ DO NOT use page.waitForTimeout(). ✅ ALWAYS use await SFUtils.waitForLoading(page); and rely on specific locator .waitFor({ state: 'visible' }) mechanisms.

⚠️ Salesforce Specific Quirks

Compound Fields (Addresses): When verifying addresses in Read-Only mode (Details tab), ALWAYS use the compound API name ('BillingAddress', 'ShippingAddress') instead of individual fields (like 'BillingStreet').

Handling Lookups: Salesforce lookups require a strict Fill -> Wait -> Click pattern.

// DO NOT JUST FILL. YOU MUST SELECT THE DROPDOWN OPTION.
await SFUtils.fillField(page, root, 'AccountId', data.account.Account_Name);
await SFUtils.waitForLoading(page);
await page.locator('[role="option"], lightning-base-combobox-item').filter({ hasText: data.account.Account_Name }).first().click();


4. Test Data Strategy

Always use the exact keys from tests/fixtures/test-data.json. DO NOT CAMELCASE.

Account: data.account.Account_Name

Contact: data.contact.First_Name, data.contact.Last_Name, data.contact.Email

Opportunity: data.opportunity.Name, data.opportunity.Stage, data.opportunity.Close_Date

Quote: data.quote.Name

5. Spec File Architecture

Every .spec.ts generated must follow this structure:

Header: Imports test, expect, SFUtils, and loads data:
const data = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'tests', 'fixtures', 'test-data.json'), 'utf8'));

Base URL: const SF = process.env.SF_SANDBOX_URL || process.env.SF_LOGIN_URL || '';

Sequential State: Use variables (e.g., let quoteUrl = '';) at the describe level to pass data.

BeforeEach: Use await SFUtils.goto(page, SF); and await SFUtils.waitForAppReady(page);.

6. Token Limit & AI Output Directive

*** CRITICAL SYSTEM DIRECTIVE ***

OUTPUT RAW TYPESCRIPT CODE ONLY.

NO EXPLANATIONS, NO MARKDOWN TABLES, NO CHAT, NO GREETINGS.

Keep tests DRY. Generate a maximum of 5 E2E scenarios per file.

Failure to output pure code will cause pipeline syntax errors.
