# Quote Lifecycle — Agentforce RM Architect Reference

## Domain Overview
Quote Lifecycle encompasses quote creation, product configuration, pricing, collaboration, approval, document generation, and conversion to order or contract. In Revenue Cloud, quotes are created and managed within Transaction Management using the native Quote object and the line editor.

## Key Salesforce Anchors
- `Quote` — master quote record; status, opportunity link, customer, total value, approval state
- `QuoteLineItem` — product within the quote; quantity, unit price, discount, pricing procedure output
- `Opportunity` — sales opportunity; primary parent of quote(s)
- Sales Transaction APIs — programmatic invocation of quote/order transaction processing
- line editor settings — configuration of the Transaction Management line editor
- pricing procedures — execution engine for quote-line pricing

## Common UI Patterns (for test automation)

### Quote Creation Flow
1. Navigate to Opportunity → New Quote button
2. Quote header fields: Account, Primary, Expiration Date, Pricebook
3. Add Products via Add Products button or configurator
4. Line editor: inline editing of quantity, discount, selling model
5. Reprice All → runs pricing procedure on all lines
6. Submit for Approval (if discount threshold exceeded)
7. Generate Document → creates ContentDocument

### Line Editor Interaction
- Line editor is a Lightning Web Component (LWC) embedded in the Quote record page
- Fields editable inline: Quantity, Unit Price, Discount
- Save triggers pricing procedure recalculation
- Use `SalesforceFormHandler` for all field interactions — do not use raw locators

### Known UI Selectors
- Quote record header: `[data-component-id="forceDetailPanelDesktop"]`
- Line editor table: `[data-component-id="c-quoteLineEditor"]`
- Add Products button: `getByRole('button', { name: 'Add Products', exact: true })`
- Reprice All button: `getByRole('button', { name: 'Reprice All', exact: true })`
- Save button (modal): `[role="dialog"]:not([id="auraError"]):not([aria-hidden="true"]) >> button:text("Save")`

## Common Implementation Patterns

1. **Simple quote** — single product, list price, no configuration
2. **Guided selling + advanced configurator** — constraint-based valid product selections
3. **Complex quote with discounts and approval** — volume discount + approval workflow
4. **Multi-scenario A/B quoting** — Quote A and Quote B on same opportunity
5. **Renewal quote from contract** — As-Is Renewal auto-generates renewal quote from contract assets

## Known Limitations & Gotchas

- **Quote versioning** — no native version control; revisions create separate Quote records
- **Reprice All scope** — re-runs full pricing procedure; may change prices seller manually adjusted
- **Tax dependencies** — tax on quote lines requires explicit Transaction Management tax setup
- **Document generation timing** — PDF generation is not instantaneous for complex templates
- **CPQ compatibility note** — native Quote object (Revenue Cloud) is distinct from CPQ quote object (`SBQQ__Quote__c`)

## Cross-Domain Dependencies
- **Product Modeling** — product rules and attribute constraints drive configurator behavior
- **Pricing** — QuoteLineItem pricing driven by pricing procedures and context definitions
- **Approvals** — discount authority determines if approval required
- **Document Generation** — quote document is the customer-facing output
- **Order Management** — quote converts to order; OrderItems derive from QuoteLineItems

## Curation Note
Revenue Cloud quotes are built on the native Quote object and Transaction Management — not the CPQ quote object. Verify which transaction layer your org is running before writing tests.
