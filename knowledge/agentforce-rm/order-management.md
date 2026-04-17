# Order Management — Agentforce RM Architect Reference

## Domain Overview
Order Management in Revenue Cloud captures the commercial commitment and prepares it for fulfillment. It bridges sales (quote) and operations (DRO/fulfillment) by creating orders, recording order actions that affect assets, and configuring the handoff to downstream orchestration.

## Key Salesforce Anchors
- `Order` — master commercial order record
- `OrderItem` — individual product line within an order
- `OrderAction` — the lifecycle event a line drives (new, amend, renew, cancel)
- `Asset` — customer's product entitlement created or updated by order activation
- fulfillment users — personas with permission to execute post-order orchestration
- context definitions — data shapes that carry order and product information into orchestration

## Common UI Patterns (for test automation)

### Order Creation Flow
1. Quote → Activate → Order auto-created (or manual order from Opportunity)
2. Order record: Status = Draft → Activated
3. OrderItems inherit pricing from QuoteLineItems
4. Order Activation: triggers Asset creation via OrderAction

### Key Order Fields
| Field | API Name | Notes |
|---|---|---|
| Status | `Status` | Draft, Activated, Cancelled |
| Account | `AccountId` | Parent account |
| Effective Date | `EffectiveDate` | When order takes effect |
| Order Start Date | `OrderStartDate` | For subscription products |
| Order End Date | `OrderEndDate` | For subscription products |

### OrderAction Types
- `New` — creates a new Asset
- `Amend` — updates an existing Asset
- `Renew` — extends Asset effective end date
- `Cancel` — sets Asset end date to amendment effective date

## Known Limitations & Gotchas

- **Order-to-fulfillment submission** — orders do not automatically submit to DRO; submission must be explicitly configured
- **OrderItem immutability post-activation** — quantity and pricing on OrderItems are locked after activation; changes require amendment order
- **OrderAction-to-asset mapping** — if not configured correctly, assets will not be created on activation
- **Tax setup dependency** — tax on orders requires explicit Transaction Management tax setup
- **Status transition enforcement** — order status state machine has limited built-in enforcement; implement validation rules or Flow

## Cross-Domain Dependencies
- **Quote Lifecycle** — orders created from quotes; OrderItem pricing derives from QuoteLineItem
- **Pricing** — pricing re-evaluated at order capture
- **Contract Lifecycle** — order activation creates or updates contract
- **Dynamic Revenue Orchestrator** — orders are the primary input to DRO
- **Billing** — order activation triggers billing schedule creation
