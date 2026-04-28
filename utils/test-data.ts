/**
 * Test Data Utility — loads structured test data from JSON fixtures
 * 
 * Usage:
 *   const data = getTestData();
 *   data.account.Account_Name  → "SBOTestAccount"
 *   data.contact.First_Name    → "David"
 * 
 * Fallback: AutoAcc-${Date.now()} when fixture data is missing
 */
import * as fs from 'fs';
import * as path from 'path';

export interface TestData {
  account: {
    Account_Name: string;
    /** alias — AI generators may use camelCase */
    name?: string;
    Billing_Address?: string;
    Payment_Terms?: string;
  };
  contact: {
    First_Name: string;
    Last_Name: string;
    Email: string;
    Full_Name: string;
    Phone?: string;
    /** aliases — AI generators may use camelCase */
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  };
  opportunity: {
    Name: string;
    Stage: string;
    Close_Date: string;
    Amount?: string;
    Probability?: string;
    /** aliases — AI generators may use camelCase */
    name?: string;
    stage?: string;
    closeDate?: string;
  };
  quote: {
    Name: string;
    Contract_Type?: string;
    /** aliases — AI generators may use camelCase */
    name?: string;
    priceBook?: string;
    expirationDate?: string;
    expiryDate?: string;
  };
}

const FIXTURE_PATH = path.join(__dirname, '..', 'tests', 'fixtures', 'test-data.json');

function loadFixture(): Partial<TestData> {
  try {
    if (fs.existsSync(FIXTURE_PATH)) {
      return JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
    }
  } catch (e) {
    console.warn('[getTestData] ⚠ Failed to load fixture:', e);
  }
  return {};
}

export function getTestData(): TestData {
  const fixture = loadFixture();
  const timestamp = Date.now();

  const accountName   = fixture.account?.Account_Name || 'SBOTestAccount';
  const firstName     = fixture.contact?.First_Name || `First${timestamp}`;
  const lastName      = fixture.contact?.Last_Name  || `Last${timestamp}`;
  const email         = fixture.contact?.Email      || `test${timestamp}@auto.com`;
  const phone         = fixture.contact?.Phone      || `555-${String(timestamp).slice(-4)}`;
  const oppName       = fixture.opportunity?.Name   || `AutoOpp-${timestamp}`;
  const stage         = fixture.opportunity?.Stage  || 'Prospecting';
  const closeDate     = fixture.opportunity?.Close_Date || '12/31/2026';
  const quoteName     = fixture.quote?.Name         || `AutoQuote-${timestamp}`;

  return {
    account: {
      Account_Name:    accountName,
      name:            accountName,          // camelCase alias
      Billing_Address: fixture.account?.Billing_Address || '123 Salesforce Way, San Francisco, CA 94105',
      Payment_Terms:   fixture.account?.Payment_Terms   || 'Net 30',
    },
    contact: {
      First_Name: firstName,
      Last_Name:  lastName,
      Email:      email,
      Phone:      phone,
      Full_Name:  fixture.contact?.Full_Name || `${firstName} ${lastName}`,
      firstName,                             // camelCase alias
      lastName,                              // camelCase alias
      email,                                 // camelCase alias
      phone,                                 // camelCase alias
    },
    opportunity: {
      Name:       oppName,
      Stage:      stage,
      Close_Date: closeDate,
      Amount:     fixture.opportunity?.Amount      || '10000',
      Probability:fixture.opportunity?.Probability || '10',
      name:       oppName,                   // camelCase alias
      stage,                                 // camelCase alias
      closeDate,                             // camelCase alias
    },
    quote: {
      Name:          quoteName,
      Contract_Type: fixture.quote?.Contract_Type || 'Subscription',
      name:          quoteName,              // camelCase alias
      priceBook:     'Standard Price Book',  // not in fixture; hardcoded safe default
      expirationDate:'12/31/2026',           // not in fixture; hardcoded safe default
      expiryDate:    '12/31/2026',           // camelCase alias variant
    },
  };
}