/**
 * Multi-Level Rate Limiting System
 *
 * Implements sophisticated rate limiting with multiple time windows:
 * - Second-level for burst protection
 * - Minute-level for sustained traffic
 * - Hour-level for heavy usage
 * - Day-level for quota management
 *
 * Features adaptive throttling based on system load and intelligent burst management
 */

import { RateLimitConfig, RateLimitResult, SystemLoadMetrics, AdaptiveRateLimitConfig } from './types';
import { InMemoryRateLimiter } from './in-memory-limiter';
import { PostgresRateLimiter } from './postgres-limiter';
import { performance } from 'perf_hooks';

interface MultiLevelConfig {
  /** Per-second rate limit */
  second?: RateLimitConfig;
  /** Per-minute rate limit */
  minute?: RateLimitConfig;
  /** Per-hour rate limit */
  hour?: RateLimitConfig;
  /** Per-day rate limit */
  day?: RateLimitConfig;
  /** Adaptive configuration */
  adaptive?: AdaptiveRateLimitConfig;
}

interface MultiLevelResult extends RateLimitResult {
  /** Results from each level */
  levels: {
    second?: RateLimitResult;
    minute?: RateLimitResult;
    hour?: RateLimitResult;
    day?: RateLimitResult;
  };
  /** Most restrictive level */
  restrictiveLevel: keyof MultiLevelResult['levels'];
  /** Adaptive adjustment applied */
  adaptiveAdjustment?: number;
}

export class MultiLevelRateLimiter {
  private memoryLimiter: InMemoryRateLimiter;
  private distributedLimiter?: PostgresRateLimiter;
  private systemLoadMetrics: SystemLoadMetrics;
  private adaptiveHistory: Array<{ timestamp: number; load: number; adjustment: number }> = [];

  constructor(options: {
    postgresUrl?: string;
    nodeId?: string;
    memoryOptions?: {
      maxBuckets?: number;
      cleanupIntervalMs?: number;
    };
    distributedOptions?: {
      cleanupIntervalMs?: number;
      maxConnections?: number;
    };
  } = {}) {
    this.memoryLimiter = new InMemoryRateLimiter(options.memoryOptions);

    if (options.postgresUrl) {
      this.distributedLimiter = new PostgresRateLimiter(
        options.postgresUrl,
        options.distributedOptions
      );
    }

    // Initialize system load metrics
    this.systemLoadMetrics = {
      cpuUsage: 0,
      memoryUsage: 0,
      activeConnections: 0,
      queueLength: 0,
      avgResponseTime: 0,
      errorRate: 0
    };

    // Start system load monitoring
    this.startLoadMonitoring();
  }

  /**
   * Initialize distributed limiter if configured
   */
  async initialize(): Promise<void> {
    if (this.distributedLimiter) {
      await this.distributedLimiter.initialize();
    }
  }

