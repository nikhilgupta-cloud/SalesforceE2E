# Procedure Plans — Agentforce RM Architect Reference

## Domain Overview
Use this file for the cross-domain procedure-plan framework in Revenue Cloud, including execution order, plan definitions, packaging, orchestration for pricing, and Apex-hook-driven procedural customization.

## Key Salesforce Anchors
- procedure plans
- procedure plan definitions
- Place Sales Transaction execution order
- Apex hooks
- packaged procedure plans
- pricing-orchestration integration points

## Guide-Backed Coverage
- `Build and Manage Your Procedure Execution`
- `Create Procedure Plans`
- `Use the Procedure Plan Framework`
- `Turn on Procedure Plan Orchestration for Pricing`
- `Create a Commercial Product`
- `Build Your Pricing Procedure`
- `Define Classes for Apex Hooks`
- `Export and Import Procedure Plans`
- `Package a Procedure Plan`

## Procedure-Plan Design Workflow
1. Define the business process that needs a reusable procedure plan
2. Decide whether to start from a template or a custom definition
3. Define execution order, Apex hooks, and product binding needs
4. Decide how the plan will be packaged, migrated, and verified
5. Validate execution across pricing or sales-transaction flows

## Capability Selection Matrix

| Requirement | Primary Mechanism | Use When | Watch-Outs |
|---|---|---|---|
| Reusable procedural execution | Procedure plan framework | Same process shape reused across flows | Keep definition ownership clear |
| Custom procedural branching | Custom procedure plan definition | Template behavior insufficient | Validate hook and execution-order complexity |
| Procedural extension with code | Apex hooks | Native definition needs custom logic | Keep hook boundaries explicit |
| Cross-org deployment | Packaged procedure plans | Move plans across orgs or releases | Import/export governance matters |

## Known Limitations & Gotchas
- **Pricing Procedure Names Must Be Unique in Procedure Plans** — documented guide caveat; use naming conventions
- **Execution order conflicts** — ordering conflicts between pricing procedure steps and custom Apex hooks require explicit sequencing
- **Packaged import/export** — must validate export/import behavior across release upgrades

## Cross-Domain Dependencies
- **Pricing** — pricing procedures are the primary consumers of procedure plan step execution
- **Quote Lifecycle / Order Management** — Place Sales Transaction execution order configured via procedure plan definitions
- **Dynamic Revenue Orchestrator** — DRO invokes procedure plan definitions for orchestration steps
- **Customizations** — all Apex hooks registered in procedure plans are custom code
- **Data Migration** — procedure plan definitions must be migrated or re-created in production org
