# Approvals — Agentforce RM Architect Reference

## Domain Overview
Approvals enforce business controls in Revenue Cloud — who can approve discounts, high-value deals, contract terms, and amendments. Uses Advanced Approvals in Revenue Cloud to route approval requests through defined hierarchies with serial and parallel approver patterns.

## Key Salesforce Anchors
- `Quote`, `Order` — records submitted for approval
- approval requests and approval rules — native Advanced Approvals objects
- approver assignments — links between approval stages and approver personas
- Advanced Approval objects — the native Revenue Cloud approval framework

## Common UI Patterns (for test automation)

### Approval Submission Flow
1. Quote reaches threshold (e.g., discount > 15%)
2. Submit for Approval button appears on Quote record
3. Approval request created → approver receives email notification
4. Approver navigates to approval request → Approve or Reject
5. On Approval: Quote status changes → document generation unlocked

### Known Selectors
- Submit for Approval: `getByRole('button', { name: 'Submit for Approval', exact: true })`
- Approval status field: standard field on Quote record page
- Approval action buttons: appear in approval request record, not Quote

## Common Implementation Patterns

1. **Single-level discount approval** — all quotes with discount > 15% require manager approval
2. **Multi-level by amount** — $10K–$50K: manager; $50K–$250K: director; $250K+: VP Sales
3. **Discount authority pyramid** — skip approval if discount within role authority
4. **Amendment approval by type** — different approvers for price vs. scope changes

## Known Limitations & Gotchas

- **Submission access prerequisite** — if submitting user lacks record access, approval email is not sent (known guide caveat)
- **Dynamic approver lookup gap** — if approver lookup resolves to user with no manager, approval fails
- **Mid-workflow record modification** — record changes while approval in-flight do not auto-restart workflow; requires manual recall
- **Approval history immutability** — once recorded, cannot be undone; rejection + resubmission is the only path

## Cross-Domain Dependencies
- **Pricing** — discount authority determines whether approval required
- **Quote Lifecycle** — quote status moves through approval states
- **Contract Lifecycle** — amendment quotes may follow different thresholds
- **Document Generation** — documents only generated on approved quotes
