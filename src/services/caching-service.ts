import { EventEmitter } from 'events';
import { optimizedRedisService } from '../config/optimized-redis';
import { logger } from '../utils/logger';

/**
 * Multi-level caching system with intelligent invalidation and warming
 * 
 * Features:
 * - L1: In-memory cache with LRU eviction
 * - L2: Redis cache with configurable TTL
 * - L3: Database query result caching
 * - Cache warming strategies for frequently accessed data
 * - Intelligent cache invalidation based on data changes
 * - Memory-efficient data structures
 * - Event-driven architecture for cache management
 */

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string; // Key prefix
  tags?: string[]; // Cache tags for invalidation
  compress?: boolean; // Compress large values
  json?: boolean; // JSON serialize/deserialize
  priority?: 'low' | 'medium' | 'high'; // Cache priority for eviction
  tier?: 'L1' | 'L2' | 'L3' | 'auto'; // Cache tier selection
}

export interface CacheEntry<T = any> {
  value: T;
  createdAt: Date;
  expiresAt: Date;
  accessCount: number;
  lastAccessed: Date;
  size: number;
  tags: string[];
  tier: 'L1' | 'L2' | 'L3';
  priority: 'low' | 'medium' | 'high';
}

export interface CacheStats {
  L1: {
    hitCount: number;
    missCount: number;
    hitRate: number;
    size: number;
    maxSize: number;
    evictions: number;
  };
  L2: {
    hitCount: number;
    missCount: number;
    hitRate: number;
    totalKeys: number;
    memoryUsage: number;
  };
  L3: {
    hitCount: number;
    missCount: number;
    hitRate: number;
    queryCount: number;
  };
  overall: {
    totalHits: number;
    totalMisses: number;
    overallHitRate: number;
    totalSize: number;
  };
}

export interface CacheWarmingStrategy {
  name: string;
  description: string;
  enabled: boolean;
  patterns: string[];
  priority: number;
  warmupFunction: () => Promise<void>;
}

/**
 * LRU Cache implementation for L1 (in-memory) caching
 */
class LRUCache<T = any> {
  private maxSize: number;
  private cache: Map<string, CacheEntry<T>> = new Map();
  private accessOrder: string[] = [];
  private currentSize = 0;
  private maxMemorySize: number; // in bytes

  constructor(maxSize: number = 1000, maxMemorySize: number = 100 * 1024 * 1024) { // 100MB default
    this.maxSize = maxSize;
    this.maxMemorySize = maxMemorySize;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if expired
    if (Date.now() > entry.expiresAt.getTime()) {
      this.delete(key);
      return null;
    }

    // Update access information
    entry.accessCount++;
    entry.lastAccessed = new Date();
    this.updateAccessOrder(key);

    return entry.value;
  }

  set(key: string, value: T, options: CacheOptions = {}): void {
    const now = new Date();
    const ttl = options.ttl || 3600; // 1 hour default
    const size = this.calculateSize(value);

    // Check if we need to evict entries
    while (this.shouldEvict(size)) {
      this.evictLRU();
    }

    const entry: CacheEntry<T> = {
      value,
      createdAt: now,
      expiresAt: new Date(now.getTime() + ttl * 1000),
      accessCount: 1,
      lastAccessed: now,
      size,
      tags: options.tags || [],
      tier: 'L1',
      priority: options.priority || 'medium',
    };

    // Remove existing entry if it exists
    if (this.cache.has(key)) {
      const existing = this.cache.get(key)!;
      this.currentSize -= existing.size;
      this.removeFromAccessOrder(key);
    }

    this.cache.set(key, entry);
    this.updateAccessOrder(key);
    this.currentSize += size;
  }

  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    this.currentSize -= entry.size;
    this.cache.delete(key);
    this.removeFromAccessOrder(key);
    return true;
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
    this.currentSize = 0;
  }

  size(): number {
    return this.cache.size;
  }

  getTotalSize(): number {
    return this.currentSize;
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      totalSize: this.currentSize,
      maxMemorySize: this.maxMemorySize,
    };
  }

  private shouldEvict(newEntrySize: number): boolean {
    return (
      this.cache.size >= this.maxSize ||
      this.currentSize + newEntrySize > this.maxMemorySize
    );
  }

  private evictLRU(): void {
    if (this.accessOrder.length === 0) return;

    const lruKey = this.accessOrder.shift()!;
    const entry = this.cache.get(lruKey);
    if (entry) {
      this.currentSize -= entry.size;
      this.cache.delete(lruKey);
    }
  }

  private updateAccessOrder(key: string): void {
    this.removeFromAccessOrder(key);
    this.accessOrder.push(key);
  }

  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  private calculateSize(value: any): number {
    // Rough estimation of memory size
    if (value === null || value === undefined) return 0;
    if (typeof value === 'string') return value.length * 2;
    if (typeof value === 'number') return 8;
    if (typeof value === 'boolean') return 4;
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value).length * 2;
      } catch {
        return 1024; // Default size for circular objects
      }
    }
    return 32; // Default size
  }
}

