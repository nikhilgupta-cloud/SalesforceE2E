# Agentforce RM Knowledge Index

Quick-reference domain summaries. Load full file (e.g., `product-modeling.md`) only when deep reference needed.

## Domain Lookup Table

| # | Domain | One-Line Summary | Key Objects | Load Full File When... |
|---|--------|-----------------|-------------|------------------------|
| 0 | **Foundations & Coexistence** | Readiness, licensing, implementation planning, context definitions, and coexistence with CPQ, Billing, Subscription Management, Service Cloud, B2B Commerce | permission set licenses, personas, context definitions, feature availability, scratch-org features, coexistence settings | Scoping an implementation, checking prerequisites, planning phases, or assessing coexistence with other Salesforce products |
| 1 | **Product Modeling** | Revenue Cloud native catalog: ProductCategory hierarchy, ProductSellingModel, attribute framework, qualification/disqualification rules | Product2, ProductCatalog, ProductCategory, ProductCategoryProduct, ProductSellingModel, ProductSellingModelOption, ProductComponentGroup, ProductRelatedComponent, AttributeDefinition, ProductAttributeDefinition, ProductClassification, ProductQualification, ProductDisqualification | Designing product catalog structure, bundle components, selling models, attribute-driven configuration, qualification/exclusion rules |
| 2 | **Pricing** | Multi-dimensional pricing: procedures, waterfall, discounts, usage management, rate plans, contract/derived pricing, renewal uplift | PricebookEntry, pricing recipes, pricing procedures, pricing elements, usage summaries, ratable summaries, context definitions, price revision policies, rate cards, rate card entries, rating procedures | Setting up pricing foundations, discount and matrix logic, contract or derived pricing, usage tracking, promotions, renewal uplift, or rate-management-driven charging |
| 3 | **Quote Lifecycle** | Quote creation, product configuration, pricing, collaboration, approval, presentation | Quote, QuoteLineItem, Opportunity, Sales Transaction APIs, line editor settings, pricing procedures | Designing quote-to-cash flow, advanced configurator, pricing logic, quote status |
| 4 | **Approvals** | Route approval requests (quotes, orders, discounts) through hierarchies with delegation and audit | ProcessInstance, ProcessInstanceStep, ProcessInstanceWorkitem, ApprovalAction (custom) | Designing approval workflows, discount authority levels, routing logic |
| 5 | **Document Generation** | Convert quotes/contracts to customer-facing PDFs with templates, clauses, and e-signature | DocumentTemplate, Clause, ClauseLibrary, Document, ContentDocument, e-signature integrations | Building quote/contract templates, clause libraries, DocuSign/Adobe Sign setup |
| 6 | **Contract Lifecycle** | Contract creation, term extraction, obligation tracking, amendments, compliance, renewal triggers | Contract, ContractLineItem, ContractTerm, Obligation, Amendment, ContractHistory, Asset, AssetContractRelationship, AssetStatePeriod | Managing contract terms, cotermination scenarios, obligation tracking, asset-aligned lifecycle events |
| 7 | **Order Management** | Transition commitment to execution: order capture, order actions, fulfillment routing, activation | Order, OrderItem, OrderAction, Asset, fulfillment users, context definitions, orchestration setup | Designing order decomposition, fulfillment routing, activation workflows |
| 8 | **Amendments** | Mid-contract changes: add products, quantity changes, pricing updates, proration, co-termination | Quote, Order, OrderAction, Asset, AssetStatePeriod, AssetActionSource, context definitions | Implementing amendment workflows, proration formulas, co-termination rules, upgrade transitions |
| 9 | **Renewals** | Auto-generate renewal quotes with pricing strategies, handle early renewal, consolidation | Contract, Asset, Quote, Order, price revision elements, managed asset records | Setting up renewal automation, pricing strategies, early renewal incentives |
| 10 | **Termination** | Manage cancellations: early termination, asset state changes, cotermination, billing closeout | Asset, AssetStatePeriod, AssetActionSource, OrderAction, Contract, billing records | Calculating early termination fees, deprovisioning workflows, billing reconciliation |
| 11 | **Dynamic Revenue Orchestrator** | Fulfillment engine: decompose orders into steps, sequence tasks, handle dependencies and exceptions | Order, OrderItem, orchestration plans, orchestration steps, procedure plans, fulfillment users, context definitions | Designing fulfillment orchestration, conditional branching, error handling |
| 12 | **Integrations** | Connect to ERPs (SAP, Oracle), tax (Avalara, Vertex), billing (Zuora), payment (Stripe) via pricing hooks, context services, and integration patterns | pricing APIs, Apex hooks, context definitions, external objects, third-party configurator integrations, integration logs | Planning ERP/tax/billing/configurator/payment integrations, API patterns, error handling |
| 13 | **Data Migration** | Move legacy data (Zuora, CPQ, custom) to ARM: mapping, validation, sequencing, reconciliation | Product2, PricebookEntry, Order, OrderItem, Asset, AssetContractRelationship, Account, Quote | Planning cutover strategy, defining data mappings, validation rules, testing |
| 14 | **Customizations** | Extend ARM beyond OOB: Apex, Flow, LWC, platform events, custom metadata, pricing APIs | Triggers, Batch, Queueable, Flow, LWC, PlatformEvent, CustomMetadataType, pricing APIs, procedure plans | Building custom pricing, approval routing, UI components, event-driven automation, or guided selling extensions |
| 15 | **Billing** | End-to-end billing: schedules, invoicing, tax, payments, accounting, disputes, billing operations | BillingContext, StandaloneBillingContext, billing schedules, invoices, credit memos, debit memos, payment schedules, legal entities | Designing billing setup, billing policies, tax/payment behavior, invoice generation, accounting flows, or self-service billing operations |
| 16 | **Procedure Plans** | Cross-domain procedure-plan framework for pricing, transactions, Apex hooks, packaging, execution order | procedure plans, procedure plan definitions, Place Sales Transaction, Apex hooks, packaged procedure plans | Designing reusable procedure-plan execution, packaging procedural logic, troubleshooting execution order |

