# Product Modeling — Agentforce RM Architect Reference

## Domain Overview
Product Modeling defines the complete product data hierarchy, attributes, relationships, qualification rules, and selling models that govern what can be sold and configured. In Agentforce RM (Revenue Cloud native), this is built on a distinct object model from CPQ — the catalog is structured around **ProductCatalog → ProductCategory → Product2**, with attributes, selling models, and qualification rules managed through dedicated object families.

This domain is foundational: every downstream domain (Pricing, Quote, Order, Contract) depends on the product structure defined here.

## Core Salesforce Objects

### Catalog & Hierarchy
- **ProductCatalog** — Top-level container; owns one or more ProductCategory trees
- **ProductCategory** — Hierarchical category node; self-referential (parent-child); maps to Market/Bundle/Plan levels
- **ProductCategoryProduct** — Junction object linking Product2 to ProductCategory (M:M)
- **Product2** — Master product record; active/inactive status, family, description

### Selling Model
- **ProductSellingModel** — Defines how a product is sold (Evergreen, Fixed-Term, One-Time)
- **ProductSellingModelOption** — Links a Product2 to a ProductSellingModel
- **ProrationPolicy** — Linked to ProductSellingModelOption; controls proration on mid-period changes
- **ProductRampSegment** — Defines ramp pricing segments per product

### Bundle / Component
- **ProductComponentGroup** — Groups related components within a bundle
- **ProductRelatedComponent** — Individual component within a bundle; `IsDefaultComponent=true` marks auto-included
- **ProductRelatedComponentOverride** — Context-specific overrides of component behavior
- **ProductRelationshipType** — Defines the relationship type (Required, Optional, Mutually Exclusive, Incompatible)

### Attribute Framework
- **AttributeDefinition** — Defines a configurable attribute
- **AttributeCategory** — Groups related AttributeDefinitions
- **AttributeCategoryAttribute** — Junction: AttributeCategory → AttributeDefinition
- **AttributePicklist** — Defines a picklist constraint for an attribute
- **AttributePicklistValue** — Individual value in a picklist
- **ProductAttributeDefinition** — Links an AttributeDefinition to a Product2

### Product Classification
- **ProductClassification** — Classifies products; linked to Product2 via `Product2.BasedOnId`
- **ProductClassificationAttr** (API name — NOT `ProductClassificationAttribute`) — Associates an AttributeDefinition to a ProductClassification

### Qualification & Exclusion Rules
- **ProductQualification** — Rule controlling when a Product2 is eligible
- **ProductDisqualification** — Rule blocking a Product2 when conditions are met
- **ProductCategoryQualification** — Qualification rule at the category level
- **ProductCategoryDisqualification** — Disqualification rule at the category level

## Product2 Mandatory & Immutable Fields

| Field | API Name | Type | Required | Immutable | Notes |
|---|---|---|---|---|---|
| Product Name | `Name` | String | Yes | No | |
| Active | `IsActive` | Boolean | Yes | No | Default false |
| **Product Type** | `Type` | Picklist | No | **Yes** | `Bundle` for configurable bundles; cannot change after save |
| SKU | `StockKeepingUnit` | String | No | No | Preferred over `ProductCode` in Revenue Cloud |
| Configure During Sale | `ConfigureDuringSale` | Picklist | No | No | `Allowed` for bundles |
| Unit of Measure | `UnitOfMeasureId` | Reference | No | **Yes** | Cannot change after creation |
| Classification | `BasedOnId` | Reference | No | No | Links to ProductClassification |

**Critical rule:** `Type = 'Bundle'` must be set at creation. Incorrect type requires deleting and recreating the Product2 record.

## Attribute Framework — Creation Sequence

```
AttributePicklist → AttributePicklistValue (×N)
     ↓
AttributeDefinition (references PicklistId)
     ↓
ProductClassification (must be Active)
     ↓
ProductClassificationAttr (links Classification + AttributeDefinition)
     ↓
Product2.BasedOnId = ProductClassification (must be Active first)
     ↓
ProductAttributeDefinition (references Product2Id + AttributeDefinitionId + ProductClassificationAttributeId)
```

## Key Gotchas

| Gotcha | Error | Fix |
|---|---|---|
| `AttributePicklist` DataType defaults to Boolean | "Select up to 2 values for boolean data type" | Explicitly set `DataType='Text'` |
| `AttributeDefinition` with Picklist type requires PicklistId at creation | "Select a picklist" | Create AttributePicklist + values first |
| `ProductClassification` must be active before linking | "Specify an active product classification" | Update `Status='Active'` before updating `Product2.BasedOnId` |
| `ProductClassificationAttribute` wrong API name | Object not found | Use API name `ProductClassificationAttr` |
| `ProductAttributeDefinition` uses `Product2Id` not `ProductId` | "No such column ProductId" | Use `Product2Id` |
| `ProductCategory CatalogId` not inherited | "catalog must match parent" | Set `CatalogId` explicitly on every `ProductCategory` at every level |
| Bundle-specific attributes require separate ProductClassifications | All bundles see all attributes | Use one ProductClassification per bundle when attributes differ |

## Common Implementation Patterns

1. **Hierarchical SaaS Catalog** — Market → Bundle → Plan → Feature using ProductCatalog + ProductCategory hierarchy
2. **Bundle with Required + Optional Components** — ProductComponentGroup with Required and Optional ProductRelationshipType
3. **Auto-Included Components** — `IsDefaultComponent=true`, `IsQuantityEditable=false`, `Quantity=1`
4. **Employee-Count Attribute Pricing** — `AttributeDefinition: Employee_Count` + `ProductQualification` rules per tier

## Cross-Domain Dependencies
- **Pricing** — `ProductSellingModelOption` and `ProductAttributeDefinition` feed into price rules
- **Quote Lifecycle** — `ProductCategory` browsing and `ProductQualification` rules control configurator
- **Order Management** — `ProductRelatedComponent` structure determines order line decomposition
- **Amendments** — `ProductRelationshipType` rules constrain what can be added/removed mid-term
- **CML Scripting** — Constraint models reference product types, attributes, and component groups

## Curation Note
Updated March 2026 based on Revenue Cloud Pricing ERD (developer.salesforce.com), verified against Revenue Cloud org object describe calls (API v66.0). This is the **Revenue Cloud native** object model — not CPQ (SBQQ__*).
