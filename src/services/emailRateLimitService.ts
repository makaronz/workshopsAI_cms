import { redisService } from '../config/redis';
import { emailConfig } from '../config/email';

export interface RateLimitRule {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (identifier: string) => string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

export interface ThrottlingConfig {
  maxPerSecond: number;
  maxPerMinute: number;
  maxPerHour: number;
  maxPerDay: number;
}

class EmailRateLimitService {
  private rules: Map<string, RateLimitRule> = new Map();
  private throttlingConfig: ThrottlingConfig;

  constructor() {
    this.initializeDefaultRules();
    this.initializeThrottlingConfig();
  }

  private initializeDefaultRules(): void {
    // Global rate limits
    this.rules.set('global', {
      windowMs: emailConfig.rateLimit.windowMs,
      maxRequests: emailConfig.rateLimit.maxRequests,
    });

    // Per-user rate limits
    this.rules.set('user', {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 10,
    });

    // Per-email rate limits
    this.rules.set('email', {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 5,
    });

    // Per-workshop rate limits
    this.rules.set('workshop', {
      windowMs: 24 * 60 * 60 * 1000, // 24 hours
      maxRequests: 100,
    });

    // Provider-specific limits
    this.rules.set('sendgrid', {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 100,
    });

    this.rules.set('mailgun', {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 50,
    });

    // Email type specific limits
    this.rules.set('marketing', {
      windowMs: 24 * 60 * 60 * 1000, // 24 hours
      maxRequests: 1,
    });

    this.rules.set('transactional', {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 20,
    });

    this.rules.set('questionnaire_reminder', {
      windowMs: 24 * 60 * 60 * 1000, // 24 hours
      maxRequests: 3,
    });
  }

  private initializeThrottlingConfig(): void {
    this.throttlingConfig = {
      maxPerSecond: 10,
      maxPerMinute: 100,
      maxPerHour: 1000,
      maxPerDay: 10000,
    };
  }

  async checkRateLimit(
    ruleName: string,
    identifier: string,
    customRule?: Partial<RateLimitRule>,
  ): Promise<RateLimitResult> {
    const rule = customRule
      ? { ...this.rules.get('global'), ...customRule }
      : this.rules.get(ruleName);

    if (!rule) {
      throw new Error(`Rate limit rule '${ruleName}' not found`);
    }

    const key = rule.keyGenerator
      ? rule.keyGenerator(identifier)
      : `rate_limit:${ruleName}:${identifier}`;
    const windowMs = rule.windowMs;
    const maxRequests = rule.maxRequests;

    try {
      const current = await redisService.getClient().incr(key);

      if (current === 1) {
        // Set expiration for new key
        await redisService.getClient().expire(key, Math.ceil(windowMs / 1000));
      }

      const remaining = Math.max(0, maxRequests - current);
      const allowed = current <= maxRequests;
      const resetTime = Date.now() + windowMs;

      const result: RateLimitResult = {
        allowed,
        remaining,
        resetTime,
      };

      if (!allowed) {
        const ttl = await redisService.getClient().ttl(key);
        result.retryAfter = ttl * 1000; // Convert to milliseconds
      }

      return result;
    } catch (error) {
      console.error('Rate limit check failed:', error);
      // Allow request if rate limiting fails
      return {
        allowed: true,
        remaining: maxRequests,
        resetTime: Date.now() + windowMs,
      };
    }
  }

