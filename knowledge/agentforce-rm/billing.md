# Billing — Agentforce RM Architect Reference

## Domain Overview
End-to-end Revenue Cloud billing design, including billing setup, billing context definitions, billing schedules, invoices, credit and debit memos, tax, payments, accounting, disputes, and billing operations.

## Key Salesforce Anchors
- `BillingContext` — asset-linked billing context
- `StandaloneBillingContext` — non-asset billing context
- billing schedules and billing schedule groups
- invoices and invoice lines
- credit memos, debit memos
- payment schedules and payment schedule items
- billing policies and billing treatments
- tax policies and tax treatments
- legal entities

## Key Billing Objects

| Object | Purpose |
|---|---|
| BillingSchedule | Time-based billing plan linked to an asset or contract |
| Invoice | Customer-facing charge document |
| InvoiceLine | Individual charge on an invoice |
| CreditMemo | Credit issued to correct/reduce a charge |
| DebitMemo | Additional charge issued to customer |
| PaymentSchedule | Payment plan tied to an invoice |
| BillingPolicy | Rules governing how billing schedules are created |
| BillingTreatment | Specific billing behavior per product type |

## Billing Design Workflow
1. Define the billing operating model (native vs. hybrid)
2. Decide billing contexts, policies, terms, and tax behavior
3. Define schedule creation, invoice timing, and document output
4. Define credit, debit, payment, refund, and dispute behavior
5. Define accounting, legal-entity, and operational monitoring needs

## Known Limitations & Gotchas

- **Auto-generate billing schedules on activation** — incorrect setup causes schedules that are hard to retroactively correct
- **Native tax insufficient** — for complex multi-state or multi-country jurisdictions, use external tax engine
- **Legal entities for accounting** — complex setup; requires finance team involvement
- **Credit memo for corrections** — manual creation is error-prone; automation requires explicit correction workflow
- **Billing migration timing** — billing records must be migrated after orders and assets are validated

## Cross-Domain Dependencies
- **Pricing** — billing charge types and frequencies defined in pricing procedure elements
- **Order Management** — order activation is the primary trigger for billing schedule creation
- **Amendments** — mid-term amendments update or replace billing schedules
- **Renewals** — renewal orders extend or create new billing schedules
- **Termination** — cancellation closes billing schedules; may trigger final invoice or credit memo
- **Integrations** — ERP sync of invoice and payment records
