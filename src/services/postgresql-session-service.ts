/**
 * PostgreSQL Session Management Service
 *
 * Replaces Redis-based session and token management with PostgreSQL implementation
 * Provides secure session storage, token management, and rate limiting
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import { eq, and, lt, gt, desc } from 'drizzle-orm';
import { db } from '../config/postgresql-database';
import { sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { logger } from '../utils/logger';

// Session management schema
export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: text('session_id').notNull().unique(),
  userId: uuid('user_id').notNull(),
  sessionData: jsonb('session_data').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  isActive: boolean('is_active').default(true).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  lastAccessedAt: timestamp('last_accessed_at').defaultNow().notNull(),
}, table => ({
  sessionIdIdx: index('idx_sessions_session_id').on(table.sessionId),
  userIdIdx: index('idx_sessions_user_id').on(table.userId),
  expiresAtIdx: index('idx_sessions_expires_at').on(table.expiresAt),
  isActiveIdx: index('idx_sessions_is_active').on(table.isActive),
}));

// Refresh tokens schema
export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  tokenId: text('token_id').notNull().unique(),
  userId: uuid('user_id').notNull(),
  tokenHash: text('token_hash').notNull(),
  deviceInfo: text('device_info'),
  ipAddress: text('ip_address'),
  isActive: boolean('is_active').default(true).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  lastUsedAt: timestamp('last_used_at').defaultNow().notNull(),
}, table => ({
  tokenIdIdx: index('idx_refresh_tokens_token_id').on(table.tokenId),
  userIdIdx: index('idx_refresh_tokens_user_id').on(table.userId),
  isActiveIdx: index('idx_refresh_tokens_is_active').on(table.isActive),
  expiresAtIdx: index('idx_refresh_tokens_expires_at').on(table.expiresAt),
}));

// Authentication attempts for rate limiting
export const authAttempts = pgTable('auth_attempts', {
  id: uuid('id').primaryKey().defaultRandom(),
  identifier: text('identifier').notNull(), // email or username
  ipAddress: text('ip_address').notNull(),
  attemptCount: text('attempt_count').default('1').notNull(),
  firstAttemptAt: timestamp('first_attempt_at').defaultNow().notNull(),
  lastAttemptAt: timestamp('last_attempt_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
}, table => ({
  identifierIpIdx: index('idx_auth_attempts_identifier_ip').on(table.identifier, table.ipAddress),
  expiresAtIdx: index('idx_auth_attempts_expires_at').on(table.expiresAt),
}));

// Password reset tokens
export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  token: text('token').notNull().unique(),
  email: text('email').notNull(),
  userId: uuid('user_id').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  usedAt: timestamp('used_at'),
}, table => ({
  tokenIdx: index('idx_password_reset_tokens_token').on(table.token),
  emailIdx: index('idx_password_reset_tokens_email').on(table.email),
  userIdIdx: index('idx_password_reset_tokens_user_id').on(table.userId),
  isActiveIdx: index('idx_password_reset_tokens_is_active').on(table.isActive),
  expiresAtIdx: index('idx_password_reset_tokens_expires_at').on(table.expiresAt),
}));

export type Session = typeof sessions.$inferSelect;
export type InsertSession = typeof sessions.$inferInsert;
export type RefreshToken = typeof refreshTokens.$inferSelect;
export type InsertRefreshToken = typeof refreshTokens.$inferInsert;
export type AuthAttempt = typeof authAttempts.$inferSelect;
export type InsertAuthAttempt = typeof authAttempts.$inferInsert;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = typeof passwordResetTokens.$inferSelect;

/**
 * PostgreSQL-based Session Service
 * Replaces Redis session management with secure PostgreSQL implementation
 */
export class PostgreSQLSessionService {
  private sessionCleanupInterval: NodeJS.Timeout | null = null;
  private readonly defaultSessionTTL = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
  private readonly maxAuthAttempts = 5;
  private readonly authAttemptWindow = 15 * 60 * 1000; // 15 minutes in milliseconds

  constructor() {
    this.startSessionCleanup();
  }