  /**
   * Check rate limits across all configured levels
   */
  async checkMultiLevelLimit(
    key: string,
    config: MultiLevelConfig,
    timestamp: number = Date.now()
  ): Promise<MultiLevelResult> {
    const results: MultiLevelResult['levels'] = {};
    let mostRestrictive: keyof MultiLevelResult['levels'] = 'second';
    let finalResult: RateLimitResult | null = null;

    // Apply adaptive adjustment if configured
    const adjustedConfig = this.applyAdaptiveAdjustment(config);

    // Check each configured level in order of restriction
    const levels: Array<keyof MultiLevelConfig> = ['second', 'minute', 'hour', 'day'];

    for (const level of levels) {
      const levelConfig = adjustedConfig[level];
      if (!levelConfig) continue;

      const levelKey = `${key}:${level}`;
      let levelResult: RateLimitResult;

      // Use distributed limiter for hour/day levels, memory for second/minute
      if ((level === 'hour' || level === 'day') && this.distributedLimiter) {
        levelResult = await this.checkDistributedLimit(levelKey, levelConfig, timestamp);
      } else {
        levelResult = await this.memoryLimiter.checkLimit(levelKey, levelConfig, timestamp);
      }

      results[level] = levelResult;

      // Update most restrictive level
      if (!finalResult || !levelResult.allowed || levelResult.remaining < finalResult.remaining) {
        finalResult = levelResult;
        mostRestrictive = level;
      }

      // Early exit if any level blocks the request
      if (!levelResult.allowed) {
        break;
      }
    }

    // Combine results into final multi-level result
    const multiLevelResult: MultiLevelResult = {
      allowed: finalResult?.allowed ?? true,
      limit: finalResult?.limit ?? 0,
      current: finalResult?.current ?? 0,
      remaining: finalResult?.remaining ?? 0,
      resetTime: finalResult?.resetTime ?? timestamp + 60000,
      penaltyTime: finalResult?.penaltyTime,
      isPenalty: finalResult?.isPenalty,
      levels: results,
      restrictiveLevel: mostRestrictive,
      adaptiveAdjustment: config.adaptive ? this.calculateAdaptiveAdjustment() : undefined
    };

    // Update adaptive history
    this.updateAdaptiveHistory(config);

    return multiLevelResult;
  }

  /**
   * Update rate limits after request completion
   */
  async updateMultiLevelLimit(
    key: string,
    config: MultiLevelConfig,
    success: boolean,
    timestamp: number = Date.now()
  ): Promise<void> {
    const adjustedConfig = this.applyAdaptiveAdjustment(config);
    const levels: Array<keyof MultiLevelConfig> = ['second', 'minute', 'hour', 'day'];

    for (const level of levels) {
      const levelConfig = adjustedConfig[level];
      if (!levelConfig) continue;

      const levelKey = `${key}:${level}`;

      if ((level === 'hour' || level === 'day') && this.distributedLimiter) {
        // Distributed storage handles updates automatically
        continue;
      } else {
        await this.memoryLimiter.updateLimit(levelKey, levelConfig, success, timestamp);
      }
    }
  }

  /**
   * Get current multi-level status
   */
  async getMultiLevelStatus(
    key: string,
    config: MultiLevelConfig,
    timestamp: number = Date.now()
  ): Promise<MultiLevelResult> {
    const results: MultiLevelResult['levels'] = {};
    let mostRestrictive: keyof MultiLevelResult['levels'] = 'second';
    let finalResult: RateLimitResult | null = null;

    const adjustedConfig = this.applyAdaptiveAdjustment(config);
    const levels: Array<keyof MultiLevelConfig> = ['second', 'minute', 'hour', 'day'];

    for (const level of levels) {
      const levelConfig = adjustedConfig[level];
      if (!levelConfig) continue;

      const levelKey = `${key}:${level}`;
      let levelResult: RateLimitResult;

      if ((level === 'hour' || level === 'day') && this.distributedLimiter) {
        levelResult = await this.getDistributedStatus(levelKey, levelConfig, timestamp);
      } else {
        levelResult = await this.memoryLimiter.getStatus(levelKey, levelConfig, timestamp);
      }

      results[level] = levelResult;

      if (!finalResult || !levelResult.allowed || levelResult.remaining < finalResult.remaining) {
        finalResult = levelResult;
        mostRestrictive = level;
      }
    }

    return {
      allowed: finalResult?.allowed ?? true,
      limit: finalResult?.limit ?? 0,
      current: finalResult?.current ?? 0,
      remaining: finalResult?.remaining ?? 0,
      resetTime: finalResult?.resetTime ?? timestamp + 60000,
      penaltyTime: finalResult?.penaltyTime,
      isPenalty: finalResult?.isPenalty,
      levels: results,
      restrictiveLevel: mostRestrictive,
      adaptiveAdjustment: config.adaptive ? this.calculateAdaptiveAdjustment() : undefined
    };
  }

