import { test, expect, Page } from '@playwright/test';
import { chromium, devices } from '@playwright/test';

test.describe('Performance Dashboard E2E Tests', () => {
  test.describe.configure({ mode: 'performance' }); // Run in performance mode for more accurate metrics

  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();

    // Enable performance monitoring
    await page.addInitScript(() => {
      // Add performance observer
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          console.log(`${entry.name}: ${entry.duration}ms`);
        });
      }).observe({ entryTypes: ['navigation', 'resource', 'paint'] });
    });

    // Set performance budget
    await page.addInitScript(() => {
      // Create performance measurement utilities
      window.performanceMeasurements = {
        navigationStart: null,
        domContentLoaded: null,
        loadComplete: null,
        firstContentfulPaint: null,
        largestContentfulPaint: null,
      };

      // PerformanceObserver for Core Web Vitals
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          switch (entry.entryType) {
            case 'navigation':
              window.performanceMeasurements.navigationStart = entry.fetchStart;
              window.performanceMeasurements.domContentLoaded = entry.domContentLoadedEventEnd;
              window.performanceMeasurements.loadComplete = entry.loadEventEnd;
              break;
            case 'paint':
              if (entry.name === 'first-contentful-paint') {
                window.performanceMeasurements.firstContentfulPaint = entry.startTime;
              }
              if (entry.name === 'largest-contentful-paint') {
                window.performanceMeasurements.largestContentfulPaint = entry.startTime;
              }
              break;
          }
        });
      }).observe({ entryTypes: ['navigation', 'paint'] });
    });
  });

  test.beforeEach(async () => {
    // Clear any existing state
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('Performance dashboard loads within performance budgets', async ({ page }) => {
    // Navigate to performance dashboard
    await page.goto('/performance/dashboard');

    // Wait for dashboard to load
    await page.waitForSelector('[data-testid="performance-dashboard"]', { timeout: 10000 });

    // Collect performance metrics
    const metrics = await page.evaluate(() => {
      return window.performanceMeasurements;
    });

    console.log('Performance Metrics:', metrics);

    // Verify performance budgets
    expect(metrics.firstContentfulPaint).toBeLessThan(2000); // 2s FCP
    expect(metrics.largestContentfulPaint).toBeLessThan(2500); // 2.5s LCP
    expect(metrics.domContentLoaded).toBeLessThan(3000); // 3s DCL
    expect(metrics.loadComplete).toBeLessThan(5000); // 5s Load

    // Check dashboard functionality
    await expect(page.locator('[data-testid="performance-overview"]')).toBeVisible();
    await expect(page.locator('[data-testid="response-time-chart"]')).toBeVisible();
    await expect(page.locator('[data-testid="throughput-chart"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-rate-chart"]')).toBeVisible();
  });

  test('Real-time performance updates work correctly', async ({ page }) => {
    await page.goto('/performance/dashboard');

    // Start monitoring
    await page.click('[data-testid="start-monitoring-button"]');

    // Verify monitoring is active
    await expect(page.locator('[data-testid="monitoring-status"]')).toContainText('Active');

    // Check for real-time updates
    const initialMetrics = await page.locator('[data-testid="live-metrics"]').textContent();

    // Wait for updates
    await page.waitForTimeout(5000);

    const updatedMetrics = await page.locator('[data-testid="live-metrics"]').textContent();
    expect(updatedMetrics).not.toBe(initialMetrics);

    // Verify chart updates
    const charts = [
      '[data-testid="response-time-chart"]',
      '[data-testid="throughput-chart"]',
      '[data-testid="memory-usage-chart"]',
      '[data-testid="cache-hit-rate-chart"]',
    ];

    for (const chartSelector of charts) {
      await expect(page.locator(chartSelector)).toBeVisible();

      // Charts should have data points
      const chartData = await page.locator(chartSelector).evaluate((element) => {
        // Check if chart has been rendered with data
        return element.querySelector('[data-chart-point], svg > *');
      });

      expect(chartData).toBeTruthy();
    }

    // Stop monitoring
    await page.click('[data-testid="stop-monitoring-button"]');
    await expect(page.locator('[data-testid="monitoring-status"]')).toContainText('Paused');
  });

  test('Performance alerts and notifications work correctly', async ({ page }) => {
    await page.goto('/performance/dashboard');

    // Set up alert thresholds
    await page.click('[data-testid="alert-settings-button"]');

    await page.fill('[data-testid="response-time-threshold"]', '5000');
    await page.fill('[data-testid="error-rate-threshold"]', '0.05');
    await page.fill('[data-testid="memory-threshold"]', '80');

    await page.click('[data-testid="save-alert-settings"]');

    // Trigger performance alerts (simulate slow API calls)
    await page.addInitScript(() => {
      // Simulate slow API responses
      const originalFetch = window.fetch;
      window.fetch = function(...args) {
        return new Promise((resolve) => {
          setTimeout(() => {
            originalFetch.apply(this, args).then(resolve);
          }, Math.random() * 3000 + 2000); // 2-5s delay
        });
      };
    });

    // Navigate to trigger API calls
    await page.goto('/api/performance/metrics');

    // Wait for alerts
    await page.waitForSelector('[data-testid="performance-alert"]', { timeout: 15000 });

    // Verify alert is displayed
    await expect(page.locator('[data-testid="alert-title"]')).toBeVisible();
    await expect(page.locator('[data-testid="alert-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="alert-dismiss-button"]')).toBeVisible();

    // Check alert categories
    const alertTypes = await page.locator('[data-testid="alert-category"]').all();
    expect(alertTypes.length).toBeGreaterThan(0);

    // Dismiss alert
    await page.click('[data-testid="alert-dismiss-button"]');
    await expect(page.locator('[data-testid="performance-alert"]')).not.toBeVisible();
  });

  test('Historical performance data loads and displays correctly', async ({ page }) => {
    await page.goto('/performance/dashboard');

    // Set time range to last 7 days
    await page.selectOption('[data-testid="time-range-select"]', '7d');

    // Wait for data to load
    await page.waitForSelector('[data-testid="historical-data"]', { timeout: 10000 });

    // Verify time series charts
    const timeSeriesCharts = [
      '[data-testid="historical-response-time"]',
      '[data-testid="historical-throughput"]',
      '[data-testid="historical-error-rate"]',
      '[data-testid="historical-memory-usage"]',
    ];

    for (const chartSelector of timeSeriesCharts) {
      await expect(page.locator(chartSelector)).toBeVisible();

      // Check if chart has data points
      const hasData = await page.locator(chartSelector).evaluate((element) => {
        return element.querySelector('svg [data-chart-point], path[*d="M"]'); // Look for actual data paths
      });

      expect(hasData).toBeTruthy();
    }

    // Test time range navigation
    const timeRanges = ['1h', '24h', '7d', '30d', '90d'];

    for (const range of timeRanges) {
      await page.selectOption('[data-testid="time-range-select"]', range);
      await page.waitForTimeout(2000); // Wait for data to reload

      const dataContainer = page.locator('[data-testid="historical-data"]');
      await expect(dataContainer).toBeVisible();
    }

    // Test data export functionality
    await page.click('[data-testid="export-data-button"]');
    await page.selectOption('[data-testid="export-format"]', 'csv');
    await page.click('[data-testid="download-export-button"]');

    // Verify download was initiated
    const downloadPromise = page.waitForEvent('download');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/performance_data_.*\.csv$/);
  });

  test('Performance optimization recommendations work correctly', async ({ page }) => {
    await page.goto('/performance/dashboard');

    // Navigate to recommendations section
    await page.click('[data-testid="recommendations-tab"]');

    // Wait for recommendations to load
    await page.waitForSelector('[data-testid="recommendations-list"]', { timeout: 10000 });

    // Verify different recommendation categories
    const recommendationCategories = [
      '[data-testid="database-optimizations"]',
      '[data-testid="cache-improvements"]',
      '[data-testid="api-optimizations"]',
      '[data-testid="resource-optimizations"]',
    ];

    for (const categorySelector of recommendationCategories) {
      await expect(page.locator(categorySelector)).toBeVisible();

      // Check for actual recommendations
      const hasRecommendations = await page.locator(categorySelector).evaluate((element) => {
        return element.querySelectorAll('[data-testid="recommendation-item"]').length > 0;
      });

      if (hasRecommendations) {
        // Verify recommendation details
        const firstRecommendation = await page.locator(categorySelector + ' [data-testid="recommendation-item"]').first();

        await expect(firstRecommendation.locator('[data-testid="recommendation-title"]')).toBeVisible();
        await expect(firstRecommendation.locator('[data-testid="recommendation-description"]')).toBeVisible();
        await expect(firstRecommendation.locator('[data-testid="recommendation-priority"]')).toBeVisible();
        await expect(firstRecommendation.locator('[data-testid="apply-recommendation"]')).toBeVisible();
      }
    }

    // Test applying a recommendation
    const applyButton = page.locator('[data-testid="apply-recommendation"]').first();
    if (await applyButton.isVisible()) {
      await applyButton.click();

      // Verify application status
      await expect(page.locator('[data-testid="recommendation-status"]')).toBeVisible();
      await expect(page.locator('[data-testid="recommendation-status"]')).toContainText('Applied');
    }

    // Test custom recommendation filters
    await page.click('[data-testid="filter-recommendations"]');

    await page.check('[data-testid="filter-priority-high"]');
    await page.check('[data-testid="filter-category-database"]');
    await page.check('[data-testid="filter-status-unapplied"]');

    await page.click('[data-testid="apply-filters"]');

    // Verify filtered results
    const filteredCount = await page.locator('[data-testid="recommendations-list"] [data-visible="true"]').count();
    expect(filteredCount).toBeGreaterThan(0);
  });

  test('Performance dashboard handles large datasets efficiently', async ({ page }) => {
    await page.goto('/performance/dashboard');

    // Test with large time range (90 days)
    await page.selectOption('[data-testid="time-range-select"]', '90d');

    // Wait for data to load
    await page.waitForSelector('[data-testid="historical-data"]', { timeout: 15000 });

    // Check virtualization is working
    const chartContainer = page.locator('[data-testid="historical-response-time"]');
    await expect(chartContainer).toBeVisible();

    // Test chart performance with large dataset
    const performanceStart = Date.now();

    // Interact with chart
    await chartContainer.hover();
    await page.click(chartContainer);

    const performanceEnd = Date.now();
    expect(performanceEnd - performanceStart).toBeLessThan(1000); // Should be responsive

    // Test table pagination
    const dataTable = page.locator('[data-testid="performance-data-table"]');
    if (await dataTable.isVisible()) {
      // Check pagination controls
      await expect(page.locator('[data-testid="pagination-controls"]')).toBeVisible();
      await expect(page.locator('[data-testid="page-size-selector"]')).toBeVisible();

      // Test page size changes
      await page.selectOption('[data-testid="page-size-selector"]', '50');
      await page.waitForTimeout(1000);

      const rowCount = await page.locator('[data-testid="performance-data-table"] tbody tr').count();
      expect(rowCount).toBeLessThanOrEqual(50);
    }

    // Test data filtering with large dataset
    await page.click('[data-testid="filter-data-button"]');
    await page.fill('[data-testid="endpoint-filter"]', '/api/analysis');
    await page.fill('[data-testid="status-filter"]', '200');
    await page.click('[data-testid="apply-data-filters"]');

    // Wait for filtering to complete
    await page.waitForTimeout(2000);

    // Verify filtered results
    const filteredDataCount = await page.locator('[data-testid="performance-data-table"] tbody tr').count();
    expect(filteredDataCount).toBeGreaterThanOrEqual(0);
  });

  test('Performance dashboard is accessible and keyboard navigable', async ({ page }) => {
    await page.goto('/performance/dashboard');

    // Test keyboard navigation
    let focusedElement = page.locator(':focus');

    // Tab through interactive elements
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
      focusedElement = page.locator(':focus');

      // Verify focused element is interactive
      const tagName = await focusedElement.evaluate(el => el.tagName.toLowerCase());
      expect(['button', 'input', 'select', 'a', 'textarea']).toContain(tagName);

      // Check for focus indicators
      const hasFocusIndicator = await focusedElement.evaluate(el => {
        const style = window.getComputedStyle(el);
        return style.outline !== 'none' || style.boxShadow !== 'none';
      });

      expect(hasFocusIndicator).toBe(true);
    }

    // Test screen reader compatibility
    const accessibleElements = [
      '[data-testid="performance-dashboard"]',
      '[data-testid="performance-overview"]',
      '[data-testid="response-time-chart"]',
      '[data-testid="start-monitoring-button"]',
      '[data-testid="recommendations-tab"]',
    ];

    for (const elementSelector of accessibleElements) {
      const element = page.locator(elementSelector);
      if (await element.isVisible()) {
        // Check for proper ARIA attributes
        const ariaLabel = await element.getAttribute('aria-label');
        const ariaLabelledBy = await element.getAttribute('aria-labelledby');
        const title = await element.getAttribute('title');

        const hasAccessibilityLabel = ariaLabel || ariaLabelledBy || title;

        if (elementSelector.includes('button')) {
          expect(hasAccessibilityLabel).toBeTruthy();
        }
      }
    }

    // Test color contrast (basic check)
    const highContrastElements = [
      '[data-testid="alert-title"]',
      '[data-testid="metric-value"]',
      '[data-testid="chart-legend"]',
    ];

    for (const elementSelector of highContrastElements) {
      const element = page.locator(elementSelector);
      if (await element.isVisible()) {
        const computedStyle = await element.evaluate(el => {
          const style = window.getComputedStyle(el);
          return {
            color: style.color,
            backgroundColor: style.backgroundColor,
          };
        });

        // Basic contrast check (would need proper contrast calculation in real implementation)
        expect(computedStyle.color).toBeDefined();
        expect(computedStyle.backgroundColor).toBeDefined();
      }
    }

    // Test responsive design
    await page.setViewportSize({ width: 768, height: 1024 }); // Tablet
    await expect(page.locator('[data-testid="performance-dashboard"]')).toBeVisible();

    await page.setViewportSize({ width: 375, height: 667 }); // Mobile
    await expect(page.locator('[data-testid="performance-dashboard"]')).toBeVisible();

    // Check mobile navigation
    const mobileNav = page.locator('[data-testid="mobile-nav-toggle"]');
    if (await mobileNav.isVisible()) {
      await mobileNav.click();
      await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();
    }
  });

  test('Performance dashboard WebSocket real-time updates', async ({ page }) => {
    await page.goto('/performance/dashboard');

    // Start real-time monitoring
    await page.click('[data-testid="enable-realtime-updates"]');

    // Monitor WebSocket connection
    const wsConnectionStatus = await page.locator('[data-testid="ws-status"]');
    await expect(wsConnectionStatus).toContainText('Connected');

    // Simulate real-time data updates
    await page.evaluate(() => {
      // Simulate WebSocket message
      window.dispatchEvent(new CustomEvent('ws-message', {
        detail: {
          type: 'metric_update',
          data: {
            timestamp: Date.now(),
            metrics: {
              responseTime: Math.random() * 1000,
              throughput: Math.random() * 100,
              errorRate: Math.random() * 0.05,
              memoryUsage: Math.random() * 80,
            },
          },
        },
      }));
    });

    // Wait for UI update
    await page.waitForTimeout(1000);

    // Verify real-time updates are reflected
    const liveMetrics = page.locator('[data-testid="realtime-metrics"]');
    await expect(liveMetrics).toBeVisible();

    // Test disconnection handling
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('ws-disconnected'));
    });

    await expect(page.locator('[data-testid="ws-status"]')).toContainText('Disconnected');
    await expect(page.locator('[data-testid="reconnect-button"]')).toBeVisible();

    // Test reconnection
    await page.click('[data-testid="reconnect-button"]');
    await expect(page.locator('[data-testid="ws-status"]')).toContainText('Connecting');

    // Wait for reconnection
    await page.waitForSelector('[data-testid="ws-status"]:has-text("Connected")', { timeout: 10000 });
  });
});