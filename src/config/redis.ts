import Redis from 'ioredis';

// Redis configuration
// Most PaaS platforms (DigitalOcean, Render, Fly.io, etc.) automatically provide REDIS_URL - use it if available
// In production, don't use localhost fallback (Redis is a separate service)
const isProduction = process.env.NODE_ENV === 'production';
const REDIS_URL = process.env.REDIS_URL || (isProduction ? undefined : 'redis://localhost:6379');
const REDIS_TTL = process.env.REDIS_TTL || '604800'; // 7 days in seconds

if (isProduction && !REDIS_URL) {
  console.warn('⚠️  REDIS_URL not set in production. Redis features will be disabled.');
}

// Helper function to validate and parse REDIS_URL
// Returns config object for ioredis or null if Redis should not be used
function parseRedisConfig(redisUrl: string | undefined): { url?: string; path?: string; config?: any } | null {
  if (!redisUrl) {
    return null;
  }

  // Check if it's a Unix socket path (starts with /)
  if (redisUrl.startsWith('/')) {
    // Unix socket path - use path option
    return { path: redisUrl };
  }

  // Check if it's a valid Redis URL (starts with redis:// or rediss://)
  if (redisUrl.startsWith('redis://') || redisUrl.startsWith('rediss://')) {
    // Valid TCP URL - use directly
    return { url: redisUrl };
  }

  // Invalid format - log warning and return null
  console.warn(`⚠️  Invalid REDIS_URL format: ${redisUrl}. Expected redis:// URL or Unix socket path.`);
  return null;
}

// Redis client singleton
class RedisClient {
  private static instance: Redis;

  static getInstance(): Redis {
    if (!RedisClient.instance) {
      const redisConfig = parseRedisConfig(REDIS_URL);

      // If REDIS_URL is not set or invalid
      if (!redisConfig) {
        // CRITICAL FIX:
        // W produkcji brak URL-a powinien wysadzić aplikację, żebyś o tym wiedział,
        // zamiast cicho próbować łączyć się z localhostem przez Workera.
        if (isProduction) {
          throw new Error(
            '🚨 CRITICAL: REDIS_URL is missing in production environment! ' +
            'Redis is required for queue workers and caching. ' +
            'Please set REDIS_URL environment variable or disable Redis-dependent features.'
          );
        }

        // Dla devu zostawiamy atrapę, ale upewnij się, że host nie istnieje,
        // żeby uniknąć przypadkowego łączenia z lokalnym Redisem, jeśli nie chcesz.
        console.warn('⚠️  Redis not configured. Creating dummy instance for DEV only.');
        RedisClient.instance = new Redis({
          host: 'nonexistent-redis-host', // Host który nie istnieje - zapobiega przypadkowemu połączeniu
          port: 6379,
          lazyConnect: true,
          enableReadyCheck: false,
          enableOfflineQueue: false, // Don't queue commands when offline
          maxRetriesPerRequest: 0, // Don't retry if not configured
          retryStrategy: () => null, // Don't retry
          connectTimeout: 1, // Very short timeout
          commandTimeout: 1, // Very short timeout
        });
        // Suppress all errors for unconfigured Redis in dev
        RedisClient.instance.on('error', () => {});
        // Prevent connection attempts
        RedisClient.instance.disconnect();
        return RedisClient.instance;
      }

      // Build ioredis config based on parsed REDIS_URL
      const ioredisConfig: any = {
        enableReadyCheck: false,
        maxRetriesPerRequest: null,
        lazyConnect: true,
        // Enable offline queue for resilience
        enableOfflineQueue: true,
        // Custom retry strategy to prevent log flooding
        retryStrategy(times) {
          const delay = Math.min(times * 500, 5000); // Max 5s delay
          return delay;
        },
        // Graceful error handling for reconnection
        reconnectOnError(err) {
          const targetError = 'READONLY';
          if (err.message.includes(targetError)) {
            return true;
          }
          return false;
        },
      };

      // Use URL or path based on parsed config
      if (redisConfig.url) {
        // TCP connection via URL
        RedisClient.instance = new Redis(redisConfig.url, ioredisConfig);
      } else if (redisConfig.path) {
        // Unix socket connection
        RedisClient.instance = new Redis({
          ...ioredisConfig,
          path: redisConfig.path,
        });
      } else {
        // Fallback (should not happen, but just in case)
        RedisClient.instance = new Redis(ioredisConfig);
      }

      // Prevent unhandled error events from crashing the app
      let lastErrorLogTime = 0;
      const ERROR_LOG_INTERVAL = 60000; // 1 minute

      RedisClient.instance.on('error', (err: any) => {
        const now = Date.now();
        const isConnectionRefused = err.code === 'ECONNREFUSED' || err.code === 'ENOENT';
        
        // Only log errors once per minute to avoid flooding
        if (now - lastErrorLogTime > ERROR_LOG_INTERVAL) {
          if (isConnectionRefused) {
            console.warn('⚠️  Redis connection failed (retrying...). Set REDIS_URL if using Redis.');
            lastErrorLogTime = now;
          } else {
            console.error('Redis connection error:', err.message);
            lastErrorLogTime = now;
          }
        }
      });

      RedisClient.instance.on('connect', () => {
        console.log('✅ Redis connected successfully');
      });

      RedisClient.instance.on('reconnecting', () => {
        // console.log('Redis reconnecting...');
      });

      RedisClient.instance.on('disconnect', () => {
        console.log('⚠️  Redis disconnected');
      });
    }

    return RedisClient.instance;
  }

