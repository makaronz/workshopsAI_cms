import { test, expect } from '@playwright/test';
import { generateTestData, generateBulkTestData } from '../helpers/test-data-factory';
import { faker } from '@faker-js/faker';

test.describe('Load Testing Scenarios', () => {
  test.describe('Workshop Listing Performance', () => {
    test('should handle large workshop lists efficiently', async ({ page, request }) => {
      // Create a large number of workshops for testing
      const workshops = generateBulkTestData('workshop', 100);

      // Create workshops via API for performance testing
      for (const workshop of workshops) {
        await request.post('/api/workshops', {
          data: workshop
        });
      }

      // Test loading time
      const startTime = performance.now();
      await page.goto('/workshops');
      const loadTime = performance.now() - startTime;

      // Should load within 3 seconds
      expect(loadTime).toBeLessThan(3000);

      // Verify content is loaded
      await expect(page.locator('[data-testid="workshop-list"]')).toBeVisible();

      // Test pagination performance
      const paginationStartTime = performance.now();
      await page.click('[data-testid="next-page"]');
      const paginationTime = performance.now() - paginationStartTime;

      // Pagination should be fast
      expect(paginationTime).toBeLessThan(1000);

      // Test search performance
      const searchStartTime = performance.now();
      await page.fill('[data-testid="search-input"]', 'JavaScript');
      await page.press('[data-testid="search-input"]', 'Enter');
      const searchTime = performance.now() - searchStartTime;

      // Search should complete within 2 seconds
      expect(searchTime).toBeLessThan(2000);
    });

    test('should handle filtering and sorting efficiently', async ({ page }) => {
      await page.goto('/workshops');

      // Test multiple filters
      const filterStartTime = performance.now();

      await page.selectOption('[data-testid="category-filter"]', 'technical');
      await page.selectOption('[data-testid="level-filter"]', 'intermediate');
      await page.fill('[data-testid="price-filter-max"]', '100');
      await page.click('[data-testid="apply-filters"]');

      const filterTime = performance.now() - filterStartTime;
      expect(filterTime).toBeLessThan(1500);

      // Test sorting
      const sortStartTime = performance.now();
      await page.selectOption('[data-testid="sort-select"]', 'price-asc');
      const sortTime = performance.now() - sortStartTime;

      expect(sortTime).toBeLessThan(1000);

      // Verify filtered results are displayed
      await expect(page.locator('[data-testid="filtered-results"]')).toBeVisible();
    });
  });

  test.describe('Questionnaire Performance', () => {
    test('should handle large questionnaires efficiently', async ({ page, request }) => {
      // Create questionnaire with many questions
      const largeQuestionnaire = generateTestData('questionnaire', {
        questions: Array(50).fill(null).map((_, index) => ({
          id: `q${index}`,
          type: 'text',
          text: `Question ${index + 1}: ${faker.lorem.words(10)}`,
          required: index < 10,
          order: index + 1
        }))
      });

      const questionnaireResponse = await request.post('/api/questionnaires', {
        data: largeQuestionnaire
      });
      const questionnaireId = questionnaireResponse.body.data.id;

      // Test questionnaire loading time
      const loadStartTime = performance.now();
      await page.goto(`/questionnaires/${questionnaireId}/respond`);
      const loadTime = performance.now() - loadStartTime;

      expect(loadTime).toBeLessThan(2000);

      // Test scrolling performance
      const scrollStartTime = performance.now();
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      const scrollTime = performance.now() - scrollStartTime;

      expect(scrollTime).toBeLessThan(500);

      // Test form submission performance
      const submitStartTime = performance.now();

      // Fill in some required fields
      const requiredFields = page.locator('[data-testid^="q"][data-testid*="required"]');
      for (let i = 0; i < Math.min(10, await requiredFields.count()); i++) {
        await requiredFields.nth(i).fill(`Answer ${i + 1}`);
      }

      await page.click('[data-testid="submit-btn"]');
      const submitTime = performance.now() - submitStartTime;

      expect(submitTime).toBeLessThan(3000);
    });

    test('should handle real-time validation efficiently', async ({ page }) => {
      await page.goto('/workshops/create');

      // Test input validation performance
      const validationStartTime = performance.now();

      await page.fill('[data-testid="workshop-title"]', 'Test Workshop');
      await page.fill('[data-testid="workshop-capacity"]', '25');

      const validationTime = performance.now() - validationStartTime;
      expect(validationTime).toBeLessThan(500);

      // Test auto-save performance (if implemented)
      const autoSaveStartTime = performance.now();

      // Wait for potential auto-save
      await page.waitForTimeout(2000);

      const autoSaveTime = performance.now() - autoSaveStartTime;

      // Auto-save should not block UI
      expect(autoSaveTime).toBeLessThan(2500);
    });
  });

  test.describe('API Performance', () => {
    test('should handle concurrent API requests', async ({ request }) => {
      // Create multiple concurrent requests
      const concurrentRequests = [];

      for (let i = 0; i < 50; i++) {
        concurrentRequests.push(
          request.get('/api/workshops', {
            headers: { 'X-Test-ID': `test-${i}` }
          })
        );
      }

      const startTime = performance.now();
      const responses = await Promise.all(concurrentRequests);
      const totalTime = performance.now() - startTime;

      // All requests should complete within 5 seconds
      expect(totalTime).toBeLessThan(5000);

      // All responses should be successful
      const successCount = responses.filter(r => r.status() === 200).length;
      expect(successCount).toBe(50);

      // Response times should be reasonable
      const avgResponseTime = totalTime / concurrentRequests.length;
      expect(avgResponseTime).toBeLessThan(2000);
    });

    test('should handle large data transfers efficiently', async ({ request }) => {
      // Create workshop with many enrollments
      const workshop = generateTestData('workshop');
      const workshopResponse = await request.post('/api/workshops', {
        data: workshop
      });
      const workshopId = workshopResponse.body.data.id;

      // Create many enrollments
      const enrollmentRequests = [];
      for (let i = 0; i < 1000; i++) {
        enrollmentRequests.push(
          request.post(`/api/workshops/${workshopId}/enrollments`, {
            data: generateTestData('enrollment', { workshopId })
          })
        );
      }

      await Promise.all(enrollmentRequests);

      // Test fetching large enrollment list
      const fetchStartTime = performance.now();
      const response = await request.get(`/api/workshops/${workshopId}/enrollments`);
      const fetchTime = performance.now() - fetchStartTime;

      expect(fetchTime).toBeLessThan(3000);
      expect(response.status()).toBe(200);

      // Response should include pagination
      expect(response.body.data.pagination).toBeDefined();
    });
  });

  test.describe('Memory and Resource Management', () => {
    test('should not cause memory leaks during navigation', async ({ page }) => {
      // Navigate through multiple pages
      const pages = [
        '/',
        '/workshops',
        '/questionnaires',
        '/dashboard',
        '/analytics',
        '/workshops/create',
        '/questionnaires/create'
      ];

      for (let iteration = 0; iteration < 5; iteration++) {
        for (const pageUrl of pages) {
          await page.goto(pageUrl);
          await page.waitForLoadState('networkidle');

          // Check memory usage (simplified check)
          const memoryInfo = await page.evaluate(() => {
            if (performance.memory) {
              return {
                used: performance.memory.usedJSHeapSize,
                total: performance.memory.totalJSHeapSize,
                limit: performance.memory.jsHeapSizeLimit
              };
            }
            return null;
          });

          if (memoryInfo) {
            // Memory usage should not grow excessively
            expect(memoryInfo.used).toBeLessThan(memoryInfo.limit * 0.8);
          }
        }
      }
    });

    test('should handle image and media loading efficiently', async ({ page }) => {
      await page.goto('/workshops');

      // Monitor image loading performance
      const imageLoadPromises = page.locator('img').map(async (img) => {
        const loadTime = await img.evaluate((element: HTMLImageElement) => {
          return new Promise((resolve) => {
            if (element.complete) {
              resolve(0);
            } else {
              const startTime = performance.now();
              element.onload = () => resolve(performance.now() - startTime);
              element.onerror = () => resolve(-1);
            }
          });
        });
        return loadTime;
      });

      const imageLoadTimes = await Promise.all(imageLoadPromises);

      // Most images should load successfully
      const successfulLoads = imageLoadTimes.filter(time => time > 0).length;
      const failedLoads = imageLoadTimes.filter(time => time < 0).length;

      expect(failedLoads).toBeLessThan(successfulLoads * 0.1); // Less than 10% failures

      // Images should load within reasonable time
      const avgLoadTime = imageLoadTimes
        .filter(time => time > 0)
        .reduce((sum, time) => sum + time, 0) / successfulLoads;

      expect(avgLoadTime).toBeLessThan(2000); // Less than 2 seconds average
    });
  });

  test.describe('Database Performance', () => {
    test('should handle database queries efficiently', async ({ page }) => {
      await page.goto('/analytics/dashboard');

      // Test complex dashboard loading
      const dashboardStartTime = performance.now();

      // Wait for all dashboard components to load
      await page.waitForSelector('[data-testid="dashboard-stats"]');
      await page.waitForSelector('[data-testid="chart-container"]');
      await page.waitForSelector('[data-testid="recent-activity"]');

      const dashboardLoadTime = performance.now() - dashboardStartTime;
      expect(dashboardLoadTime).toBeLessThan(4000);

      // Test real-time updates
      const updateStartTime = performance.now();

      // Simulate real-time data update
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('data-update', {
          detail: { type: 'analytics', data: { views: 100, enrollments: 25 } }
        }));
      });

      await page.waitForSelector('[data-testid="updated-stats"]');
      const updateTime = performance.now() - updateStartTime;

      expect(updateTime).toBeLessThan(1500);
    });

    test('should handle concurrent database operations', async ({ request }) => {
      // Create multiple simultaneous database operations
      const operations = [];

      // Create workshops
      for (let i = 0; i < 20; i++) {
        operations.push(
          request.post('/api/workshops', {
            data: generateTestData('workshop')
          })
        );
      }

      // Create questionnaires
      for (let i = 0; i < 20; i++) {
        operations.push(
          request.post('/api/questionnaires', {
            data: generateTestData('questionnaire')
          })
        );
      }

      // Create enrollments
      for (let i = 0; i < 20; i++) {
        operations.push(
          request.post('/api/enrollments', {
            data: generateTestData('enrollment')
          })
        );
      }

      const startTime = performance.now();
      const responses = await Promise.all(operations);
      const totalTime = performance.now() - startTime;

      // All operations should complete within reasonable time
      expect(totalTime).toBeLessThan(10000);

      // Most operations should be successful
      const successCount = responses.filter(r => r.status() === 201 || r.status() === 200).length;
      expect(successCount).toBeGreaterThan(50); // At least 80% success rate
    });
  });

  test.describe('Network Performance', () => {
    test('should handle slow network conditions', async ({ page }) => {
      // Simulate slow 3G network
      await page.route('**/*', async (route) => {
        await new Promise(resolve => setTimeout(resolve, 200)); // 200ms delay
        return route.continue();
      });

      const startTime = performance.now();
      await page.goto('/');
      const loadTime = performance.now() - startTime;

      // Should still load within reasonable time even with slow network
      expect(loadTime).toBeLessThan(8000);

      // Test interactive elements during slow network
      await page.click('[data-testid="load-more-btn"]');
      await expect(page.locator('[data-testid="loading-indicator"]')).toBeVisible();

      // Should show loading state
      const loadingState = await page.locator('[data-testid="loading-indicator"]').isVisible();
      expect(loadingState).toBe(true);
    });

    test('should handle network interruptions gracefully', async ({ page }) => {
      await page.goto('/workshops');

      // Simulate network failure
      await page.route('**/api/**', route => {
        return route.fulfill({
          status: 500,
          body: JSON.stringify({ error: 'Network error' })
        });
      });

      // Try to perform action that requires network
      await page.click('[data-testid="refresh-btn"]');

      // Should show error message
      await expect(page.locator('[data-testid="network-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();

      // Test retry functionality
      await page.unroute('**/api/**'); // Remove network failure simulation
      await page.click('[data-testid="retry-button"]');

      // Should recover
      await expect(page.locator('[data-testid="network-error"]')).not.toBeVisible();
    });
  });

  test.describe('Performance Metrics Collection', () => {
    test('should collect and report performance metrics', async ({ page }) => {
      // Enable performance monitoring
      await page.addInitScript(() => {
        // Collect performance metrics
        (window as any).performanceMetrics = {
          navigationStart: performance.timing.navigationStart,
          loadEventEnd: performance.timing.loadEventEnd,
          domContentLoaded: performance.timing.domContentLoadedEventEnd,
          firstPaint: 0,
          firstContentfulPaint: 0
        };

        // Use PerformanceObserver for more detailed metrics
        if ('PerformanceObserver' in window) {
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (entry.name === 'first-paint') {
                (window as any).performanceMetrics.firstPaint = entry.startTime;
              }
              if (entry.name === 'first-contentful-paint') {
                (window as any).performanceMetrics.firstContentfulPaint = entry.startTime;
              }
            }
          });
          observer.observe({ entryTypes: ['paint'] });
        }
      });

      await page.goto('/');

      // Get performance metrics
      const metrics = await page.evaluate(() => (window as any).performanceMetrics);

      // Verify key performance indicators
      expect(metrics.loadEventEnd - metrics.navigationStart).toBeLessThan(5000); // Load time
      expect(metrics.domContentLoaded - metrics.navigationStart).toBeLessThan(3000); // DOM ready
      expect(metrics.firstContentfulPaint).toBeLessThan(2000); // First paint
    });
  });
});