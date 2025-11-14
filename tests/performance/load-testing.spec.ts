/**
 * Performance Testing Suite
 * Load testing and performance metrics validation
 */

import { test, expect } from '@playwright/test';
import { performance } from 'perf_hooks';

test.describe('Performance Testing Suite', () => {
  test.describe('Page Load Performance', () => {
    test('should load homepage within performance budget', async ({ page }) => {
      const startTime = performance.now();

      await page.goto('/', { waitUntil: 'networkidle' });

      const endTime = performance.now();
      const loadTime = endTime - startTime;

      // Page should load within 3 seconds
      expect(loadTime).toBeLessThan(3000);

      // Check Core Web Vitals
      const vitals = await page.evaluate(() => {
        return new Promise((resolve) => {
          const observer = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const vitals: any = {};

            entries.forEach((entry) => {
              if (entry.entryType === 'navigation') {
                vitals.domContentLoaded = entry.domContentLoadedEventEnd - entry.domContentLoadedEventStart;
                vitals.loadComplete = entry.loadEventEnd - entry.loadEventStart;
              }
            });

            resolve(vitals);
          });

          observer.observe({ entryTypes: ['navigation'] });

          // Fallback timeout
          setTimeout(() => resolve({}), 5000);
        });
      });

      // DOM should be loaded within 1.5 seconds
      if (vitals.domContentLoaded) {
        expect(vitals.domContentLoaded).toBeLessThan(1500);
      }
    });

    test('should have optimized bundle sizes', async ({ page }) => {
      const responses: any[] = [];

      page.on('response', (response) => {
        if (response.url().includes('.js') || response.url().includes('.css')) {
          responses.push({
            url: response.url(),
            size: parseInt(response.headers()['content-length'] || '0')
          });
        }
      });

      await page.goto('/', { waitUntil: 'networkidle' });

      // Check total JavaScript bundle size (should be under 1MB)
      const jsTotalSize = responses
        .filter(r => r.url.includes('.js'))
        .reduce((total, r) => total + r.size, 0);

      expect(jsTotalSize).toBeLessThan(1024 * 1024); // 1MB

      // Check total CSS bundle size (should be under 200KB)
      const cssTotalSize = responses
        .filter(r => r.url.includes('.css'))
        .reduce((total, r) => total + r.size, 0);

      expect(cssTotalSize).toBeLessThan(200 * 1024); // 200KB
    });

    test('should use efficient caching strategies', async ({ page }) => {
      const responses: any[] = [];

      page.on('response', (response) => {
        responses.push({
          url: response.url(),
          status: response.status(),
          cacheControl: response.headers()['cache-control'],
            etag: response.headers()['etag'],
            lastModified: response.headers()['last-modified']
        });
      });

      await page.goto('/', { waitUntil: 'networkidle' });

      // Check that static assets have proper cache headers
      const staticAssets = responses.filter(r =>
        r.url.includes('.js') || r.url.includes('.css') || r.url.includes('.png') || r.url.includes('.jpg')
      );

      for (const asset of staticAssets.slice(0, 5)) {
        // Static assets should have cache-control headers
        expect(asset.cacheControl).toBeDefined();

        // Should have long cache durations for immutable assets
        if (asset.url.includes('hash') || asset.url.includes('v=')) {
          expect(asset.cacheControl).toContain('max-age=');
        }
      }
    });

    test('should minimize layout shifts', async ({ page }) => {
      const cumulativeLayoutShift = await page.evaluate(() => {
        return new Promise((resolve) => {
          let clsValue = 0;
          const observer = new PerformanceObserver((list) => {
            list.getEntries().forEach((entry) => {
              if (!entry.hadRecentInput) {
                clsValue += entry.value;
              }
            });
            resolve(clsValue);
          });

          observer.observe({ entryTypes: ['layout-shift'] });

          // Wait for layout shifts to settle
          setTimeout(() => {
            resolve(clsValue);
          }, 3000);
        });
      });

      // CLS should be less than 0.1 for good user experience
      expect(cumulativeLayoutShift).toBeLessThan(0.1);
    });
  });

  test.describe('API Performance', () => {
    test('should respond to API requests quickly', async ({ page }) => {
      const apiResponses: any[] = [];

      page.on('response', (response) => {
        if (response.url().includes('/api/')) {
          const startTime = performance.now();
          response.text().then(() => {
            const endTime = performance.now();
            apiResponses.push({
              url: response.url(),
              status: response.status(),
              responseTime: endTime - startTime
            });
          });
        }
      });

      await page.goto('/dashboard', { waitUntil: 'networkidle' });

      // API responses should be under 500ms
      for (const response of apiResponses) {
        expect(response.responseTime).toBeLessThan(500);
        expect(response.status).toBeLessThan(500);
      }

      // Average response time should be under 200ms
      const avgResponseTime = apiResponses.reduce((sum, r) => sum + r.responseTime, 0) / apiResponses.length;
      expect(avgResponseTime).toBeLessThan(200);
    });

    test('should handle concurrent requests efficiently', async ({ page }) => {
      const startTime = performance.now();

      // Simulate concurrent API calls
      const promises = [
        page.evaluate(() => fetch('/api/workshops').then(r => r.json())),
        page.evaluate(() => fetch('/api/questionnaires').then(r => r.json())),
        page.evaluate(() => fetch('/api/users/profile').then(r => r.json()))
      ];

      await Promise.all(promises);

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Concurrent requests should complete in under 1 second
      expect(totalTime).toBeLessThan(1000);
    });

    test('should implement rate limiting', async ({ page }) => {
      let blockedRequests = 0;
      let successfulRequests = 0;

      page.on('response', (response) => {
        if (response.url().includes('/api/')) {
          if (response.status() === 429) {
            blockedRequests++;
          } else if (response.status() < 400) {
            successfulRequests++;
          }
        }
      });

      // Make rapid requests to trigger rate limiting
      const promises = Array(20).fill(null).map(() =>
        page.evaluate(() => fetch('/api/workshops', { method: 'GET' }))
      );

      await Promise.allSettled(promises);

      // Should have some requests blocked by rate limiting
      expect(blockedRequests).toBeGreaterThan(0);
      expect(successfulRequests).toBeGreaterThan(0);
    });
  });

  test.describe('Memory Performance', () => {
    test('should not have memory leaks', async ({ page }) => {
      // Get initial memory usage
      const initialMemory = await page.evaluate(() => {
        return (performance as any).memory?.usedJSHeapSize || 0;
      });

      // Perform multiple actions that could cause memory leaks
      for (let i = 0; i < 10; i++) {
        await page.goto('/workshops');
        await page.waitForLoadState('networkidle');

        // Simulate user interactions
        await page.click('[data-testid="filter-button"]');
        await page.fill('[data-testid="search-input"]', `test ${i}`);
        await page.click('[data-testid="clear-search"]');

        // Wait a bit for garbage collection
        await page.waitForTimeout(100);
      }

      // Force garbage collection if available
      try {
        await page.evaluate(() => {
          if ((window as any).gc) {
            (window as any).gc();
          }
        });
      } catch (e) {
        // Ignore if gc is not available
      }

      // Get final memory usage
      const finalMemory = await page.evaluate(() => {
        return (performance as any).memory?.usedJSHeapSize || 0;
      });

      // Memory should not have grown significantly (allow 50% growth for testing)
      const memoryGrowth = finalMemory - initialMemory;
      const memoryGrowthPercent = (memoryGrowth / initialMemory) * 100;

      expect(memoryGrowthPercent).toBeLessThan(50);
    });

    test('should efficiently manage DOM nodes', async ({ page }) => {
      await page.goto('/workshops');
      await page.waitForLoadState('networkidle');

      // Get initial DOM node count
      const initialNodeCount = await page.evaluate(() => document.querySelectorAll('*').length);

      // Add many items to the page (simulate a long list)
      await page.evaluate(() => {
        const container = document.createElement('div');
        container.id = 'test-container';
        document.body.appendChild(container);

        for (let i = 0; i < 1000; i++) {
          const item = document.createElement('div');
          item.textContent = `Item ${i}`;
          item.className = 'test-item';
          container.appendChild(item);
        }
      });

      // Check node count after adding items
      const peakNodeCount = await page.evaluate(() => document.querySelectorAll('*').length);

      // Remove the test items
      await page.evaluate(() => {
        const container = document.getElementById('test-container');
        if (container) {
          container.remove();
        }
      });

      // Check that DOM nodes were properly cleaned up
      const finalNodeCount = await page.evaluate(() => document.querySelectorAll('*').length);

      // Node count should return close to initial
      expect(finalNodeCount).toBeLessThanOrEqual(initialNodeCount + 10);
      expect(peakNodeCount).toBeGreaterThan(finalNodeCount);
    });
  });

  test.describe('Mobile Performance', () => {
    test.beforeEach(async ({ page }) => {
      // Simulate mobile device
      await page.setViewportSize({ width: 375, height: 667 });

      // Simulate slower network
      await page.route('**/*', (route) => {
        // Add artificial delay for images and fonts
        if (route.request().resourceType() === 'image' || route.request().resourceType() === 'font') {
          setTimeout(() => route.continue(), 500);
        } else {
          route.continue();
        }
      });
    });

    test('should perform well on mobile devices', async ({ page }) => {
      const startTime = performance.now();

      await page.goto('/', { waitUntil: 'networkidle' });

      const endTime = performance.now();
      const loadTime = endTime - startTime;

      // Mobile load time should be under 4 seconds (allowing for slower network)
      expect(loadTime).toBeLessThan(4000);

      // Check that the page is responsive
      const isMobileOptimized = await page.evaluate(() => {
        const viewport = document.querySelector('meta[name="viewport"]');
        return viewport && viewport.getAttribute('content')?.includes('width=device-width');
      });

      expect(isMobileOptimized).toBe(true);
    });

    test('should implement efficient image loading on mobile', async ({ page }) => {
      const imageLoadTimes: number[] = [];

      page.on('response', (response) => {
        if (response.request().resourceType() === 'image') {
          const startTime = performance.now();
          response.text().then(() => {
            const endTime = performance.now();
            imageLoadTimes.push(endTime - startTime);
          });
        }
      });

      await page.goto('/workshops', { waitUntil: 'networkidle' });

      // Images should be optimized for mobile
      if (imageLoadTimes.length > 0) {
        const avgImageLoadTime = imageLoadTimes.reduce((sum, time) => sum + time, 0) / imageLoadTimes.length;

        // With the artificial delay, images should still load reasonably quickly
        expect(avgImageLoadTime).toBeLessThan(1000);
      }
    });
  });

  test.describe('Database Performance', () => {
    test('should handle database queries efficiently', async ({ page }) => {
      // This test would typically involve actual database monitoring
      // For now, we'll simulate it through API response times

      const queryTimes: number[] = [];

      page.on('response', async (response) => {
        if (response.url().includes('/api/') && response.status() < 400) {
          const startTime = performance.now();
          await response.text();
          const endTime = performance.now();
          queryTimes.push(endTime - startTime);
        }
      });

      // Navigate through different pages to trigger various database queries
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      await page.goto('/workshops');
      await page.waitForLoadState('networkidle');

      await page.goto('/questionnaires');
      await page.waitForLoadState('networkidle');

      // Database-backed responses should be efficient
      if (queryTimes.length > 0) {
        const avgQueryTime = queryTimes.reduce((sum, time) => sum + time, 0) / queryTimes.length;

        // Database queries should be under 300ms on average
        expect(avgQueryTime).toBeLessThan(300);

        // No single query should take more than 1 second
        const maxQueryTime = Math.max(...queryTimes);
        expect(maxQueryTime).toBeLessThan(1000);
      }
    });

    test('should implement database connection pooling', async ({ page }) => {
      // This is a simplified test - in reality you'd monitor database connections
      const concurrentRequests = 10;
      const responses: any[] = [];

      page.on('response', (response) => {
        if (response.url().includes('/api/workshops')) {
          const startTime = performance.now();
          response.text().then(() => {
            const endTime = performance.now();
            responses.push(endTime - startTime);
          });
        }
      });

      // Make concurrent requests to test connection pooling
      const promises = Array(concurrentRequests).fill(null).map(() =>
        page.evaluate(() => fetch('/api/workshops').then(r => r.json()))
      );

      await Promise.all(promises);

      // With connection pooling, concurrent requests should be handled efficiently
      expect(responses.length).toBe(concurrentRequests);

      // Response times should be reasonably consistent (indicating pooling is working)
      const avgResponseTime = responses.reduce((sum, time) => sum + time, 0) / responses.length;
      const maxResponseTime = Math.max(...responses);

      // Max response time shouldn't be dramatically higher than average
      expect(maxResponseTime).toBeLessThan(avgResponseTime * 2);
    });
  });

  test.describe('Stress Testing', () => {
    test('should handle high load without degradation', async ({ page }) => {
      const baselineResponseTime = await page.evaluate(async () => {
        const start = performance.now();
        await fetch('/api/workshops');
        return performance.now() - start;
      });

      // Simulate high load by making many rapid requests
      const promises = Array(50).fill(null).map(() =>
        page.evaluate(() => fetch('/api/workshops').then(r => r.ok))
      );

      const results = await Promise.allSettled(promises);

      const successfulRequests = results.filter(r =>
        r.status === 'fulfilled' && r.value === true
      ).length;

      // Should handle most requests successfully under stress
      expect(successfulRequests).toBeGreaterThan(40);

      // Check response time after stress
      const stressResponseTime = await page.evaluate(async () => {
        const start = performance.now();
        await fetch('/api/workshops');
        return performance.now() - start;
      });

      // Response time should not have degraded significantly
      expect(stressResponseTime).toBeLessThan(baselineResponseTime * 2);
    });
  });
});