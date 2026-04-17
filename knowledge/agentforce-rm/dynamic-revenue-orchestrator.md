# Dynamic Revenue Orchestrator — Agentforce RM Architect Reference

## Domain Overview
Dynamic Revenue Orchestrator (DRO) is the fulfillment execution engine in Revenue Cloud. After a commercial transaction is captured, DRO decomposes it into executable steps, sequences those steps with dependencies, manages parallel execution, handles exceptions, and tracks SLA compliance.

## Key Salesforce Anchors
- `Order`, `OrderItem` — commercial records submitted for orchestration
- orchestration plans — template defining steps, step types, dependencies, branches
- orchestration steps — individual units of work (Auto Task, Callout, Manual Task, Milestone, Pause, Staged Assetize)
- procedure plan definitions — reusable execution templates
- fulfillment users — personas with permission to execute and manage orchestration tasks
- context definitions — data shapes passed into orchestration

## Core Capabilities

### Fulfillment Step Types
| Step Type | Description |
|---|---|
| Auto Task | System-executed step (no human action) |
| Callout | External system integration call |
| Manual Task | Human action required |
| Milestone | Coordination gate — waits for condition |
| Pause | Time-based delay |
| Staged Assetize | Partial asset creation |

### Key Behaviors
- **Branch logic** — conditional routing based on order attributes or customer tier
- **Compensation and rollback** — reverse completed steps on downstream failure
- **Freeze / frozen states** — pause in-flight plans at a safe point
- **SLA jeopardy** — configurable alerts when fulfillment at risk
- **PONR (Point of No Return)** — defines where rollback is no longer possible

## Common Implementation Patterns

1. **Digital provisioning** — create account → enable license → send credentials; compensate on failure
2. **Physical + digital hybrid** — parallel plans: shipment AND digital activation; Milestone gates activation
3. **Conditional routing by customer tier** — Enterprise → dedicated workspace; SMB → automated provisioning

## Known Limitations & Gotchas

- **Plan versioning** — orchestration plans not natively versioned; changes affect all subsequently submitted orders
- **Circular dependency risk** — complex dependency graphs can silently create circular wait conditions
- **External system latency** — callout steps inherit Salesforce 30-second HTTP timeout
- **Order state vs. plan state divergence** — order status fields do not automatically reflect orchestration plan progress
- **DRO limits** — validate expected order volumes against documented limits early

## Cross-Domain Dependencies
- **Order Management** — orders and order actions are the primary inputs to DRO
- **Procedure Plans** — DRO invokes procedure plan definitions for reusable execution logic
- **Product Modeling** — product categories and technical product setup drive decomposition rules
- **Integrations** — callout steps invoke external systems
