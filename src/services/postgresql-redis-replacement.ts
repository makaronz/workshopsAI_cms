import { db } from '../config/postgresql-database';
import { sql } from 'drizzle-orm';
import { keyValueStore } from '../models/postgresql-schema';
import { eq, and, isNull, lt } from 'drizzle-orm';

/**
 * PostgreSQL-based replacement for RedisService
 * Simple key-value store implementation for small applications
 * Uses single table with JSONB values and TTL support
 */

const DEFAULT_TTL = 604800; // 7 days in seconds

export class PostgreSQLRedisReplacement {
  private cleanupExpiredKeys(): Promise<void> {
    return db.delete(keyValueStore)
      .where(
        and(
          isNull(keyValueStore.expiresAt).not(),
          lt(keyValueStore.expiresAt, new Date())
        )
      )
      .then(() => {});
  }

  private buildKey(prefix: string, ...parts: string[]): string {
    return `${prefix}:${parts.join(':')}`;
  }

  // Store refresh token with user metadata
  async storeRefreshToken(
    userId: string,
    refreshToken: string,
    deviceInfo?: string,
    ipAddress?: string,
  ): Promise<void> {
    await this.cleanupExpiredKeys();
    
    const key = this.buildKey('refresh_token', userId, refreshToken);
    const value = {
      userId,
      deviceInfo: deviceInfo || 'unknown',
      ipAddress: ipAddress || 'unknown',
      createdAt: new Date().toISOString(),
      lastUsed: new Date().toISOString(),
    };

    await db.insert(keyValueStore)
      .values({
        key,
        value,
        expiresAt: new Date(Date.now() + DEFAULT_TTL * 1000),
      })
      .onConflictDoUpdate({
        target: [keyValueStore.key],
        set: {
          value,
          expiresAt: new Date(Date.now() + DEFAULT_TTL * 1000),
        },
      });

    // Store in user's tokens list
    const userTokensKey = this.buildKey('user_tokens', userId);
    const existingTokens = await db.select()
      .from(keyValueStore)
      .where(eq(keyValueStore.key, userTokensKey));

    let tokens: string[] = [];
    if (existingTokens.length > 0) {
      tokens = existingTokens[0].value as string[];
    }
    
    if (!tokens.includes(refreshToken)) {
      tokens.push(refreshToken);
    }

    await db.insert(keyValueStore)
      .values({
        key: userTokensKey,
        value: tokens,
        expiresAt: new Date(Date.now() + DEFAULT_TTL * 1000),
      })
      .onConflictDoUpdate({
        target: [keyValueStore.key],
        set: {
          value: tokens,
          expiresAt: new Date(Date.now() + DEFAULT_TTL * 1000),
        },
      });
  }

  // Get refresh token metadata
  async getRefreshToken(
    userId: string,
    refreshToken: string,
  ): Promise<any | null> {
    await this.cleanupExpiredKeys();
    
    const key = this.buildKey('refresh_token', userId, refreshToken);
    const result = await db.select()
      .from(keyValueStore)
      .where(eq(keyValueStore.key, key));

    if (result.length === 0) {
      return null;
    }

    return result[0].value;
  }

  // Update last used timestamp for refresh token
  async updateRefreshTokenUsage(
    userId: string,
    refreshToken: string,
  ): Promise<void> {
    const key = this.buildKey('refresh_token', userId, refreshToken);
    const existing = await db.select()
      .from(keyValueStore)
      .where(eq(keyValueStore.key, key));

    if (existing.length > 0) {
      const tokenData = existing[0].value;
      tokenData.lastUsed = new Date().toISOString();
      
      await db.update(keyValueStore)
        .set({ 
          value: tokenData,
          updatedAt: new Date(),
        })
        .where(eq(keyValueStore.key, key));
    }
  }

  // Revoke specific refresh token
  async revokeRefreshToken(
    userId: string,
    refreshToken: string,
  ): Promise<void> {
    const key = this.buildKey('refresh_token', userId, refreshToken);
    await db.delete(keyValueStore)
      .where(eq(keyValueStore.key, key));

    // Remove from user's tokens list
    const userTokensKey = this.buildKey('user_tokens', userId);
    const existing = await db.select()
      .from(keyValueStore)
      .where(eq(keyValueStore.key, userTokensKey));

    if (existing.length > 0) {
      const tokens: string[] = existing[0].value;
      const updatedTokens = tokens.filter(t => t !== refreshToken);

      if (updatedTokens.length === 0) {
        await db.delete(keyValueStore)
          .where(eq(keyValueStore.key, userTokensKey));
      } else {
        await db.update(keyValueStore)
          .set({ 
            value: updatedTokens,
            updatedAt: new Date(),
          })
          .where(eq(keyValueStore.key, userTokensKey));
      }
    }
  }