## Reference-Only KB Domains

| Domain | One-Line Summary | KB File | Load When... |
|--------|-----------------|---------|--------------|
| **Agentforce** | Agentforce capabilities for Revenue Cloud: templates, partner/community access, messaging, routing, topic-driven assistance | `agentforce.md` | Designing Revenue Cloud agent experiences, partner/community access, embedded messaging, or topic-driven assistance flows |
| **Experience Cloud** | Revenue Cloud support for Experience Cloud site users, templates, and task coverage | `experience-cloud.md` | Designing site-user access, supported Experience Cloud tasks, and template-aligned Revenue Cloud experiences |
| **Operations & Intelligence** | Operational diagnostics, logs, dashboards, KPI analytics across pricing, configuration, and revenue intelligence | `operations-and-intelligence.md` | Investigating pricing/configuration issues, monitoring operational health, planning analytics and dashboard usage |
| **CML Scripting** | Constraint Modeling Language syntax, rules, annotations, and examples for Revenue Cloud Product Configurator | `cml-scripting.md` | Authoring CML constraint scripts, debugging configurator rules, or designing attribute-driven product qualification logic |

## Object-to-Domain Quick Map

Use this when writing or healing tests — load the relevant domain file to understand expected field names, UI flows, and known gotchas.

| Salesforce Object | Primary Domain File | Secondary |
|---|---|---|
| Quote, QuoteLineItem | `quote-lifecycle.md` | `pricing.md`, `approvals.md` |
| Product2, ProductCategory, ProductSellingModel | `product-modeling.md` | `pricing.md` |
| Contract, ContractLineItem, Asset | `contract-lifecycle.md` | `amendments.md`, `renewals.md` |
| Order, OrderItem, OrderAction | `order-management.md` | `dynamic-revenue-orchestrator.md` |
| PricebookEntry, PriceAdjustmentSchedule | `pricing.md` | `product-modeling.md` |
| Opportunity | `quote-lifecycle.md` | — |
| Account | `foundations-and-coexistence.md` | — |

## Cross-Domain Dependency Graph

```
Foundation (0, 1, 2) → Foundations, Product Modeling, Pricing → all downstream depends on these
   ↓
Sales (3, 4, 5) → Quote Lifecycle, Approvals, Document Generation
   ↓
Legal (6) → Contract Lifecycle
   ↓
Operations (7, 11) → Order Management, Dynamic Revenue Orchestrator
   ↓
Lifecycle (8, 9, 10) → Amendments, Renewals, Termination
   ↓
Enablement (12, 13, 14, 15, 16) → Integrations, Data Migration, Customizations, Billing, Procedure Plans
```

## Knowledge Lookup Pattern (for test agents)

1. **Identify the Salesforce object** being tested (Account, Quote, Product2, etc.)
2. **Look up the domain** in the Object-to-Domain Quick Map above
3. **Load the domain file** for field names, UI patterns, and known gotchas
4. **Check Known Limitations** — common failures are documented there
5. **Cross-reference dependencies** — e.g. Quote tests need pricing context too

---
*All domains reflect Agentforce RM / Revenue Cloud capabilities as of March 2026. Verify against current help.salesforce.com for each release.*