  /**
   * Reset rate limits across all levels
   */
  async resetMultiLevelLimit(key: string): Promise<void> {
    const levels = ['second', 'minute', 'hour', 'day'];

    for (const level of levels) {
      const levelKey = `${key}:${level}`;

      if (this.distributedLimiter) {
        await this.distributedLimiter.reset(levelKey);
      }

      await this.memoryLimiter.resetLimit(levelKey);
    }
  }

  /**
   * Apply adaptive adjustment to configuration
   */
  private applyAdaptiveAdjustment(config: MultiLevelConfig): MultiLevelConfig {
    if (!config.adaptive) {
      return config;
    }

    const adjustment = this.calculateAdaptiveAdjustment();
    const adjustedConfig = { ...config };

    // Apply adjustment to all levels
    const levels: Array<keyof MultiLevelConfig> = ['second', 'minute', 'hour', 'day'];

    for (const level of levels) {
      const levelConfig = config[level];
      if (!levelConfig) continue;

      let adjustedLimit = levelConfig.limit;

      if (adjustment < 0) {
        // Reduce limits under load
        adjustedLimit = Math.max(
          config.adaptive.minRequests,
          Math.floor(levelConfig.limit * (1 + adjustment))
        );
      } else if (adjustment > 0) {
        // Increase limits when load is low
        adjustedLimit = Math.min(
          config.adaptive.maxRequests,
          Math.floor(levelConfig.limit * (1 + adjustment))
        );
      }

      adjustedConfig[level] = {
        ...levelConfig,
        limit: adjustedLimit
      };
    }

    return adjustedConfig;
  }

  /**
   * Calculate adaptive adjustment based on system load
   */
  private calculateAdaptiveAdjustment(): number {
    const {
      cpuUsage,
      memoryUsage,
      activeConnections,
      avgResponseTime,
      errorRate
    } = this.systemLoadMetrics;

    // Calculate composite load score (0-1)
    const loadScore = (
      Math.min(cpuUsage / 80, 1) * 0.3 +  // CPU weight: 30%
      Math.min(memoryUsage / 85, 1) * 0.25 + // Memory weight: 25%
      Math.min(activeConnections / 1000, 1) * 0.2 + // Connections weight: 20%
      Math.min(avgResponseTime / 1000, 1) * 0.15 + // Response time weight: 15%
      Math.min(errorRate / 5, 1) * 0.1  // Error rate weight: 10%
    );

    // Map load score to adjustment (-0.5 to 0.3)
    if (loadScore > 0.8) {
      return -0.5; // Heavy load: reduce limits by 50%
    } else if (loadScore > 0.6) {
      return -0.3; // Medium load: reduce limits by 30%
    } else if (loadScore > 0.4) {
      return -0.1; // Light load: reduce limits by 10%
    } else if (loadScore < 0.2) {
      return 0.2;  // Very light load: increase limits by 20%
    } else {
      return 0;    // Normal load: no adjustment
    }
  }

  /**
   * Update adaptive history for trend analysis
   */
  private updateAdaptiveHistory(config: MultiLevelConfig): void {
    if (!config.adaptive) return;

    const adjustment = this.calculateAdaptiveAdjustment();

    this.adaptiveHistory.push({
      timestamp: Date.now(),
      load: this.systemLoadMetrics.cpuUsage / 100,
      adjustment
    });

    // Keep only last 100 entries
    if (this.adaptiveHistory.length > 100) {
      this.adaptiveHistory = this.adaptiveHistory.slice(-100);
    }
  }