  // Revoke all refresh tokens for a user
  async revokeAllUserTokens(userId: string): Promise<void> {
    const userTokensKey = this.buildKey('user_tokens', userId);
    const existing = await db.select()
      .from(keyValueStore)
      .where(eq(keyValueStore.key, userTokensKey));

    if (existing.length > 0) {
      const tokens: string[] = existing[0].value;

      // Delete all token entries
      for (const token of tokens) {
        const tokenKey = this.buildKey('refresh_token', userId, token);
        await db.delete(keyValueStore)
          .where(eq(keyValueStore.key, tokenKey));
      }

      // Clear user tokens set
      await db.delete(keyValueStore)
        .where(eq(keyValueStore.key, userTokensKey));
    }
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
    await this.cleanupExpiredKeys();
    
    const userTokensKey = this.buildKey('user_tokens', userId);
    const existing = await db.select()
      .from(keyValueStore)
      .where(eq(keyValueStore.key, userTokensKey));

    if (existing.length === 0) {
      return [];
    }

    const tokens: string[] = existing[0].value;
    return tokens;
  }

  // Store session data
  async storeSession(
    sessionId: string,
    sessionData: any,
    ttl?: number,
  ): Promise<void> {
    const key = this.buildKey('session', sessionId);
    const expiration = ttl || DEFAULT_TTL;
    
    await db.insert(keyValueStore)
      .values({
        key,
        value: sessionData,
        expiresAt: new Date(Date.now() + expiration * 1000),
      })
      .onConflictDoUpdate({
        target: [keyValueStore.key],
        set: {
          value: sessionData,
          expiresAt: new Date(Date.now() + expiration * 1000),
        },
      });
  }

  // Get session data
  async getSession(sessionId: string): Promise<any | null> {
    await this.cleanupExpiredKeys();
    
    const key = this.buildKey('session', sessionId);
    const result = await db.select()
      .from(keyValueStore)
      .where(eq(keyValueStore.key, key));

    if (result.length === 0) {
      return null;
    }

    return result[0].value;
  }

  // Delete session
  async deleteSession(sessionId: string): Promise<void> {
    const key = this.buildKey('session', sessionId);
    await db.delete(keyValueStore)
      .where(eq(keyValueStore.key, key));
  }

  // Store authentication attempt for rate limiting
  async recordAuthAttempt(
    identifier: string,
    ipAddress: string,
  ): Promise<void> {
    await this.cleanupExpiredKeys();
    
    const key = this.buildKey('auth_attempts', identifier, ipAddress);
    const ttl = 900; // 15 minutes

    const existing = await db.select()
      .from(keyValueStore)
      .where(eq(keyValueStore.key, key));

    const count = existing.length > 0 ? (existing[0].value.count || 0) + 1 : 1;

    await db.insert(keyValueStore)
      .values({
        key,
        value: { count },
        expiresAt: new Date(Date.now() + ttl * 1000),
      })
      .onConflictDoUpdate({
        target: [keyValueStore.key],
        set: {
          value: { count },
          expiresAt: new Date(Date.now() + ttl * 1000),
        },
      });
  }

  // Get authentication attempts count
  async getAuthAttempts(
    identifier: string,
    ipAddress: string,
  ): Promise<number> {
    await this.cleanupExpiredKeys();
    
    const key = this.buildKey('auth_attempts', identifier, ipAddress);
    const result = await db.select()
      .from(keyValueStore)
      .where(eq(keyValueStore.key, key));

    if (result.length === 0) {
      return 0;
    }

    return result[0].value.count || 0;
  }

  // Clear authentication attempts
  async clearAuthAttempts(
    identifier: string,
    ipAddress: string,
  ): Promise<void> {
    const key = this.buildKey('auth_attempts', identifier, ipAddress);
    await db.delete(keyValueStore)
      .where(eq(keyValueStore.key, key));
  }

  // Store password reset token
  async storePasswordResetToken(
    email: string,
    token: string,
    ttl: number = 3600,
  ): Promise<void> {
    const key = this.buildKey('password_reset', token);
    const value = {
      email,
      createdAt: new Date().toISOString(),
    };

    await db.insert(keyValueStore)
      .values({
        key,
        value,
        expiresAt: new Date(Date.now() + ttl * 1000),
      });
  }

