/**
 * PostgreSQL Session Management System
 *
 * This module provides secure session management using PostgreSQL as the backend
 * instead of Redis. It includes features like:
 * - Session persistence and cleanup
 * - Refresh token rotation
 * - Multi-device session management
 * - Anomaly detection
 * - GDPR compliance
 * - Performance optimization
 */

import { randomBytes, timingSafeEqual } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { db, RLSHelper } from '../config/postgresql-database';
import {
  users,
  auditLogs,
  sessionStatusEnum,
  sessionTypeEnum,
  userSessions,
  sessionAuditLogs
} from '../models/postgresql-schema';
import { eq, and, desc, lt, gte, isNull, inArray } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { pgTable, text, timestamp, boolean, uuid, decimal, jsonb, index } from 'drizzle-orm/pg-core';

// Session configuration
const SESSION_CONFIG = {
  accessTokenExpiry: 15 * 60, // 15 minutes
  refreshTokenExpiry: 7 * 24 * 60 * 60, // 7 days
  absoluteSessionExpiry: 30 * 24 * 60 * 60, // 30 days
  maxConcurrentSessions: 5,
  sessionCleanupInterval: 60 * 60 * 1000, // 1 hour
  inactivityTimeout: 24 * 60 * 60, // 24 hours
  anomalyThreshold: 3, // Number of suspicious activities before flagging
};

// Session tables are defined in postgresql-schema.ts

// Interfaces
export interface SessionData {
  id: string;
  userId: string;
  sessionId: string;
  status: 'active' | 'expired' | 'revoked' | 'suspicious';
  sessionType: 'web' | 'mobile' | 'api' | 'desktop';
  ipAddress?: string;
  userAgent?: string;
  deviceFingerprint?: string;
  lastAccessedAt: Date;
  expiresAt: Date;
  loginAt: Date;
  riskScore: number;
  metadata?: any;
}

export interface DeviceInfo {
  browser: string;
  os: string;
  device: string;
  language: string;
  timezone: string;
  screenResolution?: string;
}

export interface SessionCreateOptions {
  sessionType?: 'web' | 'mobile' | 'api' | 'desktop';
  rememberMe?: boolean;
  deviceInfo?: DeviceInfo;
  location?: {
    country?: string;
    city?: string;
    coordinates?: { lat: number; lng: number };
  };
}

export interface AnomalyDetectionResult {
  isAnomalous: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  reasons: string[];
  recommendedAction: 'allow' | 'challenge' | 'block' | 'notify';
}

// Main Session Management Service
export class SessionService {
  private static cleanupInterval: NodeJS.Timeout | null = null;

