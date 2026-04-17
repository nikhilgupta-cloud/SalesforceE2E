# Data Migration — Agentforce RM Architect Reference

## Domain Overview
Data migration moves legacy commercial data — products, pricing, orders, assets, and billing records — from source systems (Salesforce CPQ, Zuora, custom subscription platforms) into Revenue Cloud. Covers source-to-target mapping, dependency sequencing, validation, and cutover planning.

## Migration Sequencing (Dependency Order)
```
1. Accounts (customers)
2. Product2 + ProductCatalog + ProductCategory (catalog structure)
3. PricebookEntry + pricing procedures (pricing foundations)
4. Contracts (legal agreements)
5. Orders + OrderItem + OrderAction (commercial history)
6. Assets + AssetAction + AssetActionSource + AssetStatePeriod (entitlement state)
7. Billing records (schedules, invoices, settlements) — last, depends on all above
```

## Common Implementation Patterns

1. **CPQ → Revenue Cloud migration** — key shift: CPQ uses metadata-heavy product rules; Revenue Cloud uses data-driven pricing procedures
2. **Zuora → Revenue Cloud migration** — map Zuora subscriptions → Contracts + Assets via historical order generation
3. **Multi-year history migration** — migrate last 2-3 years of active contracts; direct asset migration for pre-window history

## Known Limitations & Gotchas

- **CPQ-to-RC architectural shift** — direct object copy does not work; model redesign required
- **Asset lifecycle integrity** — migrating assets without full action history (AssetAction, AssetStatePeriod) produces assets that cannot be correctly amended or renewed; always prefer historical order generation
- **Dependency sequencing failures** — loading records out of order causes referential integrity errors
- **Pricing history loss** — Revenue Cloud pricing is point-in-time; historical price points cannot be natively preserved
- **Cutover data gaps** — records created in source during cutover window will not be in migration load; define blackout window or run delta sync

## Cross-Domain Dependencies
- **Product Modeling** — product and catalog records must be fully migrated before any commercial record
- **Pricing** — pricing procedures and price book entries must exist before orders or assets can be validated
- **Contract Lifecycle** — migrated contracts drive renewal and amendment eligibility
- **Billing** — billing schedule migration depends on completed order and asset migration
