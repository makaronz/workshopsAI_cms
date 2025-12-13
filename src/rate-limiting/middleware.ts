/**
 * Express Rate Limiting Middleware
 *
 * Production-ready middleware with comprehensive features:
 * - Multi-level rate limiting (second/minute/hour/day)
 * - Adaptive throttling based on system load
 * - Penalty box for abusers
 * - Rate limit headers
 * - Analytics and monitoring
 */

import { Request, Response, NextFunction } from 'express';
import { RateLimitConfig, RateLimitRule, RateLimitMiddleware, RateLimitError, RateLimitErrorCode } from './types';
import { MultiLevelRateLimiter } from './multi-level-limiter';

interface MiddlewareOptions {
  /** PostgreSQL connection URL for distributed rate limiting */
  postgresUrl?: string;
  /** Node identifier for clustering */
  nodeId?: string;
  /** Default rate limit configuration */
  defaultConfig?: {
    second?: RateLimitConfig;
    minute?: RateLimitConfig;
    hour?: RateLimitConfig;
    day?: RateLimitConfig;
  };
  /** Custom rate limit rules */
  rules?: RateLimitRule[];
  /** Whether to skip successful requests from counting */
  skipSuccessfulRequests?: boolean;
  /** Whether to skip failed requests from counting */
  skipFailedRequests?: boolean;
  /** Custom key generation function */
  keyGenerator?: (req: Request) => string;
  /** Custom success condition function */
  successCondition?: (res: Response) => boolean;
  /** Custom failure condition function */
  failureCondition?: (res: Response) => boolean;
  /** Whether to enable adaptive rate limiting */
  enableAdaptive?: boolean;
  /** Whether to track analytics */
  enableAnalytics?: boolean;
  /** Custom error handler */
  errorHandler?: (error: RateLimitError, req: Request, res: Response, next: NextFunction) => void;
}

export class RateLimitingMiddleware {
  private limiter: MultiLevelRateLimiter;
  private options: Required<MiddlewareOptions>;
  private defaultRules: RateLimitRule[];

  constructor(options: MiddlewareOptions = {}) {
    this.options = {
      postgresUrl: process.env.DATABASE_URL,
      nodeId: `node-${process.pid}-${Date.now()}`,
      defaultConfig: {
        second: { limit: 10, windowMs: 1000 },    // 10 requests per second
        minute: { limit: 100, windowMs: 60000 },  // 100 requests per minute
        hour: { limit: 1000, windowMs: 3600000 }, // 1000 requests per hour
        day: { limit: 10000, windowMs: 86400000 } // 10000 requests per day
      },
      rules: [],
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      enableAdaptive: true,
      enableAnalytics: true,
      keyGenerator: this.defaultKeyGenerator,
      successCondition: this.defaultSuccessCondition,
      failureCondition: this.defaultFailureCondition,
      errorHandler: this.defaultErrorHandler,
      ...options
    };

    this.limiter = new MultiLevelRateLimiter({
      postgresUrl: this.options.postgresUrl,
      nodeId: this.options.nodeId
    });

    this.defaultRules = this.createDefaultRules();
  }

  /**
   * Initialize the middleware
   */
  async initialize(): Promise<void> {
    await this.limiter.initialize();
  }

