import { EventEmitter } from 'events';
import { optimizedRedisService } from '../config/optimized-redis';
import { logger } from '../utils/logger';

/**
 * Enhanced Multi-level caching system with intelligent invalidation and warming
 *
 * Features:
 * - L1: In-memory cache with LRU eviction
 * - L2: Redis cache with configurable TTL
 * - L3: Database query result caching
 * - Advanced cache warming strategies for frequently accessed data
 * - Intelligent cache invalidation based on data changes
 * - Memory-efficient data structures
 * - Event-driven architecture for cache management
 * - Predictive cache preloading
 * - Cache performance analytics
 * - Automatic cache optimization
 */

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string; // Key prefix
  tags?: string[]; // Cache tags for invalidation
  compress?: boolean; // Compress large values
  json?: boolean; // JSON serialize/deserialize
  priority?: 'low' | 'medium' | 'high' | 'critical'; // Cache priority for eviction
  tier?: 'L1' | 'L2' | 'L3' | 'auto'; // Cache tier selection
  predictive?: boolean; // Enable predictive preloading
  warmingStrategy?: string; // Specific warming strategy to use
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
  priority: 'low' | 'medium' | 'high' | 'critical';
  accessFrequency: number; // Accesses per hour
  predictionScore?: number; // Likelihood of future access
  hotKey?: boolean; // Frequently accessed key
}

export interface CacheStats {
  L1: {
    hitCount: number;
    missCount: number;
    hitRate: number;
    size: number;
    maxSize: number;
    evictions: number;
    memoryUsage: number;
    hotKeys: number;
  };
  L2: {
    hitCount: number;
    missCount: number;
    hitRate: number;
    totalKeys: number;
    memoryUsage: number;
    avgResponseTime: number;
    hotKeys: number;
  };
  L3: {
    hitCount: number;
    missCount: number;
    hitRate: number;
    queryCount: number;
    avgResponseTime: number;
  };
  overall: {
    totalHits: number;
    totalMisses: number;
    overallHitRate: number;
    totalSize: number;
    avgResponseTime: number;
    predictiveAccuracy: number;
  };
  predictions: {
    correctPredictions: number;
    totalPredictions: number;
    accuracy: number;
  };
}

export interface CacheWarmingStrategy {
  name: string;
  description: string;
  enabled: boolean;
  patterns: string[];
  priority: number;
  warmupFunction: () => Promise<void>;
  schedule?: string; // Cron-like schedule
  conditions?: () => boolean; // Conditions for warming
}

export interface CacheAnalytics {
  topKeys: Array<{
    key: string;
    accessCount: number;
    hitRate: number;
    size: number;
    tier: string;
  }>;
  accessPatterns: Array<{
    pattern: string;
    frequency: number;
    lastAccess: Date;
  }>;
  performanceTrends: Array<{
    metric: string;
    timeframe: string;
    trend: 'improving' | 'degrading' | 'stable';
    value: number;
  }>;
  recommendations: Array<{
    type: string;
    description: string;
    impact: string;
    priority: 'low' | 'medium' | 'high';
  }>;
}

/**
 * Enhanced LRU Cache implementation for L1 (in-memory) caching
 */