/**
 * Multi-level Caching Service
 * 
 * Provides intelligent caching across multiple tiers with automatic
 * promotion/demotion, warming strategies, and invalidation.
 */
export class CachingService extends EventEmitter {
  private L1Cache: LRUCache;
  private stats: CacheStats = {
    L1: { hitCount: 0, missCount: 0, hitRate: 0, size: 0, maxSize: 1000, evictions: 0 },
    L2: { hitCount: 0, missCount: 0, hitRate: 0, totalKeys: 0, memoryUsage: 0 },
    L3: { hitCount: 0, missCount: 0, hitRate: 0, queryCount: 0 },
    overall: { totalHits: 0, totalMisses: 0, overallHitRate: 0, totalSize: 0 },
  };
  private warmingStrategies: Map<string, CacheWarmingStrategy> = new Map();
  private warmingInterval: NodeJS.Timeout | null = null;
  private isWarming = false;

  // Configuration
  private readonly config = {
    L1: {
      maxSize: 1000, // Maximum number of entries
      maxMemorySize: 100 * 1024 * 1024, // 100MB
    },
    L2: {
      defaultTTL: 3600, // 1 hour
      keyPrefix: 'cache',
    },
    L3: {
      defaultTTL: 1800, // 30 minutes
      keyPrefix: 'query_cache',
    },
    warming: {
      interval: 5 * 60 * 1000, // 5 minutes
      enabled: true,
    },
  };

  constructor() {
    super();
    this.L1Cache = new LRUCache(this.config.L1.maxSize, this.config.L1.maxMemorySize);
    this.setupEventHandlers();
    this.initializeWarmingStrategies();
    if (this.config.warming.enabled) {
      this.startWarming();
    }
  }

  /**
   * Get value from cache, checking all tiers
   */
  async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    const tier = options.tier || 'auto';

    // L1: In-memory cache
    if (tier === 'L1' || tier === 'auto') {
      const l1Result = this.L1Cache.get<T>(this.buildKey(key, options.prefix, 'L1'));
      if (l1Result !== null) {
        this.stats.L1.hitCount++;
        this.updateStats();
        this.emit('cacheHit', { key, tier: 'L1', value: l1Result });
        return l1Result;
      }
      this.stats.L1.missCount++;
    }

    // L2: Redis cache
    if (tier === 'L2' || tier === 'auto') {
      try {
        const l2Result = await optimizedRedisService.get<T>(
          this.buildKey(key, options.prefix, 'L2'),
          { json: options.json, ttl: options.ttl }
        );
        if (l2Result !== null) {
          this.stats.L2.hitCount++;
          this.updateStats();

          // Promote to L1 if it's a high-priority item
          if (options.priority === 'high' || tier === 'auto') {
            this.L1Cache.set(
              this.buildKey(key, options.prefix, 'L1'),
              l2Result,
              options
            );
          }

          this.emit('cacheHit', { key, tier: 'L2', value: l2Result });
          return l2Result;
        }
        this.stats.L2.missCount++;
      } catch (error) {
        logger.error('L2 cache error:', error);
      }
    }

    // L3: Database query cache (conceptual - would integrate with your DB layer)
    if (tier === 'L3' || tier === 'auto') {
      try {
        const l3Result = await this.getFromL3<T>(key, options);
        if (l3Result !== null) {
          this.stats.L3.hitCount++;
          this.updateStats();

          // Promote to higher tiers
          if (options.priority === 'high' || tier === 'auto') {
            await this.setToL2(key, l3Result, options);
            this.L1Cache.set(
              this.buildKey(key, options.prefix, 'L1'),
              l3Result,
              options
            );
          }

          this.emit('cacheHit', { key, tier: 'L3', value: l3Result });
          return l3Result;
        }
        this.stats.L3.missCount++;
      } catch (error) {
        logger.error('L3 cache error:', error);
      }
    }

