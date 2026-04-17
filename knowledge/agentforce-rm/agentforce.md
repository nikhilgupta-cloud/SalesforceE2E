# Agentforce — Agentforce RM Architect Reference

## Domain Overview
Agentforce capabilities in Revenue Cloud, including templates, partner and community access, embedded messaging, routing, and Revenue Cloud-specific conversational topics.

## Key Salesforce Anchors
- agent templates
- embedded messaging deployments
- Omni-Channel flows
- routing queues
- enhanced chat channels
- site and partner-user access settings
- trusted URLs and CORS settings
- Revenue Agent topics

## Agent Templates in Revenue Cloud
- `Agentforce for Revenue Quote Management` — product search, shortlist, quote assistance
- `Agentforce for Billing Employee Assistance` — billing help for internal users
- `Agentforce for Billing Service Assistance Agent` — billing help for customers

## Revenue Agent Topics
- **Search Products** — catalog search and shortlisting
- **Get Product Details** — individual product detail lookup
- **Ask Follow-Up Questions** — conversational refinement of product selection
- **Share the Shortlist** — send product shortlist to customer or colleague
- **Manage Token Overages for Quoting with Agentforce** — token management for quote conversations

## Agentforce Design Workflow
1. Define the target user and channel (internal rep vs. customer portal vs. partner)
2. Select the agent template and topic scope
3. Configure site, messaging, routing, and queue behavior
4. Define partner or community access and security controls
5. Validate topic coverage and conversational outcomes

## Known Limitations & Gotchas
- **Catalog quality drives answer quality** — Agentforce product search is only as good as the Product2 data it indexes
- **Security, CSP, and CORS settings are critical** — missing trusted URL configuration silently breaks embedded messaging
- **Language and Locale Support** — not all languages/locales supported; verify before committing

## Cross-Domain Dependencies
- **Product Modeling** — catalog quality determines product search relevance
- **Quote Lifecycle** — quote assistance requires Transaction Management setup
- **Billing** — billing agent topics require billing data access permissions
- **Experience Cloud** — partner/community access patterns use Experience Cloud site setup
