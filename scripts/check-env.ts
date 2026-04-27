import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config();

console.log('--- Environment Check ---');
console.log('CWD:', process.cwd());
console.log('__dirname:', __dirname);
console.log('SF_SANDBOX_URL:', process.env.SF_SANDBOX_URL ? 'Set' : 'MISSING');
console.log('JIRA_BASE_URL:', process.env.JIRA_BASE_URL ? 'Set' : 'MISSING');

const sessionPath = path.join(process.cwd(), 'auth', 'session.json');
console.log('auth/session.json exists:', fs.existsSync(sessionPath));

if (fs.existsSync(sessionPath)) {
    try {
        const session = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
        console.log('Session file is valid JSON');
    } catch (e) {
        console.log('Session file is INVALID JSON');
    }
}

console.log('Node version:', process.version);
console.log('Platform:', process.platform);
console.log('-------------------------');
