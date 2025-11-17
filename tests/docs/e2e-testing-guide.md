# E2E Testing Guide

Comprehensive guide to End-to-End (E2E) testing with Playwright for the WorkshopsAI CMS project, covering complete user workflows, real-time features, and cross-browser testing.

## 📋 Table of Contents

- [E2E Testing Overview](#e2e-testing-overview)
- [Setting Up E2E Tests](#setting-up-e2e-tests)
- [Playwright Configuration](#playwright-configuration)
- [Page Object Model](#page-object-model)
- [User Workflow Testing](#user-workflow-testing)
- [Real-time Feature Testing](#real-time-feature-testing)
- [Cross-browser Testing](#cross-browser-testing)
- [Mobile Testing](#mobile-testing)
- [Accessibility Testing](#accessibility-testing)
- [Performance Testing](#performance-testing)
- [Visual Testing](#visual-testing)
- [Network Testing](#network-testing)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## 🎯 E2E Testing Overview

E2E testing validates complete user workflows by simulating real user interactions across the entire application stack. This guide covers:

- **User Workflows**: Complete user journeys from start to finish
- **Real-time Features**: WebSocket connections and live updates
- **Cross-browser Testing**: Testing across multiple browsers and devices
- **Accessibility Testing**: WCAG compliance and accessibility validation
- **Performance Testing**: User interface performance and responsiveness
- **Visual Testing**: Visual regression detection and UI validation

### Why E2E Testing?

- **User Perspective**: Tests from the user's point of view
- **Integration Validation**: Verifies all components work together
- **Confidence in Deployment**: High confidence in production readiness
- **Regression Prevention**: Catches breaking changes across the stack
- **Real-world Scenarios**: Tests actual user behavior and workflows

## ⚙️ Setting Up E2E Tests

### Prerequisites

```bash
# Install Playwright
npm install --save-dev @playwright/test

# Install browser binaries
npx playwright install

# Install browser dependencies (for Linux)
npx playwright install-deps

# Verify installation
npx playwright --version
```

### Environment Setup

```bash
# Create test environment file
cp .env.example .env.test

# Set test environment variables
NODE_ENV=test
BASE_URL=http://localhost:3001
TEST_DATABASE_URL=postgresql://test:test@localhost:5432/test_db
TEST_REDIS_URL=redis://localhost:6379/1
```

### Test Database Setup

```bash
# Start test database
docker-compose up -d postgres-test

# Run database migrations
npm run db:migrate:test

# Seed test data
npm run db:seed:test
```

## 🎭 Playwright Configuration

### Base Configuration

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',

  // Global test configuration
  timeout: 30000,
  expect: {
    timeout: 5000
  },

  // Retry configuration
  retries: process.env.CI ? 2 : 0,

  // Reporter configuration
  reporter: [
    ['html'],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['json', { outputFile: 'test-results/results.json' }],
    process.env.CI ? ['github'] : ['list']
  ],

  // Global setup and teardown
  globalSetup: './tests/e2e/global-setup.ts',
  globalTeardown: './tests/e2e/global-teardown.ts',

  // Use project-specific configurations
  projects: [
    // Desktop browsers
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    // Mobile browsers
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },

    // Tablet browsers
    {
      name: 'Tablet',
      use: { ...devices['iPad Pro'] },
    }
  ],

  // Web server configuration
  webServer: {
    command: 'npm run start:test',
    url: 'http://localhost:3001',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },

  // Output configuration
  outputDir: 'test-results/',

  // Test artifacts
  use: {
    // Screenshot configuration
    screenshot: 'only-on-failure',

    // Video configuration
    video: 'retain-on-failure',

    // Trace configuration
    trace: 'retain-on-failure',
  }
});
```

### Test Configuration

```typescript
// tests/e2e/fixtures/test-fixtures.ts
import { test as base, expect } from '@playwright/test';
import { TestDataManager } from '../utils/test-data-manager';
import { AuthHelpers } from '../utils/auth-helpers';

// Define custom fixtures
export const test = base.extend<{
  authenticatedPage: Page;
  testDataManager: TestDataManager;
  authHelpers: AuthHelpers;
}>({
  // Authenticated page fixture
  authenticatedPage: async ({ page, authHelpers }, use) => {
    await authHelpers.loginAsAdmin(page);
    await use(page);
    await authHelpers.logout(page);
  },

  // Test data manager fixture
  testDataManager: async ({}, use) => {
    const dataManager = new TestDataManager();
    await dataManager.setup();
    await use(dataManager);
    await dataManager.cleanup();
  },

  // Auth helpers fixture
  authHelpers: async ({ page }, use) => {
    const helpers = new AuthHelpers(page);
    await use(helpers);
  }
});

export { expect };
```

## 📄 Page Object Model

The Page Object Model (POM) pattern organizes E2E tests by separating page structure and interactions from test logic.

### Base Page Class

```typescript
// tests/e2e/pages/base-page.ts
import { Page, Locator } from '@playwright/test';

export abstract class BasePage {
  constructor(protected page: Page) {}

  // Navigation methods
  async goto(path: string = ''): Promise<void> {
    await this.page.goto(path);
  }

  async reload(): Promise<void> {
    await this.page.reload();
  }

  async goBack(): Promise<void> {
    await this.page.goBack();
  }

  async goForward(): Promise<void> {
    await this.page.goForward();
  }

  // Wait methods
  async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }

  async waitForElement(selector: string): Promise<Locator> {
    return this.page.waitForSelector(selector);
  }

  async waitForUrl(url: string | RegExp): Promise<void> {
    await this.page.waitForURL(url);
  }

  // Utility methods
  async getTitle(): Promise<string> {
    return await this.page.title();
  }

  async getUrl(): Promise<string> {
    return this.page.url();
  }

  async isElementVisible(selector: string): Promise<boolean> {
    return await this.page.locator(selector).isVisible();
  }

  async takeScreenshot(path?: string): Promise<Buffer> {
    return await this.page.screenshot({ path, fullPage: true });
  }

  // Error handling
  async waitForAndClick(selector: string, timeout: number = 5000): Promise<void> {
    await this.page.waitForSelector(selector, { timeout });
    await this.page.click(selector);
  }

  async waitForAndFill(selector: string, value: string, timeout: number = 5000): Promise<void> {
    await this.page.waitForSelector(selector, { timeout });
    await this.page.fill(selector, value);
  }
}
```

### Authentication Page

```typescript
// tests/e2e/pages/auth-page.ts
import { Page } from '@playwright/test';
import { BasePage } from './base-page';

export class AuthPage extends BasePage {
  // Locators
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly registerButton: Locator;
  readonly errorMessage: Locator;
  readonly successMessage: Locator;

  constructor(page: Page) {
    super(page);
    this.emailInput = page.locator('[data-testid="email-input"]');
    this.passwordInput = page.locator('[data-testid="password-input"]');
    this.loginButton = page.locator('[data-testid="login-button"]');
    this.registerButton = page.locator('[data-testid="register-button"]');
    this.errorMessage = page.locator('[data-testid="error-message"]');
    this.successMessage = page.locator('[data-testid="success-message"]');
  }

  // Navigation
  async gotoLogin(): Promise<void> {
    await this.goto('/login');
  }

  async gotoRegister(): Promise<void> {
    await this.goto('/register');
  }

  // Actions
  async login(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
  }

  async register(email: string, password: string, name: string): Promise<void> {
    await this.gotoRegister();
    await this.page.fill('[data-testid="name-input"]', name);
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.page.fill('[data-testid="confirm-password-input"]', password);
    await this.registerButton.click();
  }

  // Validation
  async isLoggedIn(): Promise<boolean> {
    await this.waitForUrl(/dashboard|questionnaires/);
    return !this.page.url().includes('/login');
  }

  async hasErrorMessage(): Promise<boolean> {
    return await this.errorMessage.isVisible();
  }

  async getErrorMessage(): Promise<string> {
    return await this.errorMessage.textContent() || '';
  }

  async getSuccessMessage(): Promise<string> {
    return await this.successMessage.textContent() || '';
  }
}
```

### Questionnaire Page

```typescript
// tests/e2e/pages/questionnaire-page.ts
import { Page } from '@playwright/test';
import { BasePage } from './base-page';

export class QuestionnairePage extends BasePage {
  // Locators
  readonly questionnaireTitle: Locator;
  readonly createQuestionnaireButton: Locator;
  readonly questionnaireList: Locator;
  readonly questionnaireItem: (title: string) => Locator;
  readonly editButton: (title: string) => Locator;
  readonly deleteButton: (title: string) => Locator;
  readonly analyzeButton: (title: string) => Locator;

  constructor(page: Page) {
    super(page);
    this.questionnaireTitle = page.locator('[data-testid="page-title"]');
    this.createQuestionnaireButton = page.locator('[data-testid="create-questionnaire"]');
    this.questionnaireList = page.locator('[data-testid="questionnaire-list"]');
    this.questionnaireItem = (title: string) =>
      page.locator(`[data-testid="questionnaire-item"][data-title="${title}"]`);
    this.editButton = (title: string) =>
      page.locator(`[data-testid="questionnaire-item"][data-title="${title}"] [data-testid="edit-button"]`);
    this.deleteButton = (title: string) =>
      page.locator(`[data-testid="questionnaire-item"][data-title="${title}"] [data-testid="delete-button"]`);
    this.analyzeButton = (title: string) =>
      page.locator(`[data-testid="questionnaire-item"][data-title="${title}"] [data-testid="analyze-button"]`);
  }

  // Navigation
  async gotoQuestionnaires(): Promise<void> {
    await this.goto('/questionnaires');
  }

  // Actions
  async createQuestionnaire(data: {
    title: string;
    description: string;
    questions: Array<{ text: string; type: string; options?: string[] }>;
  }): Promise<void> {
    await this.createQuestionnaireButton.click();

    await this.page.fill('[data-testid="questionnaire-title"]', data.title);
    await this.page.fill('[data-testid="questionnaire-description"]', data.description);

    // Add questions
    for (const question of data.questions) {
      await this.addQuestion(question);
    }

    await this.page.click('[data-testid="save-questionnaire"]');
  }

  private async addQuestion(question: {
    text: string;
    type: string;
    options?: string[];
  }): Promise<void> {
    await this.page.click('[data-testid="add-question"]');
    await this.page.fill('[data-testid="question-text"]', question.text);
    await this.page.selectOption('[data-testid="question-type"]', question.type);

    if (question.options && question.options.length > 0) {
      for (const option of question.options) {
        await this.page.click('[data-testid="add-option"]');
        await this.page.fill('[data-testid="option-text"]:last-child', option);
      }
    }

    await this.page.click('[data-testid="save-question"]');
  }

  async editQuestionnaire(title: string): Promise<void> {
    await this.editButton(title).click();
  }

  async deleteQuestionnaire(title: string): Promise<void> {
    await this.deleteButton(title).click();
    await this.page.click('[data-testid="confirm-delete"]');
  }

  async analyzeQuestionnaire(title: string): Promise<void> {
    await this.analyzeButton(title).click();
  }

  // Validation
  async hasQuestionnaire(title: string): Promise<boolean> {
    return await this.questionnaireItem(title).isVisible();
  }

  async getQuestionnaireCount(): Promise<number> {
    return await this.questionnaireList.locator('[data-testid="questionnaire-item"]').count();
  }

  async waitForQuestionnaireLoad(): Promise<void> {
    await this.page.waitForSelector('[data-testid="questionnaire-list"]');
    await this.page.waitForSelector('[data-testid="questionnaire-item"]');
  }
}
```

## 👤 User Workflow Testing

Complete user workflows test the entire user journey from start to finish.

### Complete Analysis Workflow

```typescript
// tests/e2e/complete-workflows/llm-analysis-e2e.spec.ts
import { test, expect } from '../../../fixtures/test-fixtures';
import { AuthPage } from '../pages/auth-page';
import { QuestionnairePage } from '../pages/questionnaire-page';
import { AnalysisPage } from '../pages/analysis-page';

test.describe('Complete LLM Analysis Workflow', () => {
  let authPage: AuthPage;
  let questionnairePage: QuestionnairePage;
  let analysisPage: AnalysisPage;

  test.beforeEach(async ({ authenticatedPage }) => {
    authPage = new AuthPage(authenticatedPage);
    questionnairePage = new QuestionnairePage(authenticatedPage);
    analysisPage = new AnalysisPage(authenticatedPage);
  });

  test('should complete full LLM analysis workflow', async ({ testDataManager }) => {
    // Step 1: Create questionnaire
    await questionnairePage.gotoQuestionnaires();
    await questionnairePage.createQuestionnaire({
      title: 'Customer Satisfaction Survey',
      description: 'Survey for measuring customer satisfaction',
      questions: [
        {
          text: 'How satisfied are you with our service?',
          type: 'multiple-choice',
          options: ['Very satisfied', 'Satisfied', 'Neutral', 'Dissatisfied']
        },
        {
          text: 'What could we improve?',
          type: 'text'
        }
      ]
    });

    // Verify questionnaire created
    await expect(questionnairePage.hasQuestionnaire('Customer Satisfaction Survey')).toBeTruthy();

    // Step 2: Add sample answers (simulate user responses)
    const questionnaire = await testDataManager.createQuestionnaire({
      title: 'Customer Satisfaction Survey'
    });

    await testDataManager.createAnswersForQuestionnaire(questionnaire.id, 25, {
      responseRate: 0.8,
      completionRate: 0.6
    });

    // Step 3: Start LLM analysis
    await questionnairePage.analyzeQuestionnaire('Customer Satisfaction Survey');

    // Verify analysis started
    await analysisPage.waitForAnalysisStart();
    await expect(analysisPage.getAnalysisStatus()).toBe('processing');

    // Step 4: Monitor streaming progress
    const streamingContent = await analysisPage.monitorStreamingAnalysis();

    expect(streamingContent.length).toBeGreaterThan(0);
    expect(streamingContent.join('')).toContain('satisfaction');

    // Step 5: Wait for completion and verify results
    await analysisPage.waitForAnalysisCompletion();

    const results = await analysisPage.getAnalysisResults();
    expect(results).toHaveProperty('summary');
    expect(results).toHaveProperty('insights');
    expect(results).toHaveProperty('recommendations');
    expect(results.summary).toContain('customer satisfaction');

    // Step 6: Export results
    await analysisPage.exportResults('pdf');

    // Verify download started
    const download = await analysisPage.waitForDownload();
    expect(download.suggestedFilename()).toMatch(/analysis.*\.pdf$/);

    // Step 7: Share results
    await analysisPage.shareResults();
    await analysisPage.enterShareEmail('colleague@example.com');
    await analysisPage.confirmShare();

    // Verify share confirmation
    await expect(analysisPage.getShareConfirmation()).toContain('results shared');
  });

  test('should handle analysis workflow with errors gracefully', async ({ page }) => {
    // Create questionnaire
    await questionnairePage.gotoQuestionnaires();
    await questionnairePage.createQuestionnaire({
      title: 'Error Test Questionnaire',
      description: 'Questionnaire for testing error handling',
      questions: [
        { text: 'Test question', type: 'text' }
      ]
    });

    // Start analysis with simulated API error
    await page.route('/api/analysis/llm', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' })
      });
    });

    await questionnairePage.analyzeQuestionnaire('Error Test Questionnaire');

    // Verify error handling
    await analysisPage.waitForAnalysisError();
    await expect(analysisPage.getErrorMessage()).toContain('analysis failed');

    // Verify retry functionality
    await analysisPage.retryAnalysis();

    // Remove error simulation
    await page.unroute('/api/analysis/llm');

    // Verify analysis proceeds after retry
    await analysisPage.waitForAnalysisStart();
    await expect(analysisPage.getAnalysisStatus()).toBe('processing');
  });

  test('should support concurrent analysis workflows', async ({ page }) => {
    // Create multiple questionnaires
    const questionnaires = [
      'Customer Feedback Survey',
      'Employee Satisfaction Survey',
      'Product Review Survey'
    ];

    for (const title of questionnaires) {
      await questionnairePage.createQuestionnaire({
        title,
        description: `Survey for ${title}`,
        questions: [
          { text: 'Rate your experience', type: 'multiple-choice', options: ['1', '2', '3', '4', '5'] }
        ]
      });
    }

    // Start concurrent analyses
    const analysisPromises = questionnaires.map(title =>
      questionnairePage.analyzeQuestionnaire(title)
    );

    await Promise.all(analysisPromises);

    // Verify all analyses started
    await analysisPage.waitForMultipleAnalyses(questionnaires.length);

    // Monitor all analyses
    const statuses = await analysisPage.getAllAnalysisStatuses();
    expect(statuses.length).toBe(questionnaires.length);

    // Wait for all to complete
    await analysisPage.waitForAllAnalysesCompletion();

    // Verify all completed successfully
    const finalStatuses = await analysisPage.getAllAnalysisStatuses();
    finalStatuses.forEach(status => {
      expect(status).toBe('completed');
    });
  });
});
```

### User Management Workflow

```typescript
// tests/e2e/complete-workflows/user-management-e2e.spec.ts
import { test, expect } from '../../../fixtures/test-fixtures';
import { AuthPage } from '../pages/auth-page';
import { UserManagementPage } from '../pages/user-management-page';

test.describe('User Management Workflow', () => {
  let authPage: AuthPage;
  let userManagementPage: UserManagementPage;

  test.beforeEach(async ({ authenticatedPage }) => {
    authPage = new AuthPage(authenticatedPage);
    userManagementPage = new UserManagementPage(authenticatedPage);
  });

  test('should complete user onboarding workflow', async ({ page }) => {
    // Step 1: Registration
    await authPage.gotoRegister();
    await authPage.register(
      'newuser@example.com',
      'SecurePassword123!',
      'New User'
    );

    // Verify successful registration
    await expect(authPage.getSuccessMessage()).toContain('registration successful');
    await expect(authPage.isLoggedIn()).toBeTruthy();

    // Step 2: Profile setup
    await page.click('[data-testid="complete-profile"]');
    await page.fill('[data-testid="job-title"]', 'Product Manager');
    await page.fill('[data-testid="company"]', 'Test Corp');
    await page.selectOption('[data-testid="industry"]', 'technology');
    await page.click('[data-testid="save-profile"]');

    // Verify profile saved
    await expect(page.locator('[data-testid="profile-saved"]')).toBeVisible();

    // Step 3: First questionnaire creation
    await page.click('[data-testid="create-first-questionnaire"]');
    await page.fill('[data-testid="questionnaire-title"]', 'My First Survey');
    await page.fill('[data-testid="questionnaire-description"]', 'This is my first survey');
    await page.click('[data-testid="add-question"]');
    await page.fill('[data-testid="question-text"]', 'How did you hear about us?');
    await page.selectOption('[data-testid="question-type"]', 'multiple-choice');
    await page.fill('[data-testid="option-text"]', 'Social Media');
    await page.click('[data-testid="add-option"]');
    await page.fill('[data-testid="option-text"]:last-child', 'Friend');
    await page.click('[data-testid="save-question"]');
    await page.click('[data-testid="publish-questionnaire"]');

    // Verify questionnaire published
    await expect(page.locator('[data-testid="questionnaire-published"]')).toBeVisible();

    // Step 4: Dashboard navigation
    await page.click('[data-testid="dashboard-link"]');
    await expect(page.locator('[data-testid="dashboard-stats"]')).toBeVisible();
    await expect(page.locator('[data-testid="recent-questionnaires"]')).toBeVisible();
    await expect(page.locator('[data-testid="quick-actions"]')).toBeVisible();

    // Verify user data in dashboard
    await expect(page.locator('[data-testid="user-name"]')).toContain('New User');
    await expect(page.locator('[data-testid="user-email"]')).toContain('newuser@example.com');
  });

  test('should handle user role management workflow', async ({ page }) => {
    // Admin creates new user
    await userManagementPage.gotoUsers();
    await userManagementPage.clickCreateUser();
    await userManagementPage.fillUserForm({
      email: 'manager@example.com',
      name: 'Manager User',
      role: 'manager',
      department: 'Analytics'
    });
    await userManagementPage.saveUser();

    // Verify user created
    await expect(userManagementPage.hasUser('manager@example.com')).toBeTruthy();

    // Login as manager
    await authPage.gotoLogin();
    await authPage.login('manager@example.com', 'DefaultPassword123!');

    // Verify manager permissions
    await expect(page.locator('[data-testid="analytics-link"]')).toBeVisible();
    await expect(page.locator('[data-testid="user-management-link"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="system-settings-link"]')).not.toBeVisible();

    // Admin upgrades user to admin
    await authPage.gotoLogin();
    await authPage.login('admin@example.com', 'AdminPassword123!');
    await userManagementPage.gotoUsers();
    await userManagementPage.editUser('manager@example.com');
    await userManagementPage.changeRole('admin');
    await userManagementPage.saveUser();

    // Verify role upgrade
    await authPage.login('manager@example.com', 'DefaultPassword123!');
    await expect(page.locator('[data-testid="user-management-link"]')).toBeVisible();
    await expect(page.locator('[data-testid="system-settings-link"]')).toBeVisible();
  });
});
```

## 🔄 Real-time Feature Testing

Testing WebSocket connections, live updates, and real-time features.

### WebSocket Connection Testing

```typescript
// tests/e2e/real-time/websocket-e2e.spec.ts
import { test, expect } from '../../../fixtures/test-fixtures';

test.describe('WebSocket Real-time Features', () => {
  test('should establish WebSocket connection for live analysis updates', async ({ page }) => {
    // Monitor WebSocket connections
    const wsMessages: any[] = [];
    page.on('websocket', ws => {
      ws.on('framereceived', event => {
        wsMessages.push(JSON.parse(event.payload as string));
      });
    });

    // Navigate to analysis page
    await page.goto('/analysis/123');

    // Start analysis
    await page.click('[data-testid="start-analysis"]');

    // Wait for WebSocket connection
    await page.waitForSelector('[data-testid="ws-status"]:has-text("Connected")');

    // Verify initial connection message
    expect(wsMessages.some(msg => msg.type === 'connection_established')).toBeTruthy();

    // Monitor streaming updates
    await page.waitForTimeout(5000);

    // Verify streaming messages
    const streamingMessages = wsMessages.filter(msg => msg.type === 'analysis_chunk');
    expect(streamingMessages.length).toBeGreaterThan(0);

    // Verify message structure
    streamingMessages.forEach(msg => {
      expect(msg).toHaveProperty('chunkId');
      expect(msg).toHaveProperty('content');
      expect(msg).toHaveProperty('timestamp');
    });

    // Wait for completion
    await page.waitForSelector('[data-testid="analysis-status"]:has-text("Completed")');

    // Verify completion message
    expect(wsMessages.some(msg => msg.type === 'analysis_completed')).toBeTruthy();
  });

  test('should handle WebSocket reconnection automatically', async ({ page }) => {
    // Navigate to dashboard with real-time updates
    await page.goto('/dashboard');

    // Monitor WebSocket status
    await page.waitForSelector('[data-testid="ws-status"]:has-text("Connected")');

    // Simulate network disconnection
    await page.context().setOffline(true);

    // Verify disconnection detected
    await page.waitForSelector('[data-testid="ws-status"]:has-text("Disconnected")');
    await page.waitForSelector('[data-testid="reconnecting-indicator"]');

    // Simulate network restoration
    await page.context().setOffline(false);

    // Verify automatic reconnection
    await page.waitForSelector('[data-testid="ws-status"]:has-text("Connected")');
    await page.waitForSelector('[data-testid="reconnect-success"]');

    // Verify data continues to flow after reconnection
    const initialStats = await page.locator('[data-testid="dashboard-stats"]').textContent();
    await page.waitForTimeout(3000);
    const updatedStats = await page.locator('[data-testid="dashboard-stats"]').textContent();

    expect(updatedStats).not.toBe(initialStats);
  });

  test('should handle concurrent WebSocket connections efficiently', async ({ page }) => {
    // Open multiple tabs with WebSocket connections
    const contexts = [];
    const pages = [];

    for (let i = 0; i < 5; i++) {
      const context = await page.context().browser().newContext();
      const newPage = await context.newPage();

      await newPage.goto('/dashboard');
      await newPage.waitForSelector('[data-testid="ws-status"]:has-text("Connected")');

      contexts.push(context);
      pages.push(newPage);
    }

    // Start real-time operation in all tabs
    const operations = pages.map(newPage =>
      newPage.click('[data-testid="start-real-time-analysis"]')
    );

    await Promise.all(operations);

    // Verify all tabs receive updates
    const updatePromises = pages.map(newPage =>
      newPage.waitForSelector('[data-testid="real-time-update"]', { timeout: 10000 })
    );

    await Promise.all(updatePromises);

    // Check connection status in all tabs
    for (const newPage of pages) {
      await expect(newPage.locator('[data-testid="ws-status"]')).toHaveText('Connected');
    }

    // Cleanup
    for (const context of contexts) {
      await context.close();
    }
  });
});
```

### Live Dashboard Testing

```typescript
// tests/e2e/real-time/live-dashboard-e2e.spec.ts
import { test, expect } from '../../../fixtures/test-fixtures';

test.describe('Live Dashboard Features', () => {
  test('should display real-time metrics updates', async ({ page }) => {
    await page.goto('/dashboard');

    // Wait for initial dashboard load
    await page.waitForSelector('[data-testid="dashboard-loaded"]');

    // Get initial metrics
    const initialMetrics = await page.evaluate(() => {
      return {
        totalQuestionnaires: parseInt(document.querySelector('[data-testid="total-questionnaires"]')?.textContent || '0'),
        totalResponses: parseInt(document.querySelector('[data-testid="total-responses"]')?.textContent || '0'),
        activeAnalyses: parseInt(document.querySelector('[data-testid="active-analyses"]')?.textContent || '0')
      };
    });

    // Simulate real-time data updates
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('metrics-update', {
        detail: {
          totalQuestionnaires: initialMetrics.totalQuestionnaires + 1,
          totalResponses: initialMetrics.totalResponses + 10,
          activeAnalyses: initialMetrics.activeAnalyses + 2
        }
      }));
    });

    // Verify metrics updated
    await page.waitForSelector('[data-testid="metrics-updated"]');

    const updatedMetrics = await page.evaluate(() => {
      return {
        totalQuestionnaires: parseInt(document.querySelector('[data-testid="total-questionnaires"]')?.textContent || '0'),
        totalResponses: parseInt(document.querySelector('[data-testid="total-responses"]')?.textContent || '0'),
        activeAnalyses: parseInt(document.querySelector('[data-testid="active-analyses"]')?.textContent || '0')
      };
    });

    expect(updatedMetrics.totalQuestionnaires).toBe(initialMetrics.totalQuestionnaires + 1);
    expect(updatedMetrics.totalResponses).toBe(initialMetrics.totalResponses + 10);
    expect(updatedMetrics.activeAnalyses).toBe(initialMetrics.activeAnalyses + 2);
  });

  test('should handle real-time chart updates', async ({ page }) => {
    await page.goto('/dashboard');

    // Wait for charts to load
    await page.waitForSelector('[data-testid="response-time-chart"]');
    await page.waitForSelector('[data-testid="throughput-chart"]');

    // Get initial chart data
    const initialChartData = await page.evaluate(() => {
      const chart = document.querySelector('[data-testid="response-time-chart"]');
      return chart ? JSON.parse(chart.getAttribute('data-chart-points') || '[]') : [];
    });

    // Simulate real-time chart data updates
    await page.evaluate((initialData) => {
      const newData = [...initialData];
      newData.push({
        timestamp: Date.now(),
        responseTime: Math.random() * 1000,
        throughput: Math.random() * 100
      });

      window.dispatchEvent(new CustomEvent('chart-update', {
        detail: {
          chartId: 'response-time-chart',
          data: newData.slice(-50) // Keep last 50 points
        }
      }));
    }, initialChartData);

    // Verify chart updated
    await page.waitForSelector('[data-testid="response-time-chart"][data-updated="true"]');

    const updatedChartData = await page.evaluate(() => {
      const chart = document.querySelector('[data-testid="response-time-chart"]');
      return chart ? JSON.parse(chart.getAttribute('data-chart-points') || '[]') : [];
    });

    expect(updatedChartData.length).toBeGreaterThan(initialChartData.length);
  });
});
```

## 🌐 Cross-browser Testing

Testing across multiple browsers to ensure consistent user experience.

### Cross-browser Compatibility Tests

```typescript
// tests/e2e/cross-browser/cross-browser-compatibility.spec.ts
import { test, expect } from '@playwright/test';

test.describe.configure({ mode: 'parallel' });

test.describe('Cross-browser Compatibility', () => {
  test('should work consistently across Chrome, Firefox, and Safari', async ({ page, browserName }) => {
    // Navigate to application
    await page.goto('/');

    // Test basic functionality
    await page.click('[data-testid="get-started"]');
    await page.fill('[data-testid="email"]', 'test@example.com');
    await page.fill('[data-testid="password"]', 'password123');
    await page.click('[data-testid="login"]');

    // Verify successful login
    await expect(page.locator('[data-testid="dashboard"]')).toBeVisible();

    // Test questionnaire creation
    await page.click('[data-testid="create-questionnaire"]');
    await page.fill('[data-testid="title"]', 'Test Questionnaire');
    await page.fill('[data-testid="description"]', 'Test Description');
    await page.click('[data-testid="add-question"]');
    await page.fill('[data-testid="question-text"]', 'Test Question');
    await page.click('[data-testid="save-questionnaire"]');

    // Verify questionnaire created
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();

    // Browser-specific assertions
    switch (browserName) {
      case 'chromium':
        // Chrome-specific tests
        await expect(page.locator('[data-testid="chrome-feature"]')).toBeVisible();
        break;
      case 'firefox':
        // Firefox-specific tests
        await expect(page.locator('[data-testid="firefox-feature"]')).toBeVisible();
        break;
      case 'webkit':
        // Safari-specific tests
        await expect(page.locator('[data-testid="safari-feature"]')).toBeVisible();
        break;
    }

    // Test responsive design
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('[data-testid="mobile-nav"]')).toBeVisible();

    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();
  });

  test('should handle browser-specific CSS features', async ({ page, browserName }) => {
    await page.goto('/questionnaires');

    // Test CSS Grid support
    const gridSupported = await page.evaluate(() => CSS.supports('display', 'grid'));
    if (gridSupported) {
      await expect(page.locator('[data-testid="grid-layout"]')).toBeVisible();
    }

    // Test Flexbox support
    const flexboxSupported = await page.evaluate(() => CSS.supports('display', 'flex'));
    if (flexboxSupported) {
      await expect(page.locator('[data-testid="flex-layout"]')).toBeVisible();
    }

    // Test browser-specific features
    if (browserName === 'webkit') {
      // Safari-specific features
      await expect(page.locator('[data-testid="safari-backdrop-filter"]')).toBeVisible();
    }

    if (browserName === 'chromium') {
      // Chrome-specific features
      await expect(page.locator('[data-testid="chrome-scroll-snap"]')).toBeVisible();
    }
  });
});
```

### Browser Performance Tests

```typescript
// tests/e2e/cross-browser/browser-performance.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Browser Performance', () => {
  test('should meet performance thresholds across browsers', async ({ page, browserName }) => {
    // Start performance monitoring
    await page.goto('/');

    // Measure Core Web Vitals
    const vitals = await page.evaluate(() => {
      return new Promise((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const vitals = {};

          entries.forEach((entry) => {
            if (entry.name === 'first-contentful-paint') {
              vitals.fcp = entry.startTime;
            }
            if (entry.name === 'largest-contentful-paint') {
              vitals.lcp = entry.startTime;
            }
            if (entry.name === 'first-input-delay') {
              vitals.fid = entry.processingStart - entry.startTime;
            }
            if (entry.name === 'cumulative-layout-shift') {
              vitals.cls = entry.value;
            }
          });

          resolve(vitals);
        }).observe({ entryTypes: ['paint', 'largest-contentful-paint', 'first-input', 'layout-shift'] });
      });
    });

    // Performance thresholds vary by browser
    const thresholds = {
      chromium: { fcp: 1500, lcp: 2500, fid: 100, cls: 0.1 },
      firefox: { fcp: 2000, lcp: 3000, fid: 150, cls: 0.15 },
      webkit: { fcp: 1800, lcp: 2800, fid: 120, cls: 0.12 }
    };

    const browserThresholds = thresholds[browserName as keyof typeof thresholds];

    expect(vitals.fcp).toBeLessThan(browserThresholds.fcp);
    expect(vitals.lcp).toBeLessThan(browserThresholds.lcp);
    if (vitals.fid) expect(vitals.fid).toBeLessThan(browserThresholds.fid);
    if (vitals.cls) expect(vitals.cls).toBeLessThan(browserThresholds.cls);
  });

  test('should handle memory usage efficiently', async ({ page, browserName }) => {
    await page.goto('/performance-test');

    // Measure initial memory usage
    const initialMemory = await page.evaluate(() => {
      return performance.memory ? performance.memory.usedJSHeapSize : 0;
    });

    // Perform memory-intensive operations
    for (let i = 0; i < 100; i++) {
      await page.click('[data-testid="create-large-chart"]');
      await page.waitForSelector('[data-testid="chart-rendered"]');
      await page.click('[data-testid="clear-chart"]');
    }

    // Force garbage collection if available
    await page.evaluate(() => {
      if (window.gc) window.gc();
    });

    // Measure final memory usage
    const finalMemory = await page.evaluate(() => {
      return performance.memory ? performance.memory.usedJSHeapSize : 0;
    });

    const memoryIncrease = finalMemory - initialMemory;
    const memoryThreshold = 50 * 1024 * 1024; // 50MB

    expect(memoryIncrease).toBeLessThan(memoryThreshold);
  });
});
```

## 📱 Mobile Testing

Testing mobile responsiveness and touch interactions.

### Mobile Responsiveness Tests

```typescript
// tests/e2e/mobile/mobile-responsiveness.spec.ts
import { test, devices, expect } from '@playwright/test';

