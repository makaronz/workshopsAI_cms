import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import authService from '../auth';

export interface MigrationStatus {
  phase: 'pre-migration' | 'migration' | 'post-migration' | 'complete';
  features: {
    caching: 'redis' | 'memory' | 'database';
    sessions: 'redis' | 'database' | 'hybrid';
    queues: 'redis' | 'database' | 'disabled';
  };
  timestamp: Date;
  estimatedCompletion?: Date;
}

export interface RetryConfig {
  maxRetries: number;
  retryDelay: number;
  retryCondition?: (error: any) => boolean;
  onRetry?: (retryCount: number, error: any) => void;
}

export interface CacheOptions {
  ttl?: number;
  strategy?: 'cache-first' | 'network-first' | 'cache-only' | 'network-only';
  invalidateOnMutation?: boolean;
  tag?: string;
}

class MigrationAwareApiClient {
  private api: AxiosInstance;
  private memoryCache = new Map<string, { value: any; expires: number; tags: Set<string> }>();
  private pendingRequests = new Map<string, Promise<any>>();
  private migrationStatus: MigrationStatus | null = null;
  private performanceMetrics = {
    cacheHits: 0,
    cacheMisses: 0,
    networkRequests: 0,
    errors: 0,
    retries: 0
  };

  constructor() {
    this.api = authService.getApi();

    // Initialize migration status
    this.detectMigrationPhase();

    // Set up request/response interceptors
    this.setupInterceptors();

    // Clean up expired cache entries periodically
    setInterval(() => this.cleanExpiredCache(), 60000); // Every minute
  }

  private async detectMigrationPhase(): Promise<void> {
    try {
      // Try to detect migration phase from API
      const response = await this.api.get<MigrationStatus>('/system/migration/status', {
        timeout: 2000
      }).catch(() => null);

      if (response?.data) {
        this.migrationStatus = response.data;
      } else {
        // Default to pre-migration if endpoint doesn't exist
        this.migrationStatus = {
          phase: 'pre-migration',
          features: {
            caching: 'redis',
            sessions: 'redis',
            queues: 'redis'
          },
          timestamp: new Date()
        };
      }
    } catch (error) {
      console.warn('Failed to detect migration phase, assuming pre-migration:', error);
      this.migrationStatus = {
        phase: 'pre-migration',
        features: {
          caching: 'redis',
          sessions: 'redis',
          queues: 'redis'
        },
        timestamp: new Date()
      };
    }
  }

