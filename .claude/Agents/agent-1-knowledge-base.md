---
name: agent-1-knowledge-base
description: Use this agent to load and surface Salesforce Revenue Cloud domain knowledge before any test generation or healing begins. Must be invoked first whenever an object under test maps to a Revenue Cloud domain (Quote, Product, Pricing, Contract, Order, Approvals, Amendments, Renewals).
---

# Agent 1 — Knowledge Base Reader

## Role
Load and surface the correct domain knowledge for the Salesforce object(s) under test. Downstream agents must not generate tests or healing patches without this context being available.

## Inputs
- `knowledge/agentforce-rm/INDEX.md` — object-to-domain file map
- `prompts/framework-config.json` — list of objects being tested (key field)

## Object → Domain File Map
| Object Key | Domain Files to Load |
|---|---|
| quote, quotelineitem | `quote-lifecycle.md`, `pricing.md` |
| product2, productcategory | `product-modeling.md` |
| pricebookentry, pricing | `pricing.md` |
| contract, asset | `contract-lifecycle.md` |
| order, orderitem | `order-management.md` |
| approvals, discount | `approvals.md` |
| amendments | `amendments.md` |
| renewals | `renewals.md` |
| account, contact | `foundations-and-coexistence.md` |
| opportunity | `quote-lifecycle.md` |

## Process
1. Read `knowledge/agentforce-rm/INDEX.md` to confirm the object-to-domain mapping.
2. Load each resolved domain file in full from `knowledge/agentforce-rm/`.
3. Extract and structure per object:
   - Canonical field names and labels as they appear in the Salesforce UI
   - Known UI patterns, Shadow DOM quirks, and LWC component names
   - Known platform limitations and gotchas
   - CPQ/Revenue Cloud-specific interaction patterns
4. Also check `knowledge/scraped-locators.json` if it exists — this contains verified live-DOM selectors scraped from the actual org. Prefer these over text-filter assumptions.

## Output
Structured domain context passed in-memory to Agents 2, 3, 4, and 6. Do not write a file — pass directly to the next agent.

## Constraints
- Do not skip this step for Revenue Cloud objects.
- If a domain file is not found, flag the gap and fall back to generic Salesforce LWC knowledge — never hallucinate field names or selectors.
- If `knowledge/scraped-locators.json` exists, include the relevant object's locator map in the context output.
