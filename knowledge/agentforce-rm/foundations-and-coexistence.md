# Foundations & Coexistence — Agentforce RM Architect Reference

## Domain Overview
Revenue Cloud readiness, editions and feature availability, implementation planning, foundational skills, context-definition readiness, and coexistence with other Salesforce products.

## Key Salesforce Anchors
- feature availability by license
- permission set licenses and personas
- scratch-org feature enablement
- predefined context definitions
- coexistence settings and supported-feature matrices
- implementation roles and phased delivery planning

## Feature Availability by License
- Revenue Cloud feature availability varies by license tier
- Check `Functional Area and Feature Availability in Revenue Cloud Licenses` on help.salesforce.com
- Key domains requiring additional licenses: Rate Management, Usage Management, Advanced Approvals, DRO, Billing

## Coexistence Patterns

| Existing Product | Coexistence Notes |
|---|---|
| Salesforce CPQ | Separate object models; CPQ and Revenue Cloud quotes are distinct; migration required for full transition |
| Subscription Management | Supported coexistence; feature boundary documentation required |
| Salesforce Billing | Configure Revenue Cloud and Salesforce Billing to coexist; distinct billing objects |
| Service Cloud | Supported; service agents can access Revenue Cloud data |
| B2B Commerce | Revenue Cloud for B2B Commerce pattern; catalog and pricing integration |

## Key Design Decisions

1. **Edition & Feature Availability** — Which modules and permission set licenses are provisioned?
2. **Coexistence Model** — Is CPQ, Subscription Management, or legacy Billing installed? Migration/parallel-run/cutover strategy?
3. **Context Definitions Strategy** — Which predefined context definitions ship with org's edition?
4. **Persona & Permission Set Design** — Which Revenue Cloud persona permission set licenses are needed?
5. **Phased Implementation Scope** — Which domains are Phase 1 vs. deferred?

## Known Limitations & Gotchas

- **Do not assume every license exposes every domain** — DRO, Advanced Approvals, Billing each require specific license
- **Scratch org features must exactly match production edition** — verify feature flags before building
- **All personas licensed from Day 1** — license cost before go-live; waste if phased rollout planned

## Cross-Domain Dependencies
- **All Domains** — Feature availability decisions gate what is designable
- **Pricing** — Context definition strategy determines how pricing procedures receive inputs
- **Order Management** — Transaction Management setup is a prerequisite for DRO
- **Billing** — Billing enablement and billing context definitions must be confirmed before Billing domain is designable
