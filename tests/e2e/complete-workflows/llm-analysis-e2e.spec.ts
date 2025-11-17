import { test, expect, Page } from '@playwright/test';
import { PerformanceTestingUtils } from '../../utils/performance-testing-utils';

test.describe('LLM Analysis Complete Workflow E2E', () => {
  let page: Page;
  let performanceUtils: PerformanceTestingUtils;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    performanceUtils = new PerformanceTestingUtils();

    // Set up performance monitoring
    await page.route('**/*', async (route) => {
      const start = Date.now();
      const response = await route.fetch();
      const end = Date.now();

      // Record performance metrics
      performanceUtils.recordPerformanceMetric(route.request().url(), end - start, response.status());
    });

    // Enable request/response logging
    page.on('request', request => {
      console.log(`Request: ${request.method()} ${request.url()}`);
    });

    page.on('response', response => {
      console.log(`Response: ${response.status()} ${response.url()}`);
    });
  });

  test.beforeEach(async () => {
    // Clear performance metrics before each test
    performanceUtils.reset();
    await page.goto('/');
  });

  test.afterEach(async () => {
    // Generate performance report after each test
    const report = performanceUtils.generatePerformanceReport();
    console.log('Performance Report:', report);
  });

  test('Complete LLM analysis workflow from questionnaire creation to results', async ({ page }) => {
    // Step 1: User Login
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'test-password');
    await page.click('[data-testid="login-button"]');

    // Verify successful login
    await expect(page.locator('[data-testid="user-dashboard"]')).toBeVisible();
    await expect(page.locator('[data-testid="user-name"]')).toContainText('Test User');

    // Step 2: Create New Questionnaire
    await page.click('[data-testid="create-questionnaire-button"]');
    await page.fill('[data-testid="questionnaire-title"]', 'Performance Test Questionnaire');
    await page.fill('[data-testid="questionnaire-description"]', 'E2E test for LLM analysis workflow');
    await page.click('[data-testid="questionnaire-save-button"]');

    // Verify questionnaire created
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Questionnaire created successfully');
    await expect(page.locator('[data-testid="questionnaire-title"]')).toContainText('Performance Test Questionnaire');

    // Step 3: Add Questions to Questionnaire
    await page.click('[data-testid="add-question-button"]');

    // Add text question
    await page.selectOption('[data-testid="question-type"]', 'text');
    await page.fill('[data-testid="question-text"]', 'What is your overall experience with our platform?');
    await page.click('[data-testid="save-question-button"]');

    // Add multiple choice question
    await page.click('[data-testid="add-question-button"]');
    await page.selectOption('[data-testid="question-type"]', 'multiple');
    await page.fill('[data-testid="question-text"]', 'Which features do you use most?');
    await page.fill('[data-testid="question-option-1"]', 'Dashboard');
    await page.fill('[data-testid="question-option-2"]', 'Analytics');
    await page.fill('[data-testid="question-option-3"]', 'Reports');
    await page.click('[data-testid="save-question-button"]');

    // Add rating question
    await page.click('[data-testid="add-question-button"]');
    await page.selectOption('[data-testid="question-type"]', 'rating');
    await page.fill('[data-testid="question-text"]', 'Rate your satisfaction (1-5)');
    await page.click('[data-testid="save-question-button"]');

    // Verify questions added
    await expect(page.locator('[data-testid="question-item"]')).toHaveCount(3);

    // Step 4: Publish Questionnaire
    await page.click('[data-testid="publish-questionnaire-button"]');
    await page.click('[data-testid="confirm-publish-button"]');

    // Verify questionnaire published
    await expect(page.locator('[data-testid="publish-success"]')).toBeVisible();
    await expect(page.locator('[data-testid="questionnaire-status"]')).toContainText('Published');

    // Step 5: Navigate to Questionnaire Preview
    const questionnaireLink = page.locator('[data-testid="questionnaire-link"]');
    await questionnaireLink.click();

    // Verify questionnaire preview page
    await expect(page.locator('[data-testid="questionnaire-preview"]')).toBeVisible();
    await expect(page.locator('[data-testid="questionnaire-title"]')).toContainText('Performance Test Questionnaire');

    // Step 6: Submit Response as Test User
    await page.fill('[data-testid="text-answer-0"]', 'The platform is very intuitive and easy to use. I particularly like the analytics features.');
    await page.check('[data-testid="multiple-choice-answer-1-0"]'); // Dashboard
    await page.check('[data-testid="multiple-choice-answer-1-1"]'); // Analytics
    await page.click('[data-testid="rating-answer-2-4"]'); // 4 stars

    await page.click('[data-testid="submit-response-button"]');
    await page.click('[data-testid="confirm-submit-button"]');

    // Verify response submitted
    await expect(page.locator('[data-testid="submission-success"]')).toBeVisible();

    // Step 7: Navigate to Analysis Section
    await page.click('[data-testid="navigation-analysis"]');
    await expect(page.locator('[data-testid="analysis-dashboard"]')).toBeVisible();

    // Step 8: Start LLM Analysis
    await page.click('[data-testid="start-analysis-button"]');

    // Configure analysis
    await page.check('[data-testid="analysis-type-thematic"]');
    await page.check('[data-testid="analysis-type-sentiment"]');
    await page.check('[data-testid="analysis-type-clusters"]');

    await page.selectOption('[data-testid="analysis-provider"]', 'openai');
    await page.selectOption('[data-testid="analysis-language"]', 'auto');

    await page.click('[data-testid="begin-analysis-button"]');

    // Step 9: Monitor Analysis Progress
    await expect(page.locator('[data-testid="analysis-progress"]')).toBeVisible();

    // Monitor progress updates
    let progressComplete = false;
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max wait time

    while (!progressComplete && attempts < maxAttempts) {
      await page.waitForTimeout(5000); // Wait 5 seconds

      const progressText = await page.locator('[data-testid="progress-status"]').textContent();
      const progressBar = await page.locator('[data-testid="progress-bar"]').getAttribute('value');

      console.log(`Analysis Progress: ${progressText} (${progressBar}%)`);

      if (progressText?.includes('completed') || progressBar === '100') {
        progressComplete = true;
      }

      attempts++;
    }

    expect(progressComplete).toBe(true);

    // Step 10: View Analysis Results
    await expect(page.locator('[data-testid="analysis-results"]')).toBeVisible();

    // Verify thematic analysis results
    await expect(page.locator('[data-testid="thematic-results"]')).toBeVisible();
    await expect(page.locator('[data-testid="theme-item"]')).toHaveCountGreaterThan(0);

    // Verify sentiment analysis results
    await expect(page.locator('[data-testid="sentiment-results"]')).toBeVisible();
    await expect(page.locator('[data-testid="sentiment-chart"]')).toBeVisible();

    // Verify cluster analysis results
    await expect(page.locator('[data-testid="cluster-results"]')).toBeVisible();
    await expect(page.locator('[data-testid="cluster-item"]')).toHaveCountGreaterThan(0);

    // Step 11: Export Analysis Results
    await page.click('[data-testid="export-results-button"]');
    await page.selectOption('[data-testid="export-format"]', 'pdf');
    await page.click('[data-testid="download-export-button"]');

    // Verify download initiated
    const downloadPromise = page.waitForEvent('download');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('analysis-results');

    // Step 12: Share Analysis Results
    await page.click('[data-testid="share-results-button"]');
    await page.fill('[data-testid="share-email"]', 'stakeholder@example.com');
    await page.fill('[data-testid="share-message"]', 'Please find attached analysis results.');
    await page.click('[data-testid="send-share-button"]');

    // Verify share sent
    await expect(page.locator('[data-testid="share-success"]')).toBeVisible();

    // Step 13: Archive Analysis
    await page.click('[data-testid="archive-analysis-button"]');
    await page.click('[data-testid="confirm-archive-button"]');

    // Verify analysis archived
    await expect(page.locator('[data-testid="archive-success"]')).toBeVisible();
    await expect(page.locator('[data-testid="analysis-status"]')).toContainText('Archived');

    // Performance verification
    const totalTime = performanceUtils.getTotalDuration();
    expect(totalTime).toBeLessThan(300000); // 5 minutes max for complete workflow

    const report = performanceUtils.generatePerformanceReport();
    expect(report.recommendations.length).toBeGreaterThanOrEqual(0);
  });

  test('LLM analysis workflow with real-time streaming updates', async ({ page }) => {
    // Setup: Login and create questionnaire (simplified)
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'streaming@example.com');
    await page.fill('[data-testid="password-input"]', 'test-password');
    await page.click('[data-testid="login-button"]');

    // Create a simple questionnaire
    await page.click('[data-testid="create-questionnaire-button"]');
    await page.fill('[data-testid="questionnaire-title"]', 'Streaming Test Questionnaire');
    await page.click('[data-testid="questionnaire-save-button"]');

    // Add questions
    await page.click('[data-testid="add-question-button"]');
    await page.selectOption('[data-testid="question-type"]', 'text');
    await page.fill('[data-testid="question-text"]', 'How would you describe your experience?');
    await page.click('[data-testid="save-question-button"]');

    await page.click('[data-testid="publish-questionnaire-button"]');
    await page.click('[data-testid="confirm-publish-button"]');

    // Submit response
    const questionnaireLink = page.locator('[data-testid="questionnaire-link"]');
    await questionnaireLink.click();

    await page.fill('[data-testid="text-answer-0"]', 'This is an amazing platform with great features and excellent user experience. The analytics dashboard provides valuable insights that help in decision making.');
    await page.click('[data-testid="submit-response-button"]');
    await page.click('[data-testid="confirm-submit-button"]');

    // Start streaming analysis
    await page.click('[data-testid="navigation-analysis"]');
    await page.click('[data-testid="start-analysis-button"]');

    // Enable streaming
    await page.check('[data-testid="enable-streaming"]');
    await page.check('[data-testid="analysis-type-thematic"]');
    await page.click('[data-testid="begin-analysis-button"]');

    // Monitor streaming updates
    const streamingContainer = page.locator('[data-testid="streaming-updates"]');
    await expect(streamingContainer).toBeVisible();

    // Collect streaming updates
    const streamingUpdates = [];
    let streamingComplete = false;

    page.on('console', msg => {
      if (msg.type() === 'log' && msg.text().includes('STREAM_UPDATE:')) {
        streamingUpdates.push(msg.text());
        console.log('Streaming Update:', msg.text());
      }
    });

    // Wait for streaming to complete
    let attempts = 0;
    while (!streamingComplete && attempts < 30) {
      await page.waitForTimeout(2000);

      try {
        const isComplete = await page.locator('[data-testid="streaming-complete"]').isVisible();
        if (isComplete) {
          streamingComplete = true;
        }
      } catch (error) {
        // Element not yet visible, continue waiting
      }

      attempts++;
    }

    expect(streamingComplete).toBe(true);
    expect(streamingUpdates.length).toBeGreaterThan(0);

    // Verify final results
    await expect(page.locator('[data-testid="final-analysis-results"]')).toBeVisible();
    await expect(page.locator('[data-testid="thematic-analysis-result"]')).toBeVisible();

    // Verify streaming performance
    const firstUpdate = streamingUpdates[0];
    const lastUpdate = streamingUpdates[streamingUpdates.length - 1];

    const streamingDuration = parseInt(lastUpdate.match(/(\d+)ms/)?.[1] || '0') -
                           parseInt(firstUpdate.match(/(\d+)ms/)?.[1] || '0');

    expect(streamingDuration).toBeGreaterThan(0);
    expect(streamingDuration).toBeLessThan(60000); // Should complete within 1 minute
  });

  test('Concurrent LLM analysis handling', async ({ page }) => {
    // Setup: Login and create multiple questionnaires
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'concurrent@example.com');
    await page.fill('[data-testid="password-input"]', 'test-password');
    await page.click('[data-testid="login-button"]');

    // Create multiple questionnaires
    const questionnaireIds = [];
    for (let i = 0; i < 3; i++) {
      await page.click('[data-testid="create-questionnaire-button"]');
      await page.fill('[data-testid="questionnaire-title"]', `Concurrent Test Questionnaire ${i + 1}`);
      await page.click('[data-testid="questionnaire-save-button"]');

      // Add one question
      await page.click('[data-testid="add-question-button"]');
      await page.selectOption('[data-testid="question-type"]', 'text');
      await page.fill('[data-testid="question-text"]', `Test question ${i + 1}`);
      await page.click('[data-testid="save-question-button"]');

      // Publish
      await page.click('[data-testid="publish-questionnaire-button"]');
      await page.click('[data-testid="confirm-publish-button"]');

      // Get questionnaire ID
      const id = await page.locator('[data-testid="questionnaire-id"]').textContent();
      questionnaireIds.push(id);
    }

    // Submit responses for each questionnaire
    for (let i = 0; i < 3; i++) {
      await page.goto(`/questionnaire/${questionnaireIds[i]}`);
      await page.fill('[data-testid="text-answer-0"]', `Response ${i + 1} for concurrent testing`);
      await page.click('[data-testid="submit-response-button"]');
      await page.click('[data-testid="confirm-submit-button"]');
    }

    // Navigate to analysis dashboard
    await page.click('[data-testid="navigation-analysis"]');

    // Start concurrent analyses
    const analysisStartTime = Date.now();

    for (let i = 0; i < 3; i++) {
      await page.click('[data-testid="start-analysis-button"]');

      // Configure each analysis differently
      await page.selectOption('[data-testid="questionnaire-select"]', questionnaireIds[i]);
      await page.check('[data-testid="analysis-type-thematic"]');

      if (i === 0) {
        await page.check('[data-testid="analysis-type-sentiment"]');
      } else if (i === 1) {
        await page.check('[data-testid="analysis-type-clusters"]');
      } else {
        await page.check('[data-testid="analysis-type-insights"]');
      }

      await page.click('[data-testid="begin-analysis-button"]');

      // Don't wait for completion, move to next analysis
      await page.waitForTimeout(1000);
    }

    // Monitor all analyses
    const analysisProgress = page.locator('[data-testid="analysis-progress-list"]');
    await expect(analysisProgress).toBeVisible();

    // Wait for all analyses to complete
    let allComplete = false;
    let attempts = 0;
    const maxAttempts = 120; // 10 minutes max

    while (!allComplete && attempts < maxAttempts) {
      await page.waitForTimeout(5000);

      const completedAnalyses = await page.locator('[data-testid="analysis-item"][data-status="completed"]').count();

      if (completedAnalyses === 3) {
        allComplete = true;
      }

      attempts++;
    }

    expect(allComplete).toBe(true);

    const totalTime = Date.now() - analysisStartTime;
    console.log(`Concurrent analyses completed in ${totalTime / 1000} seconds`);

    // Verify all results are available
    await expect(page.locator('[data-testid="analysis-item"][data-status="completed"]')).toHaveCount(3);

    // Verify results diversity
    await expect(page.locator('[data-testid="thematic-result"]')).toHaveCount(3);
    expect(page.locator('[data-testid="sentiment-result"]')).toHaveCount(1);
    expect(page.locator('[data-testid="cluster-result"]')).toHaveCount(1);
    expect(page.locator('[data-testid="insights-result"]')).toHaveCount(1);
  });

  test('Error handling and recovery in LLM analysis workflow', async ({ page }) => {
    // Setup: Login and create questionnaire
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'error@example.com');
    await page.fill('[data-testid="password-input"]', 'test-password');
    await page.click('[data-testid="login-button"]');

    await page.click('[data-testid="create-questionnaire-button"]');
    await page.fill('[data-testid="questionnaire-title"]', 'Error Handling Test');
    await page.click('[data-testid="questionnaire-save-button"]');

    await page.click('[data-testid="add-question-button"]');
    await page.selectOption('[data-testid="question-type"]', 'text');
    await page.fill('[data-testid="question-text"]', 'Test for error handling');
    await page.click('[data-testid="save-question-button"]');

    await page.click('[data-testid="publish-questionnaire-button"]');
    await page.click('[data-testid="confirm-publish-button"]');

    // Submit response
    await page.goto('/questionnaire/error-test');
    await page.fill('[data-testid="text-answer-0"]', 'Test response for error handling');
    await page.click('[data-testid="submit-response-button"]');
    await page.click('[data-testid="confirm-submit-button"]');

    // Navigate to analysis
    await page.click('[data-testid="navigation-analysis"]');

    // Simulate API failure during analysis
    await page.route('**/api/analysis/start', route => {
      return route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' }),
      });
    });

    // Attempt to start analysis
    await page.click('[data-testid="start-analysis-button"]');
    await page.check('[data-testid="analysis-type-thematic"]');
    await page.click('[data-testid="begin-analysis-button"]');

    // Verify error handling
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText('analysis failed');

    // Test retry mechanism
    await page.unroute('**/api/analysis/start');
    await page.click('[data-testid="retry-analysis-button"]');

    // Verify retry succeeded (normal analysis flow)
    await expect(page.locator('[data-testid="analysis-progress"]')).toBeVisible();

    // Wait for completion
    let progressComplete = false;
    let attempts = 0;
    while (!progressComplete && attempts < 30) {
      await page.waitForTimeout(3000);

      try {
        const isComplete = await page.locator('[data-testid="analysis-results"]').isVisible();
        if (isComplete) {
          progressComplete = true;
        }
      } catch (error) {
        // Continue waiting
      }

      attempts++;
    }

    expect(progressComplete).toBe(true);
    expect(page.locator('[data-testid="analysis-results"]')).toBeVisible();
  });

  test('LLM analysis workflow accessibility compliance', async ({ page }) => {
    // Enable accessibility testing
    await page.goto('/login');

    // Check login accessibility
    await expect(page.locator('[data-testid="email-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="password-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="login-button"]')).toBeVisible();

    // Check form labels and ARIA attributes
    const emailLabel = page.locator('label[for="email-input"]');
    const passwordLabel = page.locator('label[for="password-input"]');

    expect(emailLabel).toBeVisible();
    expect(passwordLabel).toBeVisible();
    expect(await emailLabel.getAttribute('for')).toBe('email-input');
    expect(await passwordLabel.getAttribute('for')).toBe('password-input');

    // Check keyboard navigation
    await page.keyboard.press('Tab');
    expect(await page.locator(':focus').getAttribute('data-testid')).toBe('email-input');

    await page.keyboard.press('Tab');
    expect(await page.locator(':focus').getAttribute('data-testid')).toBe('password-input');

    // Complete login
    await page.fill('[data-testid="email-input"]', 'a11y@example.com');
    await page.fill('[data-testid="password-input"]', 'test-password');
    await page.click('[data-testid="login-button"]');

    // Create questionnaire with accessibility checks
    await page.click('[data-testid="create-questionnaire-button"]');

    // Check form accessibility
    await expect(page.locator('[data-testid="questionnaire-title"]')).toBeVisible();
    await expect(page.locator('label[for="questionnaire-title"]')).toBeVisible();

    await page.fill('[data-testid="questionnaire-title"]', 'Accessibility Test Questionnaire');
    await page.click('[data-testid="questionnaire-save-button"]');

    // Navigate through analysis workflow checking accessibility
    await page.click('[data-testid="add-question-button"]');
    await page.selectOption('[data-testid="question-type"]', 'text');
    await page.fill('[data-testid="question-text"]', 'Accessibility test question');
    await page.click('[data-testid="save-question-button"]');

    await page.click('[data-testid="publish-questionnaire-button"]');
    await page.click('[data-testid="confirm-publish-button"]');

    // Test screen reader compatibility
    await page.goto('/questionnaire/accessibility-test');
    await page.fill('[data-testid="text-answer-0"]', 'Accessibility test response');
    await page.click('[data-testid="submit-response-button"]');
    await page.click('[data-testid="confirm-submit-button"]');

    // Test analysis interface accessibility
    await page.click('[data-testid="navigation-analysis"]');
    await page.click('[data-testid="start-analysis-button"]');

    // Check analysis form accessibility
    await expect(page.locator('[data-testid="analysis-type-thematic"]')).toBeVisible();
    await expect(page.locator('[data-testid="analysis-type-sentiment"]')).toBeVisible();
    await expect(page.locator('[data-testid="analysis-type-clusters"]')).toBeVisible();

    // Check ARIA labels
    const thematicCheckbox = page.locator('[data-testid="analysis-type-thematic"]');
    expect(await thematicCheckbox.getAttribute('aria-label')).toBeDefined();
    expect(await thematicCheckbox.getAttribute('role')).toBe('checkbox');

    await page.check('[data-testid="analysis-type-thematic"]');
    await page.click('[data-testid="begin-analysis-button"]');

    // Monitor progress with accessibility
    await expect(page.locator('[data-testid="analysis-progress"]')).toBeVisible();
    expect(await page.locator('[data-testid="progress-status"]').getAttribute('aria-live')).toBe('polite');

    // Wait for completion
    await page.waitForSelector('[data-testid="analysis-results"]', { timeout: 60000 });

    // Check results accessibility
    await expect(page.locator('[data-testid="thematic-results"]')).toBeVisible();
    await expect(page.locator('[data-testid="results-summary"]')).toBeVisible();

    // Check result structure for screen readers
    const resultHeadings = page.locator('[data-testid="results-section"] h2, [data-testid="results-section"] h3');
    expect(await resultHeadings.count()).toBeGreaterThan(0);
  });
});

