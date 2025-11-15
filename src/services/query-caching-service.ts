/**
 * Query Result Caching Service
 *
 * Provides intelligent query result caching with automatic invalidation,
 * query fingerprinting, and cache warming for frequently executed queries.
 *
 * Features:
 * - Intelligent query result caching
 * - Cache invalidation based on table changes
 * - Query fingerprinting for cache keys
 * - Cached result warming for frequent queries
 * - Cache statistics and monitoring
 * - Multi-layer caching (memory + Redis)
 */

import { redisService } from '../config/redis';
import { createHash } from 'crypto';
import { EventEmitter } from 'events';

/**
 * Cache entry interface
 */
export interface CacheEntry<T = any> {
  key: string;
  data: T;
  fingerprint: string;
  tables: string[];
  query: string;
  params?: any[];
  createdAt: Date;
  expiresAt: Date;
  accessCount: number;
  lastAccessed: Date;
  size: number; // in bytes
  ttl: number;
}

/**
 * Cache statistics
 */
export interface CacheStatistics {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  evictions: number;
  totalSize: number; // in bytes
  hitRatio: number;
  averageAccessTime: number;
  oldestEntry: Date | null;
  newestEntry: Date | null;
}

/**
 * Cache configuration
 */
export interface CacheConfiguration {
  defaultTTL: number; // in seconds
  maxMemorySize: number; // in bytes
  maxEntries: number;
  cleanupInterval: number; // in milliseconds
  compressionThreshold: number; // in bytes
  enableCompression: boolean;
  enableMetrics: boolean;
  warmingEnabled: boolean;
  warmingThreshold: number; // minimum access count for warming
  invalidationStrategy: 'immediate' | 'batched' | 'lazy';
  invalidationBatchSize: number;
  invalidationBatchTimeout: number; // in milliseconds
}

/**
 * Table change notification
 */
export interface TableChangeNotification {
  tableName: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE' | 'TRUNCATE';
  rowCount: number;
  timestamp: Date;
  affectedColumns?: string[];
}

/**
 * Cache warming configuration
 */
export interface CacheWarmingConfig {
  enabled: boolean;
  interval: number; // in milliseconds
  threshold: number; // minimum access count
  maxConcurrentWarms: number;
  warmupTimeout: number; // in milliseconds
}

/**
 * Query Result Caching Service
 */
export class QueryResultCachingService extends EventEmitter {
  private config: CacheConfiguration;
  private memoryCache: Map<string, CacheEntry> = new Map();
  private cacheStats: CacheStatistics;
  private cleanupInterval?: NodeJS.Timeout;
  private warmingInterval?: NodeJS.Timeout;
  private pendingInvalidations: Map<string, Set<string>> = new Map();
  private invalidationTimer?: NodeJS.Timeout;
  private warmingQueue: Array<{ key: string; priority: number }> = [];
  private isWarming: boolean = false;

  constructor(config?: Partial<CacheConfiguration>) {
    super();

    this.config = {
      defaultTTL: 300, // 5 minutes
      maxMemorySize: 100 * 1024 * 1024, // 100MB
      maxEntries: 10000,
      cleanupInterval: 60000, // 1 minute
      compressionThreshold: 1024, // 1KB
      enableCompression: true,
      enableMetrics: true,
      warmingEnabled: true,
      warmingThreshold: 5,
      invalidationStrategy: 'batched',
      invalidationBatchSize: 100,
      invalidationBatchTimeout: 5000, // 5 seconds
      ...config,
    };

    this.cacheStats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      totalSize: 0,
      hitRatio: 0,
      averageAccessTime: 0,
      oldestEntry: null,
      newestEntry: null,
    };

