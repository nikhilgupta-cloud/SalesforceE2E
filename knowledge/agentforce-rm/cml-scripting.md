# CML Scripting — Agentforce RM Architect Reference

## Domain Overview
Constraint Modeling Language (CML) authoring for Revenue Cloud Product Configurator: syntax, annotations, rules, aggregation patterns, product-selection logic, and example-driven scripting guidance.

Source: Constraint Modeling Language (CML) User Guide, Edition 3.2, Spring '26.

## Core Syntax Cheat Sheet

### 1. Header-Level Declarations
```cml
define MAX_COUNT 100
define VOLTAGE_REGEX "^([0-9]+)/([0-9]+)$"
property allowMissingRelations = "true";

@(contextPath = "SalesTransaction.ProjectUrgency", tagName = "Priority_Level")
extern string ProjectUrgency = "Standard";
```

### 2. Variables
```cml
string BayType = ["load", "lv", "mv"];
int BayNumber = [1..9];
decimal(2) TaxRate = 0.08;
string[] selectedColors;
```

### 3. Types and Inheritance
```cml
type LineItem;
type GeneratorSet : LineItem {
  int requiredKW = [101..10000];
}
```

### 4. Relationships
```cml
relation GeneralModels : GeneralModel[1..1];
relation TemperatureSensors : TemperatureSensor[0..5];
```

### 5. Constraints
```cml
constraint(requiredKW <= 2500, "Required capacity exceeds the supported limit.");
constraint(
  standardsAndCompliance == "Listing-UL 2200" -> Voltage3 <= 600,
  "UL 2200 standard covers assemblies rated at 600 volts or less."
);
```

### 6. Rule Keywords
```cml
message(condition, "Message", "Warning");
require(condition, relation[type] == 2, "Required item");
setdefault(condition, relation[type] == 2, "Recommended default");
exclude(condition, relation[type], "Excluded item");
rule(condition, "hide", "attribute", "Voltage");
rule(condition, "disable", "relation", "StarterMotors", "type", "StarterMotor_Advanced");
```

### 7. Table Constraints
```cml
constraint(
  table(
    Voltage, DutyRating,
    {"220/380", "Prime Power (PRP)"},
    {"277/480", "Emergency Standby Power (ESP)"}
  ),
  "Selected Voltage not compatible with Duty Rating."
);
```

### 8. Proxy Variables and Aggregates
```cml
int heatersInRelation = cardinality(Heater, Heaters);
int allHeaters = cardinality(Heater);
relation accessories : Accessory[0..10] {
  accessoryWeight = sum(weight_kg);
  accessoryCount = count(weight_kg > 0);
}
```

## Key Annotations

| Annotation | What it changes |
|---|---|
| `configurable` | whether user/engine can configure the variable |
| `defaultValue` | initial variable value |
| `domainComputation` | whether domain is dynamically recomputed |
| `peelable` | whether engine may override current value to resolve conflicts |
| `sequence` | resolution order |
| `virtual` | defines a logical or transaction-level container |

## Best Practices (from guide)
- Keep variable domains as small as possible
- Specify smallest cardinality range required
- Put calculations inside constraints instead of inline expressions when possible
- Give derived and aggregated fields explicit domains
- Use `sequence` intentionally to reduce backtracking
- Separate "add product" logic from "set product attributes" logic
- Avoid unsupported pricing fields (`ListPrice`, `NetUnitPrice`) in CML

## Common Failure Modes
- Missing explicit domains on calculated or aggregated variables
- Using `constraint()` when requirement is really to add a product (use `require()`)
- Overly large domains or wide relationship cardinalities that explode solver search space
- Expecting `exclude()` behavior from ordinary constraints

## Cross-Reference
- Load `product-modeling.md` when designing bundles, selling models, or attributes in PCM
- Load `customizations.md` when needing Flow, Apex, or APIs around configurator execution
- Load `quote-lifecycle.md` when CML behavior is part of quote-time configuration
