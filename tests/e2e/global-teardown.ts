/**
 * E2E Global Teardown
 * Global cleanup for Playwright E2E tests
 */

import { chromium, FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Cleaning up E2E test environment...');

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Clean up test data
    await page.evaluate(async () => {
      try {
        const response = await fetch('/api/test/cleanup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          console.log('✅ Test data cleaned up successfully');
        }
      } catch (error) {
        console.log('⚠️  Test data cleanup failed');
      }
    });

    // Reset database state
    await page.evaluate(async () => {
      try {
        const response = await fetch('/api/test/reset', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          console.log('✅ Database reset successfully');
        }
      } catch (error) {
        console.log('⚠️  Database reset failed');
      }
    });

    // Clear any test-specific storage
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Clear cookies
    await context.clearCookies();

    console.log('🎉 E2E test environment cleanup complete');

  } catch (error) {
    console.error('❌ E2E teardown failed:', error);
  } finally {
    await context.close();
    await browser.close();
  }
}

export default globalTeardown;