const mobileDevices = [
  devices['iPhone 12'],
  devices['Pixel 5'],
  devices['Galaxy S9+']
];

test.describe('Mobile Responsiveness', () => {
  mobileDevices.forEach(device => {
    test(`should work correctly on ${device.name}`, async ({ page }) => {
      // Use device-specific viewport
      await page.setViewportSize(device.viewport);

      // Navigate to mobile site
      await page.goto('/');

      // Test mobile navigation
      await expect(page.locator('[data-testid="mobile-nav-toggle"]')).toBeVisible();
      await page.click('[data-testid="mobile-nav-toggle"]');
      await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();

      // Test touch interactions
      await page.tap('[data-testid="get-started-button"]');
      await expect(page.locator('[data-testid="signup-form"]')).toBeVisible();

      // Test mobile form input
      await page.tap('[data-testid="email-input"]');
      await page.fill('[data-testid="email-input"]', 'mobile@example.com');
      await page.tap('[data-testid="password-input"]');
      await page.fill('[data-testid="password-input"]', 'password123');

      // Test mobile keyboard
      await expect(page.locator('[data-testid="virtual-keyboard"]')).toBeVisible();

      // Test scroll behavior
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await expect(page.locator('[data-testid="footer"]')).toBeVisible();

      // Test orientation change
      await page.setViewportSize({
        width: device.viewport.height,
        height: device.viewport.width
      });

      await expect(page.locator('[data-testid="orientation-landscape"]')).toBeVisible();
    });
  });

  test('should handle touch gestures correctly', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/dashboard');

    // Test swipe gestures
    await page.evaluate(() => {
      const carousel = document.querySelector('[data-testid="carousel"]');
      if (carousel) {
        const touchStart = new TouchEvent('touchstart', {
          touches: [{ clientX: 300, clientY: 200 }]
        });
        const touchEnd = new TouchEvent('touchend', {
          touches: [{ clientX: 100, clientY: 200 }]
        });

        carousel.dispatchEvent(touchStart);
        setTimeout(() => carousel.dispatchEvent(touchEnd), 100);
      }
    });

    // Test pinch-to-zoom
    await page.evaluate(() => {
      const image = document.querySelector('[data-testid="zoomable-image"]');
      if (image) {
        const touchStart = new TouchEvent('touchstart', {
          touches: [
            { clientX: 100, clientY: 100 },
            { clientX: 200, clientY: 200 }
          ]
        });

        image.dispatchEvent(touchStart);
      }
    });

    // Test long press
    await page.tap('[data-testid="pressable-element"]');
    await page.touchstart('[data-testid="pressable-element"]', {
      position: { x: 150, y: 300 }
    });
    await page.waitForTimeout(1000);
    await page.touchend('[data-testid="pressable-element"]');

    await expect(page.locator('[data-testid="context-menu"]')).toBeVisible();
  });

  test('should optimize mobile performance', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/performance-test');

    // Test image lazy loading
    const images = await page.locator('[data-testid="lazy-image"]').count();
    const visibleImages = await page.locator('[data-testid="lazy-image"]:visible').count();

    expect(visibleImages).toBeLessThan(images);

    // Test infinite scroll
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForSelector('[data-testid="loading-more"]');
    await page.waitForSelector('[data-testid="more-content"]');

    // Test mobile-specific optimizations
    const hasOptimizedImages = await page.evaluate(() => {
      const images = document.querySelectorAll('img');
      return Array.from(images).every(img =>
        img.src.includes('mobile') || img.loading === 'lazy'
      );
    });

    expect(hasOptimizedImages).toBeTruthy();
  });
});
```

## ♿ Accessibility Testing

Testing WCAG compliance and accessibility features.

### Accessibility Compliance Tests

```typescript
// tests/e2e/accessibility/accessibility.spec.ts
import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';

