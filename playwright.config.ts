import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
dotenv.config();

const sessionFile = 'auth/session.json';
const storageState = fs.existsSync(sessionFile) ? (sessionFile as any) : undefined;

export default defineConfig({
  testDir: './tests',
  globalSetup: './scripts/global-setup.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [
    ['json', { outputFile: 'reports/results.json' }],
    ['list'],
    ['./utils/DashboardReporter.ts'],
  ],
  use: {
    baseURL: process.env.SF_SANDBOX_URL,
    storageState,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: 30000,
    navigationTimeout: 60000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  timeout: 120000,
});
