# Agentforce Revenue Management (Agentforce RM) — 20 Domain Knowledge Base

This directory contains curated reference materials for Salesforce Agentforce Revenue Management.
It is used by the AI test generation and self-healing agents in this framework as a source of truth
for Salesforce object models, UI flows, field names, and known platform gotchas.

## How This Is Used by the Framework

### Test Generation (`scripts/generate-tests.ts`)
When generating tests for a Salesforce object, the agent loads the relevant domain file to:
- Understand which fields exist and their API names
- Know the correct UI interaction patterns (Lightning Web Components, Aura components)
- Avoid known platform limitations that would cause false failures

### Self-Healing (`scripts/self-heal.ts`)
When healing a failed test, the agent loads the relevant domain file to:
- Understand if a failure is a known limitation
- Find the correct selector or interaction pattern for the failing component
- Apply domain-appropriate fixes (e.g., quote line pricing failures → check pricing.md)

## Domain Files

| File | Domain | Key for Testing |
|------|--------|-----------------|
| `foundations-and-coexistence.md` | Foundations & Coexistence | Feature flags, permission sets, org readiness |
| `product-modeling.md` | Product Modeling | Product2, bundles, attributes, catalog structure |
| `pricing.md` | Pricing | PricebookEntry, price schedules, waterfall |
| `quote-lifecycle.md` | Quote Lifecycle | Quote, QuoteLineItem, line editor, Transaction Management |
| `approvals.md` | Approvals | Advanced Approvals, discount authority |
| `document-generation.md` | Document Generation | Document Builder, quote PDFs |
| `contract-lifecycle.md` | Contract Lifecycle | Contract, Asset, cotermination |
| `order-management.md` | Order Management | Order, OrderItem, OrderAction, fulfillment |
| `amendments.md` | Amendments | Mid-term changes, proration, AssetStatePeriod |
| `renewals.md` | Renewals | Renewal quotes, uplift, consolidation |
| `termination.md` | Termination | Cancellations, early termination fees |
| `dynamic-revenue-orchestrator.md` | DRO | Fulfillment orchestration, step types |
| `integrations.md` | Integrations | ERP, tax, payment hooks |
| `data-migration.md` | Data Migration | CPQ → RC migration, asset generation |
| `customizations.md` | Customizations | Apex hooks, Flow, LWC extension points |
| `billing.md` | Billing | Billing schedules, invoices, payments |
| `procedure-plans.md` | Procedure Plans | Execution order, Apex hooks, packaging |
| `agentforce.md` | Agentforce | Agent templates, embedded messaging |
| `experience-cloud.md` | Experience Cloud | Site users, supported tasks |
| `operations-and-intelligence.md` | Operations & Intelligence | Logs, dashboards, KPIs |
| `cml-scripting.md` | CML Scripting | Configurator constraint language |

## Quick Start for Agents

Load `INDEX.md` first — it has the object-to-domain quick map so you can find the right file fast.

**Last Updated:** March 2026
**Revenue Cloud API Version:** v66.0