test.describe('Accessibility Compliance', () => {
  test.beforeEach(async ({ page }) => {
    await injectAxe(page);
  });

  test('should meet WCAG 2.1 AA standards', async ({ page }) => {
    await page.goto('/');

    // Check accessibility violations
    await checkA11y(page, null, {
      detailedReport: true,
      detailedReportOptions: { html: true },
      reporter: 'v2',
      rules: {
        // Custom rules configuration
        'color-contrast': { enabled: true },
        'keyboard-navigation': { enabled: true },
        'aria-labels': { enabled: true },
        'focus-order': { enabled: true }
      }
    });
  });

  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/questionnaires');

    // Test tab navigation
    let focusedElement = page.locator(':focus');

    // Tab through all interactive elements
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('Tab');
      focusedElement = page.locator(':focus');

      // Verify element is focusable
      const tagName = await focusedElement.evaluate(el => el.tagName.toLowerCase());
      expect(['button', 'input', 'select', 'textarea', 'a', '[tabindex]']).toContain(tagName);

      // Verify focus indicator
      const hasFocusIndicator = await focusedElement.evaluate(el => {
        const style = window.getComputedStyle(el);
        return style.outline !== 'none' || style.boxShadow !== 'none';
      });

      expect(hasFocusIndicator).toBeTruthy();
    }

    // Test Enter/Space on buttons
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');

    // Test arrow key navigation in menus
    await page.keyboard.press('Tab');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    // Test Escape key for modals
    await page.click('[data-testid="open-modal"]');
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="modal"]')).not.toBeVisible();
  });

  test('should have proper ARIA labels and roles', async ({ page }) => {
    await page.goto('/dashboard');

    // Check ARIA labels
    const interactiveElements = await page.locator('button, input, select, textarea, a').all();

    for (const element of interactiveElements.slice(0, 10)) {
      const ariaLabel = await element.getAttribute('aria-label');
      const ariaLabelledBy = await element.getAttribute('aria-labelledby');
      const title = await element.getAttribute('title');
      const text = await element.textContent();

      // Element should have accessible name
      const hasAccessibleName = !!(ariaLabel || ariaLabelledBy || title || text);
      expect(hasAccessibleName).toBeTruthy();
    }

    // Check ARIA roles
    const landmarks = await page.locator('[role]').all();
    expect(landmarks.length).toBeGreaterThan(0);

    // Check live regions
    const liveRegions = await page.locator('[aria-live], [aria-atomic]').all();
    if (liveRegions.length > 0) {
      // Test live region announcements
      await page.click('[data-testid="trigger-announcement"]');
      await expect(page.locator('[data-testid="live-region"]')).toBeVisible();
    }
  });

  test('should support screen readers', async ({ page }) => {
    await page.goto('/analysis/123');

    // Test semantic HTML
    const semanticElements = await page.locator('header, nav, main, section, article, aside, footer').all();
    expect(semanticElements.length).toBeGreaterThan(0);

    // Test heading hierarchy
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();
    let previousLevel = 0;

    for (const heading of headings.slice(0, 10)) {
      const level = parseInt(await heading.evaluate(el => el.tagName.substring(1)));
      expect(level).toBeLessThanOrEqual(previousLevel + 1);
      previousLevel = level;
    }

    // Test alt text for images
    const images = await page.locator('img').all();
    for (const image of images.slice(0, 5)) {
      const alt = await image.getAttribute('alt');
      const role = await image.getAttribute('role');

      if (role !== 'presentation') {
        expect(alt).toBeTruthy();
      }
    }

    // Test form labels
    const formControls = await page.locator('input, select, textarea').all();
    for (const control of formControls.slice(0, 5)) {
      const id = await control.getAttribute('id');
      const ariaLabel = await control.getAttribute('aria-label');
      const ariaLabelledBy = await control.getAttribute('aria-labelledby');

      if (!ariaLabel && !ariaLabelledBy) {
        expect(id).toBeTruthy();
        const label = await page.locator(`label[for="${id}"]`);
        await expect(label).toBeVisible();
      }
    }
  });

  test('should handle color contrast requirements', async ({ page }) => {
    await page.goto('/questionnaires');

    // Check color contrast for text elements
    const textElements = await page.locator('[data-testid="contrast-test"]').all();

    for (const element of textElements.slice(0, 5)) {
      const styles = await element.evaluate(el => {
        const computedStyle = window.getComputedStyle(el);
        return {
          color: computedStyle.color,
          backgroundColor: computedStyle.backgroundColor,
          fontSize: computedStyle.fontSize
        };
      });

      // Basic contrast check (would use proper contrast calculation in production)
      expect(styles.color).toBeDefined();
      expect(styles.backgroundColor).toBeDefined();

      // WCAG requires 4.5:1 contrast for normal text, 3:1 for large text
      const isLargeText = parseFloat(styles.fontSize) >= 18;
      const requiredRatio = isLargeText ? 3 : 4.5;

      // This would be replaced with actual contrast calculation
      console.log(`Checking contrast for element with fontSize: ${styles.fontSize}`);
    }
  });
});
```

## 📊 Performance Testing

Testing user interface performance and responsiveness.

### UI Performance Tests

```typescript
// tests/e2e/performance/ui-performance.spec.ts
import { test, expect } from '@playwright/test';

