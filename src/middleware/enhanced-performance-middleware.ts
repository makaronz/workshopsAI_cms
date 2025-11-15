import { Request, Response, NextFunction } from 'express';
import { enhancedPerformanceMonitoringService } from '../services/enhanced-performance-monitoring-service';
import { enhancedCachingService } from '../services/enhanced-caching-service';
import { optimizedRedisService } from '../config/optimized-redis';
import { logger } from '../utils/logger';

/**
 * Enhanced Performance Middleware
 *
 * Integrates with the enhanced performance monitoring and caching services
 * to provide comprehensive request tracking, endpoint performance analysis,
 * and intelligent caching based on request patterns.
 */

export interface EnhancedPerformanceMetrics {
  requestCount: number;
  totalResponseTime: number;
  averageResponseTime: number;
  errorRate: number;
  lastResetTime: Date;
  endpointMetrics: Map<string, {
    count: number;
    totalResponseTime: number;
    averageResponseTime: number;
    errorCount: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
  }>;
}

class EnhancedPerformanceMiddleware {
  private metrics: EnhancedPerformanceMetrics = {
    requestCount: 0,
    totalResponseTime: 0,
    averageResponseTime: 0,
    errorRate: 0,
    lastResetTime: new Date(),
    endpointMetrics: new Map(),
  };
  private errorCount = 0;
  private responseTimeBuffer: number[] = [];
  private maxBufferSize = 1000;

  /**
   * Enhanced request timing middleware with caching integration
   */
  requestTiming() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      const endpoint = `${req.method}:${req.route?.path || req.path}`;

      // Add performance headers
      res.setHeader('X-Response-Time-Start', startTime.toString());
      res.setHeader('X-Endpoint', endpoint);

      // Check if request can be served from cache
      this.checkCacheForRequest(req, res, endpoint);

      // Override res.end to measure response time
      const originalEnd = res.end;
      res.end = function(this: Response, ...args: any[]) {
        const responseTime = Date.now() - startTime;

        // Add performance headers
        res.setHeader('X-Response-Time', responseTime + 'ms');
        res.setHeader('X-Request-ID', req.headers['x-request-id'] || this.generateRequestId());
        res.setHeader('X-Endpoint-Metrics', JSON.stringify({
          responseTime,
          endpoint,
          statusCode: res.statusCode,
        }));

        // Update enhanced metrics
        this.updateEnhancedMetrics(responseTime, res.statusCode, endpoint);

        // Track endpoint performance in monitoring service
        enhancedPerformanceMonitoringService.trackEndpoint(endpoint, responseTime, res.statusCode);

        // Log slow requests with enhanced context
        if (responseTime > 1000) {
          logger.warn('Slow request detected', {
            method: req.method,
            url: req.url,
            endpoint,
            responseTime: responseTime,
            statusCode: res.statusCode,
            userAgent: req.headers['user-agent'],
            contentLength: res.get('Content-Length'),
            cacheHit: res.get('X-Cache-Hit') === 'true',
          });
        }

        return originalEnd.apply(this, args);
      }.bind(this);