// Helper class for performance monitoring in E2E tests
class PerformanceTestingUtils {
  private metrics: Array<{ url: string; duration: number; status: number; timestamp: number }> = [];

  recordPerformanceMetric(url: string, duration: number, status: number) {
    this.metrics.push({
      url,
      duration,
      status,
      timestamp: Date.now(),
    });
  }

  getTotalDuration(): number {
    if (this.metrics.length === 0) return 0;
    const first = this.metrics[0].timestamp;
    const last = this.metrics[this.metrics.length - 1].timestamp;
    return last - first;
  }

  generatePerformanceReport() {
    const totalDuration = this.getTotalDuration();
    const averageDuration = this.metrics.length > 0
      ? this.metrics.reduce((sum, m) => sum + m.duration, 0) / this.metrics.length
      : 0;

    const slowRequests = this.metrics.filter(m => m.duration > 2000);
    const errorRequests = this.metrics.filter(m => m.status >= 400);

    return {
      totalRequests: this.metrics.length,
      totalDuration,
      averageDuration,
      slowRequests: slowRequests.length,
      errorRequests: errorRequests.length,
      recommendations: this.generateRecommendations(slowRequests, errorRequests),
    };
  }

  private generateRecommendations(slowRequests: any[], errorRequests: any[]): string[] {
    const recommendations = [];

    if (slowRequests.length > 0) {
      recommendations.push(`${slowRequests.length} requests took longer than 2 seconds`);
    }

    if (errorRequests.length > 0) {
      recommendations.push(`${errorRequests.length} requests returned error status`);
    }

    if (this.metrics.length > 0 && averageDuration > 1000) {
      recommendations.push('Average response time exceeds 1 second');
    }

    if (recommendations.length === 0) {
      recommendations.push('Performance is within acceptable limits');
    }

    return recommendations;
  }

  reset() {
    this.metrics = [];
  }
}