# Renewals — Agentforce RM Architect Reference

## Domain Overview
Renewals automate the re-sales cycle for expiring contracts: generating renewal quotes with updated pricing, tracking renewal status, managing early/late renewal scenarios, and consolidating multiple expiring contracts into a single renewal quote.

## Key Salesforce Anchors
- `Contract` — expiring contract being renewed
- `Quote` — renewal quote (linked to contract)
- `Asset` — product instance being renewed
- `RenewalReminder` — scheduled notification (e.g., 90 days before expiration)

## Common Implementation Patterns

1. **Simple Annual SaaS Renewal** — auto-generate 90 days before expiration
   - Scheduled Flow queries contracts expiring in 90 days
   - Creates renewal quote: same products, quantities, +5% price

2. **Early Renewal with Consolidation** — consolidate 3 expiring contracts
   - Single renewal quote with all products; co-term to common date; discount incentive

3. **Multi-Tier Pricing Uplift** — different uplift per customer segment
   - SMB: +3%, Mid-market: +5%, Enterprise: +7%

4. **At-Risk Renewal Retention** — 50% seat utilization triggers discount offer

## Renewal Pricing Strategies
- Simple uplift (e.g., 5% annual increase)
- Per-product uplift (subscription 5%, support 10%)
- Tier-based uplift by customer segment
- No uplift (match original pricing)
- Price hold (lock price for multi-year commitment)

## Known Limitations & Gotchas

- **Renewal Quote Generation Timing** — batch jobs may generate all renewals on same date; spread over 2-week window
- **Renewal + Amendment Interaction** — if contract is amended mid-term, renewal query may pick up old or new version
- **Contract Expiration Precision** — use contract end date, not billing cycle date
- **Multi-Currency Renewal** — lock FX rate at renewal quote creation
- **Renewal Order Auto-Activation** — no manual safety gate; implement opt-out mechanism

## Cross-Domain Dependencies
- **Contract Lifecycle** — renewal triggered by contract expiration date
- **Pricing** — renewal pricing rule determines uplift
- **Quote Lifecycle** — renewal quote created and approved like regular quote
- **Order Management** — renewal quote converted to order
- **Amendments** — renewal may include amendments