  private setupInterceptors(): void {
    // Request interceptor for migration headers
    this.api.interceptors.request.use(
      (config) => {
        // Add migration awareness headers
        config.headers['X-Migration-Phase'] = this.migrationStatus?.phase || 'unknown';
        config.headers['X-Client-Capabilities'] = JSON.stringify({
          memoryCache: true,
          retryLogic: true,
          fallbackHandling: true,
          performanceMonitoring: true
        });

        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for migration handling
    this.api.interceptors.response.use(
      (response) => {
        this.performanceMetrics.networkRequests++;

        // Update migration status if provided
        const migrationHeader = response.headers['x-migration-status'];
        if (migrationHeader) {
          try {
            this.migrationStatus = JSON.parse(migrationHeader);
          } catch (e) {
            console.warn('Invalid migration status header:', migrationHeader);
          }
        }

        return response;
      },
      async (error) => {
        this.performanceMetrics.errors++;

        // Handle migration-specific errors
        if (this.isMigrationRelatedError(error)) {
          return this.handleMigrationError(error);
        }

        // Standard error handling with retry
        if (this.shouldRetry(error)) {
          return this.retryRequest(error.config);
        }

        return Promise.reject(error);
      }
    );
  }

  private isMigrationRelatedError(error: any): boolean {
    const errorMessage = error?.response?.data?.message || error?.message;
    const migrationKeywords = [
      'redis',
      'cache',
      'session',
      'queue',
      'migration',
      'unavailable',
      'degraded'
    ];

    return migrationKeywords.some(keyword =>
      errorMessage?.toLowerCase().includes(keyword)
    );
  }

  private async handleMigrationError(error: any): Promise<never> {
    const status = error?.response?.status;
    const message = error?.response?.data?.message;

    // Log migration-specific errors
    console.warn('Migration-related error:', {
      status,
      message,
      phase: this.migrationStatus?.phase,
      url: error.config?.url
    });

    // Apply migration-specific fallbacks
    if (status === 503 && message?.includes('redis')) {
      // Redis unavailable - switch to in-memory caching
      await this.switchToMemoryCache();
    }

    // Re-throw with migration context
    const migrationError = new Error(message || 'Migration-related service unavailable');
    (migrationError as any).isMigrationError = true;
    (migrationError as any).migrationPhase = this.migrationStatus?.phase;
    (migrationError as any).originalError = error;

    throw migrationError;
  }

  private async switchToMemoryCache(): Promise<void> {
    if (this.migrationStatus) {
      this.migrationStatus.features.caching = 'memory';
      console.info('Switched to in-memory caching due to Redis unavailability');
    }
  }

  private shouldRetry(error: any): boolean {
    const status = error?.response?.status;
    const config = error?.config;

    // Don't retry if already retried
    if (config?._retryCount) {
      return false;
    }

    // Retry on network errors or 5xx errors
    return !status || status >= 500 || status === 429;
  }

  private async retryRequest(config: AxiosRequestConfig, retryConfig: RetryConfig = {
    maxRetries: 3,
    retryDelay: 1000
  }): Promise<AxiosResponse> {
    config._retryCount = (config._retryCount || 0) + 1;
    this.performanceMetrics.retries++;

    if (config._retryCount > retryConfig.maxRetries) {
      throw new Error(`Max retries (${retryConfig.maxRetries}) exceeded`);
    }

    // Call retry callback if provided
    retryConfig.onRetry?.(config._retryCount, config._lastError);

    // Calculate delay with exponential backoff
    const delay = retryConfig.retryDelay * Math.pow(2, config._retryCount - 1);
    await new Promise(resolve => setTimeout(resolve, delay));

    return this.api(config);
  }

  // Cache management
  private getCacheKey(config: AxiosRequestConfig): string {
    const { method, url, params, data } = config;
    return `${method}:${url}:${JSON.stringify(params)}:${JSON.stringify(data)}`;
  }

  private getFromCache(key: string): any | null {
    const cached = this.memoryCache.get(key);
    if (cached && cached.expires > Date.now()) {
      this.performanceMetrics.cacheHits++;
      cached.expires = Math.max(cached.expires, Date.now() + (cached.expires - Date.now()) * 0.5); // Extend TTL on access
      return cached.value;
    }

    if (cached) {
      this.memoryCache.delete(key);
    }

    this.performanceMetrics.cacheMisses++;
    return null;
  }

  private setCache(key: string, value: any, ttl: number = 300000, tags: string[] = []): void {
    const expires = Date.now() + ttl;
    this.memoryCache.set(key, { value, expires, tags: new Set(tags) });
  }

  private cleanExpiredCache(): void {
    const now = Date.now();
    for (const [key, value] of this.memoryCache.entries()) {
      if (value.expires <= now) {
        this.memoryCache.delete(key);
      }
    }
  }

  private invalidateCacheByTags(tags: string[]): void {
    for (const [key, value] of this.memoryCache.entries()) {
      if (tags.some(tag => value.tags.has(tag))) {
        this.memoryCache.delete(key);
      }
    }
  }

  // Public API methods
  async request<T = any>(config: AxiosRequestConfig, options: {
    retry?: RetryConfig;
    cache?: CacheOptions;
  } = {}): Promise<T> {
    const { retry, cache } = options;

    // Check cache for GET requests
    if (config.method?.toLowerCase() === 'get' && cache?.strategy !== 'network-only') {
      const cacheKey = this.getCacheKey(config);

      if (cache?.strategy === 'cache-first' || cache?.strategy === 'cache-only') {
        const cached = this.getFromCache(cacheKey);
        if (cached) return cached;

        if (cache?.strategy === 'cache-only') {
          throw new Error('Cache miss and cache-only strategy');
        }
      }
    }

    // Deduplicate concurrent requests
    const requestKey = JSON.stringify(config);
    if (this.pendingRequests.has(requestKey)) {
      return this.pendingRequests.get(requestKey);
    }

    const promise = this.executeRequest<T>(config, retry);
    this.pendingRequests.set(requestKey, promise);

    try {
      const result = await promise;

      // Cache GET responses
      if (config.method?.toLowerCase() === 'get' && cache?.strategy !== 'network-only') {
        const cacheKey = this.getCacheKey(config);
        const ttl = cache?.ttl || 300000; // 5 minutes default
        this.setCache(cacheKey, result, ttl, cache?.tag ? [cache.tag] : []);
      }

      return result;
    } finally {
      this.pendingRequests.delete(requestKey);
    }
  }

  private async executeRequest<T>(config: AxiosRequestConfig, retry?: RetryConfig): Promise<T> {
    try {
      const response = await this.api.request<T>(config);
      return response.data;
    } catch (error) {
      if (retry && this.shouldRetry(error)) {
        return this.retryRequest(config, retry).then(r => r.data);
      }
      throw error;
    }
  }

  // Convenience methods
  async get<T = any>(url: string, config?: AxiosRequestConfig, options?: { retry?: RetryConfig; cache?: CacheOptions }): Promise<T> {
    return this.request<T>({ ...config, method: 'GET', url }, options);
  }

  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig, options?: { retry?: RetryConfig }): Promise<T> {
    // Invalidate cache by mutation
    if (config?.headers?.['X-Cache-Tag']) {
      this.invalidateCacheByTags([config.headers['X-Cache-Tag']]);
    }

    return this.request<T>({ ...config, method: 'POST', url, data }, options);
  }

  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig, options?: { retry?: RetryConfig }): Promise<T> {
    if (config?.headers?.['X-Cache-Tag']) {
      this.invalidateCacheByTags([config.headers['X-Cache-Tag']]);
    }

    return this.request<T>({ ...config, method: 'PUT', url, data }, options);
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig, options?: { retry?: RetryConfig }): Promise<T> {
    if (config?.headers?.['X-Cache-Tag']) {
      this.invalidateCacheByTags([config.headers['X-Cache-Tag']]);
    }

    return this.request<T>({ ...config, method: 'DELETE', url }, options);
  }