      next();
    };
  }

  /**
   * Enhanced rate limiting with adaptive thresholds
   */
  adaptiveRateLimit(options: {
    windowMs?: number;
    baseMax?: number;
    scaleFactor?: number;
    skipSuccessfulRequests?: boolean;
    skipFailedRequests?: boolean;
  } = {}) {
    const {
      windowMs = 15 * 60 * 1000, // 15 minutes
      baseMax = 100,
      scaleFactor = 1.5,
      skipSuccessfulRequests = false,
      skipFailedRequests = false,
    } = options;

    const requests = new Map<string, {
      count: number;
      resetTime: number;
      lastRequest: number;
      averageResponseTime: number;
      errorRate: number;
    }>();

    return (req: Request, res: Response, next: NextFunction) => {
      const key = this.getRateLimitKey(req);
      const now = Date.now();

      // Clean up expired entries
      for (const [k, v] of requests.entries()) {
        if (now > v.resetTime) {
          requests.delete(k);
        }
      }

      // Get current request data
      const current = requests.get(key) || {
        count: 0,
        resetTime: now + windowMs,
        lastRequest: 0,
        averageResponseTime: 0,
        errorRate: 0,
      };

      // Calculate adaptive limit based on performance
      let adaptiveMax = baseMax;

      // Increase limit for fast, reliable clients
      if (current.averageResponseTime < 100 && current.errorRate < 0.01) {
        adaptiveMax = Math.floor(baseMax * scaleFactor);
      }

      // Decrease limit for slow or error-prone clients
      if (current.averageResponseTime > 500 || current.errorRate > 0.05) {
        adaptiveMax = Math.floor(baseMax / scaleFactor);
      }

      // Check if rate limit exceeded
      if (current.count >= adaptiveMax) {
        const resetIn = Math.ceil((current.resetTime - now) / 1000);

        res.setHeader('X-RateLimit-Limit', adaptiveMax.toString());
        res.setHeader('X-RateLimit-Remaining', '0');
        res.setHeader('X-RateLimit-Reset', resetIn.toString());
        res.setHeader('X-RateLimit-Adaptive', 'true');

        return res.status(429).json({
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Try again in ${resetIn} seconds.`,
          retryAfter: resetIn,
          limit: adaptiveMax,
          adaptive: true,
        });
      }

      // Update request count
      current.count++;
      current.lastRequest = now;
      requests.set(key, current);

      // Set rate limit headers
      const remaining = adaptiveMax - current.count;
      const resetIn = Math.ceil((current.resetTime - now) / 1000);

      res.setHeader('X-RateLimit-Limit', adaptiveMax.toString());
      res.setHeader('X-RateLimit-Remaining', remaining.toString());
      res.setHeader('X-RateLimit-Reset', resetIn.toString());
      res.setHeader('X-RateLimit-Adaptive', 'true');

      next();
    };
  }

  /**
   * Enhanced memory monitoring with caching metrics
   */
  memoryMonitor() {
    return (req: Request, res: Response, next: NextFunction) => {
      const memUsage = process.memoryUsage();
      const cacheStats = enhancedCachingService.getStats();

      // Add enhanced memory usage headers
      res.setHeader('X-Memory-Usage-Heap', memUsage.heapUsed.toString());
      res.setHeader('X-Memory-Usage-External', memUsage.external.toString());
      res.setHeader('X-Memory-Usage-RSS', memUsage.rss.toString());
      res.setHeader('X-Cache-Hit-Rate', (cacheStats.overall.overallHitRate * 100).toFixed(2));
      res.setHeader('X-Cache-Size', cacheStats.overall.totalSize.toString());

      // Warn on high memory usage with cache context
      const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
      const cacheMemoryMB = cacheStats.overall.totalSize / 1024 / 1024;

      if (heapUsedMB > 500) { // 500MB threshold
        logger.warn('High memory usage detected', {
          heapUsed: heapUsedMB.toFixed(2) + 'MB',
          cacheMemory: cacheMemoryMB.toFixed(2) + 'MB',
          url: req.url,
          endpoint: `${req.method}:${req.route?.path || req.path}`,
        });
      }

      next();
    };
  }

  /**
   * Intelligent caching middleware
   */
  intelligentCache(options: {
    ttl?: number;
    keyGenerator?: (req: Request) => string;
    condition?: (req: Request) => boolean;
    vary?: string[];
  } = {}) {
    const {
      ttl = 300, // 5 minutes default
      keyGenerator = (req) => `${req.method}:${req.originalUrl}`,
      condition = (req) => req.method === 'GET',
      vary = [],
    } = options;

    return async (req: Request, res: Response, next: NextFunction) => {
      // Skip caching for non-GET requests or if condition fails
      if (!condition(req)) {
        return next();
      }

      const cacheKey = keyGenerator(req);
      const varyHeaders = vary.map(header => req.get(header)).filter(Boolean).join(':');
      const fullKey = varyHeaders ? `${cacheKey}:${varyHeaders}` : cacheKey;

      try {
        // Try to get from enhanced cache
        const cached = await enhancedCachingService.get(fullKey, {
          tier: 'auto',
          ttl,
          predictive: true,
        });

        if (cached) {
          res.setHeader('X-Cache-Hit', 'true');
          res.setHeader('X-Cache-Key', fullKey);

          // Set cache-related headers
          res.setHeader('X-Cache-TTL', ttl.toString());
          res.setHeader('X-Cache-Tier', 'L1,L2,L3');

          return res.json(cached);
        }

        // Cache miss - intercept response to cache it
        const originalJson = res.json;
        res.json = function(data: any) {
          // Cache successful responses
          if (res.statusCode >= 200 && res.statusCode < 300) {
            enhancedCachingService.set(fullKey, data, {
              ttl,
              tier: 'auto',
              priority: req.path.includes('/api/') ? 'medium' : 'low',
            });
          }

          res.setHeader('X-Cache-Hit', 'false');
          res.setHeader('X-Cache-Key', fullKey);

          return originalJson.call(this, data);
        };

        next();
      } catch (error) {
        logger.error('Cache middleware error:', error);
        next(); // Continue without caching on error
      }
    };
  }

  /**
   * Performance profiling middleware
   */
  profileRequests(options: {
    sampleRate?: number;
    threshold?: number;
    includeBody?: boolean;
  } = {}) {
    const {
      sampleRate = 0.1, // 10% of requests
      threshold = 1000, // Profile requests > 1s
      includeBody = false,
    } = options;

    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = process.hrtime.bigint();
      const shouldProfile = Math.random() < sampleRate;

      if (shouldProfile) {
        const profile = {
          method: req.method,
          url: req.url,
          headers: { ...req.headers },
          body: includeBody ? req.body : undefined,
          startTime: Date.now(),
        };

        res.on('finish', () => {
          const endTime = process.hrtime.bigint();
          const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds

          if (duration > threshold) {
            profile['duration'] = duration;
            profile['statusCode'] = res.statusCode;
            profile['responseHeaders'] = res.getHeaders();

            logger.warn('Request profiled due to slow response', profile);
          }
        });
      }

      next();
    };
  }

  /**
   * Get enhanced performance metrics
   */
  getEnhancedMetrics(): EnhancedPerformanceMetrics & {
    errorCount: number;
    requestsPerSecond: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    topEndpoints: Array<{
      endpoint: string;
      count: number;
      averageResponseTime: number;
      errorRate: number;
    }>;
  } {
    const now = Date.now();
    const timeSinceReset = (now - this.metrics.lastResetTime.getTime()) / 1000;
    const requestsPerSecond = timeSinceReset > 0 ? this.metrics.requestCount / timeSinceReset : 0;

    // Calculate percentiles
    const sortedResponseTimes = [...this.responseTimeBuffer].sort((a, b) => a - b);
    const p95Index = Math.floor(sortedResponseTimes.length * 0.95);
    const p99Index = Math.floor(sortedResponseTimes.length * 0.99);

    // Get top endpoints by request count
    const topEndpoints = Array.from(this.metrics.endpointMetrics.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([endpoint, metrics]) => ({
        endpoint,
        count: metrics.count,
        averageResponseTime: metrics.averageResponseTime,
        errorRate: (metrics.errorCount / metrics.count) * 100,
      }));

    return {
      ...this.metrics,
      errorCount: this.errorCount,
      requestsPerSecond: requestsPerSecond,
      p95ResponseTime: sortedResponseTimes[p95Index] || 0,
      p99ResponseTime: sortedResponseTimes[p99Index] || 0,
      topEndpoints,
    };
  }

  /**
   * Reset enhanced metrics
   */
  resetEnhancedMetrics(): void {
    this.metrics = {
      requestCount: 0,
      totalResponseTime: 0,
      averageResponseTime: 0,
      errorRate: 0,
      lastResetTime: new Date(),
      endpointMetrics: new Map(),
    };
    this.errorCount = 0;
    this.responseTimeBuffer = [];
  }

  private async checkCacheForRequest(req: Request, res: Response, endpoint: string): Promise<void> {
    // Only check cache for GET requests
    if (req.method !== 'GET') return;

    try {
      const cacheKey = `request:${endpoint}:${JSON.stringify(req.query)}`;
      const cached = await enhancedCachingService.get(cacheKey, {
        tier: 'L1', // Check L1 first for fastest response
        ttl: 60, // 1 minute cache
      });

      if (cached) {
        res.setHeader('X-Cache-Hit', 'true');
        res.setHeader('X-Cache-Tier', 'L1');
        return res.json(cached);
      }
    } catch (error) {
      // Don't let cache errors block the request
      logger.debug('Cache check failed:', error);
    }
  }

  private updateEnhancedMetrics(responseTime: number, statusCode: number, endpoint: string): void {
    // Update global metrics
    this.metrics.requestCount++;
    this.metrics.totalResponseTime += responseTime;
    this.metrics.averageResponseTime = this.metrics.totalResponseTime / this.metrics.requestCount;

    // Track error rate
    if (statusCode >= 400) {
      this.errorCount++;
    }
    this.metrics.errorRate = (this.errorCount / this.metrics.requestCount) * 100;

    // Update endpoint-specific metrics
    if (!this.metrics.endpointMetrics.has(endpoint)) {
      this.metrics.endpointMetrics.set(endpoint, {
        count: 0,
        totalResponseTime: 0,
        averageResponseTime: 0,
        errorCount: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
      });
    }

    const endpointMetrics = this.metrics.endpointMetrics.get(endpoint)!;
    endpointMetrics.count++;
    endpointMetrics.totalResponseTime += responseTime;
    endpointMetrics.averageResponseTime = endpointMetrics.totalResponseTime / endpointMetrics.count;

    if (statusCode >= 400) {
      endpointMetrics.errorCount++;
    }

    // Update response time buffer
    this.responseTimeBuffer.push(responseTime);
    if (this.responseTimeBuffer.length > this.maxBufferSize) {
      this.responseTimeBuffer = this.responseTimeBuffer.slice(-this.maxBufferSize);
    }
  }

  private getRateLimitKey(req: Request): string {
    // Use IP address for rate limiting, fallback to user ID if available
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const userId = (req as any).user?.id;
    return userId ? `user:${userId}` : `ip:${ip}`;
  }

  private generateRequestId(): string {
    return Math.random().toString(36).substring(2, 15) +
           Math.random().toString(36).substring(2, 15);
  }
}

// Create and export singleton instance
export const enhancedPerformanceMiddleware = new EnhancedPerformanceMiddleware();

// Export individual middleware functions
export const enhancedRequestTiming = enhancedPerformanceMiddleware.requestTiming.bind(enhancedPerformanceMiddleware);
export const adaptiveRateLimit = enhancedPerformanceMiddleware.adaptiveRateLimit.bind(enhancedPerformanceMiddleware);
export const enhancedMemoryMonitor = enhancedPerformanceMiddleware.memoryMonitor.bind(enhancedPerformanceMiddleware);
export const intelligentCache = enhancedPerformanceMiddleware.intelligentCache.bind(enhancedPerformanceMiddleware);
export const profileRequests = enhancedPerformanceMiddleware.profileRequests.bind(enhancedPerformanceMiddleware);