  async checkThrottling(
    identifier: string,
    requestCount: number = 1,
  ): Promise<boolean> {
    const now = Date.now();
    const secondKey = `throttle:second:${identifier}`;
    const minuteKey = `throttle:minute:${identifier}`;
    const hourKey = `throttle:hour:${identifier}`;
    const dayKey = `throttle:day:${identifier}`;

    try {
      const pipeline = redisService.getClient().pipeline();

      // Check second-level throttling
      pipeline.incr(secondKey);
      pipeline.expire(secondKey, 1);

      // Check minute-level throttling
      pipeline.incr(minuteKey);
      pipeline.expire(minuteKey, 60);

      // Check hour-level throttling
      pipeline.incr(hourKey);
      pipeline.expire(hourKey, 3600);

      // Check day-level throttling
      pipeline.incr(dayKey);
      pipeline.expire(dayKey, 86400);

      const results = await pipeline.exec();

      if (!results || results.length < 8) {
        console.error('Throttling check pipeline failed');
        return true;
      }

      const [, secondResult] = results[1] as [any, number | null];
      const [, minuteResult] = results[3] as [any, number | null];
      const [, hourResult] = results[5] as [any, number | null];
      const [, dayResult] = results[7] as [any, number | null];

      const secondCount = (secondResult || 0) + requestCount;
      const minuteCount = (minuteResult || 0) + requestCount;
      const hourCount = (hourResult || 0) + requestCount;
      const dayCount = (dayResult || 0) + requestCount;

      return (
        secondCount <= this.throttlingConfig.maxPerSecond &&
        minuteCount <= this.throttlingConfig.maxPerMinute &&
        hourCount <= this.throttlingConfig.maxPerHour &&
        dayCount <= this.throttlingConfig.maxPerDay
      );
    } catch (error) {
      console.error('Throttling check failed:', error);
      // Allow request if throttling fails
      return true;
    }
  }

  async checkComprehensiveRateLimit(
    type: string,
    email: string,
    userId?: number,
    workshopId?: string,
    priority: 'low' | 'normal' | 'high' | 'urgent' = 'normal',
  ): Promise<{
    allowed: boolean;
    reasons: string[];
    retryAfter?: number;
  }> {
    const checks: Promise<{
      type: string;
      allowed: boolean;
      retryAfter?: number;
    }>[] = [];

    // Global rate limit
    checks.push(
      this.checkRateLimit('global', 'all_emails').then(result => ({
        type: 'global',
        allowed: result.allowed,
        retryAfter: result.retryAfter,
      })),
    );

    // Email-specific rate limit
    checks.push(
      this.checkRateLimit('email', email).then(result => ({
        type: 'email',
        allowed: result.allowed,
        retryAfter: result.retryAfter,
      })),
    );

    // User-specific rate limit
    if (userId) {
      checks.push(
        this.checkRateLimit('user', `user_${userId}`).then(result => ({
          type: 'user',
          allowed: result.allowed,
          retryAfter: result.retryAfter,
        })),
      );
    }

    // Workshop-specific rate limit
    if (workshopId) {
      checks.push(
        this.checkRateLimit('workshop', `workshop_${workshopId}`).then(
          result => ({
            type: 'workshop',
            allowed: result.allowed,
            retryAfter: result.retryAfter,
          }),
        ),
      );
    }

    // Email type-specific rate limit
    const emailTypeRule = this.determineEmailTypeRule(type);
    if (emailTypeRule) {
      checks.push(
        this.checkRateLimit(emailTypeRule, `type_${type}`).then(result => ({
          type: `email_type_${emailTypeRule}`,
          allowed: result.allowed,
          retryAfter: result.retryAfter,
        })),
      );
    }

    // Priority-based adjustments
    const results = await Promise.all(checks);

    // High priority emails get more lenient treatment
    const allowedChecks = results.filter(check => {
      if (priority === 'urgent' || priority === 'high') {
        return check.type === 'global' ? check.allowed : true; // Only enforce global limit for high priority
      }
      return check.allowed;
    });

    const blockedChecks = results.filter(check => !check.allowed);
    const reasons = blockedChecks.map(
      check => `${check.type} rate limit exceeded`,
    );

    const maxRetryAfter = Math.max(
      ...blockedChecks.map(check => check.retryAfter || 0),
    );

    return {
      allowed: blockedChecks.length === 0,
      reasons,
      retryAfter: maxRetryAfter > 0 ? maxRetryAfter : undefined,
    };
  }

  private determineEmailTypeRule(type: string): string | null {
    // Map email types to rate limit rules
    const typeMapping: Record<string, string> = {
      workshop_invitation: 'transactional',
      session_reminder: 'transactional',
      questionnaire_reminder: 'questionnaire_reminder',
      workshop_update: 'transactional',
      account_verification: 'transactional',
      password_reset: 'transactional',
      completion_certificate: 'transactional',
      enrollment_confirmation: 'transactional',
      waiting_list_notification: 'transactional',
      workshop_cancellation: 'transactional',
    };

    return typeMapping[type] || 'marketing';
  }

