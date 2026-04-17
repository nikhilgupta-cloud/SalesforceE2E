Salesforce CPQ — User Stories & Acceptance Criteria
Application: Salesforce CPQ
Source: Jira SCRUM — fetched 2026-04-17
Flow: Account → Contact → Opportunity → Quote (CPQ)
________________________________________
OBJECT 1: ACCOUNT

## US-005 — User Story: Salesforce E2E Process to Order Activation
As a Sales Operations Manager, I want an automated end-to-end process to manage the lifecycle of an account from contact creation through to order booking, So that I can ensure data consistency across Salesforce objects and reduce the time from quote generation to order activation by bypassing manual approval steps.
•
Acceptance Criteria:
• AC-005-01: The system must identify an existing Account and verify that Billing Address and Payment Terms are present (Soft-fail if missing).
• AC-005-02: If a Contact does not exist for the Account, the system must allow for the creation of a new Contact record.
• AC-005-03: An Opportunity must be created from the Contact’s perspective.
• AC-005-04: The system must verify that the newly created Contact is assigned as the Primary Contact Role on the Opportunity.

Technical Test Data:
Based on the .spec file logic, the automation expects the following data structure to execute successfully:
A. Account & Contact Data
| Field | Value (Example) |
| Account_Name | "SBOTestAccount" |
| First_Name | "David" |
| Last_Name | "John" |
| Contact_Email | David.John@auto.com |
B. Opportunity & Quote Data
| Field | Value (Example) |
| Opportunity_Name | "Standard E2E - Q2 Order" |
| Price_Book | "Standard Price Book" |
| Quote_Primary | true |
---
• Automated Workflow Steps
• Identity: Login to Salesforce (QA/SBO environment).
• Verify: Open Account and check Billing/Payment terms.
• Establish: Create Contact (if missing) and link a new Opportunity.
<!-- Jira: SCRUM-5 -->

________________________________________
OBJECT 2: CONTACT

## US-005 — User Story: Salesforce E2E Process to Order Activation
As a Sales Operations Manager, I want an automated end-to-end process to manage the lifecycle of an account from contact creation through to order booking, So that I can ensure data consistency across Salesforce objects and reduce the time from quote generation to order activation by bypassing manual approval steps.
•
Acceptance Criteria:
• AC-005-01: The system must identify an existing Account and verify that Billing Address and Payment Terms are present (Soft-fail if missing).
• AC-005-02: If a Contact does not exist for the Account, the system must allow for the creation of a new Contact record.
• AC-005-03: An Opportunity must be created from the Contact’s perspective.
• AC-005-04: The system must verify that the newly created Contact is assigned as the Primary Contact Role on the Opportunity.

Technical Test Data:
Based on the .spec file logic, the automation expects the following data structure to execute successfully:
A. Account & Contact Data
| Field | Value (Example) |
| Account_Name | "SBOTestAccount" |
| First_Name | "David" |
| Last_Name | "John" |
| Contact_Email | David.John@auto.com |
B. Opportunity & Quote Data
| Field | Value (Example) |
| Opportunity_Name | "Standard E2E - Q2 Order" |
| Price_Book | "Standard Price Book" |
| Quote_Primary | true |
---
• Automated Workflow Steps
• Identity: Login to Salesforce (QA/SBO environment).
• Verify: Open Account and check Billing/Payment terms.
• Establish: Create Contact (if missing) and link a new Opportunity.
<!-- Jira: SCRUM-5 -->

________________________________________
OBJECT 3: OPPORTUNITY

## US-005 — User Story: Salesforce E2E Process to Order Activation
As a Sales Operations Manager, I want an automated end-to-end process to manage the lifecycle of an account from contact creation through to order booking, So that I can ensure data consistency across Salesforce objects and reduce the time from quote generation to order activation by bypassing manual approval steps.
•
Acceptance Criteria:
• AC-005-01: The system must identify an existing Account and verify that Billing Address and Payment Terms are present (Soft-fail if missing).
• AC-005-02: If a Contact does not exist for the Account, the system must allow for the creation of a new Contact record.
• AC-005-03: An Opportunity must be created from the Contact’s perspective.
• AC-005-04: The system must verify that the newly created Contact is assigned as the Primary Contact Role on the Opportunity.

Technical Test Data:
Based on the .spec file logic, the automation expects the following data structure to execute successfully:
A. Account & Contact Data
| Field | Value (Example) |
| Account_Name | "SBOTestAccount" |
| First_Name | "David" |
| Last_Name | "John" |
| Contact_Email | David.John@auto.com |
B. Opportunity & Quote Data
| Field | Value (Example) |
| Opportunity_Name | "Standard E2E - Q2 Order" |
| Price_Book | "Standard Price Book" |
| Quote_Primary | true |
---
• Automated Workflow Steps
• Identity: Login to Salesforce (QA/SBO environment).
• Verify: Open Account and check Billing/Payment terms.
• Establish: Create Contact (if missing) and link a new Opportunity.
<!-- Jira: SCRUM-5 -->

________________________________________

<!--
  ⚠ UNRESOLVED STORIES — Salesforce object could not be detected.
  Add a Jira component matching one of: account, contact, opportunity, quote
  or set a label sf-{object} (e.g. sf-quote) on the ticket.

  SCRUM-1 | US-001 — Task 1
  SCRUM-2 | US-002 — Task 2
  SCRUM-3 | US-003 — Task 3
  SCRUM-4 | US-004 — Subtask 2.1
-->