  /**
   * Store session data
   */
  async storeSession(
    sessionId: string,
    userId: string,
    sessionData: any,
    options: {
      ttl?: number;
      ipAddress?: string;
      userAgent?: string;
    } = {}
  ): Promise<void> {
    const ttl = options.ttl || this.defaultSessionTTL;
    const expiresAt = new Date(Date.now() + ttl);

    try {
      await db.insert(sessions).values({
        sessionId,
        userId,
        sessionData,
        ipAddress: options.ipAddress,
        userAgent: options.userAgent,
        expiresAt,
      }).onConflictDoUpdate({
        target: sessions.sessionId,
        set: {
          sessionData,
          updatedAt: new Date(),
          lastAccessedAt: new Date(),
          expiresAt,
          isActive: true,
        },
      });

      logger.debug(`Session stored: ${sessionId} for user ${userId}`);
    } catch (error) {
      logger.error(`Failed to store session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Get session data
   */
  async getSession(sessionId: string): Promise<any | null> {
    try {
      const [session] = await db
        .select()
        .from(sessions)
        .where(and(
          eq(sessions.sessionId, sessionId),
          eq(sessions.isActive, true),
          gt(sessions.expiresAt, new Date())
        ))
        .limit(1);

      if (!session) {
        return null;
      }

      // Update last accessed time
      await db
        .update(sessions)
        .set({
          lastAccessedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(sessions.id, session.id));

      return session.sessionData;
    } catch (error) {
      logger.error(`Failed to get session ${sessionId}:`, error);
      return null;
    }
  }

  /**
   * Update session data
   */
  async updateSession(sessionId: string, sessionData: any): Promise<boolean> {
    try {
      const result = await db
        .update(sessions)
        .set({
          sessionData,
          updatedAt: new Date(),
          lastAccessedAt: new Date(),
        })
        .where(and(
          eq(sessions.sessionId, sessionId),
          eq(sessions.isActive, true),
          gt(sessions.expiresAt, new Date())
        ));

      return (result.rowCount || 0) > 0;
    } catch (error) {
      logger.error(`Failed to update session ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * Delete/invalidate session
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    try {
      const result = await db
        .update(sessions)
        .set({
          isActive: false,
          updatedAt: new Date(),
        })
        .where(eq(sessions.sessionId, sessionId));

      return (result.rowCount || 0) > 0;
    } catch (error) {
      logger.error(`Failed to delete session ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * Store refresh token
   */
  async storeRefreshToken(
    userId: string,
    tokenId: string,
    token: string,
    options: {
      ttl?: number;
      deviceInfo?: string;
      ipAddress?: string;
    } = {}
  ): Promise<void> {
    const ttl = options.ttl || this.defaultSessionTTL;
    const expiresAt = new Date(Date.now() + ttl);

    // Hash the token for secure storage
    const tokenHash = await bcrypt.hash(token, 12);

    try {
      await db.insert(refreshTokens).values({
        tokenId,
        userId,
        tokenHash,
        deviceInfo: options.deviceInfo,
        ipAddress: options.ipAddress,
        expiresAt,
      });

      logger.debug(`Refresh token stored: ${tokenId} for user ${userId}`);
    } catch (error) {
      logger.error(`Failed to store refresh token ${tokenId}:`, error);
      throw error;
    }
  }

  /**
   * Validate refresh token
   */
  async validateRefreshToken(tokenId: string, token: string): Promise<any | null> {
    try {
      const [refreshToken] = await db
        .select()
        .from(refreshTokens)
        .where(and(
          eq(refreshTokens.tokenId, tokenId),
          eq(refreshTokens.isActive, true),
          gt(refreshTokens.expiresAt, new Date())
        ))
        .limit(1);

      if (!refreshToken) {
        return null;
      }

      // Verify token hash
      const isValid = await bcrypt.compare(token, refreshToken.tokenHash);
      if (!isValid) {
        return null;
      }

      // Update last used time
      await db
        .update(refreshTokens)
        .set({
          lastUsedAt: new Date(),
        })
        .where(eq(refreshTokens.id, refreshToken.id));

      return {
        userId: refreshToken.userId,
        deviceInfo: refreshToken.deviceInfo,
        ipAddress: refreshToken.ipAddress,
      };
    } catch (error) {
      logger.error(`Failed to validate refresh token ${tokenId}:`, error);
      return null;
    }
  }

  /**
   * Revoke refresh token
   */
  async revokeRefreshToken(tokenId: string): Promise<boolean> {
    try {
      const result = await db
        .update(refreshTokens)
        .set({
          isActive: false,
        })
        .where(eq(refreshTokens.tokenId, tokenId));

      return (result.rowCount || 0) > 0;
    } catch (error) {
      logger.error(`Failed to revoke refresh token ${tokenId}:`, error);
      return false;
    }
  }

  /**
   * Revoke all refresh tokens for a user
   */
  async revokeAllUserTokens(userId: string): Promise<number> {
    try {
      const result = await db
        .update(refreshTokens)
        .set({
          isActive: false,
        })
        .where(eq(refreshTokens.userId, userId));

      return result.rowCount || 0;
    } catch (error) {
      logger.error(`Failed to revoke all tokens for user ${userId}:`, error);
      return 0;
    }
  }

  /**
   * Record authentication attempt for rate limiting
   */
  async recordAuthAttempt(identifier: string, ipAddress: string): Promise<void> {
    const expiresAt = new Date(Date.now() + this.authAttemptWindow);

    try {
      // Check if there's an existing record
      const [existing] = await db
        .select()
        .from(authAttempts)
        .where(and(
          eq(authAttempts.identifier, identifier),
          eq(authAttempts.ipAddress, ipAddress),
          gt(authAttempts.expiresAt, new Date())
        ))
        .limit(1);

      if (existing) {
        // Update existing record
        await db
          .update(authAttempts)
          .set({
            attemptCount: String(parseInt(existing.attemptCount) + 1),
            lastAttemptAt: new Date(),
            expiresAt,
          })
          .where(eq(authAttempts.id, existing.id));
      } else {
        // Create new record
        await db.insert(authAttempts).values({
          identifier,
          ipAddress,
          attemptCount: '1',
          expiresAt,
        });
      }

      logger.debug(`Auth attempt recorded for ${identifier} from ${ipAddress}`);
    } catch (error) {
      logger.error(`Failed to record auth attempt:`, error);
    }
  }

  /**
   * Get authentication attempts count
   */
  async getAuthAttempts(identifier: string, ipAddress: string): Promise<number> {
    try {
      const [attempt] = await db
        .select()
        .from(authAttempts)
        .where(and(
          eq(authAttempts.identifier, identifier),
          eq(authAttempts.ipAddress, ipAddress),
          gt(authAttempts.expiresAt, new Date())
        ))
        .limit(1);

      return attempt ? parseInt(attempt.attemptCount) : 0;
    } catch (error) {
      logger.error(`Failed to get auth attempts:`, error);
      return 0;
    }
  }

  /**
   * Check if authentication should be blocked due to rate limiting
   */
  async isAuthBlocked(identifier: string, ipAddress: string): Promise<boolean> {
    const attempts = await this.getAuthAttempts(identifier, ipAddress);
    return attempts >= this.maxAuthAttempts;
  }

  /**
   * Clear authentication attempts
   */
  async clearAuthAttempts(identifier: string, ipAddress: string): Promise<void> {
    try {
      await db
        .delete(authAttempts)
        .where(and(
          eq(authAttempts.identifier, identifier),
          eq(authAttempts.ipAddress, ipAddress)
        ));

      logger.debug(`Auth attempts cleared for ${identifier} from ${ipAddress}`);
    } catch (error) {
      logger.error(`Failed to clear auth attempts:`, error);
    }
  }

  /**
   * Store password reset token
   */
  async storePasswordResetToken(
    email: string,
    userId: string,
    ttl: number = 3600000 // 1 hour default
  ): Promise<string> {
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + ttl);

    try {
      await db.insert(passwordResetTokens).values({
        token,
        email,
        userId,
        expiresAt,
      });

      logger.debug(`Password reset token stored for ${email}`);
      return token;
    } catch (error) {
      logger.error(`Failed to store password reset token:`, error);
      throw error;
    }
  }

  /**
   * Validate password reset token
   */
  async validatePasswordResetToken(token: string): Promise<any | null> {
    try {
      const [resetToken] = await db
        .select()
        .from(passwordResetTokens)
        .where(and(
          eq(passwordResetTokens.token, token),
          eq(passwordResetTokens.isActive, true),
          gt(passwordResetTokens.expiresAt, new Date())
        ))
        .limit(1);

      if (!resetToken) {
        return null;
      }

      return {
        email: resetToken.email,
        userId: resetToken.userId,
      };
    } catch (error) {
      logger.error(`Failed to validate password reset token:`, error);
      return null;
    }
  }

  /**
   * Mark password reset token as used
   */
  async usePasswordResetToken(token: string): Promise<boolean> {
    try {
      const result = await db
        .update(passwordResetTokens)
        .set({
          isActive: false,
          usedAt: new Date(),
        })
        .where(eq(passwordResetTokens.token, token));

      return (result.rowCount || 0) > 0;
    } catch (error) {
      logger.error(`Failed to use password reset token:`, error);
      return false;
    }
  }

  /**
   * Start automatic cleanup of expired sessions and tokens
   */
  private startSessionCleanup(): void {
    // Run cleanup every hour
    this.sessionCleanupInterval = setInterval(async () => {
      await this.cleanupExpiredSessions();
      await this.cleanupExpiredTokens();
    }, 60 * 60 * 1000);

    logger.info('Session cleanup started');
  }

  /**
   * Clean up expired sessions
   */
  private async cleanupExpiredSessions(): Promise<void> {
    try {
      const result = await db
        .update(sessions)
        .set({
          isActive: false,
          updatedAt: new Date(),
        })
        .where(and(
          eq(sessions.isActive, true),
          lt(sessions.expiresAt, new Date())
        ));

      if (result.rowCount && result.rowCount > 0) {
        logger.info(`Cleaned up ${result.rowCount} expired sessions`);
      }
    } catch (error) {
      logger.error('Failed to cleanup expired sessions:', error);
    }
  }

  /**
   * Clean up expired tokens
   */
  private async cleanupExpiredTokens(): Promise<void> {
    try {
      // Clean up expired refresh tokens
      const refreshResult = await db
        .update(refreshTokens)
        .set({
          isActive: false,
        })
        .where(and(
          eq(refreshTokens.isActive, true),
          lt(refreshTokens.expiresAt, new Date())
        ));

      // Clean up expired password reset tokens
      const resetResult = await db
        .update(passwordResetTokens)
        .set({
          isActive: false,
        })
        .where(and(
          eq(passwordResetTokens.isActive, true),
          lt(passwordResetTokens.expiresAt, new Date())
        ));

      // Clean up expired auth attempts
      const authResult = await db
        .delete(authAttempts)
        .where(lt(authAttempts.expiresAt, new Date()));

      const totalCleaned = (refreshResult.rowCount || 0) +
                          (resetResult.rowCount || 0) +
                          (authResult.rowCount || 0);

      if (totalCleaned > 0) {
        logger.info(`Cleaned up ${totalCleaned} expired tokens`);
      }
    } catch (error) {
      logger.error('Failed to cleanup expired tokens:', error);
    }
  }

  /**
   * Health check for the session service
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Test database connection with a simple query
      await db.select({ count: sql<number>`count(*)` }).from(sessions).limit(1);
      return true;
    } catch (error) {
      logger.error('Session service health check failed:', error);
      return false;
    }
  }

  /**
   * Stop the session service and cleanup
   */
  async stop(): Promise<void> {
    if (this.sessionCleanupInterval) {
      clearInterval(this.sessionCleanupInterval);
      this.sessionCleanupInterval = null;
    }

    // Final cleanup
    await this.cleanupExpiredSessions();
    await this.cleanupExpiredTokens();

    logger.info('Session service stopped');
  }
}

// Export singleton instance
export const sessionService = new PostgreSQLSessionService();

// Export schema components for migration
export { pgTable, text, jsonb, timestamp, uuid, index, sql } from 'drizzle-orm/pg-core';