  /**
   * Check distributed rate limit
   */
  private async checkDistributedLimit(
    key: string,
    config: RateLimitConfig,
    timestamp: number
  ): Promise<RateLimitResult> {
    if (!this.distributedLimiter) {
      throw new Error('Distributed limiter not initialized');
    }

    // Check penalty box first
    const penalty = await this.distributedLimiter.getPenalty(key);
    if (penalty) {
      return {
        allowed: false,
        limit: config.limit,
        current: config.limit + 1,
        remaining: 0,
        resetTime: penalty.expiresAt,
        penaltyTime: penalty.expiresAt,
        isPenalty: true
      };
    }

    // Get current count
    const count = await this.distributedLimiter.increment(key, config.windowMs);

    // Check if limit exceeded
    if (count > config.limit) {
      // Add to penalty box if configured
      if (config.penaltyMs && config.penaltyMs > 0) {
        await this.distributedLimiter.setPenalty(key, {
          expiresAt: timestamp + config.penaltyMs,
          reason: `Rate limit exceeded: ${count}/${config.limit}`,
          violations: 1
        });
      }

      return {
        allowed: false,
        limit: config.limit,
        current: count,
        remaining: 0,
        resetTime: timestamp + config.windowMs
      };
    }

    return {
      allowed: true,
      limit: config.limit,
      current: count,
      remaining: config.limit - count,
      resetTime: timestamp + config.windowMs
    };
  }

  /**
   * Get distributed status
   */
  private async getDistributedStatus(
    key: string,
    config: RateLimitConfig,
    timestamp: number
  ): Promise<RateLimitResult> {
    if (!this.distributedLimiter) {
      throw new Error('Distributed limiter not initialized');
    }

    const entry = await this.distributedLimiter.get(key);
    const penalty = await this.distributedLimiter.getPenalty(key);

    if (penalty) {
      return {
        allowed: false,
        limit: config.limit,
        current: config.limit + 1,
        remaining: 0,
        resetTime: penalty.expiresAt,
        penaltyTime: penalty.expiresAt,
        isPenalty: true
      };
    }

    if (!entry) {
      return {
        allowed: true,
        limit: config.limit,
        current: 0,
        remaining: config.limit,
        resetTime: timestamp + config.windowMs
      };
    }

    return {
      allowed: entry.count < config.limit,
      limit: config.limit,
      current: entry.count,
      remaining: Math.max(0, config.limit - entry.count),
      resetTime: entry.windowEnd
    };
  }

  /**
   * Start system load monitoring
   */
  private startLoadMonitoring(): void {
    const updateMetrics = () => {
      const usage = process.cpuUsage();
      const memoryUsage = process.memoryUsage();

      // Update CPU usage (simplified calculation)
      this.systemLoadMetrics.cpuUsage = Math.min(100, (usage.user + usage.system) / 1000000);

      // Update memory usage
      this.systemLoadMetrics.memoryUsage = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

      // Update other metrics (these would come from actual monitoring in production)
      this.systemLoadMetrics.activeConnections = 100; // Placeholder
      this.systemLoadMetrics.queueLength = 0; // Placeholder
      this.systemLoadMetrics.avgResponseTime = 150; // Placeholder
      this.systemLoadMetrics.errorRate = 0.5; // Placeholder
    };

    // Update metrics every 5 seconds
    setInterval(updateMetrics, 5000);

    if (setInterval.unref) {
      setInterval(updateMetrics, 5000).unref();
    }
  }

  /**
   * Get comprehensive analytics
   */
  async getAnalytics(routeId?: string) {
    const memoryMetrics = this.memoryLimiter.getMetrics();
    const distributedMetrics = this.distributedLimiter
      ? await this.distributedLimiter.getAnalytics(routeId)
      : null;

    return {
      memory: memoryMetrics,
      distributed: distributedMetrics,
      systemLoad: this.systemLoadMetrics,
      adaptive: {
        currentAdjustment: this.calculateAdaptiveAdjustment(),
        history: this.adaptiveHistory.slice(-10)
      }
    };
  }

  /**
   * Close the rate limiter and cleanup resources
   */
  async close(): Promise<void> {
    await this.memoryLimiter.close();

    if (this.distributedLimiter) {
      await this.distributedLimiter.close();
    }
  }
}