# Operations & Intelligence — Agentforce RM Architect Reference

## Domain Overview
Operational diagnostics, Revenue Cloud Operations Console usage, pricing and configuration logs, and Revenue Management Intelligence analytics setup and KPI visibility.

## Key Salesforce Anchors
- pricing API execution logs
- advanced price logs
- product configuration logs
- operations console views
- Data 360 connection
- Revenue Management Intelligence data kit
- intelligence dashboards and KPI views

## Operations Console
Use for:
- **Monitor and Troubleshoot Pricing Issues** — pricing API execution log details
- **Investigate and Analyze Pricing API Execution Logs** — resolve API execution errors
- **Set Up Advanced Price Logs** — detailed waterfall diagnostic information
- **Set Up Product Configuration Logs** — turn on configuration logs; troubleshoot product configurations

## Revenue Management Intelligence Dashboards
- **Overview Dashboard** — aggregate KPIs across revenue lifecycle
- **Revenue and Margin Forecast Dashboard** — forward-looking revenue and margin
- **Customer Analysis Dashboard** — customer-level trends
- **Product Analysis Dashboard** — product performance metrics
- **Price Volume Mix Dashboard** — price, volume, and mix decomposition
- **Price Waterfall Dashboard** — pricing procedure waterfall visualization
- **Price Volume Trend Dashboard** — trend analysis over time

## Setup Prerequisites
1. Build your Data 360 Connection
2. Configure Access to Revenue Management Intelligence
3. Deploy the Revenue Management Intelligence Data Kit
4. Install Revenue Management Intelligence Apps

## Capability Selection Matrix

| Requirement | Primary Mechanism | Use When | Watch-Outs |
|---|---|---|---|
| Pricing issue diagnosis | Operations Console + pricing logs | Pricing behavior must be investigated in detail | Advanced log enablement may be required first |
| Configuration issue diagnosis | Product configuration logs | Product behavior failing at configuration time | Log setup must precede troubleshooting |
| KPI and dashboard visibility | Revenue Management Intelligence | Teams need analytical insight | Data-connection and data-kit setup are prerequisites |

## Cross-Domain Dependencies
- **Pricing** — pricing logs are the primary diagnostic tool for pricing procedure failures
- **Product Modeling** — configuration logs diagnose configurator behavior
- **All Domains** — intelligence dashboards aggregate data across the full revenue lifecycle
