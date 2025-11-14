/**
 * E2E Global Setup
 * Global setup for Playwright E2E tests
 */

import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Setting up E2E test environment...');

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Wait for the application to be ready
    const maxRetries = 30;
    let retries = 0;
    let isReady = false;

    while (retries < maxRetries && !isReady) {
      try {
        await page.goto(process.env.BASE_URL || 'http://localhost:3000', {
          waitUntil: 'networkidle',
          timeout: 5000
        });

        // Check if the application is responding
        const isAppRunning = await page.evaluate(() => {
          return document.readyState === 'complete' &&
                 document.querySelector('body') !== null;
        });

        if (isAppRunning) {
          isReady = true;
          console.log('✅ Application is ready for E2E testing');
        } else {
          retries++;
          console.log(`⏳ Waiting for application to be ready... (${retries}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        retries++;
        console.log(`⏳ Application not ready yet, retrying... (${retries}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    if (!isReady) {
      throw new Error('❌ Application failed to start within expected time');
    }

    // Initialize test database if needed
    await page.evaluate(async () => {
      try {
        const response = await fetch('/api/test/setup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          console.log('✅ Test database initialized');
        }
      } catch (error) {
        console.log('⚠️  Test database initialization failed, continuing anyway');
      }
    });

    // Seed test data
    await page.evaluate(async () => {
      try {
        const response = await fetch('/api/test/seed', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            users: true,
            workshops: true,
            questionnaires: true
          })
        });

        if (response.ok) {
          console.log('✅ Test data seeded successfully');
        }
      } catch (error) {
        console.log('⚠️  Test data seeding failed, tests may not work correctly');
      }
    });

    // Verify health endpoints
    try {
      const healthResponse = await page.evaluate(async () => {
        const response = await fetch('/api/health');
        return {
          status: response.status,
          ok: response.ok,
          body: await response.json()
        };
      });

      if (healthResponse.ok) {
        console.log('✅ Health check passed');
      } else {
        console.log('⚠️  Health check failed:', healthResponse);
      }
    } catch (error) {
      console.log('⚠️  Health check failed:', error);
    }

  } catch (error) {
    console.error('❌ E2E setup failed:', error);
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }

  console.log('🎉 E2E test environment setup complete');
}

export default globalSetup;