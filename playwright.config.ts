import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for GroundKart Website Quality and Usability Audit.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false, // Run personas and test suites predictably
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1, // Single worker avoids database write collisions during synthetic user simulations
  timeout: 45000,
  expect: {
    timeout: 10000,
  },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'test-results/playwright-test-run.json' }],
  ],
  outputDir: 'test-results',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'on',
    video: 'off',
    actionTimeout: 12000,
    navigationTimeout: 20000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1366, height: 768 },
      },
    },
  ],
});