  async getRateLimitStatus(identifier: string): Promise<Record<string, any>> {
    const keys = [
      `rate_limit:global:${identifier}`,
      `rate_limit:user:${identifier}`,
      `rate_limit:email:${identifier}`,
    ];

    try {
      const results = await redisService.getClient().mget(keys);
      const status: Record<string, any> = {};

      keys.forEach((key, index) => {
        const ruleType = key.split(':')[1];
        const count = results[index];
        if (count !== null) {
          const rule = this.rules.get(ruleType);
          if (rule) {
            status[ruleType] = {
              current: parseInt(count),
              max: rule.maxRequests,
              remaining: Math.max(0, rule.maxRequests - parseInt(count)),
              resetTime: Date.now() + rule.windowMs,
            };
          }
        }
      });

      return status;
    } catch (error) {
      console.error('Failed to get rate limit status:', error);
      return {};
    }
  }

  async resetRateLimit(ruleName: string, identifier: string): Promise<void> {
    const key = `rate_limit:${ruleName}:${identifier}`;
    try {
      await redisService.getClient().del(key);
    } catch (error) {
      console.error('Failed to reset rate limit:', error);
    }
  }

  async resetAllRateLimits(identifier: string): Promise<void> {
    const patterns = [`rate_limit:*:${identifier}`];

    try {
      const keys: string[] = [];
      for (const pattern of patterns) {
        const matchingKeys = await redisService.getClient().keys(pattern);
        keys.push(...matchingKeys);
      }

      if (keys.length > 0) {
        await redisService.getClient().del(...keys);
      }
    } catch (error) {
      console.error('Failed to reset all rate limits:', error);
    }
  }

  updateRule(ruleName: string, rule: Partial<RateLimitRule>): void {
    const existingRule = this.rules.get(ruleName);
    if (existingRule) {
      this.rules.set(ruleName, { ...existingRule, ...rule });
    } else {
      this.rules.set(ruleName, {
        windowMs: 15 * 60 * 1000, // Default 15 minutes
        maxRequests: 100, // Default 100 requests
        ...rule,
      });
    }
  }

  updateThrottlingConfig(config: Partial<ThrottlingConfig>): void {
    this.throttlingConfig = { ...this.throttlingConfig, ...config };
  }

  getRule(ruleName: string): RateLimitRule | undefined {
    return this.rules.get(ruleName);
  }

  getAllRules(): Record<string, RateLimitRule> {
    return Object.fromEntries(this.rules);
  }

  getThrottlingConfig(): ThrottlingConfig {
    return { ...this.throttlingConfig };
  }

  // Cleanup old rate limit entries
  async cleanup(): Promise<number> {
    try {
      const keys = await redisService.getClient().keys('rate_limit:*');
      let cleaned = 0;

      for (const key of keys) {
        const ttl = await redisService.getClient().ttl(key);
        if (ttl === -1) {
          // No expiration set, clean it up
          await redisService.getClient().del(key);
          cleaned++;
        }
      }

      // Also clean up old throttling keys
      const throttleKeys = await redisService.getClient().keys('throttle:*');
      for (const key of throttleKeys) {
        const parts = key.split(':');
        if (parts.length >= 2) {
          const period = parts[1];
          let maxAge: number;

          switch (period) {
          case 'second':
            maxAge = 60; // 1 minute
            break;
          case 'minute':
            maxAge = 3600; // 1 hour
            break;
          case 'hour':
            maxAge = 86400; // 1 day
            break;
          case 'day':
            maxAge = 604800; // 1 week
            break;
          default:
            maxAge = 86400; // Default 1 day
          }

          const keyAge = await redisService.getClient().object('idletime', key);
          if (keyAge > maxAge) {
            await redisService.getClient().del(key);
            cleaned++;
          }
        }
      }

      return cleaned;
    } catch (error) {
      console.error('Failed to cleanup rate limit entries:', error);
      return 0;
    }
  }
}

export const emailRateLimitService = new EmailRateLimitService();
