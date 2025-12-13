import { Request, Response, NextFunction } from 'express';
import { hybridCache, CacheOptions, CacheLevel } from './hybrid-cache';
import { logger } from '../utils/logger';

/**
 * Cache middleware factory
 */
export function cacheMiddleware(options: {
  ttl?: number;
  keyGenerator?: (req: Request) => string;
  condition?: (req: Request) => boolean;
  level?: CacheLevel;
  tags?: string[];
}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip caching if condition fails
    if (options.condition && !options.condition(req)) {
      return next();
    }

    // Generate cache key
    const key = options.keyGenerator
      ? options.keyGenerator(req)
      : `route:${req.method}:${req.originalUrl}`;

    try {
      // Try to get from cache
      const cached = await hybridCache.get(key, {
        ttl: options.ttl,
        level: options.level,
        tags: options.tags,
      });

      if (cached !== null) {
        res.set('X-Cache', 'HIT');
        return res.json(cached);
      }

      // Intercept res.json to cache the response
      const originalJson = res.json;
      let responseData: any;

      res.json = function(data: any) {
        responseData = data;

        // Cache the response
        hybridCache.set(key, data, {
          ttl: options.ttl,
          level: options.level,
          tags: options.tags,
        }).catch(error => {
          logger.error('Failed to cache response:', error);
        });

        res.set('X-Cache', 'MISS');
        return originalJson.call(this, data);
      };

      next();
    } catch (error) {
      logger.error('Cache middleware error:', error);
      next();
    }
  };
}

/**
 * Cache invalidation middleware
 */
export function invalidateCache(patterns: string[], tags?: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Continue with the request first
    const originalEnd = res.end;
    res.end = function(...args: any[]) {
      originalEnd.apply(this, args);

      // Invalidate after successful response
      if (res.statusCode >= 200 && res.statusCode < 300) {
        Promise.all(
          patterns.map(pattern => hybridCache.invalidate(pattern))
        ).catch(error => {
          logger.error('Failed to invalidate cache:', error);
        });

        if (tags) {
          Promise.all(
            tags.map(tag => hybridCache.invalidateByTag(tag))
          ).catch(error => {
            logger.error('Failed to invalidate cache by tags:', error);
          });
        }
      }
    };

    next();
  };
}

/**
 * Redis service replacement using hybrid cache
 */
export class HybridCacheService {
  /**
   * Store refresh token with metadata
   */
  async storeRefreshToken(
    userId: string,
    refreshToken: string,
    deviceInfo?: string,
    ipAddress?: string
  ): Promise<void> {
    const key = `refresh_token:${userId}:${refreshToken}`;
    const value = {
      userId,
      deviceInfo: deviceInfo || 'unknown',
      ipAddress: ipAddress || 'unknown',
      createdAt: new Date().toISOString(),
      lastUsed: new Date().toISOString(),
    };

    await hybridCache.set(key, value, {
      ttl: 604800, // 7 days
      tags: ['refresh_token', `user:${userId}`],
      priority: 'high',
      level: CacheLevel.L2,
    });
  }

  /**
   * Get refresh token metadata
   */
  async getRefreshToken(userId: string, refreshToken: string): Promise<any | null> {
    const key = `refresh_token:${userId}:${refreshToken}`;
    const cached = await hybridCache.get(key, { level: CacheLevel.L2 });

    if (cached) {
      // Update last used timestamp
      await this.updateRefreshTokenUsage(userId, refreshToken);
    }

    return cached;
  }

  /**
   * Update refresh token usage
   */
  async updateRefreshTokenUsage(userId: string, refreshToken: string): Promise<void> {
    const key = `refresh_token:${userId}:${refreshToken}`;
    const cached = await hybridCache.get(key, { level: CacheLevel.L2 });

    if (cached) {
      cached.lastUsed = new Date().toISOString();
      await hybridCache.set(key, cached, {
        ttl: 604800,
        tags: ['refresh_token', `user:${userId}`],
        level: CacheLevel.L2,
      });
    }
  }

  /**
   * Revoke refresh token
   */
  async revokeRefreshToken(userId: string, refreshToken: string): Promise<void> {
    const key = `refresh_token:${userId}:${refreshToken}`;
    await hybridCache.invalidate(key);
  }

  /**
   * Revoke all user tokens
   */
  async revokeAllUserTokens(userId: string): Promise<void> {
    await hybridCache.invalidateByTag(`user:${userId}`);
  }

  /**
   * Store session data
   */
  async storeSession(
    sessionId: string,
    sessionData: any,
    ttl: number = 86400
  ): Promise<void> {
    const key = `session:${sessionId}`;
    await hybridCache.set(key, sessionData, {
      ttl,
      tags: ['session'],
      priority: 'high',
      level: CacheLevel.L1, // Sessions should be in memory
    });
  }

  /**
   * Get session data
   */
  async getSession(sessionId: string): Promise<any | null> {
    const key = `session:${sessionId}`;
    return await hybridCache.get(key, { level: CacheLevel.L1 });
  }

  /**
   * Delete session
   */
  async deleteSession(sessionId: string): Promise<void> {
    const key = `session:${sessionId}`;
    await hybridCache.invalidate(key);
  }

  /**
   * Record authentication attempt for rate limiting
   */
  async recordAuthAttempt(identifier: string, ipAddress: string): Promise<void> {
    const key = `auth_attempts:${identifier}:${ipAddress}`;
    const current = await hybridCache.get<number>(key, { level: CacheLevel.L1 }) || 0;

    await hybridCache.set(key, current + 1, {
      ttl: 900, // 15 minutes
      level: CacheLevel.L1,
    });
  }

  /**
   * Get authentication attempts
   */
  async getAuthAttempts(identifier: string, ipAddress: string): Promise<number> {
    const key = `auth_attempts:${identifier}:${ipAddress}`;
    return await hybridCache.get<number>(key, { level: CacheLevel.L1 }) || 0;
  }

  /**
   * Clear authentication attempts
   */
  async clearAuthAttempts(identifier: string, ipAddress: string): Promise<void> {
    const key = `auth_attempts:${identifier}:${ipAddress}`;
    await hybridCache.invalidate(key);
  }

  /**
   * Store password reset token
   */
  async storePasswordResetToken(
    email: string,
    token: string,
    ttl: number = 3600
  ): Promise<void> {
    const key = `password_reset:${token}`;
    const value = {
      email,
      createdAt: new Date().toISOString(),
    };

    await hybridCache.set(key, value, {
      ttl,
      tags: ['password_reset'],
      level: CacheLevel.L2,
    });
  }

  /**
   * Validate password reset token
   */
  async validatePasswordResetToken(token: string): Promise<string | null> {
    const key = `password_reset:${token}`;
    const cached = await hybridCache.get<{ email: string }>(key, { level: CacheLevel.L2 });
    return cached?.email || null;
  }

  /**
   * Delete password reset token
   */
  async deletePasswordResetToken(token: string): Promise<void> {
    const key = `password_reset:${token}`;
    await hybridCache.invalidate(key);
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    const health = await hybridCache.healthCheck();
    return health.L1 && health.L2 && health.L3;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return hybridCache.getStats();
  }

  /**
   * Warm cache
   */
  async warmCache(strategy?: string): Promise<void> {
    await hybridCache.warmCache(strategy);
  }

  /**
   * Invalidate cache by pattern
   */
  async invalidate(pattern: string): Promise<boolean> {
    return await hybridCache.invalidate(pattern);
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    await hybridCache.clear();
  }
}

// Create and export singleton instance
export const hybridCacheService = new HybridCacheService();