class EnhancedLRUCache<T = any> {
  private maxSize: number;
  private cache: Map<string, CacheEntry<T>> = new Map();
  private accessOrder: string[] = [];
  private currentSize = 0;
  private maxMemorySize: number; // in bytes
  private hotKeyThreshold = 10; // accesses per hour to be considered hot

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
    this.updateAccessFrequency(entry);
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
      accessFrequency: 1,
      hotKey: false,
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
    const hotKeys = Array.from(this.cache.values()).filter(entry => entry.hotKey).length;

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      totalSize: this.currentSize,
      maxMemorySize: this.maxMemorySize,
      hotKeys,
    };
  }

  getTopKeys(limit: number = 10): Array<{ key: string; entry: CacheEntry<T> }> {
    return Array.from(this.cache.entries())
      .sort((a, b) => b[1].accessCount - a[1].accessCount)
      .slice(0, limit)
      .map(([key, entry]) => ({ key, entry }));
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

  private updateAccessFrequency(entry: CacheEntry<T>): void {
    const hoursSinceCreation = (Date.now() - entry.createdAt.getTime()) / (1000 * 60 * 60);
    entry.accessFrequency = entry.accessCount / Math.max(hoursSinceCreation, 1);
    entry.hotKey = entry.accessFrequency >= this.hotKeyThreshold;
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
 * Enhanced Multi-level Caching Service
 *
 * Provides intelligent caching across multiple tiers with automatic
 * promotion/demotion, advanced warming strategies, and predictive capabilities.
 */
export class EnhancedCachingService extends EventEmitter {
  private L1Cache: EnhancedLRUCache;
  private stats: CacheStats = {
    L1: { hitCount: 0, missCount: 0, hitRate: 0, size: 0, maxSize: 1000, evictions: 0, memoryUsage: 0, hotKeys: 0 },
    L2: { hitCount: 0, missCount: 0, hitRate: 0, totalKeys: 0, memoryUsage: 0, avgResponseTime: 0, hotKeys: 0 },
    L3: { hitCount: 0, missCount: 0, hitRate: 0, queryCount: 0, avgResponseTime: 0 },
    overall: { totalHits: 0, totalMisses: 0, overallHitRate: 0, totalSize: 0, avgResponseTime: 0, predictiveAccuracy: 0 },
    predictions: { correctPredictions: 0, totalPredictions: 0, accuracy: 0 },
  };
  private warmingStrategies: Map<string, CacheWarmingStrategy> = new Map();
  private warmingInterval: NodeJS.Timeout | null = null;
  private analyticsInterval: NodeJS.Timeout | null = null;
  private isWarming = false;
  private accessPatterns: Map<string, { count: number; lastAccess: Date; pattern: string }> = new Map();
  private predictions: Map<string, { score: number; timestamp: Date }> = new Map();

  // Enhanced configuration
  private readonly config = {
    L1: {
      maxSize: 1000, // Maximum number of entries
      maxMemorySize: 100 * 1024 * 1024, // 100MB
      hotKeyThreshold: 10, // accesses per hour
    },
    L2: {
      defaultTTL: 3600, // 1 hour
      keyPrefix: 'cache',
      compressionThreshold: 1024, // Compress values > 1KB
    },
    L3: {
      defaultTTL: 1800, // 30 minutes
      keyPrefix: 'query_cache',
    },
    warming: {
      interval: 5 * 60 * 1000, // 5 minutes
      enabled: true,
      predictiveWarming: true,
    },
    analytics: {
      interval: 10 * 60 * 1000, // 10 minutes
      retentionPeriod: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
    prediction: {
      enabled: true,
      modelUpdateInterval: 60 * 60 * 1000, // 1 hour
      minDataPoints: 100, // Minimum data points for prediction
    },
  };

  constructor() {
    super();
    this.L1Cache = new EnhancedLRUCache(this.config.L1.maxSize, this.config.L1.maxMemorySize);
    this.setupEventHandlers();
    this.initializeWarmingStrategies();
    this.initializePredictiveModels();

    if (this.config.warming.enabled) {
      this.startWarming();
    }

    if (this.config.analytics.interval) {
      this.startAnalytics();
    }
  }

  /**
   * Get value from cache, checking all tiers with predictive preloading
   */
  async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    const tier = options.tier || 'auto';
    const startTime = Date.now();

    // Record access pattern
    this.recordAccessPattern(key);

    // Check prediction for this key
    if (options.predictive && this.config.prediction.enabled) {
      this.checkPrediction(key);
    }

    // L1: In-memory cache
    if (tier === 'L1' || tier === 'auto') {
      const l1Result = this.L1Cache.get<T>(this.buildKey(key, options.prefix, 'L1'));
      if (l1Result !== null) {
        this.stats.L1.hitCount++;
        this.updateStats(Date.now() - startTime);
        this.emit('cacheHit', { key, tier: 'L1', value: l1Result, responseTime: Date.now() - startTime });
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
          this.updateStats(Date.now() - startTime);

          // Promote to L1 if it's a high-priority item
          if (options.priority === 'high' || options.priority === 'critical' || tier === 'auto') {
            this.L1Cache.set(
              this.buildKey(key, options.prefix, 'L1'),
              l2Result,
              options
            );
          }

          this.emit('cacheHit', { key, tier: 'L2', value: l2Result, responseTime: Date.now() - startTime });
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
          this.updateStats(Date.now() - startTime);

          // Promote to higher tiers
          if (options.priority === 'high' || options.priority === 'critical' || tier === 'auto') {
            await this.setToL2(key, l3Result, options);
            this.L1Cache.set(
              this.buildKey(key, options.prefix, 'L1'),
              l3Result,
              options
            );
          }

          this.emit('cacheHit', { key, tier: 'L3', value: l3Result, responseTime: Date.now() - startTime });
          return l3Result;
        }
        this.stats.L3.missCount++;
      } catch (error) {
        logger.error('L3 cache error:', error);
      }
    }

    this.updateStats(Date.now() - startTime);
    this.emit('cacheMiss', { key, options, responseTime: Date.now() - startTime });
    return null;
  }

  /**
   * Set value in cache across appropriate tiers with smart tier selection
   */
  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    const tier = this.tier || options.tier || 'auto';

    try {
      // Determine optimal tier based on data characteristics
      const optimalTier = this.determineOptimalTier(key, value, options);

      // L1: In-memory cache
      if (optimalTier === 'L1' || tier === 'L1' || tier === 'auto') {
        this.L1Cache.set(this.buildKey(key, options.prefix, 'L1'), value, options);
      }

      // L2: Redis cache
      if (optimalTier === 'L2' || tier === 'L2' || tier === 'auto') {
        await this.setToL2(key, value, options);
      }

      // L3: Database query cache
      if (optimalTier === 'L3' || tier === 'L3' || tier === 'auto') {
        await this.setToL3(key, value, options);
      }

      // Update prediction model
      if (this.config.prediction.enabled) {
        this.updatePredictionModel(key, value, options);
      }

      this.emit('cacheSet', { key, value, options, tier: optimalTier });
    } catch (error) {
      logger.error('Cache set error:', error);
      this.emit('cacheError', { key, error, operation: 'set' });
    }
  }

  /**
   * Get or set pattern with automatic cache miss handling and predictive loading
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
      const startTime = Date.now();
      const data = await fetchFunction();
      const fetchTime = Date.now() - startTime;

      // Store in cache with dynamic TTL based on fetch time
      const dynamicOptions = {
        ...options,
        ttl: this.calculateDynamicTTL(fetchTime, options.ttl),
      };

      // Store in cache
      await this.set(key, data, dynamicOptions);

      // If fetch was slow, predict future access and preload related data
      if (fetchTime > 1000 && options.predictive) {
        this.triggerPredictiveLoading(key, data, options);
      }

      return data;
    } catch (error) {
      logger.error('Cache getOrSet fetch error:', error);
      this.emit('cacheError', { key, error, operation: 'getOrSet' });
      throw error;
    }
  }

  /**
   * Get comprehensive cache analytics
   */
  getAnalytics(): CacheAnalytics {
    const topKeys = this.getTopAccessedKeys(20);
    const accessPatterns = this.getAccessPatterns();
    const performanceTrends = this.getPerformanceTrends();
    const recommendations = this.generateOptimizationRecommendations();

    return {
      topKeys,
      accessPatterns,
      performanceTrends,
      recommendations,
    };
  }

  /**
   * Warm cache with frequently accessed data using advanced strategies
   */
  async warmCache(strategyName?: string): Promise<void> {
    if (this.isWarming) {
      logger.warn('Cache warming already in progress');
      return;
    }

    this.isWarming = true;
    logger.info('Starting enhanced cache warming');

    try {
      if (strategyName) {
        const strategy = this.warmingStrategies.get(strategyName);
        if (strategy && strategy.enabled && (!strategy.conditions || strategy.conditions())) {
          await strategy.warmupFunction();
          logger.info(`Cache warming completed for strategy: ${strategyName}`);
        }
      } else {
        // Run all enabled strategies that meet conditions
        for (const [name, strategy] of this.warmingStrategies) {
          if (strategy.enabled && (!strategy.conditions || strategy.conditions())) {
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
   * Trigger predictive loading based on key access patterns
   */
  private async triggerPredictiveLoading<T>(key: string, data: T, options: CacheOptions): Promise<void> {
    try {
      const relatedKeys = this.findRelatedKeys(key);

      for (const relatedKey of relatedKeys) {
        const predictionScore = this.calculatePredictionScore(relatedKey);
        if (predictionScore > 0.7) { // High likelihood of access
          // Preload related keys in background
          this.preloadKey(relatedKey, options);
        }
      }
    } catch (error) {
      logger.error('Predictive loading failed:', error);
    }
  }

  private determineOptimalTier<T>(key: string, value: T, options: CacheOptions): 'L1' | 'L2' | 'L3' {
    const size = this.calculateSize(value);
    const accessPattern = this.accessPatterns.get(key);
    const accessFrequency = accessPattern ? accessPattern.count : 0;

    // Small, frequently accessed items go to L1
    if (size < 1024 && accessFrequency > 5 && options.priority !== 'low') {
      return 'L1';
    }

    // Medium-sized items with moderate access go to L2
    if (size < 10240 && accessFrequency > 1) {
      return 'L2';
    }

    // Large items or infrequently accessed go to L3
    return 'L3';
  }

  private calculateDynamicTTL(fetchTime: number, baseTTL?: number): number {
    if (!baseTTL) {
      // Slower data gets longer TTL to avoid repeated expensive fetches
      if (fetchTime > 5000) return 7200; // 2 hours for very slow data
      if (fetchTime > 2000) return 3600; // 1 hour for slow data
      if (fetchTime > 1000) return 1800; // 30 minutes for moderately slow data
      return 600; // 10 minutes for fast data
    }

    // Adjust base TTL based on fetch time
    const multiplier = Math.min(3, Math.max(0.5, fetchTime / 1000));
    return Math.floor(baseTTL * multiplier);
  }

  private recordAccessPattern(key: string): void {
    const pattern = this.extractPattern(key);
    const existing = this.accessPatterns.get(key);

    if (existing) {
      existing.count++;
      existing.lastAccess = new Date();
    } else {
      this.accessPatterns.set(key, {
        count: 1,
        lastAccess: new Date(),
        pattern,
      });
    }
  }

  private extractPattern(key: string): string {
    // Extract pattern from key (e.g., user:123 -> user:*)
    const parts = key.split(':');
    if (parts.length > 1) {
      return parts.slice(0, -1).join(':') + ':*';
    }
    return key;
  }

  private findRelatedKeys(key: string): string[] {
    const pattern = this.extractPattern(key);
    const relatedKeys: string[] = [];

    for (const [cacheKey, accessData] of this.accessPatterns.entries()) {
      if (accessData.pattern === pattern && cacheKey !== key) {
        relatedKeys.push(cacheKey);
      }
    }

    // Sort by access frequency and return top 5
    return relatedKeys
      .sort((a, b) => this.accessPatterns.get(b)!.count - this.accessPatterns.get(a)!.count)
      .slice(0, 5);
  }

  private calculatePredictionScore(key: string): number {
    const accessData = this.accessPatterns.get(key);
    if (!accessData) return 0;

    const timeSinceLastAccess = Date.now() - accessData.lastAccess.getTime();
    const hoursSinceLastAccess = timeSinceLastAccess / (1000 * 60 * 60);

    // Higher score for recently accessed, frequently accessed keys
    const recencyScore = Math.max(0, 1 - hoursSinceLastAccess / 24); // Decay over 24 hours
    const frequencyScore = Math.min(1, accessData.count / 10); // Normalize to 0-1

    return (recencyScore * 0.6) + (frequencyScore * 0.4);
  }

  private preloadKey(key: string, options: CacheOptions): void {
    // This would trigger background loading of the key
    // Implementation depends on your specific data fetching logic
    logger.debug(`Preloading key: ${key} with prediction score`);
    this.emit('preloadKey', { key, options });
  }

  private checkPrediction(key: string): void {
    const prediction = this.predictions.get(key);
    if (prediction && Date.now() - prediction.timestamp.getTime() < 3600000) { // 1 hour
      this.stats.predictions.totalPredictions++;

      // If key is accessed after prediction, it's a correct prediction
      if (this.calculatePredictionScore(key) > 0.5) {
        this.stats.predictions.correctPredictions++;
      }
    }
  }

  private updatePredictionModel<T>(key: string, value: T, options: CacheOptions): void {
    if (!this.config.prediction.enabled) return;

    const predictionScore = this.calculatePredictionScore(key);
    this.predictions.set(key, {
      score: predictionScore,
      timestamp: new Date(),
    });

    // Clean up old predictions
    const cutoff = Date.now() - this.config.prediction.modelUpdateInterval;
    for (const [k, v] of this.predictions.entries()) {
      if (v.timestamp.getTime() < cutoff) {
        this.predictions.delete(k);
      }
    }
  }

  private getTopAccessedKeys(limit: number): Array<{ key: string; accessCount: number; hitRate: number; size: number; tier: string }> {
    const L1TopKeys = this.L1Cache.getTopKeys(limit);

    return L1TopKeys.map(({ key, entry }) => ({
      key,
      accessCount: entry.accessCount,
      hitRate: entry.accessCount / Math.max(1, (Date.now() - entry.createdAt.getTime()) / (1000 * 60 * 60)),
      size: entry.size,
      tier: entry.tier,
    }));
  }

  private getAccessPatterns(): Array<{ pattern: string; frequency: number; lastAccess: Date }> {
    const patternCounts = new Map<string, { count: number; lastAccess: Date }>();

    for (const [key, accessData] of this.accessPatterns.entries()) {
      const existing = patternCounts.get(accessData.pattern);
      if (existing) {
        existing.count += accessData.count;
        if (accessData.lastAccess > existing.lastAccess) {
          existing.lastAccess = accessData.lastAccess;
        }
      } else {
        patternCounts.set(accessData.pattern, {
          count: accessData.count,
          lastAccess: accessData.lastAccess,
        });
      }
    }

    return Array.from(patternCounts.entries())
      .map(([pattern, data]) => ({
        pattern,
        frequency: data.count,
        lastAccess: data.lastAccess,
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 20);
  }

  private getPerformanceTrends(): Array<{ metric: string; timeframe: string; trend: 'improving' | 'degrading' | 'stable'; value: number }> {
    // This would analyze historical performance data
    // For now, return basic trends
    return [
      {
        metric: 'hit_rate',
        timeframe: '1h',
        trend: this.stats.overall.overallHitRate > 0.8 ? 'improving' : 'degrading',
        value: this.stats.overall.overallHitRate,
      },
      {
        metric: 'avg_response_time',
        timeframe: '1h',
        trend: this.stats.overall.avgResponseTime < 50 ? 'improving' : 'degrading',
        value: this.stats.overall.avgResponseTime,
      },
    ];
  }

  private generateOptimizationRecommendations(): Array<{ type: string; description: string; impact: string; priority: 'low' | 'medium' | 'high' }> {
    const recommendations = [];

    // Low hit rate recommendation
    if (this.stats.overall.overallHitRate < 0.6) {
      recommendations.push({
        type: 'hit_rate',
        description: 'Cache hit rate is below optimal threshold',
        impact: 'Improve response times and reduce database load',
        priority: 'high',
      });
    }

    // Memory usage recommendation
    const l1Stats = this.L1Cache.getStats();
    if (l1Stats.totalSize / l1Stats.maxMemorySize > 0.9) {
      recommendations.push({
        type: 'memory',
        description: 'L1 cache is approaching memory limit',
        impact: 'Prevent evictions and improve stability',
        priority: 'medium',
      });
    }

    // Evictions recommendation
    if (this.stats.L1.evictions > 100) {
      recommendations.push({
        type: 'evictions',
        description: 'High number of L1 cache evictions detected',
        impact: 'Reduce cache churn and improve hit rates',
        priority: 'medium',
      });
    }

    return recommendations;
  }

  private calculateSize(value: any): number {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'string') return value.length * 2;
    if (typeof value === 'number') return 8;
    if (typeof value === 'boolean') return 4;
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value).length * 2;
      } catch {
        return 1024;
      }
    }
    return 32;
  }

  private initializeWarmingStrategies(): void {
    // Enhanced warming strategies
    this.addWarmingStrategy({
      name: 'user_sessions',
      description: 'Warm active user sessions and profile data',
      enabled: true,
      patterns: ['session:*', 'user:*'],
      priority: 1,
      warmupFunction: async () => {
        // Implementation would vary based on your application
        logger.debug('Warming user sessions and profiles cache');
      },
    });

    this.addWarmingStrategy({
      name: 'frequently_accessed',
      description: 'Warm frequently accessed data based on access patterns',
      enabled: true,
      patterns: [],
      priority: 2,
      warmupFunction: async () => {
        const topKeys = this.getTopAccessedKeys(50);
        for (const { key } of topKeys) {
          // Trigger warming for top keys
          this.emit('warmKey', { key });
        }
        logger.debug(`Warming ${topKeys.length} frequently accessed keys`);
      },
    });

    this.addWarmingStrategy({
      name: 'predictive_warming',
      description: 'Warm keys based on predictive analysis',
      enabled: this.config.warming.predictiveWarming,
      patterns: [],
      priority: 3,
      conditions: () => this.predictions.size > this.config.prediction.minDataPoints,
      warmupFunction: async () => {
        const highScorePredictions = Array.from(this.predictions.entries())
          .filter(([, prediction]) => prediction.score > 0.8)
          .sort((a, b) => b[1].score - a[1].score)
          .slice(0, 20);

        for (const [key] of highScorePredictions) {
          this.emit('warmKey', { key, predictive: true });
        }
        logger.debug(`Predictive warming for ${highScorePredictions.length} keys`);
      },
    });

    this.addWarmingStrategy({
      name: 'system_config',
      description: 'Warm system configuration and settings',
      enabled: true,
      patterns: ['config:*', 'settings:*'],
      priority: 4,
      warmupFunction: async () => {
        logger.debug('Warming system configuration cache');
      },
    });
  }

  private initializePredictiveModels(): void {
    if (!this.config.prediction.enabled) return;

    // Update prediction models periodically
    setInterval(() => {
      this.updatePredictionAccuracy();
    }, this.config.prediction.modelUpdateInterval);
  }

  private updatePredictionAccuracy(): void {
    if (this.stats.predictions.totalPredictions > 0) {
      this.stats.predictions.accuracy =
        this.stats.predictions.correctPredictions / this.stats.predictions.totalPredictions;
      this.stats.overall.predictiveAccuracy = this.stats.predictions.accuracy;
    }
  }

  private startWarming(): void {
    if (this.warmingInterval) {
      clearInterval(this.warmingInterval);
    }

    this.warmingInterval = setInterval(async () => {
      await this.warmCache();
    }, this.config.warming.interval);

    logger.info('Started automatic enhanced cache warming');
  }

  private startAnalytics(): void {
    if (this.analyticsInterval) {
      clearInterval(this.analyticsInterval);
    }

    this.analyticsInterval = setInterval(() => {
      this.cleanupOldData();
      this.updateAnalytics();
    }, this.config.analytics.interval);

    logger.info('Started cache analytics collection');
  }

  private cleanupOldData(): void {
    const cutoff = Date.now() - this.config.analytics.retentionPeriod;

    // Clean up old access patterns
    for (const [key, accessData] of this.accessPatterns.entries()) {
      if (accessData.lastAccess.getTime() < cutoff) {
        this.accessPatterns.delete(key);
      }
    }
  }

  private updateAnalytics(): void {
    const analytics = this.getAnalytics();
    this.emit('analyticsUpdated', analytics);
  }

  private setupEventHandlers(): void {
    this.on('cacheHit', ({ tier, key, responseTime }) => {
      logger.debug(`Cache hit on ${tier} for key: ${key} (${responseTime}ms)`);
    });

    this.on('cacheMiss', ({ key, responseTime }) => {
      logger.debug(`Cache miss for key: ${key} (${responseTime}ms)`);
    });

    this.on('cacheError', ({ key, error, operation }) => {
      logger.error(`Cache error during ${operation} for key ${key}:`, error);
    });
  }

  private updateStats(responseTime: number): void {
    // Update average response time
    const totalRequests = this.stats.overall.totalHits + this.stats.overall.totalMisses;
    this.stats.overall.avgResponseTime =
      (this.stats.overall.avgResponseTime * (totalRequests - 1) + responseTime) / totalRequests;
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

  // Additional methods would be implemented here for L2/L3 operations
  private async setToL2<T>(key: string, value: T, options: CacheOptions): Promise<void> {
    const l2Key = this.buildKey(key, options.prefix, 'L2');
    await optimizedRedisService.set(l2Key, value, {
      ttl: options.ttl || this.config.L2.defaultTTL,
      tags: options.tags,
      json: options.json !== false,
      compress: options.compress,
    });
  }

  private async setToL3<T>(key: string, value: T, options: CacheOptions): Promise<void> {
    const l3Key = this.buildKey(key, options.prefix, 'L3');
    await optimizedRedisService.set(l3Key, value, {
      ttl: options.ttl || this.config.L3.defaultTTL,
      tags: options.tags,
      json: options.json !== false,
      prefix: this.config.L3.keyPrefix,
    });
  }

  private async getFromL3<T>(key: string, options: CacheOptions): Promise<T | null> {
    const l3Key = this.buildKey(key, options.prefix, 'L3');
    return await optimizedRedisService.get<T>(l3Key, {
      json: options.json !== false,
      prefix: this.config.L3.keyPrefix,
    });
  }
}

// Create and export singleton instance
export const enhancedCachingService = new EnhancedCachingService();