  static async disconnect(): Promise<void> {
    if (RedisClient.instance) {
      await RedisClient.instance.quit();
    }
  }
}

// Redis service for token management
export class RedisService {
  private client: Redis;

  constructor() {
    this.client = RedisClient.getInstance();
  }

  // Store refresh token with user metadata
  async storeRefreshToken(
    userId: string,
    refreshToken: string,
    deviceInfo?: string,
    ipAddress?: string,
  ): Promise<void> {
    const key = `refresh_token:${userId}:${refreshToken}`;
    const value = {
      userId,
      deviceInfo: deviceInfo || 'unknown',
      ipAddress: ipAddress || 'unknown',
      createdAt: new Date().toISOString(),
      lastUsed: new Date().toISOString(),
    };

    await this.client.setex(key, parseInt(REDIS_TTL), JSON.stringify(value));

    // Also store user's active tokens list
    const userTokensKey = `user_tokens:${userId}`;
    await this.client.sadd(userTokensKey, refreshToken);
    await this.client.expire(userTokensKey, parseInt(REDIS_TTL));
  }

  // Get refresh token metadata
  async getRefreshToken(
    userId: string,
    refreshToken: string,
  ): Promise<any | null> {
    const key = `refresh_token:${userId}:${refreshToken}`;
    const value = await this.client.get(key);
    return value ? JSON.parse(value) : null;
  }

  // Update last used timestamp for refresh token
  async updateRefreshTokenUsage(
    userId: string,
    refreshToken: string,
  ): Promise<void> {
    const key = `refresh_token:${userId}:${refreshToken}`;
    const existing = await this.client.get(key);

    if (existing) {
      const tokenData = JSON.parse(existing);
      tokenData.lastUsed = new Date().toISOString();
      await this.client.setex(
        key,
        parseInt(REDIS_TTL),
        JSON.stringify(tokenData),
      );
    }
  }

  // Revoke specific refresh token
  async revokeRefreshToken(
    userId: string,
    refreshToken: string,
  ): Promise<void> {
    const key = `refresh_token:${userId}:${refreshToken}`;
    await this.client.del(key);

    // Remove from user's active tokens
    const userTokensKey = `user_tokens:${userId}`;
    await this.client.srem(userTokensKey, refreshToken);
  }

