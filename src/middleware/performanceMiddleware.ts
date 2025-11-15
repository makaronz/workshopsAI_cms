import { Request, Response, NextFunction } from 'express';
import { optimizedRedisService } from '../config/optimized-redis';
import { logger } from '../utils/logger';

// Performance monitoring middleware
export interface PerformanceMetrics {
  requestCount: number;
  totalResponseTime: number;
  averageResponseTime: number;
  errorRate: number;
  lastResetTime: Date;
}

class PerformanceMiddleware {
  private metrics: PerformanceMetrics = {
    requestCount: 0,
    totalResponseTime: 0,
    averageResponseTime: 0,
    errorRate: 0,
    lastResetTime: new Date(),
  };
  private errorCount = 0;
  private responseTimeBuffer: number[] = [];
  private maxBufferSize = 1000;

  // Request timing middleware
  requestTiming() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();

      // Add performance headers
      res.setHeader('X-Response-Time-Start', startTime.toString());

      // Override res.end to measure response time
      const originalEnd = res.end;
      res.end = function(this: Response, ...args: any[]) {
        const responseTime = Date.now() - startTime;

        // Add performance headers
        res.setHeader('X-Response-Time', responseTime + 'ms');
        res.setHeader('X-Request-ID', req.headers['x-request-id'] || this.generateRequestId());

        // Update metrics
        this.updateMetrics(responseTime, res.statusCode);

        // Log slow requests
        if (responseTime > 1000) {
          logger.warn('Slow request detected', {
            method: req.method,
            url: req.url,
            responseTime: responseTime,
            statusCode: res.statusCode,
            userAgent: req.headers['user-agent'],
          });
        }

        return originalEnd.apply(this, args);
      }.bind(this);

      next();
    };
  }

  // API rate limiting with intelligent throttling
  rateLimit(options: {
    windowMs?: number;
    max?: number;
    skipSuccessfulRequests?: boolean;
    skipFailedRequests?: boolean;
  } = {}) {
    const {
      windowMs = 15 * 60 * 1000, // 15 minutes
      max = 100,
      skipSuccessfulRequests = false,
      skipFailedRequests = false,
    } = options;

    const requests = new Map<string, { count: number; resetTime: number; lastRequest: number }>();

    return (req: Request, res: Response, next: NextFunction) => {
      const key = this.getRateLimitKey(req);
      const now = Date.now();

      // Clean up expired entries
      for (const [k, v] of requests.entries()) {
        if (now > v.resetTime) {
          requests.delete(k);
        }
      }

      // Get current request count
      const current = requests.get(key) || { count: 0, resetTime: now + windowMs, lastRequest: 0 };

      // Check if rate limit exceeded
      if (current.count >= max) {
        const resetIn = Math.ceil((current.resetTime - now) / 1000);

        res.setHeader('X-RateLimit-Limit', max.toString());
        res.setHeader('X-RateLimit-Remaining', '0');
        res.setHeader('X-RateLimit-Reset', resetIn.toString());

        return res.status(429).json({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Try again in ' + resetIn + ' seconds.',
          retryAfter: resetIn,
        });
      }

      // Update request count
      current.count++;
      current.lastRequest = now;
      requests.set(key, current);

      // Set rate limit headers
      const remaining = max - current.count;
      const resetIn = Math.ceil((current.resetTime - now) / 1000);

      res.setHeader('X-RateLimit-Limit', max.toString());
      res.setHeader('X-RateLimit-Remaining', remaining.toString());
      res.setHeader('X-RateLimit-Reset', resetIn.toString());

      next();
    };
  }

  // Memory usage monitoring
  memoryMonitor() {
    return (req: Request, res: Response, next: NextFunction) => {
      const memUsage = process.memoryUsage();

      // Add memory usage headers
      res.setHeader('X-Memory-Usage-Heap', memUsage.heapUsed.toString());
      res.setHeader('X-Memory-Usage-External', memUsage.external.toString());
      res.setHeader('X-Memory-Usage-RSS', memUsage.rss.toString());

      // Warn on high memory usage
      const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
      if (heapUsedMB > 500) { // 500MB threshold
        logger.warn('High memory usage detected', {
          heapUsed: heapUsedMB.toFixed(2) + 'MB',
          url: req.url,
        });
      }

      next();
    };
  }

  // Get performance metrics
  getMetrics(): PerformanceMetrics & {
    errorCount: number;
    requestsPerSecond: number;
    p95ResponseTime: number;
    } {
    const now = Date.now();
    const timeSinceReset = (now - this.metrics.lastResetTime.getTime()) / 1000;
    const requestsPerSecond = timeSinceReset > 0 ? this.metrics.requestCount / timeSinceReset : 0;

    // Calculate p95 response time
    const sortedResponseTimes = [...this.responseTimeBuffer].sort((a, b) => a - b);
    const p95Index = Math.floor(sortedResponseTimes.length * 0.95);
    const p95ResponseTime = sortedResponseTimes[p95Index] || 0;

    return {
      ...this.metrics,
      errorCount: this.errorCount,
      requestsPerSecond: requestsPerSecond,
      p95ResponseTime: p95ResponseTime,
    };
  }

  // Reset metrics
  resetMetrics(): void {
    this.metrics = {
      requestCount: 0,
      totalResponseTime: 0,
      averageResponseTime: 0,
      errorRate: 0,
      lastResetTime: new Date(),
    };
    this.errorCount = 0;
    this.responseTimeBuffer = [];
  }

  private updateMetrics(responseTime: number, statusCode: number): void {
    this.metrics.requestCount++;
    this.metrics.totalResponseTime += responseTime;
    this.metrics.averageResponseTime = this.metrics.totalResponseTime / this.metrics.requestCount;

    // Track error rate
    if (statusCode >= 400) {
      this.errorCount++;
    }
    this.metrics.errorRate = (this.errorCount / this.metrics.requestCount) * 100;

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
    return userId ? 'user:' + userId : 'ip:' + ip;
  }

  private generateRequestId(): string {
    return Math.random().toString(36).substring(2, 15) +
           Math.random().toString(36).substring(2, 15);
  }
}

// Create and export singleton instance
export const performanceMiddleware = new PerformanceMiddleware();

// Export individual middleware functions
export const requestTiming = performanceMiddleware.requestTiming.bind(performanceMiddleware);
export const rateLimit = performanceMiddleware.rateLimit.bind(performanceMiddleware);
export const memoryMonitor = performanceMiddleware.memoryMonitor.bind(performanceMiddleware);
