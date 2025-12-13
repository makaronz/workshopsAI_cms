/**
 * High-Performance In-Memory Rate Limiter
 *
 * Implements sliding window rate limiting with lock-free operations
 * Uses optimized data structures for sub-millisecond performance
 */

import { RateLimitConfig, RateLimitResult, RateLimitWindow, PenaltyBox } from './types';
import { performance } from 'perf_hooks';

interface MemoryBucket {
  /** Sorted array of request timestamps */
  timestamps: number[];
  /** Current window start */
  windowStart: number;
  /** Request count in current window */
  count: number;
  /** Burst requests in current window */
  burstCount: number;
  /** Last access timestamp for LRU cleanup */
  lastAccess: number;
}

interface PenaltyEntry {
  /** Penalty expiry timestamp */
  expiresAt: number;
  /** Penalty reason */
  reason: string;
  /** Number of violations */
  violations: number;
}

export class InMemoryRateLimiter {
  private buckets = new Map<string, MemoryBucket>();
  private penalties = new Map<string, PenaltyEntry>();
  private cleanupTimer: NodeJS.Timeout;
  private readonly maxBuckets: number;
  private readonly cleanupIntervalMs: number;
  private readonly bucketExpirationMs: number;

  // Performance metrics
  private totalRequests = 0;
  private blockedRequests = 0;
  private cleanupCount = 0;

  constructor(options: {
    maxBuckets?: number;
    cleanupIntervalMs?: number;
    bucketExpirationMs?: number;
  } = {}) {
    this.maxBuckets = options.maxBuckets || 100000;
    this.cleanupIntervalMs = options.cleanupIntervalMs || 60000; // 1 minute
    this.bucketExpirationMs = options.bucketExpirationMs || 300000; // 5 minutes

    // Start cleanup timer
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.cleanupIntervalMs);

