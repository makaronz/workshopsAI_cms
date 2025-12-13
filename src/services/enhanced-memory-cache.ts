import NodeCache from 'node-cache';
import { EventEmitter } from 'events';

export interface EnhancedCacheOptions {
  ttl?: number;
  checkperiod?: number;
  useClones?: boolean;
  deleteOnExpire?: boolean;
  enableLegacyCallbacks?: boolean;
  maxKeys?: number;
  lruSize?: number;
}

export interface CacheEntry<T = any> {
  value: T;
  createdAt: Date;
  expiresAt: Date;
  accessCount: number;
  lastAccessed: Date;
  size: number;
  tags: string[];
  priority: 'low' | 'medium' | 'high';
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalKeys: number;
  memoryUsage: number;
  evictions: number;
}

export class EnhancedMemoryCache extends EventEmitter {
  private caches: Map<string, NodeCache> = new Map();
  private customCaches: Map<string, LRUCache> = new Map();
  private defaultOptions: EnhancedCacheOptions;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    hitRate: 0,
    totalKeys: 0,
    memoryUsage: 0,
    evictions: 0
  };

  constructor(options: EnhancedCacheOptions = {}) {
    super();
    this.defaultOptions = {
      ttl: 3600, // 1 hour
      checkperiod: 600, // 10 minutes
      useClones: false,
      deleteOnExpire: true,
      enableLegacyCallbacks: false,
      maxKeys: 10000,
      lruSize: 1000,
      ...options
    };

    this.setupCaches();
  }

  private setupCaches(): void {
    // Create separate caches for different data types
    this.caches.set('sessions', new NodeCache({
      ttl: 86400, // 24 hours
      checkperiod: 3600,
      maxKeys: 5000,
      useClones: false
    }));

    this.caches.set('queries', new NodeCache({
      ttl: 1800, // 30 minutes
      checkperiod: 300,
      maxKeys: 10000,
      useClones: false
    }));

    this.caches.set('tokens', new NodeCache({
      ttl: 604800, // 7 days
      checkperiod: 3600,
      maxKeys: 1000,
      useClones: false
    }));

    this.caches.set('rate_limit', new NodeCache({
      ttl: 900, // 15 minutes
      checkperiod: 60,
      maxKeys: 50000,
      useClones: false
    }));

    this.caches.set('general', new NodeCache(this.defaultOptions));

    // Setup event listeners
    this.caches.forEach((cache, name) => {
      cache.on('expired', (key, value) => {
        this.emit('expired', { cache: name, key, value });
      });

      cache.on('del', (key, value) => {
        this.emit('deleted', { cache: name, key, value });
      });

      cache.on('set', (key, value) => {
        this.emit('set', { cache: name, key, value });
      });
    });
  }

  async get<T>(key: string, options?: { prefix?: string; cacheName?: string }): Promise<T | null> {
    const cacheName = options?.cacheName || this.determineCacheName(key);
    const cache = this.caches.get(cacheName) || this.customCaches.get(cacheName);

    if (!cache) {
      throw new Error(`Cache '${cacheName}' not found`);
    }

    const fullKey = this.buildKey(key, options?.prefix);

    if (cache instanceof LRUCache) {
      const entry = cache.get(fullKey);
      if (entry !== null) {
        this.updateStats(true);
        return entry.value;
      }
    } else {
      const value = cache.get<T>(fullKey);
      if (value !== undefined) {
        this.updateStats(true);
        return value;
      }
    }

    this.updateStats(false);
    return null;
  }

  async set<T>(
    key: string,
    value: T,
    options: {
      ttl?: number;
      prefix?: string;
      cacheName?: string;
      tags?: string[];
      priority?: 'low' | 'medium' | 'high';
    } = {}
  ): Promise<boolean> {
    const cacheName = options.cacheName || this.determineCacheName(key);
    const cache = this.caches.get(cacheName) || this.customCaches.get(cacheName);

    if (!cache) {
      throw new Error(`Cache '${cacheName}' not found`);
    }

    const fullKey = this.buildKey(key, options.prefix);
    const ttl = options.ttl;

    if (cache instanceof LRUCache) {
      cache.set(fullKey, value, options);
    } else {
      cache.set(fullKey, value, ttl);
    }

    this.emit('set', { key: fullKey, value, cacheName });
    return true;
  }

  async del(key: string, options?: { prefix?: string; cacheName?: string }): Promise<number> {
    if (options?.cacheName) {
      const cache = this.caches.get(options.cacheName) || this.customCaches.get(options.cacheName);
      if (!cache) return 0;

      const fullKey = this.buildKey(key, options?.prefix);

      if (cache instanceof LRUCache) {
        return cache.delete(fullKey) ? 1 : 0;
      } else {
        return cache.del(fullKey) ? 1 : 0;
      }
    }

    // Delete from all caches
    let deleted = 0;
    const fullKey = this.buildKey(key, options?.prefix);

    for (const cache of this.caches.values()) {
      if (cache.del(fullKey)) deleted++;
    }

    for (const cache of this.customCaches.values()) {
      if (cache.delete(fullKey)) deleted++;
    }

    return deleted;
  }

  async exists(key: string, options?: { prefix?: string; cacheName?: string }): Promise<boolean> {
    const cacheName = options?.cacheName || this.determineCacheName(key);
    const cache = this.caches.get(cacheName) || this.customCaches.get(cacheName);

    if (!cache) return false;

    const fullKey = this.buildKey(key, options?.prefix);

    if (cache instanceof LRUCache) {
      return cache.has(fullKey);
    } else {
      return cache.has(fullKey);
    }
  }

  async incr(key: string, options?: { prefix?: string; cacheName?: string }): Promise<number> {
    const cacheName = options?.cacheName || 'rate_limit';
    const cache = this.caches.get(cacheName);

    if (!cache) {
      throw new Error(`Cache '${cacheName}' not found`);
    }

    const fullKey = this.buildKey(key, options?.prefix);
    const current = cache.get<number>(fullKey) || 0;
    const newValue = current + 1;
    cache.set(fullKey, newValue);

    return newValue;
  }

  async expire(key: string, ttl: number, options?: { prefix?: string; cacheName?: string }): Promise<boolean> {
    if (options?.cacheName) {
      const cache = this.caches.get(options.cacheName);
      if (!cache || !cache.has(this.buildKey(key, options?.prefix))) return false;

      const fullKey = this.buildKey(key, options?.prefix);
      const value = cache.get(fullKey);
      cache.set(fullKey, value, ttl);
      return true;
    }

    // Try all caches
    const fullKey = this.buildKey(key, options?.prefix);

    for (const cache of this.caches.values()) {
      if (cache.has(fullKey)) {
        const value = cache.get(fullKey);
        cache.set(fullKey, value, ttl);
        return true;
      }
    }
    return false;
  }

  async ttl(key: string, options?: { prefix?: string; cacheName?: string }): Promise<number> {
    if (options?.cacheName) {
      const cache = this.caches.get(options.cacheName);
      if (!cache || !cache.has(this.buildKey(key, options?.prefix))) return -2;

      const fullKey = this.buildKey(key, options?.prefix);
      return cache.getTtl(fullKey) || -1;
    }

    // Check all caches
    const fullKey = this.buildKey(key, options?.prefix);

    for (const cache of this.caches.values()) {
      if (cache.has(fullKey)) {
        return cache.getTtl(fullKey) || -1;
      }
    }
    return -2;
  }

  async keys(pattern: string, options?: { cacheName?: string }): Promise<string[]> {
    const cacheName = options?.cacheName || 'general';
    const cache = this.caches.get(cacheName);

    if (!cache) return [];

    const allKeys = cache.keys();
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return allKeys.filter(key => regex.test(key));
  }

  async clear(options?: { pattern?: string; cacheName?: string }): Promise<void> {
    if (options?.cacheName) {
      const cache = this.caches.get(options.cacheName);
      if (cache) {
        cache.flushAll();
      }
      return;
    }

    if (options?.pattern) {
      // Clear keys matching pattern
      for (const cache of this.caches.values()) {
        const keys = cache.keys();
        const regex = new RegExp(options.pattern.replace(/\*/g, '.*'));
        const matchingKeys = keys.filter(key => regex.test(key));
        if (matchingKeys.length > 0) {
          cache.del(matchingKeys);
        }
      }
    } else {
      // Clear all caches
      this.caches.forEach(cache => cache.flushAll());
      this.customCaches.forEach(cache => cache.clear());
    }
  }

  async invalidateByTag(tag: string): Promise<number> {
    let invalidated = 0;

    // Invalidate from LRU caches
    for (const cache of this.customCaches.values()) {
      invalidated += cache.deleteByTag(tag);
    }

    // For NodeCache instances, we'd need a different approach
    // since NodeCache doesn't natively support tags
    // This would require maintaining a tag-to-key mapping

    return invalidated;
  }

  getStats(cacheName?: string): CacheStats | Record<string, CacheStats> {
    if (cacheName) {
      const cache = this.caches.get(cacheName);
      if (cache) {
        const stats = cache.getStats();
        return {
          hits: this.stats.hits,
          misses: this.stats.misses,
          hitRate: this.stats.hitRate,
          totalKeys: stats.keys,
          memoryUsage: this.estimateMemoryUsage(cache),
          evictions: stats.vsize // NodeCache uses vsize for evictions
        };
      }
      return this.stats;
    }

    const allStats: Record<string, CacheStats> = {};

    this.caches.forEach((cache, name) => {
      const stats = cache.getStats();
      allStats[name] = {
        hits: this.stats.hits,
        misses: this.stats.misses,
        hitRate: this.stats.hitRate,
        totalKeys: stats.keys,
        memoryUsage: this.estimateMemoryUsage(cache),
        evictions: stats.vsize
      };
    });

    this.customCaches.forEach((cache, name) => {
      const lruStats = cache.getStats();
      allStats[name] = {
        hits: this.stats.hits,
        misses: this.stats.misses,
        hitRate: this.stats.hitRate,
        totalKeys: lruStats.size,
        memoryUsage: lruStats.totalSize,
        evictions: lruStats.evictions
      };
    });

    return allStats;
  }

  private buildKey(key: string, prefix?: string): string {
    return prefix ? `${prefix}:${key}` : key;
  }

  private determineCacheName(key: string): string {
    if (key.startsWith('sess:') || key.startsWith('session:')) return 'sessions';
    if (key.startsWith('rate_limit:') || key.startsWith('throttle:')) return 'rate_limit';
    if (key.startsWith('refresh_token:') || key.startsWith('password_reset:')) return 'tokens';
    if (key.startsWith('query:') || key.includes('cache')) return 'queries';
    return 'general';
  }

  private updateStats(hit: boolean): void {
    if (hit) {
      this.stats.hits++;
    } else {
      this.stats.misses++;
    }

    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  private estimateMemoryUsage(cache: NodeCache): number {
    const stats = cache.getStats();
    // Rough estimation - NodeCache doesn't provide exact memory usage
    return stats.keys * 1024; // Assume 1KB per entry average
  }

  // Cluster support for multi-instance synchronization
  async syncWithCluster(nodes: string[]): Promise<void> {
    // Implementation would use:
    // - Database for state synchronization
    // - Message queue (if still available)
    // - HTTP API calls between nodes
    // - Shared file system
  }

  // Create custom LRU cache for specific use cases
  createLRUCache(name: string, maxSize: number, maxMemorySize: number): void {
    this.customCaches.set(name, new LRUCache(maxSize, maxMemorySize));
  }
}

