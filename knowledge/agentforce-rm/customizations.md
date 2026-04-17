# Customizations — Agentforce RM Architect Reference

## Domain Overview
Customizations extend Revenue Cloud beyond out-of-the-box capabilities using Apex hooks in pricing and discovery procedures, Flow-driven transaction API invocation, Sales Transaction API for configurator integration, Lightning App Builder for UI, and custom metadata for configuration-driven logic.

**Custom code is the safety valve — use it only after exhausting native setup options.**

## Key Salesforce Anchors
- `Flow` — low-code automation; invokes Revenue Cloud APIs and routes transaction events
- `Apex` — pro-code extension for pricing hooks, discovery hooks, callouts, and event handlers
- pricing APIs — invoked programmatically to apply or override pricing logic
- Sales Transaction APIs — data-transfer and invocation pattern for configurator
- procedure plans — orchestration wrapper controlling when custom logic fires
- context definitions — runtime data shapes that feed custom logic

## Guide-Backed Extension Points
- `Configure Apex Hooks in a Product Discovery Procedure Plan`
- `Sample Apex Class for Product Discovery External Pricing`
- `Example: Use Apex Hooks to Extend Pricing Logic`
- `Invoke the Place Sales Transaction API in a Flow`
- `Configure Custom Logic in a Synchronous Flow`
- `Configure Custom Logic in an Asynchronous Flow`

## Governor Limits to Design Around

| Execution Context | Key Limits |
|---|---|
| Synchronous Apex | 100 SOQL queries, 150 DML statements, 100 HTTP callouts, 30s callout timeout, 6 MB heap |
| Asynchronous Batch | 50M records queryable, 5 concurrent batches |
| Queueable | Chainable; monitor queue depth under high order volume |
| Scheduled jobs | Max 250 scheduled jobs active |
| Flow | Shares Apex governor limits when record-triggered |

## Known Limitations & Gotchas

- **Governor limit violations in production** — test with production-representative data volumes
- **Recursion in Apex triggers** — implement static recursion guard; test all update paths
- **Async data consistency** — always re-query within async context; never rely on data captured at enqueue time
- **Flow complexity growth** — decompose into subflows early; max 50 elements before maintenance suffers
- **Apex runs in system mode** — implement explicit FLS checks if hook exposes data to user context
- **Hook interface versioning** — verify current hook interface signature against active release before deploying

## Cross-Domain Dependencies
- **Pricing** — most customization entry points are in the pricing procedure (Apex hooks, custom elements)
- **Quote Lifecycle / Order Management** — Flow and API customizations most commonly trigger on quote submission, order activation
- **Dynamic Revenue Orchestrator** — custom orchestration step actions (invocable Apex, Flow actions) are the primary customization surface within fulfillment plans
- **Integrations** — custom callout patterns and event-driven architecture live at the intersection
