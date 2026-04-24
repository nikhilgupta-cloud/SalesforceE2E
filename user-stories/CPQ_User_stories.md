Salesforce CPQ — User Stories & Acceptance Criteria
Application: Salesforce CPQ
Source: Jira SCRUM — fetched 2026-04-24
Flow: Account → Contact → Opportunity → Quote (CPQ) → Contract → Order → Amendment → Renewal
________________________________________
OBJECT 1: ACCOUNT

## US-005 — User Story: Salesforce E2E Process to Order Activation
As a Sales Operations Manager, I want an automated end-to-end process to manage the lifecycle of an account from contact creation through to opportunity creation
• Acceptance Criteria:
AC-005-01: The system must identify an existing Account and verify that Billing Address and Payment Terms are present under the details tab(Soft-fail if missing).
AC-005-02: On the Account record create the new contact.
AC-005-03: An Opportunity must be created from the Contact’s perspective.
AC-005-04: The system must verify that the newly created Contact is assigned as the Primary Contact Role on the Opportunity.
QO-005-05: The system must create the Quote from the Opportunity from the create Quote button.

Technical Test Data:
Test data is managed externally via tests/fixtures/test-data.json and loaded via getTestData() utility.
Account, Contact, Opportunity , Quote fields: auto-loaded from fixture
Fallback: timestamp-suffixed names (AutoAcc-${Date.now()}) if fixture missing
Price Book & Quote fields: defined in test-data.json

Automated Workflow Steps:
Identity: Login to Salesforce (QA/SBO environment).
Verify: Open Account and check Billing/Payment terms.
Establish: Create Contact (if missing) and link a new Opportunity.

Technical Test Data:
Test data is managed externally via tests/fixtures/test-data.json and loaded via getTestData() utility.
Account, Contact, Opportunity , Quote fields: auto-loaded from fixture
Fallback: timestamp-suffixed names (AutoAcc-${Date.now()}) if fixture missing
Price Book & Quote fields: defined in test-data.json
Automated Workflow Steps:
Identity: Login to Salesforce (QA/SBO environment).
Verify: Open Account and check Billing/Payment terms.
Establish: Create Contact (if missing) and link a new Opportunity.
<!-- Jira: SCRUM-5 -->

________________________________________