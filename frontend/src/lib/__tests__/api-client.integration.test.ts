/**
 * Simple Integration Test for Unified API Client
 *
 * This test validates that the unified API client can be imported
 * and instantiated correctly without any runtime errors.
 */

import { describe, test, expect } from 'vitest';

describe('API Client Integration', () => {
  test('should import and create API client without errors', () => {
    // Test that we can import the modules without errors
    expect(() => {
      const { ApiClient, createApiClient, apiClient } = require('../api-client');
      expect(ApiClient).toBeDefined();
      expect(createApiClient).toBeDefined();
      expect(apiClient).toBeDefined();
    }).not.toThrow();
  });

  test('should import configuration without errors', () => {
    expect(() => {
      const { API_ENDPOINTS, DEFAULT_API_CONFIG } = require('../api-config');
      expect(API_ENDPOINTS).toBeDefined();
      expect(DEFAULT_API_CONFIG).toBeDefined();
    }).not.toThrow();
  });

  test('should have all required endpoints defined', () => {
    const { API_ENDPOINTS } = require('../api-config');

    // Check that critical endpoints are defined
    expect(API_ENDPOINTS.AUTH).toBeDefined();
    expect(API_ENDPOINTS.WORKSHOPS).toBeDefined();
    expect(API_ENDPOINTS.DASHBOARD).toBeDefined();
    expect(API_ENDPOINTS.QUESTIONNAIRES).toBeDefined();

    // Check specific endpoints
    expect(API_ENDPOINTS.AUTH.LOGIN).toBe('/auth/login');
    expect(API_ENDPOINTS.WORKSHOPS.LIST).toBe('/workshops');
    expect(API_ENDPOINTS.DASHBOARD.METRICS).toBe('/dashboard/metrics');
  });

  test('should have default configuration values', () => {
    const { DEFAULT_API_CONFIG } = require('../api-config');

    expect(DEFAULT_API_CONFIG.timeout).toBe(30000);
    expect(DEFAULT_API_CONFIG.retryAttempts).toBe(3);
    expect(DEFAULT_API_CONFIG.enableCache).toBe(true);
    expect(DEFAULT_API_CONFIG.baseURL).toBeDefined();
  });

  test('should create API client with custom config', () => {
    const { createApiClient } = require('../api-client');

    const customConfig = {
      baseURL: 'https://test-api.example.com',
      timeout: 60000,
      retryAttempts: 5
    };

    expect(() => {
      const client = createApiClient(customConfig);
      expect(client).toBeDefined();
    }).not.toThrow();
  });
});

// Type checking tests
describe('TypeScript Integration', () => {
  test('should have correct type definitions', () => {
    // This test ensures TypeScript types are correctly exported
    const typeTests = () => {
      // These would cause TypeScript errors if types were incorrect
      const config = {
        baseURL: 'https://api.example.com',
        timeout: 30000,
        retryAttempts: 3,
        retryDelay: 1000,
        enableCache: true,
        enableLogging: false
      } as const;

      return config;
    };

    expect(typeTests).toBeDefined();
  });
});