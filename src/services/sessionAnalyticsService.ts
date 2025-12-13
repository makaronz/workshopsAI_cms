/**
 * Session Analytics Service
 *
 * Provides analytics and monitoring capabilities for session management.
 * Includes real-time monitoring, security alerts, and detailed reporting.
 */

import { db } from '../config/postgresql-database';
import { userSessions, sessionAuditLogs, users } from '../models/postgresql-schema';
import { eq, and, desc, gte, lt, sql } from 'drizzle-orm';
import { SessionService } from './sessionService';

// Analytics interfaces
export interface SessionMetrics {
  totalSessions: number;
  activeSessions: number;
  expiredSessions: number;
  revokedSessions: number;
  suspiciousSessions: number;
  averageSessionDuration: number;
  totalUsers: number;
  newUsersToday: number;
  loginAttemptsToday: number;
  failedLoginsToday: number;
  uniqueIPs: number;
  topDevices: Array<{ device: string; count: number }>;
  topLocations: Array<{ country: string; count: number }>;
  riskDistribution: {
    low: number;
    medium: number;
    high: number;
  };
}

export interface SecurityAlert {
  id: string;
  type: 'suspicious_login' | 'impossible_travel' | 'brute_force' | 'anomaly_detected';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  timestamp: Date;
  details?: any;
  resolved: boolean;
}

export interface SessionReport {
  dateRange: {
    start: Date;
    end: Date;
  };
  summary: SessionMetrics;
  trends: {
    daily: Array<{
      date: string;
      sessions: number;
      users: number;
      avgDuration: number;
    }>;
    hourly: Array<{
      hour: number;
      sessions: number;
      logins: number;
    }>;
  };
  securityEvents: Array<{
    type: string;
    count: number;
    percentage: number;
  }>;
}

export class SessionAnalyticsService {
  // Get real-time session metrics
  static async getRealTimeMetrics(): Promise<SessionMetrics> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Execute queries in parallel
    const [
      totalSessionsResult,
      activeSessionsResult,
      expiredSessionsResult,
      revokedSessionsResult,
      suspiciousSessionsResult,
      completedSessionsResult,
      uniqueUsersResult,
      newUsersResult,
      todayLoginsResult,
      todayFailedLoginsResult,
      deviceBreakdown,
      locationBreakdown,
    ] = await Promise.all([
      // Total sessions
      db.select({ count: sql<number>`count(*)` }).from(userSessions),

      // Active sessions
      db.select({ count: sql<number>`count(*)` })
        .from(userSessions)
        .where(and(
          eq(userSessions.status, 'active'),
          eq(userSessions.isActive, true),
          gte(userSessions.expiresAt, now),
        )),

      // Expired sessions
      db.select({ count: sql<number>`count(*)` })
        .from(userSessions)
        .where(eq(userSessions.status, 'expired')),

      // Revoked sessions
      db.select({ count: sql<number>`count(*)` })
        .from(userSessions)
        .where(eq(userSessions.status, 'revoked')),

      // Suspicious sessions
      db.select({ count: sql<number>`count(*)` })
        .from(userSessions)
        .where(eq(userSessions.status, 'suspicious')),

      // Completed sessions (for duration calculation)
      db.select({
        avgDuration: sql<number>`AVG(EXTRACT(EPOCH FROM (logout_at - login_at)))`
      })
        .from(userSessions)
        .where(and(
          eq(userSessions.status, 'revoked'),
          sql`logout_at IS NOT NULL`,
        )),

      // Unique users
      db.select({ count: sql<number>`count(DISTINCT user_id)` }).from(userSessions),

      // New users today
      db.select({ count: sql<number>`count(*)` })
        .from(users)
        .where(gte(users.createdAt, todayStart)),

      // Login attempts today
      db.select({ count: sql<number>`count(*)` })
        .from(sessionAuditLogs)
        .where(and(
          eq(sessionAuditLogs.action, 'login'),
          gte(sessionAuditLogs.timestamp, todayStart),
        )),

      // Failed logins today
      db.select({ count: sql<number>`count(*)` })
        .from(sessionAuditLogs)
        .where(and(
          eq(sessionAuditLogs.action, 'login_failed'),
          gte(sessionAuditLogs.timestamp, todayStart),
        )),

      // Device breakdown
      db.select({
        device: sql<string>`metadata->>'device'`,
        count: sql<number>`count(*)`,
      })
        .from(userSessions)
        .groupBy(sql`metadata->>'device'`)
        .orderBy(desc(sql`count(*)`))
        .limit(5),

      // Location breakdown
      db.select({
        country: sql<string>`location->>'country'`,
        count: sql<number>`count(*)`,
      })
        .from(userSessions)
        .where(sql`location IS NOT NULL`)
        .groupBy(sql`location->>'country'`)
        .orderBy(desc(sql`count(*)`))
        .limit(5),
    ]);

