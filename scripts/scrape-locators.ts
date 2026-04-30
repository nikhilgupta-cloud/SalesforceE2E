import * as dotenv from 'dotenv';
dotenv.config();
import * as jsforce from 'jsforce';
import * as fs from 'fs';
import * as path from 'path';

// 1. Map Salesforce Backend Types to LWC Frontend Components
function getLwcComponentData(sfType: string): { tag: string, inputType: string } {
    switch (sfType) {
        case 'picklist':
        case 'multipicklist':
            return { tag: 'lightning-combobox', inputType: 'combobox' };
        case 'reference':
            return { tag: 'lightning-lookup', inputType: 'lookup' };
        case 'boolean':
            return { tag: 'lightning-input', inputType: 'checkbox' };
        case 'textarea':
            return { tag: 'lightning-textarea', inputType: 'text' };
        case 'date':
        case 'datetime':
        case 'string':
        case 'currency':
        case 'double':
        default:
            return { tag: 'lightning-input', inputType: 'text' };
    }
}

// 🚀 UPDATED: Now returns a status object instead of 'void'
export async function scrapeLocators(opts: { force?: boolean } = {}): Promise<{ skipped: boolean; reason?: string }> {
    const outputPath = path.join(process.cwd(), 'knowledge', 'scraped-locators.json');

    // NEW: If the file exists and we aren't forcing a refresh, skip it to save time
    if (!opts.force && fs.existsSync(outputPath)) {
        console.log('⏭️  Locators file already exists. Skipping fresh scrape.');
        return { skipped: true, reason: 'Locators file already exists' };
    }

    console.log('🔄 Reading MFA-approved session from Playwright...');

    try {
        const sessionPath = path.join(process.cwd(), 'auth', 'session.json');
        if (!fs.existsSync(sessionPath)) {
            throw new Error(`Session file not found at ${sessionPath}. Please run codegen first.`);
        }

        const sessionData = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
        const sidCookie = sessionData.cookies.find((c: any) => 
            c.name === 'sid' && c.domain.includes('salesforce.com')
        );

        if (!sidCookie) {
            throw new Error('Could not find a valid Salesforce "sid" cookie in session.json.');
        }

        const conn = new jsforce.Connection({
            instanceUrl: `https://${sidCookie.domain}`,
            sessionId: sidCookie.value
        });

        const objectsToMap = ['Account', 'Contact', 'Opportunity', 'Quote']; 
        const finalJson: Record<string, any> = {};

        for (const objName of objectsToMap) {
            console.log(`📡 Fetching metadata for ${objName}...`);
            const meta = await conn.sobject(objName).describe();
            
            const mappedFields = meta.fields.map(field => {
                const lwcData = getLwcComponentData(field.type);
                return {
                    label: field.label,
                    componentTag: lwcData.tag,
                    inputType: lwcData.inputType,
                    selector: `[data-field-api-name="${field.name}"]`,
                    apiName: field.name
                };
            });

            finalJson[objName.toLowerCase()] = {
                scrapedAt: new Date().toISOString(),
                objectApiName: objName,
                fields: mappedFields
            };
        }

        fs.writeFileSync(outputPath, JSON.stringify(finalJson, null, 2));
        console.log(`🚀 Successfully generated API names at: ${outputPath}`);

        // 🚀 UPDATED: Return success status
        return { skipped: false };

    } catch (error) {
        console.error('❌ Failed to fetch Salesforce metadata:', error);
        throw error;
    }
}

if (require.main === module) {
    scrapeLocators().catch(console.error);
}