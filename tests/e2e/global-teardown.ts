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
    // Clean up test data (if endpoint exists)
    try {
      const cleanupResponse = await page.evaluate(async () => {
        try {
          const response = await fetch('/api/test/cleanup', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            }
          });

          if (response.ok) {
            return { success: true };
          }
          return { success: false, message: 'cleanup endpoint returned error' };
        } catch (error) {
          return { success: true, message: 'cleanup endpoint not found' };
        }
      });

      if (cleanupResponse.success) {
        console.log('✅ Test data cleanup completed');
      }
    } catch (error) {
      console.log('⚠️  Test data cleanup failed');
    }

    // Reset database state (if endpoint exists)
    try {
      const resetResponse = await page.evaluate(async () => {
        try {
          const response = await fetch('/api/test/reset', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            }
          });

          if (response.ok) {
            return { success: true };
          }
          return { success: false };
        } catch (error) {
          return { success: true, message: 'reset endpoint not found' };
        }
      });

      if (resetResponse.success) {
        console.log('✅ Database reset completed');
      }
    } catch (error) {
      console.log('⚠️  Database reset failed');
    }

    // Clear any test-specific storage (with error handling)
    try {
      await page.evaluate(() => {
        try {
          localStorage.clear();
          sessionStorage.clear();
        } catch (error) {
          // Storage might be disabled in some contexts
          console.log('Storage access denied, skipping');
        }
      });
    } catch (error) {
      console.log('Storage cleanup failed, continuing');
    }

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