  // Revoke all refresh tokens for a user
  async revokeAllUserTokens(userId: string): Promise<void> {
    const userTokensKey = `user_tokens:${userId}`;
    const tokens = await this.client.smembers(userTokensKey);

    // Delete all token entries
    const pipeline = this.client.pipeline();
    tokens.forEach(token => {
      pipeline.del(`refresh_token:${userId}:${token}`);
    });

    // Clear user tokens set
    pipeline.del(userTokensKey);

    await pipeline.exec();
  }

  // Check if refresh token exists and is valid
  async isRefreshTokenValid(
    userId: string,
    refreshToken: string,
  ): Promise<boolean> {
    const tokenData = await this.getRefreshToken(userId, refreshToken);
    return tokenData !== null;
  }

  // Get all active tokens for a user
  async getUserTokens(userId: string): Promise<string[]> {
    const userTokensKey = `user_tokens:${userId}`;
    return await this.client.smembers(userTokensKey);
  }

  // Store session data
  async storeSession(
    sessionId: string,
    sessionData: any,
    ttl?: number,
  ): Promise<void> {
    const key = `session:${sessionId}`;
    const expiration = ttl || parseInt(REDIS_TTL);
    await this.client.setex(key, expiration, JSON.stringify(sessionData));
  }

  // Get session data
  async getSession(sessionId: string): Promise<any | null> {
    const key = `session:${sessionId}`;
    const value = await this.client.get(key);
    return value ? JSON.parse(value) : null;
  }

  // Delete session
  async deleteSession(sessionId: string): Promise<void> {
    const key = `session:${sessionId}`;
    await this.client.del(key);
  }

  // Store authentication attempt for rate limiting
  async recordAuthAttempt(
    identifier: string,
    ipAddress: string,
  ): Promise<void> {
    const key = `auth_attempts:${identifier}:${ipAddress}`;
    const ttl = 900; // 15 minutes
    await this.client.incr(key);
    await this.client.expire(key, ttl);
  }

  // Get authentication attempts count
  async getAuthAttempts(
    identifier: string,
    ipAddress: string,
  ): Promise<number> {
    const key = `auth_attempts:${identifier}:${ipAddress}`;
    const attempts = await this.client.get(key);
    return attempts ? parseInt(attempts) : 0;
  }

  // Clear authentication attempts
  async clearAuthAttempts(
    identifier: string,
    ipAddress: string,
  ): Promise<void> {
    const key = `auth_attempts:${identifier}:${ipAddress}`;
    await this.client.del(key);
  }

  // Store password reset token
  async storePasswordResetToken(
    email: string,
    token: string,
    ttl: number = 3600,
  ): Promise<void> {
    const key = `password_reset:${token}`;
    const value = {
      email,
      createdAt: new Date().toISOString(),
    };
    await this.client.setex(key, ttl, JSON.stringify(value));
  }

  // Validate password reset token
  async validatePasswordResetToken(token: string): Promise<string | null> {
    const key = `password_reset:${token}`;
    const value = await this.client.get(key);
    return value ? JSON.parse(value).email : null;
  }

  // Delete password reset token
  async deletePasswordResetToken(token: string): Promise<void> {
    const key = `password_reset:${token}`;
    await this.client.del(key);
  }

  // Health check with timeout to prevent blocking
  async healthCheck(timeoutMs: number = 2000): Promise<boolean> {
    try {
      // Use Promise.race to add timeout
      const pingPromise = this.client.ping();
      const timeoutPromise = new Promise<boolean>((_, reject) => {
        setTimeout(() => reject(new Error('Redis health check timeout')), timeoutMs);
      });

      await Promise.race([pingPromise, timeoutPromise]);
      return true;
    } catch (error) {
      // Silently fail - don't log to avoid log flooding
      // Healthcheck should gracefully report Redis as disconnected
      return false;
    }
  }

  // Get Redis client for BullMQ
  getClient(): Redis {
    return this.client;
  }

  // Close connection
  async disconnect(): Promise<void> {
    await RedisClient.disconnect();
  }
}

// Export singleton instance
export const redisService = new RedisService();
