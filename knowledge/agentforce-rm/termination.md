# Termination — Agentforce RM Architect Reference

## Domain Overview
Termination manages customer contract cancellations: voluntary (customer-initiated), involuntary (non-payment, breach), and negotiated early terminations. Calculates early termination fees, manages service deprovisioning, stops billing, and captures closure financials.

## Key Salesforce Anchors
- `Contract` — contract being terminated; status changes to Terminated
- `OrderAction` — type Cancel; sets Asset end dates to termination effective date
- `Asset` — deactivated/archived on termination

## Common Implementation Patterns

1. **Simple Voluntary Termination** — no early termination fee; billing stops at effective date
2. **Early Termination with Fee** — remaining contract value × 50% = early termination fee
3. **Non-Payment Termination** — default after 60-day past-due; 15-day cure window offered
4. **Negotiated Early Termination** — buyout amount negotiated; requires finance approval

## Early Termination Fee Calculation
```
Remaining contract value = (remaining days / total days) × annual contract value
Early termination fee = remaining contract value × termination %
```

## Known Limitations & Gotchas

- **Billing System Deactivation Lag** — 24-48 hour lag between Salesforce termination and billing system; final invoice may include charges post-termination
- **Deprovisioning Complexity** — no single "deprovision everything" button; requires orchestrated deprovisioning across systems
- **Termination + Amendment State** — if contract has pending amendment, termination creates conflict; implement lock
- **Reactivation After Termination** — termination is permanent; reverting requires new contract creation; implement 72-hour grace period
- **Legal Hold & Compliance** — cannot delete data immediately if litigation pending

## Cross-Domain Dependencies
- **Contract Lifecycle** — contract status changes to Terminated
- **Amendments** — termination is amendment type; uses amendment workflow
- **Order Management** — termination creates order for early termination fee
- **Billing** — final invoice generated; billing system notified
- **Assets** — asset deactivated/retired on contract termination
