# Pricing — Agentforce RM Architect Reference

## Domain Overview
Pricing in Revenue Cloud native translates product definitions, selling models, and business rules into unit economics on quote and order lines. It is built on a distinct object model from CPQ — no `PriceRule`, `DiscountSchedule`, or `SBQQ__*` pricing objects. The pricing engine is driven by **PriceAdjustmentSchedule**, **PriceAdjustmentTier**, **BundleBasedAdjustment**, and **AttributeBasedAdjustment**.

## Core Object Model

```
Pricebook (Pricebook2)
  └── PricebookEntry (Product2 × Pricebook × ProductSellingModel)

PriceAdjustmentSchedule (linked to Pricebook2)
  ├── PriceAdjustmentTier (× ProductSellingModel)
  ├── BundleBasedAdjustment (× ProductSellingModel, ParentProduct, RootBundle)
  └── AttributeBasedAdjustment (× ProductSellingModel, Product2)
        └── AttributeAdjustmentCondition (× AttributeDefinition, Product2)

IndexRate
PriceRevisionPolicy
```

## Object Reference

### Standard Objects
| Object | API Name | Purpose |
|---|---|---|
| Pricebook | `Pricebook2` | Named price list; one Standard + custom pricebooks |
| Pricebook Entry | `PricebookEntry` | Links Product2 to Pricebook with UnitPrice; references ProductSellingModelId |
| Product Selling Model | `ProductSellingModel` | Defines selling type (Evergreen, TermDefined, OneTime) |

### Revenue Cloud Licensed Objects
| Object | API Name | Purpose |
|---|---|---|
| Price Adjustment Schedule | `PriceAdjustmentSchedule` | Container for all pricing adjustments |
| Price Adjustment Tier | `PriceAdjustmentTier` | Volume/quantity tiers; LowerBound, UpperBound, TierType, TierValue |
| Bundle Based Adjustment | `BundleBasedAdjustment` | Adjustments applied to products within a bundle context |
| Attribute Based Adjustment | `AttributeBasedAdjustment` | Adjustment triggered by attribute values |
| Attribute Adjustment Condition | `AttributeAdjustmentCondition` | Condition clause referencing AttributeDefinition |
| Index Rate | `IndexRate` | Named rate index (e.g., CPI) for index-based pricing |
| Price Revision Policy | `PriceRevisionPolicy` | Policy governing when/how prices can be revised |

## Key Relationships

### PricebookEntry
- Required: `Pricebook2Id`, `Product2Id`, `UnitPrice`
- Must create entry in **Standard Price Book first** before creating in custom pricebooks
- `ProductSellingModelId` — links selling model; omitting causes pricing failures at quote time

### PriceAdjustmentTier
- Required: `PriceAdjustmentScheduleId`, `LowerBound`, `TierType`, `TierValue`
- Defines the pricing tier: quantity range → adjustment value

### AttributeBasedAdjustment
- Required: `PriceAdjustmentScheduleId`, `AdjustmentType`, `AdjustmentValue`, `EffectiveFrom`, `AttributeBasedAdjRuleId`, `ProductId`

### AttributeAdjustmentCondition
- Required: `AttributeBasedAdjRuleId`, `AttributeDefinitionId`, `ProductId`
- One condition per attribute; multiple conditions combine into the rule (AND logic by default)

## Common Pricing Patterns

### 1. Per-Unit (Seat/Employee) Pricing
- `PriceAdjustmentSchedule` → `AttributeBasedAdjustment` on the subscription bundle
- `AttributeAdjustmentCondition`: `AttributeDefinitionId = <unit count attribute>`, Operator = range
- Different `TierValue` per unit band (1–50 = $X/unit, 51–200 = $Y/unit)

### 2. Plan Tier Pricing
- `AttributeAdjustmentCondition`: `AttributeDefinitionId = <Plan Tier attribute>`
- One `AttributeBasedAdjustment` per tier value (Starter, Professional, Enterprise)

### 3. Volume Tiers
- `PriceAdjustmentTier` with LowerBound/UpperBound ranges
- TierType = Percent or Amount discount as volume increases

### 4. Bundle Component Pricing
- `BundleBasedAdjustment`: `ParentProductId` = Bundle, `ProductId` = Component
- Supports included-at-no-charge vs. paid add-on logic

## Known Limitations & Gotchas

- **Standard Pricebook entry required first** — creating a PricebookEntry in a custom pricebook without a prior Standard Pricebook entry fails
- **PricebookEntry requires ProductSellingModelId** for subscription products — omitting causes pricing calculation failures at quote time
- **AttributeBasedAdjustmentRule API name** — referenced via `AttributeBasedAdjRuleId` field; verify actual API name in each org
- **No CPQ pricing objects** — `PriceRule`, `DiscountSchedule`, `SBQQ__*` do not apply
- **Compound attribute conditions** — Multiple `AttributeAdjustmentCondition` records on one rule use AND logic by default; OR conditions require separate rules
- **License-dependent objects** — `PricebookEntryDerivedPricing`, `PricingProcedureResolution`, `PricingAdjustmentBatchJob` may not be available depending on license tier

## Cross-Domain Dependencies
- **Product Modeling** — `ProductSellingModelOption` and `ProductAttributeDefinition` feed directly into pricing conditions
- **Quote Lifecycle** — Pricing schedule evaluation triggered at quote line creation
- **Contract Lifecycle** — Price schedules committed to contract; `PriceRevisionPolicy` governs mid-term changes
- **Amendments / Renewals** — `IndexRate` and `PriceRevisionPolicy` drive uplift on renewal

## Curation Note
Updated March 2026 based on Revenue Cloud Pricing ERD (developer.salesforce.com, last modified Aug 29, 2025), verified against Revenue Cloud org object describe calls (API v66.0). This is the Revenue Cloud native pricing model — not CPQ.
