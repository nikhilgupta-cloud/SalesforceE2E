# Document Generation — Agentforce RM Architect Reference

## Domain Overview
Revenue Cloud's native document generation capability is focused on quote documents: generating customer-facing PDFs from quote data using Document Builder for Quotes. Native coverage is strongest for quote output; contract document assembly and e-signature workflows require integration or custom design.

## Key Salesforce Anchors
- `Quote` — source record for document generation
- `QuoteLineItem` — line-item data merged into quote document
- quote document templates — layout and field mapping definitions used by Document Builder
- `ContentDocument` / `ContentVersion` — Salesforce Files storage for generated documents

## Common UI Patterns (for test automation)

### Document Generation Flow
1. Quote record → Generate Document button (or action)
2. Template selected → PDF generated → stored as ContentDocument
3. ContentDocument linked to Quote via ContentDocumentLink
4. Email to customer from Quote record

### Key Selectors
- Generate Document: `getByRole('button', { name: 'Generate Document', exact: true })`
- Document status: custom field on Quote record

## Known Limitations & Gotchas

- **Native coverage is quote-specific** — Document Builder is for quote output, not contract lifecycle documents
- **Merge field scope** — templates can merge from Quote, QuoteLineItem, Account, Opportunity only
- **Large quote performance** — 100+ line items causes PDF generation latency (30+ seconds)
- **Template maintenance** — requires explicit maintenance as products/pricing fields evolve
- **E-signature status lag** — DocuSign/Adobe Sign status syncs run on 15–30 minute schedule
- **No native clause library** — clause selection and versioning require custom solution or dedicated CLM tooling

## Cross-Domain Dependencies
- **Quote Lifecycle** — document generation is the final step before signature
- **Approvals** — documents should generally only be generated on approved quotes
- **Pricing** — pricing details appear via merge fields; ensure pricing output fields surfaced on QuoteLineItem
- **Contract Lifecycle** — signed quote document is the source for contract record creation
