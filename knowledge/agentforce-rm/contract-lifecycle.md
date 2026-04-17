# Contract Lifecycle — Agentforce RM Architect Reference

## Domain Overview
Contract lifecycle in Revenue Cloud is asset-centric: the contract anchors a customer's active products, and its lifecycle is driven by assets, order actions, and managed-asset patterns. Post-sale changes (amendments, renewals, cancellations) flow through the asset layer.

## Key Salesforce Anchors
- `Contract` — commercial agreement record; status, start/end dates, customer, linked assets
- `ContractLineItem` — product or service within a contract
- `Asset` — the customer's active product entitlement
- `AssetContractRelationship` — links assets to the contract that governs them
- `AssetStatePeriod` — time-bounded record of asset state (quantity, price, effective dates)
- `OrderAction` — the lifecycle event (New, Amend, Renew, Cancel) that produces asset state changes

## Common UI Patterns (for test automation)

### Contract Creation Flow
1. Approved Quote → Activate Order → Contract auto-created on order activation
2. Contract record: Status = Draft → Activated
3. Contract fields: Contract Start Date, Contract End Date, Account, Opportunity

### Key Contract Fields
| Field | API Name | Notes |
|---|---|---|
| Status | `Status` | Draft, Activated, Terminated |
| Contract Start Date | `StartDate` | Date of commercial commitment |
| Contract End Date | `EndDate` | Auto-populated from term length |
| Contract Term | `ContractTerm` | In months |
| Account | `AccountId` | Parent account |

## Known Limitations & Gotchas

- **Cotermination not automatic** — amendment end dates can deviate from contract end date; requires explicit enforcement
- **Contract-to-billing linkage** — actual billing triggered by orders and billing schedules, not the contract record itself
- **Renewal alert timing** — no OOB renewal alert engine; requires scheduled Flow or batch Apex
- **Managed-asset pattern prerequisites** — requires `Access Lifecycle-Managed Assets` permission set; missing causes silent failures
- **Subscription start date adjustment** — edge cases exist around start date behavior in amendments and co-termination

## Cross-Domain Dependencies
- **Quote Lifecycle** — quote is the source of contract data
- **Pricing** — contract-based pricing governs amendment and renewal pricing
- **Amendments** — mid-term changes flow through amendment order pattern
- **Renewals** — contract expiration triggers renewal
- **Order Management** — orders create or update contracts
- **Termination** — contract cancellation and early termination
- **Billing** — billing schedules linked to contracts
