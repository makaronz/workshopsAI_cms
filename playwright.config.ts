import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'path';

/**
 * Playwright Configuration for E2E Testing
 *
 * This configuration supports:
 * - Cross-browser testing (Chrome, Firefox, Safari, Edge)
 * - Mobile device emulation
 * - Accessibility testing
 * - Performance metrics collection
 * - Visual regression testing
 * - API testing alongside UI tests
 */
export default defineConfig({
  // Test directory
  testDir: './tests/e2e',

  // Run tests in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,

  // Reporter configuration
  reporter: [
    ['html', { outputFolder: './test-results/playwright-report' }],
    ['json', { outputFile: './test-results/playwright/results.json' }],
    ['junit', { outputFile: './test-results/playwright/results.xml' }],
    ['list'],
    process.env.CI ? ['github'] : ['line']
  ],

  // Global test configuration
  use: {
    // Base URL to use in actions like `await page.goto('/')`
    baseURL: process.env.BASE_URL || 'http://localhost:3001',

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Record video on failure
    video: 'retain-on-failure',

    // Take screenshot on failure
    screenshot: 'only-on-failure',

    // Global timeout for each action
    actionTimeout: 10000,

    // Global timeout for navigation
    navigationTimeout: 30000,

    // Ignore HTTPS errors (for testing environments)
    ignoreHTTPSErrors: true,

    // User agent
    userAgent: 'workshopsAI-cms-e2e-tests',

    // Locale
    locale: 'en-US',

    // Timezone
    timezoneId: 'America/New_York',

    // Color scheme preference
    colorScheme: 'light',

    // Reduced motion for accessibility testing
    reducedMotion: 'reduce'
  },

  // Configure projects for major browsers
  projects: [
    // Desktop browsers
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testMatch: '**/e2e/**/*.spec.ts',
      dependencies: ['setup']
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      testMatch: '**/e2e/**/*.spec.ts',
      dependencies: ['setup']
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      testMatch: '**/e2e/**/*.spec.ts',
      dependencies: ['setup']
    },

    {
      name: 'edge',
      use: { ...devices['Desktop Edge'] },
      testMatch: '**/e2e/**/*.spec.ts',
      dependencies: ['setup']
    },

    // Mobile devices
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
      testMatch: '**/e2e/**/*.spec.ts',
      dependencies: ['setup']
    },

    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
      testMatch: '**/e2e/**/*.spec.ts',
      dependencies: ['setup']
    },

    // Tablet devices
    {
      name: 'Tablet',
      use: { ...devices['iPad Pro'] },
      testMatch: '**/e2e/**/*.spec.ts',
      dependencies: ['setup']
    },

    // Accessibility testing project
    {
      name: 'accessibility',
      use: {
        ...devices['Desktop Chrome'],
        // Enable accessibility testing
        // This will be used by our accessibility fixtures
      },
      testMatch: '**/e2e/**/*.spec.ts',
      dependencies: ['setup']
    },

    // Performance testing project
    {
      name: 'performance',
      use: {
        ...devices['Desktop Chrome'],
        // Enable performance testing
        // This will be used by our performance fixtures
      },
      testMatch: '**/e2e/**/*.spec.ts',
      dependencies: ['setup']
    },

    // API testing project (headless)
    {
      name: 'api',
      use: {
        ...devices['Desktop Chrome'],
        // Headless for API testing
        headless: true
      },
      testMatch: '**/e2e/**/*.spec.ts',
      dependencies: ['setup']
    },

    // Setup project (runs first)
    {
      name: 'setup',
      testMatch: '**/setup.spec.ts',
      teardown: 'cleanup'
    },

    // Cleanup project (runs last)
    {
      name: 'cleanup',
      testMatch: '**/cleanup.spec.ts'
    }
  ],

  // Web server configuration
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3001',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    stdout: 'ignore',
    stderr: 'pipe'
  },

  // Global setup and teardown
  globalSetup: resolve(__dirname, './tests/e2e/global-setup.ts'),
  globalTeardown: resolve(__dirname, './tests/e2e/global-teardown.ts'),

  // Output directory
  outputDir: './test-results/playwright/artifacts',

  // Test timeout
  timeout: 60000,

  // Expect timeout
  expect: {
    timeout: 10000
  },

  // Metadata for test organization
  metadata: {
    'test-environment': 'e2e',
    'test-type': 'playwright',
    'application': 'workshopsAI-cms'
  }
});