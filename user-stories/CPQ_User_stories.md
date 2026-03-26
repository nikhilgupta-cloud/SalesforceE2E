Salesforce CPQ — User Stories & Acceptance Criteria
Application: Salesforce CPQ (RCA)
Flow: Account → Contact → Opportunity → Quote
Environment: Salesforce Sandbox
________________________________________
OBJECT 1: ACCOUNT
## US-001 — Create a New Account
As a Sales Representative
I want to create a new Account in Salesforce
So that I can associate Contacts and Opportunities with a customer organization
Acceptance Criteria:
•	AC-001-01: User can navigate to the Accounts tab and click "New"
•	AC-001-02: Form must include required fields: Account Name, Type, Industry, Phone
•	AC-001-03: Account Name must be unique; duplicate names must trigger a warning
•	AC-001-04: On Save, the Account record is created and visible in the list view
•	AC-001-05: Account Type picklist must accept: Prospect, Customer, Partner
## US-002 — Edit an Existing Account
As a Sales Representative
I want to edit an Account record
So that I can keep customer information up to date
Acceptance Criteria:
•	AC-002-01: User can open an Account and click "Edit"
•	AC-002-02: All editable fields can be modified and saved
•	AC-002-03: Changes are reflected immediately on the record page after Save
•	AC-002-04: Last Modified By and Last Modified Date update after every Save
## US-003 — Search and View an Account
As a Sales Representative
I want to search for an existing Account
So that I can quickly access customer details
Acceptance Criteria:
•	AC-003-01: Global search returns Account matches by name
•	AC-003-02: Clicking a result navigates to the Account detail page
•	AC-003-03: Detail page displays: Name, Type, Industry, Phone, Related Contacts, Related Opportunities
________________________________________
OBJECT 2: CONTACT
## US-004 — Create a Contact Linked to an Account
As a Sales Representative
I want to create a Contact associated with an Account
So that I can track individuals at customer organizations
Acceptance Criteria:
•	AC-004-01: Contact form requires: First Name, Last Name, Account Name (lookup), Email
•	AC-004-02: Account Name lookup must resolve to an existing Account record
•	AC-004-03: On Save, Contact appears in the Account's related Contacts list
•	AC-004-04: Duplicate email addresses must trigger a duplicate alert
## US-005 — Edit Contact Details
As a Sales Representative
I want to update a Contact's information
So that records remain accurate over time
Acceptance Criteria:
•	AC-005-01: Phone, Title, Email, and Mailing Address are editable
•	AC-005-02: Changes persist after navigating away and returning to the record
•	AC-005-03: Required fields (Last Name, Account Name) cannot be cleared and saved
## US-006 — Associate Contact to an Opportunity as a Contact Role
As a Sales Representative
I want to link a Contact to an Opportunity with a defined role
So that I can track stakeholders involved in a deal
Acceptance Criteria:
•	AC-006-01: From an Opportunity, user can add Contact Roles via the related list
•	AC-006-02: Contact Role must include a Role value (e.g. Decision Maker, Evaluator, Economic Buyer)
•	AC-006-03: One Contact Role per Opportunity can be flagged as Primary
________________________________________
OBJECT 3: OPPORTUNITY
## US-007 — Create a New Opportunity
As a Sales Representative
I want to create an Opportunity linked to an Account
So that I can track a potential sale through the pipeline
Acceptance Criteria:
•	AC-007-01: Opportunity form requires: Name, Account Name, Close Date, Stage
•	AC-007-02: Stage picklist values: Prospecting, Qualification, Proposal/Price Quote, Negotiation/Review, Closed Won, Closed Lost
•	AC-007-03: Close Date set in the past must trigger a validation warning
•	AC-007-04: On Save, Opportunity appears in the Account's related Opportunities list
•	AC-007-05: Amount field is optional on creation but required before advancing to Proposal stage
## US-008 — Advance Opportunity Through Sales Stages
As a Sales Manager
I want to move an Opportunity through pipeline stages
So that the forecast reflects the current deal status
Acceptance Criteria:
•	AC-008-01: Stage can be updated via the record detail page or Kanban board
•	AC-008-02: Advancing to "Closed Won" requires Amount and Close Date to be set
•	AC-008-03: Advancing to "Closed Lost" must prompt for a Loss Reason (required)
•	AC-008-04: Each stage change is timestamped and logged in Activity History
## US-009 — View Opportunity Forecast Category
As a Sales Manager
I want to see the Forecast Category for each Opportunity
So that I can estimate revenue for the current quarter
Acceptance Criteria:
•	AC-009-01: Forecast Category is auto-populated based on the Stage value
•	AC-009-02: Forecast Category is visible on both the list view and the detail page
•	AC-009-03: Changing Stage triggers automatic recalculation of Forecast Category
________________________________________
OBJECT 4: QUOTE (Salesforce CPQ)
## US-010 — Create a Quote from an Opportunity
As a Sales Representative
I want to generate a CPQ Quote directly from an Opportunity
So that I can configure products and pricing for a proposal
Acceptance Criteria:
•	AC-010-01: "New Quote" button is accessible from the Opportunity detail page
•	AC-010-02: Quote inherits Account Name, Opportunity Name, and Billing Address from the Opportunity
•	AC-010-03: Quote form requires: Quote Name, Expiration Date
•	AC-010-04: Primary Quote checkbox is available and can be selected
•	AC-010-05: On Save, Quote appears in the Opportunity's related Quotes list
## US-011 — Add Products via the Quote Line Editor (QLE)
As a Sales Representative
I want to add products and configure quantities and pricing in the Quote Line Editor
So that I can build an accurate product proposal
Acceptance Criteria:
•	AC-011-01: Quote Line Editor (QLE) opens from the Quote record via "Edit Lines"
•	AC-011-02: User can search and select products from the product catalog
•	AC-011-03: Quantity and Sale Price are editable per line item in the QLE
•	AC-011-04: System Price (list price) is read-only; only Sale Price and Discount % are editable
•	AC-011-05: Total Price auto-calculates as Quantity × Sale Price on every line
•	AC-011-06: QLE must save successfully and reflect line items on the Quote record
## US-012 — Apply Discount to a Quote Line
As a Sales Representative
I want to apply a discount percentage to one or more Quote lines
So that I can offer a customer-specific price
Acceptance Criteria:
•	AC-012-01: Discount % field is editable per line item in the QLE
•	AC-012-02: Entering a Discount % automatically recalculates the Sale Price
•	AC-012-03: Discounts exceeding the configured approval threshold trigger a Discount Approval workflow
•	AC-012-04: An Approval Request becomes visible in the Approvals section of the Quote
•	AC-012-05: Quote Status changes to "Approval Required" when the approval threshold is breached
## US-013 — Generate a Quote PDF Document
As a Sales Representative
I want to generate a PDF version of the Quote
So that I can send a formal proposal to the customer
Acceptance Criteria:
•	AC-013-01: "Generate Document" button is visible on the Quote record
•	AC-013-02: Generated PDF includes all line items, quantities, prices, totals, and Quote header fields
•	AC-013-03: PDF is saved as a file attachment on the Quote record after generation
•	AC-013-04: PDF generation completes without error within 30 seconds
•	AC-013-05: PDF filename follows the pattern: Quote-{QuoteName}-{YYYY-MM-DD}.pdf