  // Validate password reset token
  async validatePasswordResetToken(token: string): Promise<string | null> {
    await this.cleanupExpiredKeys();
    
    const key = this.buildKey('password_reset', token);
    const result = await db.select()
      .from(keyValueStore)
      .where(eq(keyValueStore.key, key));

    if (result.length === 0) {
      return null;
    }

    return result[0].value.email;
  }

  // Delete password reset token
  async deletePasswordResetToken(token: string): Promise<void> {
    const key = this.buildKey('password_reset', token);
    await db.delete(keyValueStore)
      .where(eq(keyValueStore.key, key));
  }

  // Generic store/get/delete for direct redis.getClient() replacements
  async setex(key: string, ttl: number, value: string): Promise<void> {
    let parsedValue: any;
    try {
      parsedValue = JSON.parse(value);
    } catch {
      parsedValue = value;
    }

    await db.insert(keyValueStore)
      .values({
        key,
        value: parsedValue,
        expiresAt: new Date(Date.now() + ttl * 1000),
      })
      .onConflictDoUpdate({
        target: [keyValueStore.key],
        set: {
          value: parsedValue,
          expiresAt: new Date(Date.now() + ttl * 1000),
        },
      });
  }

  async get(key: string): Promise<string | null> {
    await this.cleanupExpiredKeys();
    
    const result = await db.select()
      .from(keyValueStore)
      .where(eq(keyValueStore.key, key));

    if (result.length === 0) {
      return null;
    }

    const value = result[0].value;
    return typeof value === 'string' ? value : JSON.stringify(value);
  }

  async del(key: string): Promise<void> {
    await db.delete(keyValueStore)
      .where(eq(keyValueStore.key, key));
  }

  async incr(key: string): Promise<number> {
    const existing = await db.select()
      .from(keyValueStore)
      .where(eq(keyValueStore.key, key));

    const count = existing.length > 0 ? (existing[0].value.count || 0) + 1 : 1;

    await db.insert(keyValueStore)
      .values({
        key,
        value: { count },
      })
      .onConflictDoUpdate({
        target: [keyValueStore.key],
        set: {
          value: { count },
        },
      });

    return count;
  }

  async expire(key: string, ttl: number): Promise<void> {
    await db.update(keyValueStore)
      .set({
        expiresAt: new Date(Date.now() + ttl * 1000),
      })
      .where(eq(keyValueStore.key, key));
  }

  async ttl(key: string): Promise<number> {
    const result = await db.select()
      .from(keyValueStore)
      .where(eq(keyValueStore.key, key));

    if (result.length === 0) {
      return -2; // Key doesn't exist
    }

    if (!result[0].expiresAt) {
      return -1; // No TTL
    }

    const now = new Date();
    const expiresAt = result[0].expiresAt;
    
    if (expiresAt < now) {
      return -2; // Key expired
    }

    return Math.floor((expiresAt.getTime() - now.getTime()) / 1000);
  }

  async keys(pattern: string): Promise<string[]> {
    await this.cleanupExpiredKeys();
    
    // Simple pattern matching - convert * to SQL LIKE %
    const sqlPattern = pattern.replace(/\*/g, '%');
    
    const results = await db.select()
      .from(keyValueStore)
      .where(sql`${keyValueStore.key} LIKE ${sqlPattern}`);

    return results.map(row => row.key);
  }

  async mget(keys: string[]): Promise<(string | null)[]> {
    const results = await Promise.all(
      keys.map(key => this.get(key))
    );
    return results;
  }

  async lpush(key: string, value: string): Promise<void> {
    const existing = await db.select()
      .from(keyValueStore)
      .where(eq(keyValueStore.key, key));

    let list: string[] = [];
    if (existing.length > 0) {
      list = existing[0].value as string[];
    }
    
    list.unshift(value);
    
    await db.insert(keyValueStore)
      .values({
        key,
        value: list,
      })
      .onConflictDoUpdate({
        target: [keyValueStore.key],
        set: {
          value: list,
        },
      });
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    const result = await db.select()
      .from(keyValueStore)
      .where(eq(keyValueStore.key, key));

    if (result.length === 0) {
      return [];
    }

    const list: string[] = result[0].value;
    
    // Handle negative indices
    const length = list.length;
    const startIdx = start < 0 ? Math.max(0, length + start) : start;
    const stopIdx = stop < 0 ? Math.max(0, length + stop) : stop;
    
    return list.slice(startIdx, stopIdx + 1);
  }

