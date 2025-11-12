/**
 * Test Setup File
 * Global setup for all tests
 */

import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DB_NAME = 'workshopsai_cms_test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-purposes-only';
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret-key-for-testing-purposes-only';

// Mock console methods to reduce noise in test output
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Setup global test utilities
beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();
});

// Global test timeout
jest.setTimeout(30000);

// Mock environment variables for tests
process.env.TEST_MODE = 'true';
process.env.SKIP_AUTH = 'true';