  /**
   * Create Express middleware function
   */
  middleware(): RateLimitMiddleware {
    const rateLimitMiddleware = async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Generate rate limit key
        const key = this.options.keyGenerator(req);

        // Find matching rule
        const rule = this.findMatchingRule(req);

        // Check rate limit
        const result = await this.limiter.checkMultiLevelLimit(key, {
          second: rule.config.second || this.options.defaultConfig.second,
          minute: rule.config.minute || this.options.defaultConfig.minute,
          hour: rule.config.hour || this.options.defaultConfig.hour,
          day: rule.config.day || this.options.defaultConfig.day,
          adaptive: this.options.enableAdaptive ? {
            baseConfig: rule.config.second || this.options.defaultConfig.second!,
            loadThreshold: 0.7,
            reductionFactor: 0.3,
            expansionFactor: 1.2,
            minRequests: 5,
            maxRequests: 50,
            adaptationWindowMs: 30000
          } : undefined
        });

        // Add rate limit headers
        this.addRateLimitHeaders(res, result);

        // Check if request is allowed
        if (!result.allowed) {
          const error = this.createRateLimitError(result);
          await this.handleRateLimitExceeded(req, res, error, rule, key);
          return;
        }

        // Track request for analytics
        if (this.options.enableAnalytics) {
          this.trackRequest(req, result);
        }

        // Setup response tracking
        this.setupResponseTracking(req, res, key, rule, result);

        next();
      } catch (error) {
        console.error('Rate limiting error:', error);
        // In case of error, allow the request but log it
        next();
      }
    };

    // Attach utility methods to the middleware function
    Object.assign(rateLimitMiddleware, {
      getStatus: this.getStatus.bind(this),
      resetClient: this.resetClient.bind(this),
      addPenalty: this.addPenalty.bind(this),
      removePenalty: this.removePenalty.bind(this),
      getAnalytics: this.getAnalytics.bind(this),
      close: this.close.bind(this)
    });

    return rateLimitMiddleware as RateLimitMiddleware;
  }

  /**
   * Default key generator
   */
  private defaultKeyGenerator(req: Request): string {
    // Use IP address with optional user ID if authenticated
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const userId = (req as any).user?.id;

    return userId ? `user:${userId}` : `ip:${ip}`;
  }

  /**
   * Default success condition
   */
  private defaultSuccessCondition(res: Response): boolean {
    return res.statusCode >= 200 && res.statusCode < 300;
  }

  /**
   * Default failure condition
   */
  private defaultFailureCondition(res: Response): boolean {
    return res.statusCode >= 400;
  }

  /**
   * Create default rate limiting rules
   */
  private createDefaultRules(): RateLimitRule[] {
    const baseConfig = this.options.defaultConfig;

    return [
      // Auth endpoints - stricter limits
      {
        id: 'auth',
        pattern: /^\/api\/v1\/auth/,
        config: {
          second: { limit: 5, windowMs: 1000, penaltyMs: 60000 },
          minute: { limit: 20, windowMs: 60000 },
          hour: { limit: 100, windowMs: 3600000 }
        },
        priority: 10,
        enabled: true
      },

      // File upload endpoints - very strict
      {
        id: 'file-upload',
        pattern: /^\/api\/v1\/files.*upload/,
        config: {
          second: { limit: 2, windowMs: 1000 },
          minute: { limit: 10, windowMs: 60000 },
          hour: { limit: 50, windowMs: 3600000 }
        },
        priority: 10,
        enabled: true
      },

      // API endpoints - moderate limits
      {
        id: 'api',
        pattern: /^\/api\//,
        config: baseConfig,
        priority: 1,
        enabled: true
      },

      // Public endpoints - higher limits
      {
        id: 'public',
        pattern: /^\/api\/v1\/public/,
        config: {
          second: { limit: 50, windowMs: 1000 },
          minute: { limit: 500, windowMs: 60000 },
          hour: { limit: 5000, windowMs: 3600000 }
        },
        priority: 5,
        enabled: true
      },

      // Static assets - highest limits
      {
        id: 'static',
        pattern: /\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2)$/,
        config: {
          second: { limit: 100, windowMs: 1000 },
          minute: { limit: 1000, windowMs: 60000 }
        },
        priority: 1,
        enabled: true
      }
    ];
  }

  /**
   * Find matching rate limit rule for request
   */
  private findMatchingRule(req: Request): RateLimitRule {
    const path = req.path;
    let matchingRule = this.defaultRules.find(rule => !rule.enabled);

    // Find enabled rule with highest priority
    for (const rule of this.defaultRules) {
      if (!rule.enabled) continue;

      let matches = false;

      if (rule.pattern instanceof RegExp) {
        matches = rule.pattern.test(path);
      } else if (typeof rule.pattern === 'string') {
        matches = path.includes(rule.pattern);
      } else if (rule.matcher) {
        matches = rule.matcher(req);
      }

      if (matches && (!matchingRule || rule.priority > matchingRule.priority)) {
        matchingRule = rule;
      }
    }

    return matchingRule || this.defaultRules[this.defaultRules.length - 1]; // Fallback to API rule
  }

  /**
   * Add rate limit headers to response
   */
  private addRateLimitHeaders(res: Response, result: any): void {
    const headerPrefix = 'X-RateLimit';

    // Add headers for each level
    if (result.levels.second) {
      res.set(`${headerPrefix}-Second-Limit`, result.levels.second.limit.toString());
      res.set(`${headerPrefix}-Second-Remaining`, result.levels.second.remaining.toString());
      res.set(`${headerPrefix}-Second-Reset`, Math.ceil(result.levels.second.resetTime / 1000).toString());
    }

    if (result.levels.minute) {
      res.set(`${headerPrefix}-Minute-Limit`, result.levels.minute.limit.toString());
      res.set(`${headerPrefix}-Minute-Remaining`, result.levels.minute.remaining.toString());
      res.set(`${headerPrefix}-Minute-Reset`, Math.ceil(result.levels.minute.resetTime / 1000).toString());
    }

    if (result.levels.hour) {
      res.set(`${headerPrefix}-Hour-Limit`, result.levels.hour.limit.toString());
      res.set(`${headerPrefix}-Hour-Remaining`, result.levels.hour.remaining.toString());
      res.set(`${headerPrefix}-Hour-Reset`, Math.ceil(result.levels.hour.resetTime / 1000).toString());
    }

    if (result.levels.day) {
      res.set(`${headerPrefix}-Day-Limit`, result.levels.day.limit.toString());
      res.set(`${headerPrefix}-Day-Remaining`, result.levels.day.remaining.toString());
      res.set(`${headerPrefix}-Day-Reset`, Math.ceil(result.levels.day.resetTime / 1000).toString());
    }

    // Add overall headers
    res.set(`${headerPrefix}-Limit`, result.limit.toString());
    res.set(`${headerPrefix}-Remaining`, result.remaining.toString());
    res.set(`${headerPrefix}-Reset`, Math.ceil(result.resetTime / 1000).toString());

    if (result.isPenalty) {
      res.set(`${headerPrefix}-Penalty`, 'true');
      res.set(`${headerPrefix}-Penalty-Reason`, 'Rate limit violations detected');
    }

    if (result.adaptiveAdjustment) {
      res.set(`${headerPrefix}-Adaptive`, result.adaptiveAdjustment.toString());
    }
  }

  /**
   * Create rate limit error
   */
  private createRateLimitError(result: any): RateLimitError {
    const error = new Error(result.isPenalty
      ? 'Rate limit penalty box active'
      : 'Rate limit exceeded'
    ) as RateLimitError;

    error.code = result.isPenalty
      ? RateLimitErrorCode.PENALTY_BOX
      : RateLimitErrorCode.EXCEEDED;

    error.retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);
    error.details = {
      limit: result.limit,
      current: result.current,
      resetTime: result.resetTime,
      restrictiveLevel: result.restrictiveLevel
    };

    return error;
  }

  /**
   * Handle rate limit exceeded
   */
  private async handleRateLimitExceeded(
    req: Request,
    res: Response,
    error: RateLimitError,
    rule: RateLimitRule,
    key: string
  ): Promise<void> {
    // Log rate limit hit
    console.warn(`Rate limit exceeded for ${key}:`, {
      path: req.path,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      rule: rule.id,
      error: error.message
    });

    // Set response headers
    res.set('Retry-After', error.retryAfter?.toString() || '60');

    // Call custom error handler if provided
    if (this.options.errorHandler) {
      this.options.errorHandler(error, req, res, () => {});
      return;
    }

    // Default error response
    const statusCode = error.code === RateLimitErrorCode.PENALTY_BOX ? 429 : 429;
    res.status(statusCode).json({
      error: true,
      code: error.code,
      message: error.isPenalty
        ? 'Too many requests. Access temporarily blocked due to repeated violations.'
        : 'Too many requests. Please try again later.',
      retryAfter: error.retryAfter,
      details: process.env.NODE_ENV === 'development' ? error.details : undefined
    });
  }

  /**
   * Track request for analytics
   */
  private trackRequest(req: Request, result: any): void {
    // This would integrate with your analytics system
    // For now, we'll just log the data
    console.log('Rate limit analytics:', {
      path: req.path,
      method: req.method,
      allowed: result.allowed,
      levels: result.levels,
      adaptiveAdjustment: result.adaptiveAdjustment
    });
  }

  /**
   * Setup response tracking
   */
  private setupResponseTracking(
    req: Request,
    res: Response,
    key: string,
    rule: RateLimitRule,
    result: any
  ): void {
    let finished = false;

    const onFinish = async () => {
      if (finished) return;
      finished = true;

      // Skip tracking based on configuration
      if (this.options.skipSuccessfulRequests && this.options.successCondition(res)) {
        return;
      }

      if (this.options.skipFailedRequests && this.options.failureCondition(res)) {
        return;
      }

      // Update rate limit
      try {
        await this.limiter.updateMultiLevelLimit(
          key,
          {
            second: rule.config.second || this.options.defaultConfig.second,
            minute: rule.config.minute || this.options.defaultConfig.minute,
            hour: rule.config.hour || this.options.defaultConfig.hour,
            day: rule.config.day || this.options.defaultConfig.day
          },
          this.options.successCondition(res)
        );
      } catch (error) {
        console.error('Error updating rate limit:', error);
      }
    };

    // Attach to response events
    res.on('finish', onFinish);
    res.on('close', onFinish);
  }

  /**
   * Get current rate limit status for a request
   */
  async getStatus(req: Request): Promise<any> {
    const key = this.options.keyGenerator(req);
    const rule = this.findMatchingRule(req);

    return await this.limiter.getMultiLevelStatus(key, {
      second: rule.config.second || this.options.defaultConfig.second,
      minute: rule.config.minute || this.options.defaultConfig.minute,
      hour: rule.config.hour || this.options.defaultConfig.hour,
      day: rule.config.day || this.options.defaultConfig.day
    });
  }

  /**
   * Reset rate limit for a client
   */
  async resetClient(clientId: string): Promise<void> {
    const key = clientId.includes(':') ? clientId : `ip:${clientId}`;
    await this.limiter.resetMultiLevelLimit(key);
  }

  /**
   * Add client to penalty box
   */
  async addPenalty(clientId: string, reason: string, durationMs: number): Promise<void> {
    const key = clientId.includes(':') ? clientId : `ip:${clientId}`;

    // This would need to be implemented in the MultiLevelRateLimiter
    console.log(`Adding penalty for ${key}: ${reason} (${durationMs}ms)`);
  }

  /**
   * Remove client from penalty box
   */
  async removePenalty(clientId: string): Promise<void> {
    const key = clientId.includes(':') ? clientId : `ip:${clientId}`;

    // This would need to be implemented in the MultiLevelRateLimiter
    console.log(`Removing penalty for ${key}`);
  }

  /**
   * Get analytics data
   */
  async getAnalytics(routeId?: string): Promise<any> {
    return await this.limiter.getAnalytics(routeId);
  }

  /**
   * Default error handler
   */
  private defaultErrorHandler(
    error: RateLimitError,
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    res.status(429).json({
      error: true,
      code: error.code,
      message: error.message,
      retryAfter: error.retryAfter
    });
  }

  /**
   * Close the middleware
   */
  async close(): Promise<void> {
    await this.limiter.close();
  }
}

/**
 * Factory function to create rate limiting middleware
 */
export function createRateLimitMiddleware(options?: MiddlewareOptions): RateLimitMiddleware {
  const middlewareInstance = new RateLimitingMiddleware(options);

  // Auto-initialize if possible
  middlewareInstance.initialize().catch(console.error);

  return middlewareInstance.middleware();
}