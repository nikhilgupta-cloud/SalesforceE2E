/**
 * setup-mcp.ts — Inject .env secrets into .claude/settings.local.json
 *
 * Run once after cloning or rotating credentials:
 *   npx ts-node scripts/setup-mcp.ts
 *
 * Writes .claude/settings.local.json (gitignored).
 * The file merges with .claude/settings.json so MCP servers receive live credentials.
 */

import * as fs   from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const ROOT        = path.resolve(__dirname, '..');
const SETTINGS    = path.join(ROOT, '.claude', 'settings.local.json');

function require_env(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing required env var: ${key}`);
  return v;
}

const local = {
  mcpServers: {
    playwright: {
      command: 'npx',
      args: ['@playwright/mcp@latest', '--headless'],
    },
    github: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github@latest'],
      env: {
        GITHUB_PERSONAL_ACCESS_TOKEN: require_env('GITHUB_TOKEN'),
      },
    },
    jira: {
      command: 'npx',
      args: ['-y', 'mcp-atlassian@latest'],
      env: {
        JIRA_URL:       require_env('JIRA_BASE_URL'),
        JIRA_USERNAME:  require_env('JIRA_EMAIL'),
        JIRA_API_TOKEN: require_env('JIRA_API_TOKEN'),
      },
    },
    salesforce: {
      command: 'npx',
      args: ['-y', '@salesforce/mcp@latest'],
      env: {
        SF_USERNAME:     require_env('SF_USERNAME'),
        SF_PASSWORD:     require_env('SF_PASSWORD'),
        SF_INSTANCE_URL: require_env('SF_SANDBOX_URL'),
      },
    },
  },
};

fs.writeFileSync(SETTINGS, JSON.stringify(local, null, 2));
console.log(`✅  Written: ${SETTINGS}`);
console.log('   Reload Claude Code (or restart the MCP servers) to apply.');
