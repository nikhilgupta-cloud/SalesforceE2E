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
    Billing_Address?: string;
    Payment_Terms?: string;
  };
  contact: {
    First_Name: string;
    Last_Name: string;
    Email: string;
    Full_Name: string;
    Phone?: string;
  };
  opportunity: {
    Name: string;
    Stage: string;
    Close_Date: string;
    Amount?: string;
    Probability?: string;
  };
  quote: {
    Name: string;
    Contract_Type?: string;
  };
}

const FIXTURE_PATH = path.join(__dirname, '..', 'tests', 'fixtures', 'test-data.json');

function loadFixture(): Partial<TestData> & { Quote?: { Name?: string; Contract_Type?: string } } {
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

  return {
    account: {
      Account_Name: fixture.account?.Account_Name || 'SBOTestAccount',
      Billing_Address: fixture.account?.Billing_Address || '123 Salesforce Way, San Francisco, CA 94105',
      Payment_Terms: fixture.account?.Payment_Terms || 'Net 30',
    },
    contact: {
      First_Name: fixture.contact?.First_Name || `First${timestamp}`,
      Last_Name: fixture.contact?.Last_Name || `Last${timestamp}`,
      Email: fixture.contact?.Email || `test${timestamp}@auto.com`,
      Full_Name: fixture.contact?.Full_Name || `First${timestamp} Last${timestamp}`,
      Phone: fixture.contact?.Phone || `555-${String(timestamp).slice(-4)}`,
    },
    opportunity: {
      Name: fixture.opportunity?.Name || (fixture.opportunity as any)?.Opportunity_Name || `AutoOpp-${timestamp}`,
      Stage: fixture.opportunity?.Stage || 'Prospecting',
      Close_Date: fixture.opportunity?.Close_Date || '12/31/2026',
      Amount: fixture.opportunity?.Amount || '10000',
      Probability: fixture.opportunity?.Probability || '10',
    },
    quote: {
      Name: fixture.Quote?.Name || `AutoQuote-${timestamp}`,
      Contract_Type: fixture.Quote?.Contract_Type || 'Subscription',
    },
  };
}