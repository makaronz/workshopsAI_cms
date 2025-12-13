/**
 * PostgreSQL Caching Service
 *
 * Replaces Redis-based multi-tier caching with PostgreSQL implementation
 * Provides intelligent caching with L1 in-memory and L2 PostgreSQL storage
 */

import { EventEmitter } from 'events';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq, and, lt, gt, inArray } from 'drizzle-orm';
import { db } from '../config/postgresql-database';
import { sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

// Cache entries schema
export const cacheEntries = pgTable('cache_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: text('key').notNull().unique(),
  value: jsonb('value').notNull(),
  ttl: text('ttl').notNull(), // Time to live in seconds
  expiresAt: timestamp('expires_at').notNull(),
  priority: text('priority').default('medium').notNull(), // 'low', 'medium', 'high'
  tags: text('tags').array(),
  accessCount: text('access_count').default('0').notNull(),
  lastAccessedAt: timestamp('last_accessed_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, table => ({
  keyIdx: index('idx_cache_entries_key').on(table.key),
  expiresAtIdx: index('idx_cache_entries_expires_at').on(table.expiresAt),
  priorityIdx: index('idx_cache_entries_priority').on(table.priority),
  lastAccessedAtIdx: index('idx_cache_entries_last_accessed_at').on(table.lastAccessedAt),
}));

// Cache tags schema for tag-based invalidation
export const cacheTags = pgTable('cache_tags', {
  id: uuid('id').primaryKey().defaultRandom(),
  tag: text('tag').notNull(),
  cacheKeyId: text('cache_key_id').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, table => ({
  tagIdx: index('idx_cache_tags_tag').on(table.tag),
  cacheKeyIdIdx: index('idx_cache_tags_cache_key_id').on(table.cacheKeyId),
}));

export type CacheEntry = typeof cacheEntries.$inferSelect;
export type InsertCacheEntry = typeof cacheEntries.$inferInsert;
export type CacheTag = typeof cacheTags.$inferSelect;
export type InsertCacheTag = typeof cacheTags.$inferInsert;

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string; // Key prefix
  tags?: string[]; // Cache tags for invalidation
  priority?: 'low' | 'medium' | 'high'; // Cache priority for eviction
}

export interface CacheStats {
  totalKeys: number;
  totalSize: number;
  hitCount: number;
  missCount: number;
  hitRate: number;
  expiredKeys: number;
}

/**
 * LRU Cache implementation for L1 (in-memory) caching
 */
class LRUCache<T = any> {
  private maxSize: number;
  private cache: Map<string, { value: T; expiresAt: number; accessCount: number }> = new Map();
  private accessOrder: string[] = [];

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  get(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;

    // Check if expired
    if (Date.now() > item.expiresAt) {
      this.delete(key);
      return null;
    }

    // Update access information
    item.accessCount++;
    this.updateAccessOrder(key);

    return item.value;
  }

  set(key: string, value: T, ttl: number = 3600): void {
    const expiresAt = Date.now() + (ttl * 1000);

    // Check if we need to evict
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, { value, expiresAt, accessCount: 1 });
    this.updateAccessOrder(key);
  }

  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.removeFromAccessOrder(key);
    }
    return deleted;
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  size(): number {
    return this.cache.size;
  }

  getStats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
    };
  }

  private evictLRU(): void {
    if (this.accessOrder.length === 0) return;

    const lruKey = this.accessOrder.shift()!;
    this.cache.delete(lruKey);
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
}

/**
 * PostgreSQL-based Multi-level Caching Service
 * Provides L1 (in-memory) and L2 (PostgreSQL) caching
 */
export class PostgreSQLCachingService extends EventEmitter {
  private l1Cache: LRUCache;
  private stats: CacheStats = {
    totalKeys: 0,
    totalSize: 0,
    hitCount: 0,
    missCount: 0,
    hitRate: 0,
    expiredKeys: 0,
  };
  private cleanupInterval: NodeJS.Timeout | null = null;