  // Initialize session service
  static initialize(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions().catch(console.error);
    }, SESSION_CONFIG.sessionCleanupInterval);
  }

  // Generate secure session ID
  static generateSessionId(): string {
    return randomBytes(32).toString('hex');
  }

  // Generate refresh token ID
  static generateRefreshTokenId(): string {
    return randomBytes(16).toString('hex');
  }

  // Generate secure token
  static generateSecureToken(length: number = 64): string {
    return randomBytes(length).toString('hex');
  }

  // Hash token for database storage
  static async hashToken(token: string): Promise<string> {
    return bcrypt.hash(token, 12);
  }

  // Verify token against hash
  static async verifyToken(token: string, hash: string): Promise<boolean> {
    return bcrypt.compare(token, hash);
  }

  // Extract request metadata
  static extractRequestMetadata(req: Request): {
    ipAddress: string;
    userAgent: string;
    deviceFingerprint: string;
  } {
    const ipAddress = this.getClientIP(req);
    const userAgent = req.headers['user-agent'] || '';
    const deviceFingerprint = this.generateDeviceFingerprint(ipAddress, userAgent);

    return {
      ipAddress,
      userAgent,
      deviceFingerprint,
    };
  }

  // Get client IP address
  static getClientIP(req: Request): string {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string) ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      'unknown'
    );
  }

  // Generate device fingerprint
  static generateDeviceFingerprint(ip: string, userAgent: string): string {
    const combined = `${ip}:${userAgent}`;
    return require('crypto')
      .createHash('sha256')
      .update(combined)
      .digest('hex')
      .substring(0, 32);
  }

  // Parse user agent for device info
  static parseUserAgent(userAgent: string): DeviceInfo {
    // Simple UA parsing - consider using 'ua-parser-js' in production
    const browser = userAgent.includes('Chrome') ? 'Chrome' :
                   userAgent.includes('Firefox') ? 'Firefox' :
                   userAgent.includes('Safari') ? 'Safari' : 'Unknown';

    const os = userAgent.includes('Windows') ? 'Windows' :
               userAgent.includes('Mac') ? 'macOS' :
               userAgent.includes('Linux') ? 'Linux' :
               userAgent.includes('Android') ? 'Android' :
               userAgent.includes('iOS') ? 'iOS' : 'Unknown';

    const device = userAgent.includes('Mobile') ? 'Mobile' : 'Desktop';

    return {
      browser,
      os,
      device,
      language: 'en-US', // Should be extracted from Accept-Language header
      timezone: 'UTC', // Should be detected or provided by client
    };
  }

  // Create new session
  static async createSession(
    userId: string,
    req: Request,
    options: SessionCreateOptions = {}
  ): Promise<{
    sessionId: string;
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
  }> {
    const { ipAddress, userAgent, deviceFingerprint } = this.extractRequestMetadata(req);
    const deviceInfo = options.deviceInfo || this.parseUserAgent(userAgent);

    // Check concurrent session limit
    await this.enforceSessionLimit(userId, options.sessionType || 'web');

    const sessionId = this.generateSessionId();
    const refreshTokenId = this.generateRefreshTokenId();
    const accessToken = this.generateSecureToken();
    const refreshToken = this.generateSecureToken();

    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_CONFIG.accessTokenExpiry * 1000);
    const absoluteExpiresAt = new Date(now.getTime() + SESSION_CONFIG.absoluteSessionExpiry * 1000);

    // Hash tokens for storage
    const accessTokenHash = await this.hashToken(accessToken);
    const refreshTokenHash = await this.hashToken(refreshToken);

    // Create session record
    const sessionRecord = await db.insert(userSessions).values({
      userId,
      sessionId,
      accessTokenHash,
      refreshTokenHash,
      refreshTokenId,
      sessionType: options.sessionType || 'web',
      ipAddress,
      userAgent,
      deviceFingerprint,
      location: options.location,
      expiresAt,
      absoluteExpiresAt,
      metadata: deviceInfo,
      isActive: true,
    }).returning();

    // Log session creation
    await this.logSessionActivity(sessionRecord[0].id, userId, 'login', {
      ip: ipAddress,
      userAgent,
      deviceId: deviceFingerprint,
    });

    // Update user's last login
    await db.update(users)
      .set({ lastLoginAt: now })
      .where(eq(users.id, userId));

    return {
      sessionId,
      accessToken,
      refreshToken,
      expiresAt,
    };
  }

  // Enforce concurrent session limit
  static async enforceSessionLimit(userId: string, sessionType: string): Promise<void> {
    const activeSessions = await db.select()
      .from(userSessions)
      .where(and(
        eq(userSessions.userId, userId),
        eq(userSessions.sessionType, sessionType),
        eq(userSessions.status, 'active'),
        eq(userSessions.isActive, true),
        gte(userSessions.expiresAt, new Date()),
      ))
      .orderBy(desc(userSessions.lastAccessedAt));

    if (activeSessions.length >= SESSION_CONFIG.maxConcurrentSessions) {
      // Revoke oldest session
      const oldestSession = activeSessions[activeSessions.length - 1];
      await this.revokeSession(oldestSession.sessionId, 'concurrent_session_limit');
    }
  }

  // Validate session
  static async validateSession(accessToken: string): Promise<SessionData | null> {
    try {
      // Find session by iterating through active sessions and comparing hash
      const activeSessions = await db.select()
        .from(userSessions)
        .where(and(
          eq(userSessions.status, 'active'),
          eq(userSessions.isActive, true),
          gte(userSessions.expiresAt, new Date()),
        ));

      for (const session of activeSessions) {
        if (await this.verifyToken(accessToken, session.accessTokenHash)) {
          // Update last accessed time
          await this.updateSessionAccess(session.id);

          return {
            id: session.id,
            userId: session.userId,
            sessionId: session.sessionId,
            status: session.status,
            sessionType: session.sessionType,
            ipAddress: session.ipAddress,
            userAgent: session.userAgent,
            deviceFingerprint: session.deviceFingerprint,
            lastAccessedAt: session.lastAccessedAt,
            expiresAt: session.expiresAt,
            loginAt: session.loginAt,
            riskScore: parseFloat(session.riskScore?.toString() || '0'),
            metadata: session.metadata,
          };
        }
      }

      return null;
    } catch (error) {
      console.error('Session validation error:', error);
      return null;
    }
  }

  // Update session access time
  static async updateSessionAccess(sessionId: string): Promise<void> {
    await db.update(userSessions)
      .set({
        lastAccessedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(userSessions.id, sessionId));
  }

  // Refresh access token with rotation
  static async refreshAccessToken(
    refreshToken: string,
    req: Request
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
  } | null> {
    try {
      const { ipAddress, userAgent, deviceFingerprint } = this.extractRequestMetadata(req);

      // Find session by refresh token
      const sessions = await db.select()
        .from(userSessions)
        .where(and(
          eq(userSessions.status, 'active'),
          eq(userSessions.isActive, true),
          gte(userSessions.expiresAt, new Date()),
        ));

      let validSession: any = null;
      for (const session of sessions) {
        if (await this.verifyToken(refreshToken, session.refreshTokenHash)) {
          validSession = session;
          break;
        }
      }

      if (!validSession) {
        return null;
      }

      // Check for anomalies
      const anomalyCheck = await this.detectAnomalies(validSession, req);
      if (anomalyCheck.isAnomalous && anomalyCheck.recommendedAction === 'block') {
        await this.flagSessionAsSuspicious(validSession.id, anomalyCheck.reasons);
        return null;
      }

      // Generate new tokens (rotation)
      const newAccessToken = this.generateSecureToken();
      const newRefreshToken = this.generateSecureToken();
      const newRefreshTokenId = this.generateRefreshTokenId();

      const now = new Date();
      const expiresAt = new Date(now.getTime() + SESSION_CONFIG.accessTokenExpiry * 1000);

      // Hash new tokens
      const accessTokenHash = await this.hashToken(newAccessToken);
      const refreshTokenHash = await this.hashToken(newRefreshToken);

      // Update session with new tokens
      await db.update(userSessions)
        .set({
          accessTokenHash,
          refreshTokenHash,
          refreshTokenId: newRefreshTokenId,
          lastAccessedAt: now,
          updatedAt: now,
          expiresAt,
        })
        .where(eq(userSessions.id, validSession.id));

      // Log refresh activity
      await this.logSessionActivity(validSession.id, validSession.userId, 'refresh', {
        ip: ipAddress,
        userAgent,
        deviceId: deviceFingerprint,
        previousIp: validSession.ipAddress,
      });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresAt,
      };
    } catch (error) {
      console.error('Token refresh error:', error);
      return null;
    }
  }

  // Detect anomalies in session access
  static async detectAnomalies(
    session: any,
    req: Request
  ): Promise<AnomalyDetectionResult> {
    const { ipAddress, userAgent, deviceFingerprint } = this.extractRequestMetadata(req);
    const reasons: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' = 'low';

    // Check IP address change
    if (session.ipAddress && session.ipAddress !== ipAddress) {
      reasons.push('IP address changed');
      riskLevel = 'medium';
    }

    // Check user agent change
    if (session.userAgent && session.userAgent !== userAgent) {
      reasons.push('User agent changed');
      riskLevel = 'medium';
    }

    // Check device fingerprint change
    if (session.deviceFingerprint && session.deviceFingerprint !== deviceFingerprint) {
      reasons.push('Device fingerprint changed');
      riskLevel = 'high';
    }

    // Check for impossible travel (if location data is available)
    if (session.location && req.body?.location) {
      const distance = this.calculateDistance(
        session.location.coordinates,
        req.body.location.coordinates
      );
      const timeDiff = Date.now() - new Date(session.lastAccessedAt).getTime();

      if (distance > 1000 && timeDiff < 3600000) { // >1000km in <1 hour
        reasons.push('Impossible travel detected');
        riskLevel = 'high';
      }
    }

    // Check session age
    const sessionAge = Date.now() - new Date(session.loginAt).getTime();
    if (sessionAge > 30 * 24 * 60 * 60 * 1000) { // 30 days
      reasons.push('Session too old');
      riskLevel = 'medium';
    }

    const isAnomalous = reasons.length > 0;
    let recommendedAction: 'allow' | 'challenge' | 'block' | 'notify' = 'allow';

    if (riskLevel === 'high') {
      recommendedAction = 'block';
    } else if (riskLevel === 'medium') {
      recommendedAction = 'challenge';
    } else if (reasons.length > 0) {
      recommendedAction = 'notify';
    }

    return {
      isAnomalous,
      riskLevel,
      reasons,
      recommendedAction,
    };
  }

  // Calculate distance between two coordinates
  static calculateDistance(
    coord1?: { lat: number; lng: number },
    coord2?: { lat: number; lng: number }
  ): number {
    if (!coord1 || !coord2) return 0;

    const R = 6371; // Earth radius in km
    const dLat = (coord2.lat - coord1.lat) * Math.PI / 180;
    const dLon = (coord2.lng - coord1.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(coord1.lat * Math.PI / 180) * Math.cos(coord2.lat * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  // Flag session as suspicious
  static async flagSessionAsSuspicious(
    sessionId: string,
    reasons: string[]
  ): Promise<void> {
    const session = await db.select()
      .from(userSessions)
      .where(eq(userSessions.id, sessionId))
      .limit(1);

    if (!session[0]) return;

    const suspiciousActivities = [
      ...(session[0].suspiciousActivities || []),
      {
        type: 'anomaly_detected',
        timestamp: new Date().toISOString(),
        details: { reasons },
        ipAddress: session[0].ipAddress,
        userAgent: session[0].userAgent,
      },
    ];

    await db.update(userSessions)
      .set({
        status: 'suspicious',
        suspiciousActivities,
        riskScore: Math.min(parseFloat(session[0].riskScore?.toString() || '0') + reasons.length * 0.5, 10),
        updatedAt: new Date(),
      })
      .where(eq(userSessions.id, sessionId));
  }

  // Revoke session
  static async revokeSession(
    sessionId: string,
    reason: string = 'user_logout'
  ): Promise<void> {
    await db.update(userSessions)
      .set({
        status: 'revoked',
        isActive: false,
        revokedAt: new Date(),
        revokedReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(userSessions.sessionId, sessionId));
  }

  // Revoke all user sessions
  static async revokeAllUserSessions(
    userId: string,
    reason: string = 'user_request'
  ): Promise<void> {
    await db.update(userSessions)
      .set({
        status: 'revoked',
        isActive: false,
        revokedAt: new Date(),
        revokedReason: reason,
        updatedAt: new Date(),
      })
      .where(and(
        eq(userSessions.userId, userId),
        eq(userSessions.status, 'active'),
      ));
  }

  // Get user sessions
  static async getUserSessions(userId: string): Promise<SessionData[]> {
    const sessions = await db.select()
      .from(userSessions)
      .where(and(
        eq(userSessions.userId, userId),
        eq(userSessions.isActive, true),
      ))
      .orderBy(desc(userSessions.lastAccessedAt));

    return sessions.map(session => ({
      id: session.id,
      userId: session.userId,
      sessionId: session.sessionId,
      status: session.status,
      sessionType: session.sessionType,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      deviceFingerprint: session.deviceFingerprint,
      lastAccessedAt: session.lastAccessedAt,
      expiresAt: session.expiresAt,
      loginAt: session.loginAt,
      riskScore: parseFloat(session.riskScore?.toString() || '0'),
      metadata: session.metadata,
    }));
  }

  // Cleanup expired sessions
  static async cleanupExpiredSessions(): Promise<number> {
    const now = new Date();

    const result = await db.update(userSessions)
      .set({
        status: 'expired',
        isActive: false,
        updatedAt: now,
      })
      .where(and(
        eq(userSessions.status, 'active'),
        lt(userSessions.expiresAt, now),
      ));

    return result.rowCount || 0;
  }

  // Log session activity
  static async logSessionActivity(
    sessionId: string,
    userId: string,
    action: string,
    details?: any
  ): Promise<void> {
    await db.insert(sessionAuditLogs).values({
      sessionId,
      userId,
      action,
      details,
      timestamp: new Date(),
    });
  }

  // Get session analytics
  static async getSessionAnalytics(userId?: string): Promise<{
    totalSessions: number;
    activeSessions: number;
    suspiciousSessions: number;
    averageSessionDuration: number;
    deviceBreakdown: Record<string, number>;
    locationBreakdown: Record<string, number>;
  }> {
    const whereClause = userId ? eq(userSessions.userId, userId) : undefined;

    const sessions = await db.select()
      .from(userSessions)
      .where(whereClause);

    const totalSessions = sessions.length;
    const activeSessions = sessions.filter(s => s.status === 'active' && s.isActive).length;
    const suspiciousSessions = sessions.filter(s => s.status === 'suspicious').length;

    // Calculate average session duration
    const completedSessions = sessions.filter(s => s.logoutAt);
    const avgDuration = completedSessions.length > 0
      ? completedSessions.reduce((acc, s) => {
          const duration = s.logoutAt!.getTime() - s.loginAt.getTime();
          return acc + duration;
        }, 0) / completedSessions.length / (1000 * 60) // Convert to minutes
      : 0;

    // Device breakdown
    const deviceBreakdown = sessions.reduce((acc, s) => {
      const device = s.metadata?.device || 'Unknown';
      acc[device] = (acc[device] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Location breakdown
    const locationBreakdown = sessions.reduce((acc, s) => {
      const country = s.location?.country || 'Unknown';
      acc[country] = (acc[country] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalSessions,
      activeSessions,
      suspiciousSessions,
      averageSessionDuration: Math.round(avgDuration),
      deviceBreakdown,
      locationBreakdown,
    };
  }

  // GDPR compliance: Delete user sessions
  static async deleteUserSessions(userId: string): Promise<void> {
    // Soft delete by updating records
    await db.update(userSessions)
      .set({
        isActive: false,
        status: 'revoked',
        revokedReason: 'gdpr_request',
        revokedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(userSessions.userId, userId));

    // Clear audit logs after retention period (or anonymize them)
    await db.update(sessionAuditLogs)
      .set({
        userId: null, // Anonymize
      })
      .where(eq(sessionAuditLogs.userId, userId));
  }

  // Initialize cleanup on module load
  static {
    this.initialize();
  }
}

export default SessionService;