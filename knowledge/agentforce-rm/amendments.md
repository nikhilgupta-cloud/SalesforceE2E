# Amendments — Agentforce RM Architect Reference

## Domain Overview
Amendments handle mid-term commercial changes to active contracts and assets: adding seats, upgrading features, changing pricing, swapping products, co-terming additions. Amendments are expressed as order actions that update asset state.

## Key Salesforce Anchors
- `Quote`, `Order` — amendment transaction vehicles
- `OrderAction` — the lifecycle event type (Amend, Upgrade, Cancel) that drives asset impact
- `Asset` — the customer entitlement being changed
- `AssetStatePeriod` — time-bounded record of asset state
- `AssetActionSource` — links order action to the asset action it created or modified

## Common Implementation Patterns

1. **Quantity upsell** — add 10 users to a 100-user subscription
   - Amendment order with OrderAction type Amend
   - Proration: (remaining_days / period_days) × unit_price × delta_quantity
   - Asset quantity updated on order activation

2. **Feature upgrade** — move customer from Standard to Premium tier
   - OrderAction: Amend on the subscription asset; attribute change triggers repricing
   - New AssetStatePeriod created from effective date with Premium attributes

3. **Downgrade / removal** — OrderAction: Amend (reduce quantity) or Cancel (remove product)

4. **Swap / product transfer** — OrderAction: Cancel on source + New on target

## Known Limitations & Gotchas

- **Proration complexity** — monthly fixed-fee products with partial months do not prorate cleanly by default
- **Co-termination not automatic** — amendment end dates can deviate from contract end date without explicit enforcement
- **Concurrent amendments** — no built-in lock if two amendment orders target same asset simultaneously
- **Usage-based net unit price** — guide explicitly documents `Net Unit Price Disappears During Amendment of Usage Assets Created with Group Ramp`
- **Spring '26 upgrade path** — review `Upgrade Guidance for Spring '26` for changes affecting amendment behavior

## Cross-Domain Dependencies
- **Pricing** — amendment pricing flows through same pricing procedure as new sales
- **Contract Lifecycle** — amendments modify contract and linked assets
- **Order Management** — amendment orders use same order capture setup
- **Approvals** — amendment quotes may follow different approval thresholds
- **Renewals** — renewal and amendment can interact (early renewal is a type of amendment)
