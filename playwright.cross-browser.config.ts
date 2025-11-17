import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for cross-browser testing
 * This configuration focuses on LitElement compatibility testing
 */
export default defineConfig({
  testDir: './tests/e2e',

  // Global test timeout
  timeout: 30000,

  // Expect timeout
  expect: {
    timeout: 10000
  },

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Test reporter configuration
  reporter: [
    ['html', { outputFolder: 'playwright-report/cross-browser' }],
    ['json', { outputFile: 'test-results/cross-browser-results.json' }],
    ['junit', { outputFile: 'test-results/cross-browser-results.xml' }],
    ['list']
  ],

  // Global setup and teardown
  globalSetup: require.resolve('./tests/e2e/global-setup.ts'),

  use: {
    // Base URL for tests
    baseURL: process.env.BASE_URL || 'http://localhost:3001',

    // Collect trace when retrying a test
    trace: 'on-first-retry',

    // Record video only when retrying
    video: 'on-first-retry',

    // Take screenshot on failure
    screenshot: 'only-on-failure',

    // Ignore HTTPS errors for localhost
    ignoreHTTPSErrors: true,

    // User agent
    userAgent: 'WorkshopsAI-CMS-E2E-Tests',

    // Viewport size
    viewport: { width: 1280, height: 720 },

    // Accept downloads
    acceptDownloads: true,

    // Color scheme
    colorScheme: 'light',

    // Locale
    locale: 'en-US',

    // Timezone
    timezoneId: 'America/New_York',

    // Geolocation (disabled for privacy)
    geolocation: undefined,

    // Permissions
    permissions: ['clipboard-write'],

    // Extra HTTP headers
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br'
    }
  },

  // Browser-specific projects
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testMatch: '**/cross-browser-lit-element.test.ts',
      dependencies: ['setup'],
      teardown: 'cleanup'
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      testMatch: '**/cross-browser-lit-element.test.ts',
      dependencies: ['setup'],
      teardown: 'cleanup'
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      testMatch: '**/cross-browser-lit-element.test.ts',
      dependencies: ['setup'],
      teardown: 'cleanup'
    },

    {
      name: 'edge',
      use: { ...devices['Desktop Edge'], channel: 'msedge' },
      testMatch: '**/cross-browser-lit-element.test.ts',
      dependencies: ['setup'],
      teardown: 'cleanup'
    },

    // Mobile browsers
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
      testMatch: '**/cross-browser-lit-element.test.ts',
      dependencies: ['setup'],
      teardown: 'cleanup'
    },

    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 13'] },
      testMatch: '**/cross-browser-lit-element.test.ts',
      dependencies: ['setup'],
      teardown: 'cleanup'
    },

    // Tablet browsers
    {
      name: 'tablet-chrome',
      use: { ...devices['iPad Pro'] },
      testMatch: '**/cross-browser-lit-element.test.ts',
      dependencies: ['setup'],
      teardown: 'cleanup'
    },

    // Setup and teardown projects
    {
      name: 'setup',
      testMatch: '**/global-setup.ts',
      teardown: 'cleanup'
    },

    {
      name: 'cleanup',
      testMatch: '**/global-teardown.ts'
    }
  ],

  // Web server configuration
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3001',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    stdout: 'ignore',
    stderr: 'pipe'
  },

  // Output directory
  outputDir: 'test-results/',

  // Metadata
  metadata: {
    'Test Environment': 'Cross-Browser Testing',
    'Test Purpose': 'LitElement Compatibility Verification',
    'Browsers Tested': 'Chrome, Firefox, Safari, Edge, Mobile Chrome, Mobile Safari',
    'Test Framework': 'Playwright',
    'Target Standards': 'WCAG 2.2 AA, OWASP Top 10'
  },

  // Global test configuration
  grep: process.env.GREP,
  grepInvert: process.env.GREP_INVERT,

  // Test filters
  testIgnore: [
    '**/node_modules/**',
    '**/dist/**',
    '**/.git/**',
    '**/coverage/**'
  ]
});