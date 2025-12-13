import Redis from 'ioredis';

// Redis configuration
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const REDIS_TTL = process.env.REDIS_TTL || '604800'; // 7 days in seconds

// Redis client singleton
class RedisClient {
  private static instance: Redis;

  static getInstance(): Redis {
    if (!RedisClient.instance) {
      RedisClient.instance = new Redis(REDIS_URL, {
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
      });

      // Prevent unhandled error events from crashing the app
      RedisClient.instance.on('error', (err: any) => {
        // Only log connection refused errors once per minute to avoid flooding
        const isConnectionRefused = err.code === 'ECONNREFUSED';
        if (isConnectionRefused) {
          // Debounce logging for ECONNREFUSED
          // console.warn('Redis connection failed (retrying...)');
        } else {
          console.error('Redis connection error:', err.message);
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
