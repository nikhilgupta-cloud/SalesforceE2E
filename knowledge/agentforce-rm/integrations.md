# Integrations — Agentforce RM Architect Reference

## Domain Overview
Integrations connect Revenue Cloud to external systems at defined extension points. The guide provides native hooks for pricing, product discovery, and configurator embedding; ERP, tax, payment, and billing integration blueprints are architecture patterns built on those hooks.

## Key Salesforce Anchors
- pricing APIs — invoked at quote and order time
- Apex hooks — extension points in pricing procedures and product discovery procedure plans
- context definitions — runtime data shapes at system boundaries
- procedure plans — orchestration wrapper controlling when external calls fire
- Sales Transaction APIs — programmatic handoff for configurator and transaction integration

## Guide-Backed Extension Points
- `Configure Apex Hooks in a Product Discovery Procedure Plan`
- `Sample Apex Class for Product Discovery External Pricing`
- `Example: Use Apex Hooks to Extend Pricing Logic`
- `Third-Party Configurator UI Component Integration into First-Party Configurator`
- `Use Place Sales Transaction API for Data Transfer`

## Common Implementation Patterns

1. **External pricing hook** — Apex class implements pricing hook interface; hook returns price adjustments; fallback if external unavailable
2. **Tax calculation inline** (Avalara, Vertex) — pricing procedure Apex hook calls tax engine API; result stored on transaction lines
3. **ERP order sync** (SAP, Oracle) — order activation triggers Flow or Apex callout; upsert pattern on retry prevents duplicates
4. **Payment capture** (Stripe, Braintree) — payment method token stored at account level; async Queueable calls payment gateway
5. **Usage-based billing data ingestion** — external metering system posts usage records via Salesforce REST API

## Known Limitations & Gotchas

- **Apex callout limits** — 100 HTTP callouts per synchronous transaction; 30-second timeout
- **Duplicate prevention** — use ExternalId-based upsert patterns in all outbound sync operations
- **Secrets management** — store all API keys in Salesforce Named Credentials; never log tokens
- **Reconciliation gaps** — failed syncs create orphaned records; implement scheduled reconciliation job

## Cross-Domain Dependencies
- **Pricing** — Apex hooks and pricing APIs are the primary Revenue Cloud-native integration surface
- **Order Management** — order activation is the most common trigger for ERP outbound integration
- **Dynamic Revenue Orchestrator** — callout steps in orchestration plans execute external integrations
- **Customizations** — most integration logic implemented via Apex or Flow