    // Prevent timer from keeping Node alive
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Check if request is allowed under rate limit
   */
  async checkLimit(
    key: string,
    config: RateLimitConfig,
    timestamp: number = Date.now()
  ): Promise<RateLimitResult> {
    // Check penalty box first
    const penalty = this.penalties.get(key);
    if (penalty && penalty.expiresAt > timestamp) {
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

    // Get or create bucket
    let bucket = this.buckets.get(key);
    if (!bucket) {
      // Enforce maximum bucket limit
      if (this.buckets.size >= this.maxBuckets) {
        await this.cleanup();
        if (this.buckets.size >= this.maxBuckets) {
          // Force remove oldest bucket
          const oldestKey = this.findOldestBucket();
          if (oldestKey) {
            this.buckets.delete(oldestKey);
          }
        }
      }

      bucket = {
        timestamps: [],
        windowStart: timestamp,
        count: 0,
        burstCount: 0,
        lastAccess: timestamp
      };
      this.buckets.set(key, bucket);
    }

    // Update last access
    bucket.lastAccess = timestamp;

    // Sliding window algorithm
    const windowEnd = timestamp + config.windowMs;
    const windowStart = windowEnd - config.windowMs;

    // Remove expired timestamps using binary search
    this.removeExpiredTimestamps(bucket, windowStart);

    // Calculate burst capacity
    const burstCapacity = config.burstCapacity || Math.floor(config.limit * 0.2);

    // Check if request fits in limit
    const currentTotal = bucket.count + bucket.burstCount;

    if (currentTotal >= config.limit) {
      // Check if we can use burst capacity
      if (bucket.burstCount < burstCapacity) {
        bucket.burstCount++;
        bucket.timestamps.push(timestamp);
        this.totalRequests++;

        return {
          allowed: true,
          limit: config.limit,
          current: currentTotal + 1,
          remaining: Math.max(0, config.limit - bucket.count),
          resetTime: bucket.windowStart + config.windowMs
        };
      }

      // Rate limit exceeded
      this.blockedRequests++;

      // Add to penalty box if configured
      if (config.penaltyMs && config.penaltyMs > 0) {
        const existingPenalty = this.penalties.get(key);
        const violations = existingPenalty ? existingPenalty.violations + 1 : 1;
        const penaltyDuration = Math.min(config.penaltyMs * violations, 300000); // Max 5 minutes

        this.penalties.set(key, {
          expiresAt: timestamp + penaltyDuration,
          reason: `Rate limit exceeded ${violations} times`,
          violations
        });
      }

      return {
        allowed: false,
        limit: config.limit,
        current: currentTotal,
        remaining: 0,
        resetTime: bucket.windowStart + config.windowMs
      };
    }

    // Allow request
    bucket.count++;
    bucket.timestamps.push(timestamp);
    this.totalRequests++;

    return {
      allowed: true,
      limit: config.limit,
      current: bucket.count + bucket.burstCount,
      remaining: Math.max(0, config.limit - bucket.count),
      resetTime: bucket.windowStart + config.windowMs
    };
  }

  /**
   * Update rate limit after request completion
   */
  async updateLimit(
    key: string,
    config: RateLimitConfig,
    success: boolean,
    timestamp: number = Date.now()
  ): Promise<void> {
    const bucket = this.buckets.get(key);
    if (!bucket) return;

    // If request failed, potentially adjust burst count
    if (!success && bucket.burstCount > 0) {
      bucket.burstCount--;
    }

    // Update last access
    bucket.lastAccess = timestamp;
  }

  /**
   * Reset rate limit for a key
   */
  async resetLimit(key: string): Promise<void> {
    this.buckets.delete(key);
    this.penalties.delete(key);
  }

  /**
   * Add penalty box entry
   */
  async addPenalty(
    key: string,
    reason: string,
    durationMs: number,
    timestamp: number = Date.now()
  ): Promise<void> {
    const existingPenalty = this.penalties.get(key);
    const violations = existingPenalty ? existingPenalty.violations + 1 : 1;

    this.penalties.set(key, {
      expiresAt: timestamp + durationMs,
      reason,
      violations
    });
  }

  /**
   * Remove penalty box entry
   */
  async removePenalty(key: string): Promise<void> {
    this.penalties.delete(key);
  }

  /**
   * Get penalty box information
   */
  getPenalty(key: string, timestamp: number = Date.now()): PenaltyBox | null {
    const penalty = this.penalties.get(key);
    if (!penalty || penalty.expiresAt <= timestamp) {
      if (penalty) {
        this.penalties.delete(key);
      }
      return null;
    }

    return {
      expiresAt: penalty.expiresAt,
      reason: penalty.reason,
      violations: penalty.violations
    };
  }

  /**
   * Get current rate limit status
   */
  async getStatus(
    key: string,
    config: RateLimitConfig,
    timestamp: number = Date.now()
  ): Promise<RateLimitResult> {
    // Check penalty box first
    const penalty = this.getPenalty(key, timestamp);
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

    const bucket = this.buckets.get(key);
    if (!bucket) {
      return {
        allowed: true,
        limit: config.limit,
        current: 0,
        remaining: config.limit,
        resetTime: timestamp + config.windowMs
      };
    }

    // Clean expired timestamps
    const windowEnd = timestamp + config.windowMs;
    const windowStart = windowEnd - config.windowMs;
    this.removeExpiredTimestamps(bucket, windowStart);

    return {
      allowed: bucket.count + bucket.burstCount < config.limit,
      limit: config.limit,
      current: bucket.count + bucket.burstCount,
      remaining: Math.max(0, config.limit - bucket.count),
      resetTime: bucket.windowStart + config.windowMs
    };
  }

  /**
   * Cleanup expired buckets and penalties
   */
  private async cleanup(): Promise<number> {
    const timestamp = Date.now();
    let removed = 0;

    // Cleanup expired buckets
    for (const [key, bucket] of this.buckets.entries()) {
      if (timestamp - bucket.lastAccess > this.bucketExpirationMs) {
        this.buckets.delete(key);
        removed++;
      }
    }

    // Cleanup expired penalties
    for (const [key, penalty] of this.penalties.entries()) {
      if (penalty.expiresAt <= timestamp) {
        this.penalties.delete(key);
        removed++;
      }
    }

    this.cleanupCount += removed;
    return removed;
  }

  /**
   * Remove expired timestamps using binary search
   */
  private removeExpiredTimestamps(bucket: MemoryBucket, windowStart: number): void {
    const { timestamps } = bucket;

    // Binary search for first valid timestamp
    let left = 0;
    let right = timestamps.length;

    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      if (timestamps[mid] < windowStart) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }

    // Remove expired timestamps
    if (left > 0) {
      timestamps.splice(0, left);
      bucket.count = Math.max(0, bucket.count - left);
    }
  }

  /**
   * Find oldest bucket for eviction
   */
  private findOldestBucket(): string | null {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, bucket] of this.buckets.entries()) {
      if (bucket.lastAccess < oldestTime) {
        oldestTime = bucket.lastAccess;
        oldestKey = key;
      }
    }

    return oldestKey;
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    return {
      totalRequests: this.totalRequests,
      blockedRequests: this.blockedRequests,
      activeBuckets: this.buckets.size,
      activePenalties: this.penalties.size,
      cleanupCount: this.cleanupCount,
      blockRate: this.totalRequests > 0 ? this.blockedRequests / this.totalRequests : 0
    };
  }

  /**
   * Estimate memory usage
   */
  getMemoryUsage(): number {
    // Rough estimation in bytes
    let size = 0;

    // Bucket storage
    for (const bucket of this.buckets.values()) {
      size += 64; // Bucket object overhead
      size += bucket.timestamps.length * 8; // Timestamps
    }

    // Penalty storage
    size += this.penalties.size * 128; // Approximate penalty entry size

    return size;
  }

  /**
   * Close the rate limiter and cleanup resources
   */
  async close(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.buckets.clear();
    this.penalties.clear();
  }
}