import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Attempt to load .env if present
try {
  if (typeof process.loadEnvFile === 'function' && fs.existsSync('.env')) {
    process.loadEnvFile('.env');
  }
} catch {
  // Ignore env loading errors
}

// Dev-only safety check
if (process.env.E2E_ALLOW_DESTRUCTIVE !== '1') {
  throw new Error('Dev only: E2E_ALLOW_DESTRUCTIVE must be set to "1" to run tests.');
}

const apiUrl = process.env.E2E_API_URL || 'http://localhost:8000';
const apiHost = new URL(apiUrl).hostname;
if (apiHost !== 'localhost' && apiHost !== '127.0.0.1') {
  throw new Error(`Dev only: E2E_API_URL host must be localhost or 127.0.0.1, got: "${apiHost}"`);
}

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : 2,
  reporter: [
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['list'],
    ['json', { outputFile: 'test-results/report.json' }],
    ['junit', { outputFile: 'test-results/report.xml' }],
  ],
  globalSetup: path.resolve(__dirname, './e2e/global-setup.ts'),
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
      },
    },
    {
      name: 'mobile-chromium',
      use: {
        ...devices['Pixel 5'],
      },
    },
  ],
  webServer: [
    {
      command: 'npm run dev',
      cwd: __dirname,
      url: 'http://localhost:3000',
      reuseExistingServer: true,
      timeout: 30_000,
    },
    {
      command: 'uvicorn app.main:app --port 8000',
      cwd: path.resolve(__dirname, '../backend'),
      url: 'http://localhost:8000/healthz',
      reuseExistingServer: true,
      timeout: 30_000,
    },
  ],
});