    // Calculate unique IPs
    const uniqueIPsResult = await db
      .select({ count: sql<number>`count(DISTINCT ip_address)` })
      .from(userSessions);

    // Calculate risk distribution
    const riskDistribution = await db
      .select({
        range: sql<string>`
          CASE
            WHEN risk_score < 3 THEN 'low'
            WHEN risk_score < 7 THEN 'medium'
            ELSE 'high'
          END
        `,
        count: sql<number>`count(*)`,
      })
      .from(userSessions)
      .groupBy(sql`
        CASE
          WHEN risk_score < 3 THEN 'low'
          WHEN risk_score < 7 THEN 'medium'
          ELSE 'high'
        END
      `);

    const riskDist = { low: 0, medium: 0, high: 0 };
    riskDistribution.forEach(r => {
      riskDist[r.range as keyof typeof riskDist] = parseInt(r.count.toString());
    });

    return {
      totalSessions: parseInt(totalSessionsResult[0].count.toString()),
      activeSessions: parseInt(activeSessionsResult[0].count.toString()),
      expiredSessions: parseInt(expiredSessionsResult[0].count.toString()),
      revokedSessions: parseInt(revokedSessionsResult[0].count.toString()),
      suspiciousSessions: parseInt(suspiciousSessionsResult[0].count.toString()),
      averageSessionDuration: Math.round(parseFloat(completedSessionsResult[0].avgDuration?.toString() || '0')),
      totalUsers: parseInt(uniqueUsersResult[0].count.toString()),
      newUsersToday: parseInt(newUsersResult[0].count.toString()),
      loginAttemptsToday: parseInt(todayLoginsResult[0].count.toString()),
      failedLoginsToday: parseInt(todayFailedLoginsResult[0].count.toString()),
      uniqueIPs: parseInt(uniqueIPsResult[0].count.toString()),
      topDevices: deviceBreakdown.map(d => ({
        device: d.device || 'Unknown',
        count: parseInt(d.count.toString()),
      })),
      topLocations: locationBreakdown.map(l => ({
        country: l.country || 'Unknown',
        count: parseInt(l.count.toString()),
      })),
      riskDistribution: riskDist,
    };
  }

  // Get session trends over time
  static async getSessionTrends(days: number = 30): Promise<{
    daily: Array<{
      date: string;
      sessions: number;
      users: number;
      avgDuration: number;
    }>;
    hourly: Array<{
      hour: number;
      sessions: number;
      logins: number;
    }>;
  }> {
    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    // Daily trends
    const dailyTrends = await db
      .select({
        date: sql<string>`DATE_TRUNC('day', created_at)::date`,
        sessions: sql<number>`count(*)`,
        users: sql<number>`count(DISTINCT user_id)`,
      })
      .from(userSessions)
      .where(gte(userSessions.createdAt, startDate))
      .groupBy(sql`DATE_TRUNC('day', created_at)::date`)
      .orderBy(sql`DATE_TRUNC('day', created_at)::date`);

    // Get average duration for each day
    const dailyDurations = await db
      .select({
        date: sql<string>`DATE_TRUNC('day', login_at)::date`,
        avgDuration: sql<number>`AVG(EXTRACT(EPOCH FROM (COALESCE(logout_at, NOW()) - login_at)))`,
      })
      .from(userSessions)
      .where(and(
        gte(userSessions.loginAt, startDate),
        sql`logout_at IS NOT NULL OR login_at > NOW() - INTERVAL '24 hours'`,
      ))
      .groupBy(sql`DATE_TRUNC('day', login_at)::date`);

    // Combine daily trends with durations
    const daily = dailyTrends.map(day => {
      const duration = dailyDurations.find(d => d.date === day.date);
      return {
        date: day.date,
        sessions: parseInt(day.sessions.toString()),
        users: parseInt(day.users.toString()),
        avgDuration: Math.round(parseFloat(duration?.avgDuration?.toString() || '0')),
      };
    });

    // Hourly trends (last 24 hours)
    const hourlyStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const hourlyTrends = await db
      .select({
        hour: sql<number>`EXTRACT(HOUR FROM created_at)`,
        sessions: sql<number>`count(*)`,
      })
      .from(userSessions)
      .where(gte(userSessions.createdAt, hourlyStart))
      .groupBy(sql`EXTRACT(HOUR FROM created_at)`);

    // Hourly login trends
    const hourlyLogins = await db
      .select({
        hour: sql<number>`EXTRACT(HOUR FROM timestamp)`,
        logins: sql<number>`count(*)`,
      })
      .from(sessionAuditLogs)
      .where(and(
        eq(sessionAuditLogs.action, 'login'),
        gte(sessionAuditLogs.timestamp, hourlyStart),
      ))
      .groupBy(sql`EXTRACT(HOUR FROM timestamp)`);

    // Combine hourly data
    const hourly = Array.from({ length: 24 }, (_, i) => {
      const sessionsData = hourlyTrends.find(h => parseInt(h.hour.toString()) === i);
      const loginsData = hourlyLogins.find(h => parseInt(h.hour.toString()) === i);

      return {
        hour: i,
        sessions: parseInt(sessionsData?.sessions.toString() || '0'),
        logins: parseInt(loginsData?.logins.toString() || '0'),
      };
    });

    return { daily, hourly };
  }

  // Get security alerts
  static async getSecurityAlerts(limit: number = 50): Promise<SecurityAlert[]> {
    const alerts: SecurityAlert[] = [];

    // Get suspicious sessions
    const suspiciousSessions = await db
      .select()
      .from(userSessions)
      .where(eq(userSessions.status, 'suspicious'))
      .orderBy(desc(userSessions.updatedAt))
      .limit(limit);

    suspiciousSessions.forEach(session => {
      alerts.push({
        id: `suspicious-${session.id}`,
        type: 'suspicious_login',
        severity: session.riskScore > 7 ? 'high' : 'medium',
        message: `Suspicious activity detected from ${session.ipAddress}`,
        userId: session.userId,
        sessionId: session.sessionId,
        ipAddress: session.ipAddress,
        timestamp: session.updatedAt,
        details: {
          riskScore: session.riskScore,
          activities: session.suspiciousActivities,
        },
        resolved: false,
      });
    });

    // Get failed login attempts (potential brute force)
    const failedLogins = await db
      .select({
        ipAddress: sessionAuditLogs.ipAddress,
        count: sql<number>`count(*)`,
        lastAttempt: sql<Date>`MAX(timestamp)`,
      })
      .from(sessionAuditLogs)
      .where(and(
        eq(sessionAuditLogs.action, 'login_failed'),
        gte(sessionAuditLogs.timestamp, new Date(Date.now() - 60 * 60 * 1000)), // Last hour
      ))
      .groupBy(sessionAuditLogs.ipAddress)
      .having(sql`count(*) >= 5`);

    failedLogins.forEach(attempt => {
      alerts.push({
        id: `bruteforce-${attempt.ipAddress}`,
        type: 'brute_force',
        severity: attempt.count > 10 ? 'high' : 'medium',
        message: `${attempt.count} failed login attempts from ${attempt.ipAddress}`,
        ipAddress: attempt.ipAddress,
        timestamp: attempt.lastAttempt,
        details: {
          attempts: parseInt(attempt.count.toString()),
          timeWindow: '1 hour',
        },
        resolved: false,
      });
    });

    // Sort by severity and timestamp
    alerts.sort((a, b) => {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const aSeverity = severityOrder[a.severity];
      const bSeverity = severityOrder[b.severity];

      if (aSeverity !== bSeverity) {
        return bSeverity - aSeverity;
      }

      return b.timestamp.getTime() - a.timestamp.getTime();
    });

    return alerts.slice(0, limit);
  }

  // Generate session report
  static async generateSessionReport(
    startDate: Date,
    endDate: Date,
    userId?: string
  ): Promise<SessionReport> {
    // Get summary metrics
    const metrics = await this.getReportMetrics(startDate, endDate, userId);

    // Get trends
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const trends = await this.getSessionTrends(daysDiff);

    // Get security events
    const securityEvents = await this.getSecurityEventsSummary(startDate, endDate, userId);

    return {
      dateRange: {
        start: startDate,
        end: endDate,
      },
      summary: metrics,
      trends: {
        daily: trends.daily.filter(d =>
          new Date(d.date) >= startDate && new Date(d.date) <= endDate
        ),
        hourly: trends.hourly,
      },
      securityEvents,
    };
  }

  // Helper: Get report metrics
  private static async getReportMetrics(
    startDate: Date,
    endDate: Date,
    userId?: string
  ): Promise<SessionMetrics> {
    const baseQuery = userId
      ? eq(userSessions.userId, userId)
      : sql`1=1`;

    const [
      totalResult,
      activeResult,
      completedResult,
      uniqueUsersResult,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)` })
        .from(userSessions)
        .where(and(
          baseQuery,
          gte(userSessions.createdAt, startDate),
          lt(userSessions.createdAt, endDate),
        )),

      db.select({ count: sql<number>`count(*)` })
        .from(userSessions)
        .where(and(
          baseQuery,
          eq(userSessions.status, 'active'),
          gte(userSessions.expiresAt, new Date()),
        )),

      db.select({
        avgDuration: sql<number>`AVG(EXTRACT(EPOCH FROM (COALESCE(logout_at, NOW()) - login_at)))`,
      })
        .from(userSessions)
        .where(and(
          baseQuery,
          gte(userSessions.loginAt, startDate),
          lt(userSessions.loginAt, endDate),
          sql`logout_at IS NOT NULL OR login_at > NOW() - INTERVAL '24 hours'`,
        )),

      db.select({ count: sql<number>`count(DISTINCT user_id)` })
        .from(userSessions)
        .where(and(
          baseQuery,
          gte(userSessions.createdAt, startDate),
          lt(userSessions.createdAt, endDate),
        )),
    ]);

    return {
      totalSessions: parseInt(totalResult[0].count.toString()),
      activeSessions: parseInt(activeResult[0].count.toString()),
      expiredSessions: 0,
      revokedSessions: 0,
      suspiciousSessions: 0,
      averageSessionDuration: Math.round(parseFloat(completedResult[0].avgDuration?.toString() || '0')),
      totalUsers: parseInt(uniqueUsersResult[0].count.toString()),
      newUsersToday: 0,
      loginAttemptsToday: 0,
      failedLoginsToday: 0,
      uniqueIPs: 0,
      topDevices: [],
      topLocations: [],
      riskDistribution: { low: 0, medium: 0, high: 0 },
    };
  }

  // Helper: Get security events summary
  private static async getSecurityEventsSummary(
    startDate: Date,
    endDate: Date,
    userId?: string
  ): Promise<Array<{ type: string; count: number; percentage: number }>> {
    const baseQuery = userId
      ? eq(sessionAuditLogs.userId, userId)
      : sql`1=1`;

    const events = await db
      .select({
        type: sessionAuditLogs.action,
        count: sql<number>`count(*)`,
      })
      .from(sessionAuditLogs)
      .where(and(
        baseQuery,
        gte(sessionAuditLogs.timestamp, startDate),
        lt(sessionAuditLogs.timestamp, endDate),
        sql`action IN ('login_failed', 'suspicious_activity', 'token_refresh')`,
      ))
      .groupBy(sessionAuditLogs.action);

    const total = events.reduce((sum, e) => sum + parseInt(e.count.toString()), 0);

    return events.map(e => ({
      type: e.type,
      count: parseInt(e.count.toString()),
      percentage: total > 0 ? (parseInt(e.count.toString()) / total) * 100 : 0,
    }));
  }

  // Get user session history
  static async getUserSessionHistory(
    userId: string,
    limit: number = 50
  ): Promise<Array<{
    sessionId: string;
    sessionType: string;
    ipAddress: string;
    userAgent: string;
    loginAt: Date;
    logoutAt?: Date;
    duration?: number;
    status: string;
    riskScore: number;
  }>> {
    const sessions = await db
      .select({
        sessionId: userSessions.sessionId,
        sessionType: userSessions.sessionType,
        ipAddress: userSessions.ipAddress,
        userAgent: userSessions.userAgent,
        loginAt: userSessions.loginAt,
        logoutAt: userSessions.logoutAt,
        duration: sql<number>`EXTRACT(EPOCH FROM (COALESCE(logout_at, NOW()) - login_at))`,
        status: userSessions.status,
        riskScore: userSessions.riskScore,
      })
      .from(userSessions)
      .where(eq(userSessions.userId, userId))
      .orderBy(desc(userSessions.loginAt))
      .limit(limit);

    return sessions.map(s => ({
      sessionId: s.sessionId,
      sessionType: s.sessionType,
      ipAddress: s.ipAddress || '',
      userAgent: s.userAgent || '',
      loginAt: s.loginAt,
      logoutAt: s.logoutAt || undefined,
      duration: s.duration ? Math.round(parseFloat(s.duration.toString())) : undefined,
      status: s.status,
      riskScore: parseFloat(s.riskScore?.toString() || '0'),
    }));
  }

  // Export session data (GDPR/Compliance)
  static async exportUserData(userId: string): Promise<{
    sessions: Array<any>;
    auditLogs: Array<any>;
  }> {
    const [sessions, auditLogs] = await Promise.all([
      // User sessions
      db
        .select()
        .from(userSessions)
        .where(eq(userSessions.userId, userId))
        .orderBy(desc(userSessions.createdAt)),

      // Session audit logs
      db
        .select()
        .from(sessionAuditLogs)
        .where(eq(sessionAuditLogs.userId, userId))
        .orderBy(desc(sessionAuditLogs.timestamp)),
    ]);

    return {
      sessions,
      auditLogs,
    };
  }

  // Cleanup old data
  static async cleanupOldData(retentionDays: number = 365): Promise<{
    sessionsDeleted: number;
    auditLogsDeleted: number;
  }> {
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    const [sessionsDeleted, auditLogsDeleted] = await Promise.all([
      // Delete old revoked/expired sessions
      db.delete(userSessions)
        .where(and(
          lt(userSessions.updatedAt, cutoffDate),
          sql`status IN ('revoked', 'expired')`,
        ))
        .then(result => result.rowCount || 0),

      // Delete old audit logs
      db.delete(sessionAuditLogs)
        .where(lt(sessionAuditLogs.timestamp, cutoffDate))
        .then(result => result.rowCount || 0),
    ]);

    return {
      sessionsDeleted: sessionsDeleted,
      auditLogsDeleted: auditLogsDeleted,
    };
  }
}

export default SessionAnalyticsService;