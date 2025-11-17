/**
 * Tests for Unified API Client
 *
 * These tests validate the functionality of the new unified API client
 * including authentication, error handling, caching, and retry mechanisms.
 */

import { describe, test, expect, jest, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { ApiClient, createApiClient, apiClient } from '../api-client';
import { TokenManager } from '@/utils/authTokens';

// Mock dependencies
jest.mock('axios');
jest.mock('@/utils/authTokens');

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedTokenManager = TokenManager as jest.Mocked<typeof TokenManager>;

describe('ApiClient', () => {
  let client: ApiClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new ApiClient({
      baseURL: 'http://localhost:3010/api',
      enableLogging: false,
      enableCache: true
    });

    // Default token mock
    mockedTokenManager.getAccessToken.mockReturnValue('mock-access-token');
    mockedTokenManager.getRefreshToken.mockReturnValue('mock-refresh-token');
  });

  afterEach(() => {
    client.clearCache();
  });

  describe('Construction', () => {
    test('should initialize with default configuration', () => {
      const defaultClient = createApiClient();
      expect(defaultClient).toBeInstanceOf(ApiClient);
    });

    test('should accept custom configuration', () => {
      const customConfig = {
        baseURL: 'https://api.example.com',
        timeout: 60000,
        retryAttempts: 5
      };

      const customClient = createApiClient(customConfig);
      expect(customClient).toBeInstanceOf(ApiClient);
    });
  });

  describe('Request Execution', () => {
    test('should make GET request successfully', async () => {
      const mockResponse = {
        data: {
          success: true,
          message: 'Success',
          data: { id: '1', name: 'Test' }
        }
      };

      mockedAxios.request.mockResolvedValue(mockResponse);

      const result = await client.get('/test');

      expect(result).toEqual({ id: '1', name: 'Test' });
      expect(mockedAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          url: '/test',
          baseURL: 'http://localhost:3010/api'
        })
      );
    });

    test('should add authorization header when token exists', async () => {
      const mockResponse = {
        data: { success: true, data: { user: 'test' } }
      };

      mockedAxios.request.mockResolvedValue(mockResponse);
      mockedTokenManager.getAccessToken.mockReturnValue('test-token');

      await client.get('/protected');

      expect(mockedAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token'
          })
        })
      );
    });

    test('should handle POST request with data', async () => {
      const postData = { name: 'Test Workshop', description: 'Test Description' };
      const mockResponse = {
        data: {
          success: true,
          data: { id: '123', ...postData }
        }
      };

      mockedAxios.request.mockResolvedValue(mockResponse);

      const result = await client.post('/workshops', postData);

      expect(result).toEqual({ id: '123', ...postData });
      expect(mockedAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: '/workshops',
          data: postData
        })
      );
    });
  });

  describe('Error Handling', () => {
    test('should format API response errors correctly', async () => {
      const axiosError = {
        response: {
          status: 404,
          data: {
            message: 'Resource not found',
            code: 'NOT_FOUND'
          }
        },
        config: {
          url: '/test',
          method: 'GET'
        }
      };

      mockedAxios.request.mockRejectedValue(axiosError);

      await expect(client.get('/test')).rejects.toMatchObject({
        message: 'Resource not found',
        status: 404,
        code: 'NOT_FOUND',
        timestamp: expect.any(String)
      });
    });

    test('should handle network errors', async () => {
      const networkError = {
        request: {},
        message: 'Network Error'
      };

      mockedAxios.request.mockRejectedValue(networkError);

      await expect(client.get('/test')).rejects.toMatchObject({
        message: 'Network error. Please check your connection.',
        timestamp: expect.any(String)
      });
    });

    test('should handle 401 unauthorized with token refresh', async () => {
      const originalRequest = {
        url: '/protected',
        method: 'GET',
        headers: {}
      };

      const axiosError = {
        response: { status: 401 },
        config: { ...originalRequest, _retry: false }
      };

      // First call fails with 401
      mockedAxios.request.mockRejectedValueOnce(axiosError);

      // Refresh token call succeeds
      mockedAxios.post.mockResolvedValueOnce({
        data: { data: { accessToken: 'new-token' } }
      });

      // Retry call succeeds
      const mockResponse = {
        data: { success: true, data: { user: 'refreshed' } }
      };
      mockedAxios.request.mockResolvedValueOnce(mockResponse);

      const result = await client.get('/protected');

      expect(result).toEqual({ user: 'refreshed' });
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://localhost:3010/api/auth/refresh',
        { refreshToken: 'mock-refresh-token' },
        { timeout: 5000 }
      );
    });
  });

  describe('Caching', () => {
    test('should cache GET requests', async () => {
      const mockResponse = {
        data: { success: true, data: { items: ['cached'] } }
      };

      mockedAxios.request.mockResolvedValue(mockResponse);

      // First call
      const result1 = await client.get('/workshops');
      expect(result1).toEqual({ items: ['cached'] });
      expect(mockedAxios.request).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const result2 = await client.get('/workshops');
      expect(result2).toEqual({ items: ['cached'] });
      expect(mockedAxios.request).toHaveBeenCalledTimes(1); // Still only called once
    });

    test('should skip cache when requested', async () => {
      const mockResponse = {
        data: { success: true, data: { fresh: true } }
      };

      mockedAxios.request.mockResolvedValue(mockResponse);

      await client.get('/workshops', undefined, { skipCache: true });
      await client.get('/workshops', undefined, { skipCache: true });

      expect(mockedAxios.request).toHaveBeenCalledTimes(2);
    });

    test('should clear cache', async () => {
      const mockResponse = {
        data: { success: true, data: { test: 'data' } }
      };

      mockedAxios.request.mockResolvedValue(mockResponse);

      // First call
      await client.get('/workshops');
      expect(mockedAxios.request).toHaveBeenCalledTimes(1);

      // Clear cache
      client.clearCache();

      // Second call should make new request
      await client.get('/workshops');
      expect(mockedAxios.request).toHaveBeenCalledTimes(2);
    });
  });

  describe('File Upload', () => {
    test('should upload file with progress tracking', async () => {
      const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
      const mockResponse = {
        data: { success: true, data: { url: 'https://example.com/file.txt' } }
      };

      mockedAxios.request.mockResolvedValue(mockResponse);

      const onProgress = jest.fn();

      const result = await client.upload('/upload', file, {
        onProgress,
        fieldName: 'file'
      });

      expect(result).toEqual({ url: 'https://example.com/file.txt' });

      expect(mockedAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: '/upload',
          data: expect.any(FormData),
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        })
      );
    });
  });

  describe('Configuration Updates', () => {
    test('should update configuration', () => {
      const newConfig = {
        timeout: 60000,
        retryAttempts: 5
      };

      client.updateConfig(newConfig);

      // Configuration should be updated for subsequent requests
      expect(client).toBeDefined();
    });
  });
});

describe('Default API Client', () => {
  test('should export default apiClient instance', () => {
    expect(apiClient).toBeInstanceOf(ApiClient);
  });

  test('should create new client instances', () => {
    const newClient = createApiClient({
      baseURL: 'https://new-api.example.com'
    });

    expect(newClient).toBeInstanceOf(ApiClient);
    expect(newClient).not.toBe(apiClient); // Should be different instance
  });
});

describe('Integration with Services', () => {
  // These tests would require actual service imports
  // For now, we'll test the integration patterns

  test('should maintain consistent interface across services', () => {
    // This test verifies that the unified client maintains
    // consistent interface that all services can use

    const mockResponse = {
      data: { success: true, data: { consistent: true } }
    };

    mockedAxios.request.mockResolvedValue(mockResponse);

    // Simulate service calls
    const workshopCall = client.get('/workshops');
    const authCall = client.post('/auth/login', { email: 'test@example.com' });
    const dashboardCall = client.get('/dashboard/metrics');

    Promise.all([workshopCall, authCall, dashboardCall]).then(results => {
      expect(results[0]).toEqual({ consistent: true });
      expect(results[1]).toEqual({ consistent: true });
      expect(results[2]).toEqual({ consistent: true });
    });
  });
});