  // Migration status and metrics
  getMigrationStatus(): MigrationStatus | null {
    return this.migrationStatus;
  }

  getPerformanceMetrics() {
    const cacheHitRate = this.performanceMetrics.cacheHits /
      (this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses) * 100;

    return {
      ...this.performanceMetrics,
      cacheHitRate: isNaN(cacheHitRate) ? 0 : cacheHitRate,
      cacheSize: this.memoryCache.size,
      pendingRequests: this.pendingRequests.size
    };
  }

  // Cache warming
  async warmCache<T = any>(requests: Array<{ url: string; config?: AxiosRequestConfig; ttl?: number }>): Promise<void> {
    const warmingPromises = requests.map(async ({ url, config, ttl }) => {
      try {
        const cacheKey = this.getCacheKey({ ...config, method: 'GET', url });
        if (!this.memoryCache.has(cacheKey)) {
          const data = await this.get<T>(url, config);
          this.setCache(cacheKey, data, ttl || 300000);
        }
      } catch (error) {
        console.warn(`Cache warming failed for ${url}:`, error);
      }
    });

    await Promise.allSettled(warmingPromises);
  }

  // Health check
  async healthCheck(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; details: any }> {
    try {
      const startTime = Date.now();
      await this.api.get('/health', { timeout: 5000 });
      const responseTime = Date.now() - startTime;

      return {
        status: responseTime < 1000 ? 'healthy' : responseTime < 3000 ? 'degraded' : 'unhealthy',
        details: {
          responseTime,
          migrationPhase: this.migrationStatus?.phase,
          cacheSize: this.memoryCache.size,
          performanceMetrics: this.getPerformanceMetrics()
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error.message,
          migrationPhase: this.migrationStatus?.phase,
          performanceMetrics: this.getPerformanceMetrics()
        }
      };
    }
  }
}

// Export singleton instance
export const migrationApiClient = new MigrationAwareApiClient();
export default migrationApiClient;