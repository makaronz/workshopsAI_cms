import type { FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting E2E test cleanup...');

  // Perform any global cleanup here
  // For example:
  // - Clean up test database
  // - Clear any temporary files
  // - Reset external services

  console.log('✅ E2E test cleanup completed');
}

export default globalTeardown;