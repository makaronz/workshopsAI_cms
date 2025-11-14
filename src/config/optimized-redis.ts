import Redis from 'ioredis';
import { logger } from '../utils/logger';

// Optimized Redis configuration with performance monitoring and intelligent caching
interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  maxRetriesPerRequest: number;
  retryDelayOnFailover: number;
  enableOfflineQueue: boolean;
  connectTimeout: number;
  commandTimeout: number;
  lazyConnect: boolean;
  keepAlive: number;
  family: 4 | 6;
}

interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string; // Key prefix
  tags?: string[]; // Cache tags for invalidation
  compress?: boolean; // Compress large values
  json?: boolean; // JSON serialize/deserialize
}

interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalKeys: number;
  memoryUsage: number;
  avgResponseTime: number;
}

// Performance-optimized Redis client with connection pooling and intelligent caching
export class OptimizedRedisService {
  private client: Redis;
  private config: RedisConfig;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    hitRate: 0,
    totalKeys: 0,
    memoryUsage: 0,
    avgResponseTime: 0,
  };
  private responseTimes: number[] = [];
  private maxResponseTimeSamples = 1000;

  constructor() {
    this.config = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      enableOfflineQueue: false, // Disable for better performance
      connectTimeout: 10000,
      commandTimeout: 5000,
      lazyConnect: true,
      keepAlive: 30000,
      family: 4,
    };

    this.client = new Redis({
      host: this.config.host,
      port: this.config.port,
      password: this.config.password,
      db: this.config.db,
      maxRetriesPerRequest: this.config.maxRetriesPerRequest,
      retryDelayOnFailover: this.config.retryDelayOnFailover,
      enableOfflineQueue: this.config.enableOfflineQueue,
      connectTimeout: this.config.connectTimeout,
      commandTimeout: this.config.commandTimeout,
      lazyConnect: this.config.lazyConnect,
      keepAlive: this.config.keepAlive,
      family: this.config.family,
      // Enable clustering for better performance if multiple Redis instances
      enableReadyCheck: true,
      maxLoadingTimeout: 5000,
      // Connection pool optimization
      connectionName: 'workshopsai-cms',
      // Performance optimizations
      lazyConnect: true,
      keyPrefix: 'workshopsai:',
      // Pipeline optimization
      enableAutoPipelining: true,
      autoPipeliningIgnoredCommands: ['subscribe', 'unsubscribe', 'psubscribe', 'punsubscribe'],
    });

    this.setupEventHandlers();
    this.setupPerformanceMonitoring();
  }

  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      logger.info('Redis client connected', { host: this.config.host, port: this.config.port });
    });

    this.client.on('ready', () => {
      logger.info('Redis client ready');
    });

    this.client.on('error', (err) => {
      logger.error('Redis connection error:', err);
    });

    this.client.on('close', () => {
      logger.warn('Redis connection closed');
    });

    this.client.on('reconnecting', (ms) => {
      logger.info(`Redis reconnecting in ${ms}ms`);
    });
  }

  private setupPerformanceMonitoring(): void {
    // Update stats every 30 seconds
    setInterval(async () => {
      await this.updateStats();
    }, 30000);
  }

  private async updateStats(): Promise<void> {
    try {
      const info = await this.client.info('memory');
      const keyCount = await this.client.dbsize();
      
      const memoryUsage = this.parseMemoryInfo(info);
      this.stats.totalKeys = keyCount;
      this.stats.memoryUsage = memoryUsage;
      this.stats.hitRate = this.stats.hits / (this.stats.hits + this.stats.misses) || 0;

      // Calculate average response time
      if (this.responseTimes.length > 0) {
        this.stats.avgResponseTime = this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;
        
        // Keep only recent samples
        if (this.responseTimes.length > this.maxResponseTimeSamples) {
          this.responseTimes = this.responseTimes.slice(-this.maxResponseTimeSamples);
        }
      }

      logger.debug('Redis performance stats updated', this.stats);
    } catch (error) {
      logger.error('Failed to update Redis stats:', error);
    }
  }

  private parseMemoryInfo(info: string): number {
    const match = info.match(/used_memory:(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }

  private async measureResponseTime<T>(operation: () => Promise<T>): Promise<T> {
    const start = Date.now();
    try {
      const result = await operation();
      const responseTime = Date.now() - start;
      this.responseTimes.push(responseTime);
      return result;
    } catch (error) {
      const responseTime = Date.now() - start;
      this.responseTimes.push(responseTime);
      throw error;
    }
  }

  // Get with performance monitoring and hit/miss tracking
  async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    const fullKey = this.buildKey(key, options.prefix);
    
    return this.measureResponseTime(async () => {
      try {
        const value = await this.client.get(fullKey);
        
        if (value === null) {
          this.stats.misses++;
          return null;
        }

        this.stats.hits++;
        
        // Deserialize based on options
        if (options.json) {
          return JSON.parse(value) as T;
        }
        
        return value as unknown as T;
      } catch (error) {
        logger.error(`Redis GET error for key ${key}:`, error);
        return null;
      }
    });
  }

  // Set with intelligent TTL and tagging
  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    const fullKey = this.buildKey(key, options.prefix);
    
    return this.measureResponseTime(async () => {
      try {
        let serializedValue: string;
        
        if (options.json) {
          serializedValue = JSON.stringify(value);
        } else if (typeof value === 'string') {
          serializedValue = value;
        } else {
          serializedValue = String(value);
        }

        const result = await this.client.setex(
          fullKey,
          options.ttl || this.getDefaultTTL(key),
          serializedValue
        );

        // Store cache tags for invalidation
        if (options.tags && options.tags.length > 0) {
          await this.addTagsToKey(fullKey, options.tags);
        }

        if (result !== 'OK') {
          throw new Error(`Redis SET failed: ${result}`);
        }
      } catch (error) {
        logger.error(`Redis SET error for key ${key}:`, error);
        throw error;
      }
    });
  }

  // Get or set with automatic cache miss handling
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
    const data = await fetchFunction();
    
    // Store in cache
    await this.set(key, data, options);
    
    return data;
  }

  // Invalidate cache by tags
  async invalidateByTag(tag: string): Promise<number> {
    return this.measureResponseTime(async () => {
      try {
        const tagKey = this.buildKey(`tag:${tag}`);
        const keys = await this.client.smembers(tagKey);
        
        if (keys.length === 0) {
          return 0;
        }
        
        const pipeline = this.client.pipeline();
        pipeline.del(...keys);
        pipeline.del(tagKey);
        
        const results = await pipeline.exec();
        return results?.[0]?.[1] as number || 0;
      } catch (error) {
        logger.error(`Redis tag invalidation error for tag ${tag}:`, error);
        return 0;
      }
    });
  }

  // Get cache statistics
  getStats(): CacheStats {
    return { ...this.stats };
  }

  // Health check with detailed diagnostics
  async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    try {
      const start = Date.now();
      const pong = await this.client.ping();
      const responseTime = Date.now() - start;
      
      return {
        healthy: pong === 'PONG',
        details: {
          responseTime,
          hitRate: this.stats.hitRate,
          totalKeys: this.stats.totalKeys,
          avgResponseTime: this.stats.avgResponseTime,
        },
      };
    } catch (error) {
      logger.error('Redis health check failed:', error);
      return {
        healthy: false,
        details: { error: error.message },
      };
    }
  }

  private buildKey(key: string, prefix?: string): string {
    const keyPrefix = prefix || 'cache';
    return `${keyPrefix}:${key}`;
  }

  private getDefaultTTL(key: string): number {
    // Different TTLs for different types of data
    if (key.includes('workshop')) {
      return 3600; // 1 hour for workshop data
    }
    if (key.includes('user')) {
      return 1800; // 30 minutes for user data
    }
    if (key.includes('session')) {
      return 86400; // 24 hours for session data
    }
    return 600; // 10 minutes default
  }

  private async addTagsToKey(key: string, tags: string[]): Promise<void> {
    const pipeline = this.client.pipeline();
    
    tags.forEach(tag => {
      const tagKey = this.buildKey(`tag:${tag}`);
      pipeline.sadd(tagKey, key);
      pipeline.expire(tagKey, 86400); // Tags expire after 24 hours
    });
    
    await pipeline.exec();
  }

  // Disconnect and cleanup
  async disconnect(): Promise<void> {
    try {
      await this.client.quit();
      logger.info('Redis client disconnected successfully');
    } catch (error) {
      logger.error('Error disconnecting Redis client:', error);
    }
  }
}

// Create and export singleton instance
export const optimizedRedisService = new OptimizedRedisService();