  async ltrim(key: string, start: number, stop: number): Promise<void> {
    const existing = await db.select()
      .from(keyValueStore)
      .where(eq(keyValueStore.key, key));

    if (existing.length === 0) {
      return;
    }

    const list: string[] = existing[0].value;
    
    // Handle negative indices
    const length = list.length;
    const startIdx = start < 0 ? Math.max(0, length + start) : start;
    const stopIdx = stop < 0 ? Math.max(0, length + stop) : stop;
    
    const trimmed = list.slice(startIdx, stopIdx + 1);
    
    await db.update(keyValueStore)
      .set({ 
        value: trimmed,
      })
      .where(eq(keyValueStore.key, key));
  }

  async sadd(key: string, member: string): Promise<void> {
    const existing = await db.select()
      .from(keyValueStore)
      .where(eq(keyValueStore.key, key));

    let set: string[] = [];
    if (existing.length > 0) {
      set = existing[0].value as string[];
    }
    
    if (!set.includes(member)) {
      set.push(member);
      
      await db.insert(keyValueStore)
        .values({
          key,
          value: set,
        })
        .onConflictDoUpdate({
          target: [keyValueStore.key],
          set: {
            value: set,
          },
        });
    }
  }

  async srem(key: string, member: string): Promise<void> {
    const existing = await db.select()
      .from(keyValueStore)
      .where(eq(keyValueStore.key, key));

    if (existing.length === 0) {
      return;
    }

    let set: string[] = existing[0].value;
    const updatedSet = set.filter(m => m !== member);
    
    if (updatedSet.length === 0) {
      await db.delete(keyValueStore)
        .where(eq(keyValueStore.key, key));
    } else {
      await db.update(keyValueStore)
        .set({ 
          value: updatedSet,
        })
        .where(eq(keyValueStore.key, key));
    }
  }

  async smembers(key: string): Promise<string[]> {
    await this.cleanupExpiredKeys();
    
    const result = await db.select()
      .from(keyValueStore)
      .where(eq(keyValueStore.key, key));

    if (result.length === 0) {
      return [];
    }

    return result[0].value as string[];
  }

  async zadd(key: string, score: number, member: string): Promise<void> {
    // For sorted sets, store as array of [score, member] tuples
    const existing = await db.select()
      .from(keyValueStore)
      .where(eq(keyValueStore.key, key));

    let set: Array<[number, string]> = [];
    if (existing.length > 0) {
      set = existing[0].value as Array<[number, string]>;
      // Remove existing member if present
      set = set.filter(([_, m]) => m !== member);
    }
    
    set.push([score, member]);
    set.sort((a, b) => a[0] - b[0]);
    
    await db.insert(keyValueStore)
      .values({
        key,
        value: set,
      })
      .onConflictDoUpdate({
        target: [keyValueStore.key],
        set: {
          value: set,
        },
      });
  }

  async zrange(key: string, min: number, max: number): Promise<string[]> {
    await this.cleanupExpiredKeys();
    
    const result = await db.select()
      .from(keyValueStore)
      .where(eq(keyValueStore.key, key));

    if (result.length === 0) {
      return [];
    }

    const set: Array<[number, string]> = result[0].value;
    return set.slice(min, max + 1).map(([_, member]) => member);
  }

  async zremrangebyscore(key: string, min: number, max: number): Promise<void> {
    const existing = await db.select()
      .from(keyValueStore)
      .where(eq(keyValueStore.key, key));

    if (existing.length === 0) {
      return;
    }

    const set: Array<[number, string]> = existing[0].value;
    const filtered = set.filter(([score]) => score < min || score > max);
    
    if (filtered.length === 0) {
      await db.delete(keyValueStore)
        .where(eq(keyValueStore.key, key));
    } else {
      await db.update(keyValueStore)
        .set({ 
          value: filtered,
        })
        .where(eq(keyValueStore.key, key));
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await db.execute(sql`SELECT 1`);
      return true;
    } catch (error) {
      console.error('PostgreSQL health check failed:', error);
      return false;
    }
  }

  // Close connection (no-op for connection pool)
  async disconnect(): Promise<void> {
    // Connection pooling handled by postgresql-database.ts
    // Nothing to do here
  }
}

// Export singleton instance
export const postgresqlRedisReplacement = new PostgreSQLRedisReplacement();
