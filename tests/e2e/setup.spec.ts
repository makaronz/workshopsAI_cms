/**
 * E2E Test Setup
 * Global setup and teardown for Playwright E2E tests
 */

import { test, expect } from '@playwright/test';

test.describe('E2E Test Setup', () => {
  test('setup test environment', async ({ page }) => {
    // Verify the test environment is ready
    await page.goto('/');

    // Check if the application is running
    const title = await page.title();
    expect(title).toBeDefined();

    // Wait for the app to be fully loaded
    await page.waitForLoadState('networkidle');
  });

  test('cleanup test environment', async ({ page }) => {
    // Cleanup any test data
    await page.goto('/api/test/cleanup', { waitUntil: 'networkidle' });

    // Verify cleanup was successful
    const response = await page.evaluate(() => {
      return fetch('/api/test/verify-cleanup')
        .then(res => res.json())
        .catch(() => ({ success: false }));
    });

    expect(response.success).toBe(true);
  });
});