  // Configuration
  private readonly config = {
    l1: {
      maxSize: 1000, // Maximum number of entries in L1 cache
      defaultTTL: 3600, // 1 hour default TTL
    },
    l2: {
      defaultTTL: 3600, // 1 hour default TTL
      cleanupInterval: 60 * 60 * 1000, // 1 hour cleanup interval
    },
  };

  constructor() {
    super();
    this.l1Cache = new LRUCache(this.config.l1.maxSize);
    this.startCleanup();
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    const fullKey = this.buildKey(key, options.prefix);

    try {
      // L1: Check in-memory cache first
      const l1Result = this.l1Cache.get<T>(fullKey);
      if (l1Result !== null) {
        this.stats.hitCount++;
        this.updateStats();
        this.emit('cacheHit', { key: fullKey, tier: 'L1', value: l1Result });
        return l1Result;
      }

      // L2: Check PostgreSQL cache
      const [cacheEntry] = await db
        .select()
        .from(cacheEntries)
        .where(and(
          eq(cacheEntries.key, fullKey),
          gt(cacheEntries.expiresAt, new Date())
        ))
        .limit(1);

      if (cacheEntry) {
        // Update access statistics
        await db
          .update(cacheEntries)
          .set({
            accessCount: String(parseInt(cacheEntry.accessCount) + 1),
            lastAccessedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(cacheEntries.id, cacheEntry.id));

        // Promote to L1 if high priority
        if (cacheEntry.priority === 'high' || options.priority === 'high') {
          const ttl = parseInt(cacheEntry.ttl);
          const expiresAt = new Date(cacheEntry.expiresAt).getTime();
          const remainingTTL = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
          this.l1Cache.set(fullKey, cacheEntry.value as T, remainingTTL);
        }

        this.stats.hitCount++;
        this.updateStats();
        this.emit('cacheHit', { key: fullKey, tier: 'L2', value: cacheEntry.value });
        return cacheEntry.value as T;
      }

      // Cache miss
      this.stats.missCount++;
      this.updateStats();
      this.emit('cacheMiss', { key: fullKey });
      return null;

    } catch (error) {
      logger.error(`Cache get error for key ${key}:`, error);
      this.emit('cacheError', { key, error, operation: 'get' });
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    const fullKey = this.buildKey(key, options.prefix);
    const ttl = options.ttl || this.config.l2.defaultTTL;
    const expiresAt = new Date(Date.now() + (ttl * 1000));

    try {
      // L1: Store in-memory cache
      this.l1Cache.set(fullKey, value, ttl);

      // L2: Store in PostgreSQL cache
      await db.insert(cacheEntries).values({
        key: fullKey,
        value: value as any,
        ttl: String(ttl),
        expiresAt,
        priority: options.priority || 'medium',
        tags: options.tags || [],
      }).onConflictDoUpdate({
        target: cacheEntries.key,
        set: {
          value: value as any,
          ttl: String(ttl),
          expiresAt,
          priority: options.priority || 'medium',
          tags: options.tags || [],
          updatedAt: new Date(),
        },
      });

      // Store tags if provided
      if (options.tags && options.tags.length > 0) {
        await this.addTags(fullKey, options.tags);
      }

      this.emit('cacheSet', { key: fullKey, value, options });
    } catch (error) {
      logger.error(`Cache set error for key ${key}:`, error);
      this.emit('cacheError', { key, error, operation: 'set' });
      throw error;
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
   * Delete cache entry
   */
  async delete(key: string, options: CacheOptions = {}): Promise<boolean> {
    const fullKey = this.buildKey(key, options.prefix);

    try {
      // L1: Delete from in-memory cache
      this.l1Cache.delete(fullKey);

      // L2: Delete from PostgreSQL cache
      const result = await db
        .delete(cacheEntries)
        .where(eq(cacheEntries.key, fullKey));

      // Delete associated tags
      await this.deleteTags(fullKey);

      const deleted = (result.rowCount || 0) > 0;
      if (deleted) {
        this.emit('cacheDeleted', { key: fullKey });
      }

      return deleted;
    } catch (error) {
      logger.error(`Cache delete error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateByTag(tag: string): Promise<number> {
    try {
      // Get all cache keys with this tag
      const [tagEntries] = await db
        .select({ cacheKeyId: cacheTags.cacheKeyId })
        .from(cacheTags)
        .where(eq(cacheTags.tag, tag));

      if (!tagEntries || tagEntries.length === 0) {
        return 0;
      }

      const cacheKeyIds = tagEntries.map(entry => entry.cacheKeyId);

      // Delete from L1 cache
      for (const cacheKeyId of cacheKeyIds) {
        this.l1Cache.delete(cacheKeyId);
      }

      // Delete from L2 cache
      const result = await db
        .delete(cacheEntries)
        .where(inArray(cacheEntries.key, cacheKeyIds));

      // Delete tags
      await db
        .delete(cacheTags)
        .where(eq(cacheTags.tag, tag));

      const deletedCount = result.rowCount || 0;
      this.emit('cacheTagInvalidated', { tag, count: deletedCount });

      return deletedCount;
    } catch (error) {
      logger.error(`Cache tag invalidation error for tag ${tag}:`, error);
      return 0;
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    try {
      // L1: Clear in-memory cache
      this.l1Cache.clear();

      // L2: Clear PostgreSQL cache
      await db.delete(cacheEntries);
      await db.delete(cacheTags);

      this.emit('cacheCleared');
    } catch (error) {
      logger.error('Cache clear error:', error);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * Build cache key with prefix
   */
  private buildKey(key: string, prefix?: string): string {
    return prefix ? `${prefix}:${key}` : key;
  }

  /**
   * Add tags to cache entry
   */
  private async addTags(cacheKey: string, tags: string[]): Promise<void> {
    if (tags.length === 0) return;

    const tagData = tags.map(tag => ({
      tag,
      cacheKeyId: cacheKey,
    }));

    await db.insert(cacheTags).values(tagData).onConflictDoNothing();
  }

  /**
   * Delete tags for cache key
   */
  private async deleteTags(cacheKey: string): Promise<void> {
    await db
      .delete(cacheTags)
      .where(eq(cacheTags.cacheKeyId, cacheKey));
  }

  /**
   * Update cache statistics
   */
  private updateStats(): void {
    const totalRequests = this.stats.hitCount + this.stats.missCount;
    this.stats.hitRate = totalRequests > 0 ? this.stats.hitCount / totalRequests : 0;

    // Get L1 stats
    const l1Stats = this.l1Cache.getStats();
    this.stats.totalKeys = l1Stats.size;
  }

  /**
   * Start cleanup process
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(async () => {
      await this.cleanupExpired();
    }, this.config.l2.cleanupInterval);

    logger.info('Cache cleanup started');
  }

  /**
   * Clean up expired cache entries
   */
  private async cleanupExpired(): Promise<void> {
    try {
      const result = await db
        .delete(cacheEntries)
        .where(lt(cacheEntries.expiresAt, new Date()));

      const deletedCount = result.rowCount || 0;
      if (deletedCount > 0) {
        this.stats.expiredKeys += deletedCount;
        logger.info(`Cleaned up ${deletedCount} expired cache entries`);
      }

      // Clean up orphaned tags
      await db
        .delete(cacheTags)
        .where(sql`cache_key_id NOT IN (SELECT key FROM cache_entries)`);

    } catch (error) {
      logger.error('Cache cleanup error:', error);
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Test database connection with a simple query
      await db.select({ count: sql<number>`count(*)` }).from(cacheEntries).limit(1);
      return true;
    } catch (error) {
      logger.error('Cache service health check failed:', error);
      return false;
    }
  }

  /**
   * Stop the caching service
   */
  async stop(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Final cleanup
    await this.cleanupExpired();

    // Clear L1 cache
    this.l1Cache.clear();

    logger.info('Caching service stopped');
  }
}

// Export singleton instance
export const cachingService = new PostgreSQLCachingService();

// Export schema components for migration
export { pgTable, text, jsonb, timestamp, uuid, index, sql } from 'drizzle-orm/pg-core';