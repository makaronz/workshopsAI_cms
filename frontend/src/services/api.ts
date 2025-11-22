import authService from './auth';

/**
 * API Client Service
 * Provides a centralized client for making API requests
 * Uses the auth service's axios instance for automatic token management
 */

export const apiClient = authService.getApi();

export default apiClient;
