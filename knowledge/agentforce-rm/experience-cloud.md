# Experience Cloud — Agentforce RM Architect Reference

## Domain Overview
Revenue Cloud support in Experience Cloud, including site-user licenses, supported templates, supported task coverage, and site-experience considerations.

## Guide-Backed Coverage
- `Revenue Cloud Support for Experience Cloud`
- `Permission Set Licenses for Experience Cloud Site Users`
- `Supported Experience Cloud Templates`
- Product Catalog Management, Salesforce Pricing, Product Configurator, Transaction Management, Salesforce Contracts, DRO, Usage Management, Billing Tasks for Experience Cloud

## Key Constraints
- Not all Revenue Cloud capabilities are available to Experience Cloud site users
- Template compatibility must be confirmed before promising capabilities
- Permission set licenses for site users differ from internal user licenses

## Capability Selection Matrix

| Requirement | Primary Mechanism | Use When | Watch-Outs |
|---|---|---|---|
| Product browsing for site users | Product Catalog Management tasks | External users mainly browse products | Search and template constraints matter |
| Guided selling on site | Product Configurator + task support | External users need guided configuration | Experience Cloud implementation requirements apply |
| Pricing and transaction access | Supported Pricing and Transaction Management tasks | Users need quotes or pricing-related self-service | Check domain support carefully |
| External billing self-service | Billing tasks | Users need invoice or billing visibility | Pair with billing-data access and security design |

## Test Checklist
- Validate template compatibility
- Confirm site-user licenses and permissions
- Test each supported Revenue Cloud task in scope
- Validate external-user navigation and security boundaries