test.describe('UI Performance', () => {
  test('should load pages within performance budgets', async ({ page }) => {
    // Define performance budgets
    const budgets = {
      fcp: 1500, // First Contentful Paint
      lcp: 2500, // Largest Contentful Paint
      tti: 3500, // Time to Interactive
      cls: 0.1,  // Cumulative Layout Shift
      fid: 100   // First Input Delay
    };

    // Navigate to page and collect metrics
    const metrics = await page.goto('/dashboard', {
      waitUntil: 'networkidle'
    }).then(async () => {
      return await page.evaluate(() => {
        return new Promise((resolve) => {
          const observer = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const metrics = {};

            entries.forEach((entry) => {
              switch (entry.entryType) {
                case 'navigation':
                  metrics.domContentLoaded = entry.domContentLoadedEventEnd;
                  metrics.loadComplete = entry.loadEventEnd;
                  break;
                case 'paint':
                  if (entry.name === 'first-contentful-paint') {
                    metrics.fcp = entry.startTime;
                  }
                  break;
                case 'largest-contentful-paint':
                  metrics.lcp = entry.startTime;
                  break;
                case 'layout-shift':
                  metrics.cls = (metrics.cls || 0) + entry.value;
                  break;
                case 'first-input':
                  metrics.fid = entry.processingStart - entry.startTime;
                  break;
              }
            });

            resolve(metrics);
          });

          observer.observe({
            entryTypes: ['navigation', 'paint', 'largest-contentful-paint', 'layout-shift', 'first-input']
          });
        });
      });
    });

    // Verify metrics against budgets
    expect(metrics.fcp).toBeLessThan(budgets.fcp);
    expect(metrics.lcp).toBeLessThan(budgets.lcp);
    expect(metrics.cls).toBeLessThan(budgets.cls);
    if (metrics.fid) expect(metrics.fid).toBeLessThan(budgets.fid);
  });

  test('should handle large datasets efficiently', async ({ page }) => {
    await page.goto('/questionnaires');

    // Test with large dataset
    const startTime = Date.now();

    // Load large questionnaire dataset
    await page.click('[data-testid="load-large-dataset"]');
    await page.waitForSelector('[data-testid="dataset-loaded"]');

    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(5000); // <5 seconds

    // Test virtual scrolling
    const container = page.locator('[data-testid="virtual-scroll-container"]');
    await container.scrollIntoViewIfNeeded();

    // Scroll to bottom and verify performance
    const scrollStart = Date.now();
    await page.evaluate(() => {
      const container = document.querySelector('[data-testid="virtual-scroll-container"]');
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    });

    const scrollTime = Date.now() - scrollStart;
    expect(scrollTime).toBeLessThan(1000); // <1 second

    // Test filtering performance
    const filterStart = Date.now();
    await page.fill('[data-testid="search-input"]', 'test query');
    await page.waitForSelector('[data-testid="filter-results"]');

    const filterTime = Date.now() - filterStart;
    expect(filterTime).toBeLessThan(500); // <500ms
  });

  test('should maintain responsiveness during animations', async ({ page }) => {
    await page.goto('/animations');

    // Test CSS animations
    await page.click('[data-testid="start-animation"]');

    const animationStart = Date.now();
    await page.waitForSelector('[data-testid="animation-complete"]');
    const animationTime = Date.now() - animationStart;

    expect(animationTime).toBeLessThan(2000); // <2 seconds

    // Test JavaScript animations
    await page.click('[data-testid="start-js-animation"]');

    const jsAnimationStart = Date.now();
    await page.waitForSelector('[data-testid="js-animation-complete"]');
    const jsAnimationTime = Date.now() - jsAnimationStart;

    expect(jsAnimationTime).toBeLessThan(3000); // <3 seconds

    // Test animation performance
    const frameRate = await page.evaluate(() => {
      return new Promise((resolve) => {
        let frames = 0;
        const startTime = performance.now();

        function countFrames() {
          frames++;
          if (performance.now() - startTime < 1000) {
            requestAnimationFrame(countFrames);
          } else {
            resolve(frames);
          }
        }

        requestAnimationFrame(countFrames);
      });
    });

    expect(frameRate).toBeGreaterThan(30); // >30 FPS
  });
});
```

## 🎨 Visual Testing

Testing visual consistency and detecting UI regressions.

### Visual Regression Tests

```typescript
// tests/e2e/visual/visual-regression.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Visual Regression Testing', () => {
  test('should match visual baseline for key pages', async ({ page }) => {
    const pages = [
      '/',
      '/questionnaires',
      '/dashboard',
      '/analytics',
      '/settings'
    ];

    for (const pagePath of pages) {
      await page.goto(pagePath);
      await page.waitForLoadState('networkidle');

      // Take full page screenshot
      await expect(page).toHaveScreenshot(`${pagePath.replace(/\//g, '_')}.png`, {
        fullPage: true,
        animations: 'disabled'
      });
    }
  });

  test('should match visual baseline for components', async ({ page }) => {
    await page.goto('/components');

    const components = [
      '[data-testid="questionnaire-card"]',
      '[data-testid="analysis-chart"]',
      '[data-testid="user-avatar"]',
      '[data-testid="status-badge"]',
      '[data-testid="action-button"]'
    ];

    for (const componentSelector of components) {
      const component = page.locator(componentSelector).first();
      await component.scrollIntoViewIfNeeded();

      // Take component screenshot
      const componentName = componentSelector.replace(/\W/g, '_');
      await expect(component).toHaveScreenshot(`component_${componentName}.png`);
    }
  });

  test('should handle responsive design correctly', async ({ page }) => {
    const viewports = [
      { width: 1920, height: 1080, name: 'desktop' },
      { width: 1024, height: 768, name: 'tablet' },
      { width: 375, height: 667, name: 'mobile' }
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      // Take screenshot for each viewport
      await expect(page).toHaveScreenshot(`dashboard_${viewport.name}.png`, {
        fullPage: true
      });
    }
  });

  test('should handle different themes correctly', async ({ page }) => {
    const themes = ['light', 'dark', 'high-contrast'];

    for (const theme of themes) {
      await page.goto('/');
      await page.click(`[data-testid="theme-toggle"]`);
      await page.click(`[data-testid="theme-${theme}"]`);
      await page.waitForTimeout(500); // Wait for theme transition

      await expect(page).toHaveScreenshot(`home_${theme}_theme.png`, {
        fullPage: true
      });
    }
  });
});
```

## 🌐 Network Testing

Testing network conditions and API interactions.

### Network Simulation Tests

```typescript
// tests/e2e/network/network-conditions.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Network Conditions', () => {
  test('should handle slow network conditions', async ({ page }) => {
    // Simulate slow 3G network
    await page.route('**/*', route => {
      // Simulate network delay
      setTimeout(() => {
        route.continue();
      }, 1000);
    });

    await page.goto('/');

    // Test loading indicators
    await expect(page.locator('[data-testid="loading-indicator"]')).toBeVisible();

    // Test timeout handling
    await page.waitForSelector('[data-testid="page-loaded"]', { timeout: 10000 });

    // Verify content loaded despite slow network
    await expect(page.locator('[data-testid="main-content"]')).toBeVisible();
  });

  test('should handle offline mode gracefully', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Go offline
    await page.context().setOffline(true);

    // Test offline indicator
    await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible();

    // Test cached content availability
    await expect(page.locator('[data-testid="cached-content"]')).toBeVisible();

    // Test actions disabled when offline
    await expect(page.locator('[data-testid="disabled-when-offline"]')).toBeDisabled();

    // Go back online
    await page.context().setOffline(false);

    // Test online restoration
    await expect(page.locator('[data-testid="online-indicator"]')).toBeVisible();
    await expect(page.locator('[data-testid="reconnecting"]')).not.toBeVisible();
  });

  test('should handle API failures gracefully', async ({ page }) => {
    // Mock API failures
    await page.route('/api/questionnaires', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' })
      });
    });

    await page.goto('/questionnaires');

    // Test error handling
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Failed to load questionnaires');

    // Test retry functionality
    await page.click('[data-testid="retry-button"]');

    // Test fallback content
    await expect(page.locator('[data-testid="fallback-content"]')).toBeVisible();
  });

  test('should handle intermittent connectivity', async ({ page }) => {
    await page.goto('/real-time-dashboard');

    // Simulate intermittent connection
    let connectionCount = 0;
    await page.route('/api/real-time-data', route => {
      connectionCount++;
      if (connectionCount % 3 === 0) {
        route.fulfill({
          status: 500,
          body: 'Connection error'
        });
      } else {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: 'real-time-data', timestamp: Date.now() })
        });
      }
    });

    // Test connection status indicator
    await expect(page.locator('[data-testid="connection-status"]')).toBeVisible();

    // Test data updates despite interruptions
    await page.waitForTimeout(5000);

    // Verify last successful update is displayed
    await expect(page.locator('[data-testid="last-update"]')).toBeVisible();
  });
});
```

## 🎯 Best Practices

### Test Organization

1. **Page Object Model**: Separate page structure from test logic
2. **Fixtures**: Use fixtures for common test setup and teardown
3. **Test Groups**: Organize related tests in describe blocks
4. **Clear Naming**: Use descriptive test names that explain what's being tested
5. **Test Data**: Use factories and builders for consistent test data

### Test Design

1. **User Scenarios**: Test real user workflows, not just individual features
2. **Cross-browser**: Test across multiple browsers and devices
3. **Accessibility**: Include accessibility testing in E2E tests
4. **Performance**: Validate performance metrics and user experience
5. **Error Handling**: Test error conditions and recovery scenarios

### Test Maintenance

1. **Stable Selectors**: Use data-testid attributes instead of CSS selectors
2. **Explicit Waits**: Use explicit waits instead of fixed timeouts
3. **Test Isolation**: Ensure tests don't depend on each other
4. **Regular Updates**: Keep tests updated with UI changes
5. **CI Integration**: Run E2E tests in CI/CD pipeline

## 🔧 Troubleshooting

### Common E2E Test Issues

#### Test Flakiness

```bash
# Run tests with retries
npx playwright test --retries=3

# Run tests in debug mode
npx playwright test --debug

# Run tests with trace
npx playwright test --trace on

# Run tests with video recording
npx playwright test --video on
```

#### Performance Issues

```bash
# Run tests in headed mode to see what's happening
npx playwright test --headed

# Run tests with slower speed
npx playwright test --slow-mo=1000

# Run single test to isolate issues
npx playwright test --grep "test name"
```

#### Browser-specific Issues

```bash
# Run tests on specific browser
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit

# Update browsers
npx playwright install

# Install browser dependencies
npx playwright install-deps
```

#### Network Issues

```bash
# Check if application is running
curl http://localhost:3001

# Start application in test mode
npm run start:test

# Check network connectivity
npx playwright test --debug
```

### Debugging Tips

1. **Use Browser DevTools**: Run tests in headed mode and use DevTools
2. **Add Console Logs**: Use `console.log` statements in tests
3. **Take Screenshots**: Capture screenshots at key points
4. **Use Playwright Inspector**: Use the Playwright inspector for debugging
5. **Check Test Reports**: Review HTML reports for detailed information

---

This comprehensive E2E testing guide provides all the tools and techniques needed to create robust, maintainable end-to-end tests for the WorkshopsAI CMS project.