/**
 * LRU Cache implementation with tag support
 */
class LRUCache<T = any> {
  private maxSize: number;
  private cache: Map<string, CacheEntry<T>> = new Map();
  private accessOrder: string[] = [];
  private currentSize = 0;
  private maxMemorySize: number;
  private tagIndex: Map<string, Set<string>> = new Map();

  constructor(maxSize: number = 1000, maxMemorySize: number = 100 * 1024 * 1024) {
    this.maxSize = maxSize;
    this.maxMemorySize = maxMemorySize;
  }

  get(key: string): CacheEntry<T> | null {
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

    return entry;
  }

  set(key: string, value: T, options: { ttl?: number; tags?: string[]; priority?: 'low' | 'medium' | 'high' } = {}): void {
    const now = new Date();
    const ttl = options.ttl || 3600;
    const size = this.calculateSize(value);
    const tags = options.tags || [];

    // Check if we need to evict entries
    while (this.shouldEvict(size)) {
      this.evictLRU();
    }

    // Remove existing entry if it exists
    if (this.cache.has(key)) {
      this.delete(key);
    }

    const entry: CacheEntry<T> = {
      value,
      createdAt: now,
      expiresAt: new Date(now.getTime() + ttl * 1000),
      accessCount: 1,
      lastAccessed: now,
      size,
      tags,
      priority: options.priority || 'medium'
    };

    this.cache.set(key, entry);
    this.updateAccessOrder(key);
    this.currentSize += size;

    // Update tag index
    for (const tag of tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(key);
    }
  }

  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // Remove from tag index
    for (const tag of entry.tags) {
      const tagKeys = this.tagIndex.get(tag);
      if (tagKeys) {
        tagKeys.delete(key);
        if (tagKeys.size === 0) {
          this.tagIndex.delete(tag);
        }
      }
    }

    this.currentSize -= entry.size;
    this.cache.delete(key);
    this.removeFromAccessOrder(key);
    return true;
  }

  deleteByTag(tag: string): number {
    const keys = this.tagIndex.get(tag);
    if (!keys) return 0;

    let deleted = 0;
    for (const key of keys) {
      if (this.delete(key)) {
        deleted++;
      }
    }

    return deleted;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // Check if expired
    if (Date.now() > entry.expiresAt.getTime()) {
      this.delete(key);
      return false;
    }

    return true;
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
    this.currentSize = 0;
    this.tagIndex.clear();
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      totalSize: this.currentSize,
      maxMemorySize: this.maxMemorySize,
      evictions: 0 // Track evictions if needed
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
      // Remove from tag index
      for (const tag of entry.tags) {
        const tagKeys = this.tagIndex.get(tag);
        if (tagKeys) {
          tagKeys.delete(lruKey);
        }
      }

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
}