    this.updateStats();
    this.emit('cacheMiss', { key, options });
    return null;
  }

  /**
   * Set value in cache across appropriate tiers
   */
  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    const tier = options.tier || 'auto';

    try {
      // L1: In-memory cache
      if (tier === 'L1' || tier === 'auto') {
        this.L1Cache.set(this.buildKey(key, options.prefix, 'L1'), value, options);
      }

      // L2: Redis cache
      if (tier === 'L2' || tier === 'auto') {
        await this.setToL2(key, value, options);
      }

      // L3: Database query cache
      if (tier === 'L3' || tier === 'auto') {
        await this.setToL3(key, value, options);
      }

      this.emit('cacheSet', { key, value, options, tier });
    } catch (error) {
      logger.error('Cache set error:', error);
      this.emit('cacheError', { key, error, operation: 'set' });
    }
  }

  /**
   * Get or set pattern with automatic cache miss handling
   */
  async getOrSet<T>(
    key: string,
    fetchFunction: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key, options);
    if (cached !== null) {
      return cached;
    }

    // Cache miss, fetch the data
    try {
      const data = await fetchFunction();

      // Store in cache
      await this.set(key, data, options);

      return data;
    } catch (error) {
      logger.error('Cache getOrSet fetch error:', error);
      this.emit('cacheError', { key, error, operation: 'getOrSet' });
      throw error;
    }
  }

  /**
   * Invalidate cache by key
   */
  async invalidate(key: string, options: CacheOptions = {}): Promise<boolean> {
    try {
      let invalidated = false;

      // L1: In-memory cache
      const l1Key = this.buildKey(key, options.prefix, 'L1');
      if (this.L1Cache.delete(l1Key)) {
        invalidated = true;
      }

      // L2: Redis cache
      const l2Key = this.buildKey(key, options.prefix, 'L2');
      try {
        const redisResult = await optimizedRedisService.getClient().del(l2Key);
        if (redisResult > 0) {
          invalidated = true;
        }
      } catch (error) {
        logger.error('L2 cache invalidation error:', error);
      }

      // L3: Database query cache
      const l3Key = this.buildKey(key, options.prefix, 'L3');
      try {
        await this.invalidateFromL3(l3Key);
        invalidated = true;
      } catch (error) {
        logger.error('L3 cache invalidation error:', error);
      }

      this.emit('cacheInvalidated', { key, options, invalidated });
      return invalidated;
    } catch (error) {
      logger.error('Cache invalidation error:', error);
      return false;
    }
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateByTag(tag: string): Promise<number> {
    try {
      let invalidatedCount = 0;

      // L1: In-memory cache (find and remove entries with matching tags)
      for (const [key, entry] of this.L1Cache['cache'].entries()) {
        if (entry.tags.includes(tag)) {
          this.L1Cache.delete(key);
          invalidatedCount++;
        }
      }

      // L2: Redis cache (using existing tag invalidation)
      try {
        const redisInvalidated = await optimizedRedisService.invalidateByTag(tag);
        invalidatedCount += redisInvalidated;
      } catch (error) {
        logger.error('L2 cache tag invalidation error:', error);
      }

      // L3: Database query cache
      try {
        const l3Invalidated = await this.invalidateL3ByTag(tag);
        invalidatedCount += l3Invalidated;
      } catch (error) {
        logger.error('L3 cache tag invalidation error:', error);
      }

      this.emit('cacheTagInvalidated', { tag, count: invalidatedCount });
      return invalidatedCount;
    } catch (error) {
      logger.error('Cache tag invalidation error:', error);
      return 0;
    }
  }

  /**
   * Clear all cache tiers
   */
  async clear(): Promise<void> {
    try {
      // L1: In-memory cache
      this.L1Cache.clear();

      // L2: Redis cache (clear with prefix)
      try {
        const pattern = `${this.config.L2.keyPrefix}:*`;
        const keys = await optimizedRedisService.getClient().keys(pattern);
        if (keys.length > 0) {
          await optimizedRedisService.getClient().del(...keys);
        }
      } catch (error) {
        logger.error('L2 cache clear error:', error);
      }

      // L3: Database query cache
      try {
        await this.clearL3();
      } catch (error) {
        logger.error('L3 cache clear error:', error);
      }

      this.emit('cacheCleared');
    } catch (error) {
      logger.error('Cache clear error:', error);
    }
  }

  /**
   * Get comprehensive cache statistics
   */
  getStats(): CacheStats {
    // Update L1 stats
    const l1Stats = this.L1Cache.getStats();
    this.stats.L1.size = l1Stats.size;
    this.stats.L1.maxSize = l1Stats.maxSize;
    this.stats.L1.totalSize = l1Stats.totalSize;

    // Update L2 stats from Redis
    this.updateL2Stats();

    this.updateStats();
    return { ...this.stats };
  }

  /**
   * Warm cache with frequently accessed data
   */
  async warmCache(strategyName?: string): Promise<void> {
    if (this.isWarming) {
      logger.warn('Cache warming already in progress');
      return;
    }

    this.isWarming = true;
    logger.info('Starting cache warming');

    try {
      if (strategyName) {
        const strategy = this.warmingStrategies.get(strategyName);
        if (strategy && strategy.enabled) {
          await strategy.warmupFunction();
          logger.info(`Cache warming completed for strategy: ${strategyName}`);
        }
      } else {
        // Run all enabled strategies
        for (const [name, strategy] of this.warmingStrategies) {
          if (strategy.enabled) {
            try {
              await strategy.warmupFunction();
              logger.info(`Cache warming completed for strategy: ${name}`);
            } catch (error) {
              logger.error(`Cache warming failed for strategy ${name}:`, error);
            }
          }
        }
      }

      this.emit('cacheWarmed');
    } catch (error) {
      logger.error('Cache warming error:', error);
      this.emit('cacheError', { error, operation: 'warming' });
    } finally {
      this.isWarming = false;
    }
  }

  /**
   * Add custom warming strategy
   */
  addWarmingStrategy(strategy: CacheWarmingStrategy): void {
    this.warmingStrategies.set(strategy.name, strategy);
    logger.info(`Added cache warming strategy: ${strategy.name}`);
  }

  /**
   * Remove warming strategy
   */
  removeWarmingStrategy(strategyName: string): boolean {
    const removed = this.warmingStrategies.delete(strategyName);
    if (removed) {
      logger.info(`Removed cache warming strategy: ${strategyName}`);
    }
    return removed;
  }

  /**
   * Start automatic cache warming
   */
  private startWarming(): void {
    if (this.warmingInterval) {
      clearInterval(this.warmingInterval);
    }

    this.warmingInterval = setInterval(async () => {
      await this.warmCache();
    }, this.config.warming.interval);

    logger.info('Started automatic cache warming');
  }

  /**
   * Stop automatic cache warming
   */
  stopWarming(): void {
    if (this.warmingInterval) {
      clearInterval(this.warmingInterval);
      this.warmingInterval = null;
      logger.info('Stopped automatic cache warming');
    }
  }

  private setupEventHandlers(): void {
    this.on('cacheHit', ({ tier, key }) => {
      logger.debug(`Cache hit on ${tier} for key: ${key}`);
    });

    this.on('cacheMiss', ({ key }) => {
      logger.debug(`Cache miss for key: ${key}`);
    });

    this.on('cacheError', ({ key, error, operation }) => {
      logger.error(`Cache error during ${operation} for key ${key}:`, error);
    });
  }

  private initializeWarmingStrategies(): void {
    // Default warming strategies
    this.addWarmingStrategy({
      name: 'frequent_queries',
      description: 'Warm frequently accessed query results',
      enabled: true,
      patterns: ['user:*', 'workshop:*', 'questionnaire:*'],
      priority: 1,
      warmupFunction: async () => {
        // Implementation would vary based on your application
        logger.debug('Warming frequent queries cache');
      },
    });

    this.addWarmingStrategy({
      name: 'user_sessions',
      description: 'Warm active user sessions',
      enabled: true,
      patterns: ['session:*'],
      priority: 2,
      warmupFunction: async () => {
        // Implementation would vary based on your application
        logger.debug('Warming user sessions cache');
      },
    });

    this.addWarmingStrategy({
      name: 'system_config',
      description: 'Warm system configuration',
      enabled: true,
      patterns: ['config:*', 'settings:*'],
      priority: 3,
      warmupFunction: async () => {
        // Implementation would vary based on your application
        logger.debug('Warming system configuration cache');
      },
    });
  }

  private async setToL2<T>(key: string, value: T, options: CacheOptions): Promise<void> {
    const l2Key = this.buildKey(key, options.prefix, 'L2');
    await optimizedRedisService.set(l2Key, value, {
      ttl: options.ttl || this.config.L2.defaultTTL,
      tags: options.tags,
      json: options.json !== false, // Default to JSON
      compress: options.compress,
    });
  }

  private async setToL3<T>(key: string, value: T, options: CacheOptions): Promise<void> {
    // This would integrate with your database query caching system
    // For now, we'll use Redis as a placeholder
    const l3Key = this.buildKey(key, options.prefix, 'L3');
    await optimizedRedisService.set(l3Key, value, {
      ttl: options.ttl || this.config.L3.defaultTTL,
      tags: options.tags,
      json: options.json !== false,
      prefix: this.config.L3.keyPrefix,
    });
  }

  private async getFromL3<T>(key: string, options: CacheOptions): Promise<T | null> {
    // This would integrate with your database query caching system
    const l3Key = this.buildKey(key, options.prefix, 'L3');
    return await optimizedRedisService.get<T>(l3Key, {
      json: options.json !== false,
      prefix: this.config.L3.keyPrefix,
    });
  }

  private async invalidateFromL3(key: string): Promise<void> {
    await optimizedRedisService.getClient().del(key);
  }

  private async invalidateL3ByTag(tag: string): Promise<number> {
    // This would integrate with your database query caching system
    return await optimizedRedisService.invalidateByTag(tag);
  }

  private async clearL3(): Promise<void> {
    const pattern = `${this.config.L3.keyPrefix}:*`;
    const keys = await optimizedRedisService.getClient().keys(pattern);
    if (keys.length > 0) {
      await optimizedRedisService.getClient().del(...keys);
    }
  }

  private buildKey(key: string, prefix?: string, tier?: string): string {
    const parts = [];
    
    if (tier) {
      parts.push(tier.toLowerCase());
    }
    
    if (prefix) {
      parts.push(prefix);
    }
    
    parts.push(key);
    
    return parts.join(':');
  }

  private updateStats(): void {
    const totalHits = this.stats.L1.hitCount + this.stats.L2.hitCount + this.stats.L3.hitCount;
    const totalMisses = this.stats.L1.missCount + this.stats.L2.missCount + this.stats.L3.missCount;
    const totalRequests = totalHits + totalMisses;

    this.stats.overall.totalHits = totalHits;
    this.stats.overall.totalMisses = totalMisses;
    this.stats.overall.overallHitRate = totalRequests > 0 ? totalHits / totalRequests : 0;
    this.stats.overall.totalSize = this.stats.L1.totalSize + this.stats.L2.memoryUsage;

    // Update tier hit rates
    this.stats.L1.hitRate = (this.stats.L1.hitCount + this.stats.L1.missCount) > 0 
      ? this.stats.L1.hitCount / (this.stats.L1.hitCount + this.stats.L1.missCount) 
      : 0;

    this.stats.L2.hitRate = (this.stats.L2.hitCount + this.stats.L2.missCount) > 0 
      ? this.stats.L2.hitCount / (this.stats.L2.hitCount + this.stats.L2.missCount) 
      : 0;

    this.stats.L3.hitRate = (this.stats.L3.hitCount + this.stats.L3.missCount) > 0 
      ? this.stats.L3.hitCount / (this.stats.L3.hitCount + this.stats.L3.missCount) 
      : 0;
  }

  private async updateL2Stats(): Promise<void> {
    try {
      const redisStats = optimizedRedisService.getStats();
      this.stats.L2.hitCount = redisStats.hits;
      this.stats.L2.missCount = redisStats.misses;
      this.stats.L2.memoryUsage = redisStats.memoryUsage;
      this.stats.L2.totalKeys = redisStats.totalKeys;
    } catch (error) {
      logger.error('Failed to update L2 stats:', error);
    }
  }
}

// Create and export singleton instance
export const cachingService = new CachingService();