    this.initializeService();
  }

  /**
   * Initialize the caching service
   */
  private initializeService(): void {
    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);

    // Start warming interval if enabled
    if (this.config.warmingEnabled) {
      this.warmingInterval = setInterval(() => {
        this.processWarmingQueue();
      }, 30000); // Every 30 seconds
    }

    console.log('Query Result Caching Service initialized');
  }

  /**
   * Get cached query result
   */
  async get<T = any>(
    query: string,
    params?: any[],
    ttl?: number
  ): Promise<T | null> {
    const startTime = Date.now();
    const fingerprint = this.generateQueryFingerprint(query, params);
    const key = this.generateCacheKey(fingerprint, query, params);

    try {
      // Check memory cache first
      let entry = this.memoryCache.get(key);

      if (!entry) {
        // Check Redis cache
        const redisData = await redisService.getClient().get(key);
        if (redisData) {
          entry = JSON.parse(redisData);

          // Add to memory cache if it fits
          if (this.canAddToMemoryCache(entry)) {
            this.memoryCache.set(key, entry);
          }
        }
      }

      if (entry) {
        // Check if expired
        if (entry.expiresAt < new Date()) {
          await this.delete(key);
          this.cacheStats.misses++;
          return null;
        }

        // Update access statistics
        entry.accessCount++;
        entry.lastAccessed = new Date();

        // Update cache statistics
        this.cacheStats.hits++;
        this.updateHitRatio();

        // Emit cache hit event
        this.emit('cacheHit', { key, fingerprint, accessTime: Date.now() - startTime });

        return entry.data as T;
      }

      // Cache miss
      this.cacheStats.misses++;
      this.updateHitRatio();

      // Emit cache miss event
      this.emit('cacheMiss', { key, fingerprint, accessTime: Date.now() - startTime });

      return null;
    } catch (error) {
      console.error('Cache get error:', error);
      this.cacheStats.misses++;
      return null;
    }
  }

  /**
   * Set cached query result
   */
  async set<T = any>(
    query: string,
    data: T,
    params?: any[],
    ttl?: number,
    tables?: string[]
  ): Promise<void> {
    try {
      const fingerprint = this.generateQueryFingerprint(query, params);
      const key = this.generateCacheKey(fingerprint, query, params);
      const actualTTL = ttl || this.config.defaultTTL;

      // Calculate data size
      const serializedData = JSON.stringify(data);
      const size = Buffer.byteLength(serializedData, 'utf8');

      // Check if entry is too large for memory cache
      const useMemoryCache = this.canAddToMemoryCache({ size } as CacheEntry);

      const entry: CacheEntry<T> = {
        key,
        data,
        fingerprint,
        tables: tables || this.extractTablesFromQuery(query),
        query,
        params,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + actualTTL * 1000),
        accessCount: 0,
        lastAccessed: new Date(),
        size,
        ttl: actualTTL,
      };

      // Set in Redis
      const redisData = JSON.stringify(entry);
      await redisService.getClient().setex(key, actualTTL, redisData);

      // Set in memory cache if it fits
      if (useMemoryCache) {
        this.memoryCache.set(key, entry);
        this.cacheStats.totalSize += size;
      }

      // Update statistics
      this.cacheStats.sets++;
      this.updateCacheTimestamps(entry);

      // Check if we need to warm this cache entry later
      if (this.config.warmingEnabled) {
        this.scheduleWarming(key, entry);
      }

      // Emit cache set event
      this.emit('cacheSet', { key, fingerprint, size, ttl: actualTTL });

    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  /**
   * Delete cached entry
   */
  async delete(key: string): Promise<void> {
    try {
      // Remove from memory cache
      const entry = this.memoryCache.get(key);
      if (entry) {
        this.cacheStats.totalSize -= entry.size;
        this.memoryCache.delete(key);
      }

      // Remove from Redis
      await redisService.getClient().del(key);

      // Update statistics
      this.cacheStats.deletes++;

      // Emit cache delete event
      this.emit('cacheDelete', { key });

    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  /**
   * Invalidate cache entries by table
   */
  async invalidateByTable(tableName: string): Promise<void> {
    try {
      const keysToDelete: string[] = [];

      // Find entries in memory cache
      for (const [key, entry] of this.memoryCache.entries()) {
        if (entry.tables.includes(tableName)) {
          keysToDelete.push(key);
        }
      }

      // Add to pending invalidations based on strategy
      if (this.config.invalidationStrategy === 'immediate') {
        await this.performInvalidation(keysToDelete);
      } else {
        this.addToPendingInvalidations(tableName, keysToDelete);
      }

      // Emit invalidation event
      this.emit('cacheInvalidation', { tableName, keyCount: keysToDelete.length });

    } catch (error) {
      console.error('Cache invalidation error:', error);
    }
  }

  /**
   * Invalidate cache entries by table pattern
   */
  async invalidateByTablePattern(pattern: string): Promise<void> {
    try {
      const keysToDelete: string[] = [];

      // Find entries in memory cache
      for (const [key, entry] of this.memoryCache.entries()) {
        if (entry.tables.some(table => table.match(pattern))) {
          keysToDelete.push(key);
        }
      }

      await this.performInvalidation(keysToDelete);

      // Emit pattern invalidation event
      this.emit('cachePatternInvalidation', { pattern, keyCount: keysToDelete.length });

    } catch (error) {
      console.error('Cache pattern invalidation error:', error);
    }
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    try {
      // Clear memory cache
      this.memoryCache.clear();
      this.cacheStats.totalSize = 0;

      // Clear Redis cache (using pattern matching)
      const redis = redisService.getClient();
      const keys = await redis.keys('query_cache:*');
      if (keys.length > 0) {
        await redis.del(...keys);
      }

      // Reset statistics
      this.resetStatistics();

      // Emit cache clear event
      this.emit('cacheClear');

      console.log('Cache cleared successfully');

    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }

  /**
   * Get cache statistics
   */
  getStatistics(): CacheStatistics {
    return { ...this.cacheStats };
  }

  /**
   * Get memory cache entries
   */
  getMemoryCacheEntries(): Array<CacheEntry> {
    return Array.from(this.memoryCache.values());
  }

  /**
   * Warm cache for frequently accessed queries
   */
  async warmCache(entry: CacheEntry): Promise<void> {
    try {
      // This would typically involve re-executing the query and caching the result
      // For now, we'll just update the access time to keep it in cache

      if (this.memoryCache.has(entry.key)) {
        const cachedEntry = this.memoryCache.get(entry.key)!;
        cachedEntry.lastAccessed = new Date();
        cachedEntry.accessCount++;
      }

      // Emit cache warm event
      this.emit('cacheWarm', { key: entry.key, fingerprint: entry.fingerprint });

    } catch (error) {
      console.error('Cache warm error:', error);
    }
  }

  /**
   * Generate query fingerprint
   */
  private generateQueryFingerprint(query: string, params?: any[]): string {
    let normalized = query
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

    // Normalize parameters
    if (params && params.length > 0) {
      normalized += '|' + params.map(p =>
        typeof p === 'string' ? `'${p}'` : String(p)
      ).join(',');
    }

    return createHash('md5').update(normalized).digest('hex');
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(fingerprint: string, query: string, params?: any[]): string {
    return `query_cache:${fingerprint}`;
  }

  /**
   * Extract tables from query (simple implementation)
   */
  private extractTablesFromQuery(query: string): string[] {
    const tables: string[] = [];
    const tablePatterns = [
      /from\s+(\w+)/gi,
      /join\s+(\w+)/gi,
      /update\s+(\w+)/gi,
      /insert\s+into\s+(\w+)/gi,
      /delete\s+from\s+(\w+)/gi,
    ];

    tablePatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(query)) !== null) {
        const table = match[1].toLowerCase();
        if (!tables.includes(table) && table !== 'select' && table !== 'where') {
          tables.push(table);
        }
      }
    });

    return tables;
  }

  /**
   * Check if entry can be added to memory cache
   */
  private canAddToMemoryCache(entry: Partial<CacheEntry>): boolean {
    if (!entry.size) return true;

    // Check if we have space
    if (this.cacheStats.totalSize + entry.size > this.config.maxMemorySize) {
      return false;
    }

    // Check if we have too many entries
    if (this.memoryCache.size >= this.config.maxEntries) {
      return false;
    }

    return true;
  }

  /**
   * Update cache hit ratio
   */
  private updateHitRatio(): void {
    const total = this.cacheStats.hits + this.cacheStats.misses;
    this.cacheStats.hitRatio = total > 0 ? this.cacheStats.hits / total : 0;
  }

  /**
   * Update cache timestamps
   */
  private updateCacheTimestamps(entry: CacheEntry): void {
    if (!this.cacheStats.oldestEntry || entry.createdAt < this.cacheStats.oldestEntry) {
      this.cacheStats.oldestEntry = entry.createdAt;
    }

    if (!this.cacheStats.newestEntry || entry.createdAt > this.cacheStats.newestEntry) {
      this.cacheStats.newestEntry = entry.createdAt;
    }
  }

  /**
   * Add to pending invalidations
   */
  private addToPendingInvalidations(tableName: string, keys: string[]): void {
    if (!this.pendingInvalidations.has(tableName)) {
      this.pendingInvalidations.set(tableName, new Set());
    }

    keys.forEach(key => {
      this.pendingInvalidations.get(tableName)!.add(key);
    });

    // Schedule batch processing
    if (this.invalidationTimer) {
      clearTimeout(this.invalidationTimer);
    }

    this.invalidationTimer = setTimeout(() => {
      this.processPendingInvalidations();
    }, this.config.invalidationBatchTimeout);
  }

  /**
   * Process pending invalidations
   */
  private async processPendingInvalidations(): Promise<void> {
    const allKeys: string[] = [];

    for (const [tableName, keys] of this.pendingInvalidations.entries()) {
      allKeys.push(...Array.from(keys));
    }

    if (allKeys.length > 0) {
      await this.performInvalidation(allKeys);
    }

    this.pendingInvalidations.clear();
  }

  /**
   * Perform invalidation
   */
  private async performInvalidation(keys: string[]): Promise<void> {
    if (keys.length === 0) return;

    try {
      // Remove from memory cache
      for (const key of keys) {
        const entry = this.memoryCache.get(key);
        if (entry) {
          this.cacheStats.totalSize -= entry.size;
          this.memoryCache.delete(key);
        }
      }

      // Remove from Redis
      await redisService.getClient().del(...keys);

      // Update statistics
      this.cacheStats.deletes += keys.length;

    } catch (error) {
      console.error('Batch invalidation error:', error);
    }
  }

  /**
   * Schedule warming for cache entry
   */
  private scheduleWarming(key: string, entry: CacheEntry): void {
    if (entry.accessCount < this.config.warmingThreshold) return;

    // Add to warming queue with priority based on access count
    this.warmingQueue.push({ key, priority: entry.accessCount });

    // Sort by priority (highest first)
    this.warmingQueue.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Process warming queue
   */
  private async processWarmingQueue(): Promise<void> {
    if (this.isWarming || this.warmingQueue.length === 0) return;

    this.isWarming = true;

    try {
      const maxWarms = Math.min(5, this.warmingQueue.length); // Limit concurrent warms
      const entriesToWarm = this.warmingQueue.splice(0, maxWarms);

      await Promise.all(
        entriesToWarm.map(({ key }) => {
          const entry = this.memoryCache.get(key);
          if (entry) {
            return this.warmCache(entry);
          }
          return Promise.resolve();
        })
      );

    } catch (error) {
      console.error('Cache warming error:', error);
    } finally {
      this.isWarming = false;
    }
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.expiresAt.getTime() < now) {
        keysToDelete.push(key);
      }
    }

    // Remove expired entries
    for (const key of keysToDelete) {
      const entry = this.memoryCache.get(key)!;
      this.cacheStats.totalSize -= entry.size;
      this.memoryCache.delete(key);
      this.cacheStats.evictions++;
    }

    // If we're still over memory limits, remove least recently used entries
    if (this.cacheStats.totalSize > this.config.maxMemorySize ||
        this.memoryCache.size > this.config.maxEntries) {
      this.evictLRUEntries();
    }

    if (keysToDelete.length > 0) {
      console.log(`Cleaned up ${keysToDelete.length} expired cache entries`);
    }
  }

  /**
   * Evict least recently used entries
   */
  private evictLRUEntries(): void {
    const entries = Array.from(this.memoryCache.entries())
      .sort(([, a], [, b]) => a.lastAccessed.getTime() - b.lastAccessed.getTime());

    let evictedCount = 0;

    for (const [key, entry] of entries) {
      if (this.cacheStats.totalSize <= this.config.maxMemorySize &&
          this.memoryCache.size <= this.config.maxEntries) {
        break;
      }

      this.cacheStats.totalSize -= entry.size;
      this.memoryCache.delete(key);
      evictedCount++;
    }

    if (evictedCount > 0) {
      this.cacheStats.evictions += evictedCount;
      console.log(`Evicted ${evictedCount} LRU cache entries`);
    }
  }

  /**
   * Reset cache statistics
   */
  private resetStatistics(): void {
    this.cacheStats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      totalSize: 0,
      hitRatio: 0,
      averageAccessTime: 0,
      oldestEntry: null,
      newestEntry: null,
    };
  }

  /**
   * Handle table change notifications
   */
  onTableChange(notification: TableChangeNotification): void {
    this.invalidateByTable(notification.tableName);
  }

  /**
   * Get cache performance report
   */
  generatePerformanceReport(): string {
    const memoryEntries = this.getMemoryCacheEntries();
    const averageEntrySize = memoryEntries.length > 0
      ? this.cacheStats.totalSize / memoryEntries.length
      : 0;

    const report = `
Query Cache Performance Report
Generated: ${new Date().toISOString()}

=== OVERVIEW ===
Hit Ratio: ${(this.cacheStats.hitRatio * 100).toFixed(2)}%
Total Entries: ${memoryEntries.length}
Total Size: ${(this.cacheStats.totalSize / 1024 / 1024).toFixed(2)} MB
Average Entry Size: ${(averageEntrySize / 1024).toFixed(2)} KB

=== STATISTICS ===
Hits: ${this.cacheStats.hits}
Misses: ${this.cacheStats.misses}
Sets: ${this.cacheStats.sets}
Deletes: ${this.cacheStats.deletes}
Evictions: ${this.cacheStats.evictions}

=== TIMELINE ===
Oldest Entry: ${this.cacheStats.oldestEntry?.toISOString() || 'None'}
Newest Entry: ${this.cacheStats.newestEntry?.toISOString() || 'None'}

=== CONFIGURATION ===
Default TTL: ${this.config.defaultTTL}s
Max Memory Size: ${(this.config.maxMemorySize / 1024 / 1024).toFixed(2)} MB
Max Entries: ${this.config.maxEntries}
Warming Enabled: ${this.config.warmingEnabled}
Invalidation Strategy: ${this.config.invalidationStrategy}

=== PERFORMANCE RECOMMENDATIONS ===
${this.generateRecommendations()}
`;

    return report;
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(): string {
    const recommendations: string[] = [];

    if (this.cacheStats.hitRatio < 0.5) {
      recommendations.push('• Low hit ratio detected. Consider increasing TTL or optimizing query patterns.');
    }

    if (this.cacheStats.totalSize > this.config.maxMemorySize * 0.9) {
      recommendations.push('• Cache is near memory limit. Consider increasing maxMemorySize or reducing TTL.');
    }

    if (this.cacheStats.evictions > this.cacheStats.sets * 0.1) {
      recommendations.push('• High eviction rate. Consider increasing maxMemorySize or maxEntries.');
    }

    if (!this.config.warmingEnabled) {
      recommendations.push('• Cache warming is disabled. Consider enabling for better performance.');
    }

    if (this.config.invalidationStrategy === 'immediate') {
      recommendations.push('• Immediate invalidation may impact performance. Consider batched invalidation.');
    }

    return recommendations.length > 0 ? recommendations.join('\n') : '• Cache performance is optimal.';
  }

  /**
   * Gracefully shutdown the caching service
   */
  async shutdown(): Promise<void> {
    // Clear intervals
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    if (this.warmingInterval) {
      clearInterval(this.warmingInterval);
    }

    if (this.invalidationTimer) {
      clearTimeout(this.invalidationTimer);
    }

    // Persist statistics
    try {
      await redisService.getClient().setex(
        'cache_statistics',
        3600, // 1 hour
        JSON.stringify(this.cacheStats)
      );
    } catch (error) {
      console.warn('Failed to persist cache statistics:', error);
    }

    console.log('Query Result Caching Service shutdown completed');
  }
}

// Export singleton instance
export const queryResultCachingService = new QueryResultCachingService();