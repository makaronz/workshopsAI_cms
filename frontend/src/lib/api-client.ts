/**
 * Unified API Client for WorkshopsAI CMS
 *
 * This module provides a centralized API client with consistent authentication,
 * error handling, caching, and retry mechanisms across all services.
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { TokenManager } from '@/utils/authTokens';
import { ApiConfig, API_ENDPOINTS, HTTP_STATUS_CODES, ERROR_MESSAGES, validateApiConfig, DEFAULT_API_CONFIG } from './api-config';

// Types for API responses and requests
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data: T;
  meta?: {
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
    timestamp: string;
    requestId?: string;
  };
}

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
  details?: any;
  timestamp: string;
  requestId?: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface RequestOptions extends AxiosRequestConfig {
  skipCache?: boolean;
  skipRetry?: boolean;
  serviceType?: keyof typeof SERVICE_CONFIGS;
}

/**
 * Request cache for GET requests
 */
class RequestCache {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();

  set(key: string, data: any, ttl: number = 300000): void { // 5 minutes default TTL
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  clear(): void {
    this.cache.clear();
  }

  delete(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }
}

/**
 * Retry mechanism with exponential backoff
 */
class RetryManager {
  static async executeWithRetry<T>(
    fn: () => Promise<T>,
    maxAttempts: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;

        // Don't retry on certain status codes
        if (error.response?.status && [400, 401, 403, 404, 422].includes(error.response.status)) {
          throw error;
        }

        // Don't retry on last attempt
        if (attempt === maxAttempts) {
          throw error;
        }

        // Exponential backoff with jitter
        const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));

        console.warn(`Retrying request (attempt ${attempt + 1}/${maxAttempts})`, {
          url: error.config?.url,
          status: error.response?.status
        });
      }
    }

    throw lastError;
  }
}

/**
 * Main API Client class
 */
export class ApiClient {
  private axiosInstance: AxiosInstance;
  private config: ApiConfig;
  private requestCache: RequestCache;
  private isRefreshing = false;
  private refreshPromise: Promise<string | null> | null = null;

  constructor(config: Partial<ApiConfig> = {}) {
    this.config = validateApiConfig(config);
    this.requestCache = new RequestCache();
    this.setupAxiosInstance();
  }

  private setupAxiosInstance(): void {
    this.axiosInstance = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.axiosInstance.interceptors.request.use(
      (config) => {
        // Add authentication header
        const token = TokenManager.getAccessToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        // Add request metadata
        config.metadata = {
          startTime: Date.now(),
          requestId: this.generateRequestId()
        };

        // Log request in development
        if (this.config.enableLogging) {
          console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`, {
            headers: this.sanitizeHeaders(config.headers),
            requestId: config.metadata.requestId
          });
        }

        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.axiosInstance.interceptors.response.use(
      (response) => {
        // Log response in development
        if (this.config.enableLogging) {
          const duration = Date.now() - response.config.metadata?.startTime;
          console.log(`[API Response] ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url}`, {
            duration: `${duration}ms`,
            requestId: response.config.metadata?.requestId
          });
        }

        return response;
      },
      async (error) => {
        const originalRequest = error.config;

        // Log error in development
        if (this.config.enableLogging) {
          console.error(`[API Error] ${error.response?.status || 'Network'} ${originalRequest?.method?.toUpperCase()} ${originalRequest?.url}`, {
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
            requestId: originalRequest?.metadata?.requestId
          });
        }

        // Handle token refresh
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const newToken = await this.refreshAccessToken();
            if (newToken) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              return this.axiosInstance(originalRequest);
            }
          } catch (refreshError) {
            // Refresh failed, clear tokens and redirect
            TokenManager.handleUnauthorized();
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(this.formatError(error));
      }
    );
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private sanitizeHeaders(headers: any): any {
    const sanitized = { ...headers };
    if (sanitized.Authorization) {
      sanitized.Authorization = sanitized.Authorization.replace(/Bearer\s+(.+)/, 'Bearer [REDACTED]');
    }
    return sanitized;
  }

  private async refreshAccessToken(): Promise<string | null> {
    if (this.isRefreshing) {
      return this.refreshPromise || null;
    }

    this.isRefreshing = true;
    this.refreshPromise = this.performTokenRefresh();

    try {
      const result = await this.refreshPromise;
      return result;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  private async performTokenRefresh(): Promise<string | null> {
    const refreshToken = TokenManager.getRefreshToken();
    if (!refreshToken) return null;

    try {
      const response = await axios.post(
        `${this.config.baseURL}/auth/refresh`,
        { refreshToken },
        { timeout: 5000 }
      );

      const { accessToken } = response.data.data || response.data;
      if (accessToken) {
        TokenManager.setAccessToken(accessToken);
        return accessToken;
      }

      return null;
    } catch (error) {
      console.error('Token refresh failed:', error);
      TokenManager.clearTokens();
      return null;
    }
  }

  private formatError(error: any): ApiError {
    const apiError: ApiError = {
      message: ERROR_MESSAGES.SERVER_ERROR,
      timestamp: new Date().toISOString(),
      requestId: error.config?.metadata?.requestId
    };

    if (error.response) {
      // Server response error
      const status = error.response.status;
      apiError.status = status;
      apiError.code = error.response.data?.code;

      // Use server message if available, otherwise use status-based message
      apiError.message = error.response.data?.message ||
                       error.response.data?.error?.message ||
                       this.getStatusMessage(status);

      // Include validation details if available
      if (error.response.data?.details) {
        apiError.details = error.response.data.details;
      }
    } else if (error.request) {
      // Network error
      apiError.message = ERROR_MESSAGES.NETWORK_ERROR;
    } else {
      // Other error
      apiError.message = error.message || ERROR_MESSAGES.SERVER_ERROR;
    }

    return apiError;
  }

  private getStatusMessage(status: number): string {
    switch (status) {
      case HTTP_STATUS_CODES.UNAUTHORIZED:
        return ERROR_MESSAGES.UNAUTHORIZED;
      case HTTP_STATUS_CODES.FORBIDDEN:
        return ERROR_MESSAGES.FORBIDDEN;
      case HTTP_STATUS_CODES.NOT_FOUND:
        return ERROR_MESSAGES.NOT_FOUND;
      case HTTP_STATUS_CODES.TOO_MANY_REQUESTS:
        return ERROR_MESSAGES.RATE_LIMITED;
      case HTTP_STATUS_CODES.SERVICE_UNAVAILABLE:
        return ERROR_MESSAGES.SERVICE_UNAVAILABLE;
      default:
        return ERROR_MESSAGES.SERVER_ERROR;
    }
  }

  private getCacheKey(method: string, url: string, params?: any): string {
    return `${method}:${url}:${JSON.stringify(params || {})}`;
  }

  /**
   * Make HTTP request with caching and retry logic
   */
  public async request<T = any>(
    method: string,
    url: string,
    data?: any,
    options: RequestOptions = {}
  ): Promise<T> {
    const { skipCache = false, skipRetry = false, serviceType, ...axiosOptions } = options;

    // Get service-specific config
    const serviceConfig = serviceType ? SERVICE_CONFIGS[serviceType] : {};
    const maxAttempts = skipRetry ? 1 : (serviceConfig.retryAttempts || this.config.retryAttempts);

    // Check cache for GET requests
    if (method.toLowerCase() === 'get' && this.config.enableCache && !skipCache && serviceConfig.enableCache !== false) {
      const cacheKey = this.getCacheKey(method, url, axiosOptions.params);
      const cachedData = this.requestCache.get(cacheKey);
      if (cachedData) {
        return cachedData;
      }
    }

    const executeRequest = async (): Promise<T> => {
      const response = await this.axiosInstance.request<ApiResponse<T>>({
        method,
        url,
        data,
        ...axiosOptions
      });

      const result = response.data.data || response.data;

      // Cache GET responses
      if (method.toLowerCase() === 'get' && this.config.enableCache && serviceConfig.enableCache !== false) {
        const cacheKey = this.getCacheKey(method, url, axiosOptions.params);
        const ttl = serviceConfig === 'dashboard' ? 60000 : 300000; // Dashboard data cached for 1 minute
        this.requestCache.set(cacheKey, result, ttl);
      }

      return result;
    };

    return skipRetry ? executeRequest() : RetryManager.executeWithRetry(executeRequest, maxAttempts);
  }

  // HTTP method shortcuts
  public async get<T = any>(url: string, params?: any, options?: RequestOptions): Promise<T> {
    return this.request<T>('GET', url, undefined, { ...options, params });
  }

  public async post<T = any>(url: string, data?: any, options?: RequestOptions): Promise<T> {
    return this.request<T>('POST', url, data, options);
  }

  public async put<T = any>(url: string, data?: any, options?: RequestOptions): Promise<T> {
    return this.request<T>('PUT', url, data, options);
  }

  public async patch<T = any>(url: string, data?: any, options?: RequestOptions): Promise<T> {
    return this.request<T>('PATCH', url, data, options);
  }

  public async delete<T = any>(url: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('DELETE', url, undefined, options);
  }

  /**
   * Upload file with progress tracking
   */
  public async upload<T = any>(
    url: string,
    file: File,
    options?: RequestOptions & {
      onProgress?: (progress: number) => void;
      fieldName?: string;
      additionalData?: Record<string, any>;
    }
  ): Promise<T> {
    const { onProgress, fieldName = 'file', additionalData = {}, ...requestOptions } = options;

    const formData = new FormData();
    formData.append(fieldName, file);

    // Add additional form data
    Object.entries(additionalData).forEach(([key, value]) => {
      formData.append(key, value as string);
    });

    return this.request<T>('POST', url, formData, {
      ...requestOptions,
      serviceType: 'upload',
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: onProgress ? (progressEvent) => {
        const progress = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
        onProgress(progress);
      } : undefined
    });
  }

  /**
   * Clear cache (all or by pattern)
   */
  public clearCache(pattern?: string): void {
    if (pattern) {
      this.requestCache.delete(pattern);
    } else {
      this.requestCache.clear();
    }
  }

  /**
   * Get the underlying Axios instance for advanced usage
   */
  public getAxiosInstance(): AxiosInstance {
    return this.axiosInstance;
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<ApiConfig>): void {
    this.config = validateApiConfig({ ...this.config, ...newConfig });
    this.setupAxiosInstance();
  }
}

// Import SERVICE_CONFIGS from api-config
const SERVICE_CONFIGS = {
  auth: {
    timeout: 15000,
    retryAttempts: 2,
    enableCache: false
  },
  workshops: {
    timeout: 30000,
    retryAttempts: 3,
    enableCache: true
  },
  dashboard: {
    timeout: 20000,
    retryAttempts: 2,
    enableCache: true
  },
  upload: {
    timeout: 60000,
    retryAttempts: 1,
    enableCache: false
  }
} as const;

/**
 * Default API client instance
 */
export const apiClient = new ApiClient(DEFAULT_API_CONFIG);

/**
 * Create API client with custom configuration
 */
export function createApiClient(config: Partial<ApiConfig>): ApiClient {
  return new ApiClient(config);
}