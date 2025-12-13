/**
 * PostgreSQL-based Authentication Service
 *
 * This service provides authentication functionality using PostgreSQL
 * for session management instead of Redis.
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Request } from 'express';
import { db, RLSHelper } from '../config/postgresql-database';
import { users, auditLogs, consents } from '../models/postgresql-schema';
import { eq, and, desc, isNull } from 'drizzle-orm';
import SessionService from './sessionService';

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = '15m'; // 15 minutes for access token

// Password configuration
const SALT_ROUNDS = parseInt(process.env.SALT_ROUNDS || '12');

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const MAX_LOGIN_ATTEMPTS = 5;

// Failed login attempts tracking (in production, use Redis or database)
const failedAttempts = new Map<string, { count: number; resetTime: number }>();

// User roles
export type UserRole =
  | 'participant'
  | 'facilitator'
  | 'moderator'
  | 'sociologist-editor'
  | 'admin';

// Role permissions
export const ROLE_PERMISSIONS = {
  participant: [
    'read:own-profile',
    'read:workshops',
    'create:enrollment',
    'read:own-enrollments',
    'create:feedback',
    'create:questionnaire-response',
  ],
  facilitator: [
    'read:own-profile',
    'read:workshops',
    'read:own-workshops',
    'update:own-workshops',
    'read:enrollments',
    'read:feedback',
    'read:questionnaires',
    'create:announcements',
  ],
  moderator: [
    'read:all-profiles',
    'read:workshops',
    'create:workshops',
    'update:workshops',
    'read:enrollments',
    'update:enrollments',
    'manage:feedback',
    'manage:questionnaires',
  ],
  'sociologist-editor': [
    'read:all-profiles',
    'create:workshops',
    'read:workshops',
    'update:workshops',
    'delete:workshops',
    'read:enrollments',
    'manage:facilitators',
    'read:facilitators',
    'read:feedback',
    'manage:questionnaires',
    'create:llm-analysis',
    'read:analytics',
  ],
  admin: ['*'], // All permissions
} as const;

// JWT Token interfaces
export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  sessionId: string;
  iat?: number;
  exp?: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

export interface LoginResponse {
  user: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    emailVerified: boolean;
    lastLoginAt?: Date;
  };
  tokens: AuthTokens;
  sessionId: string;
}

export interface CreateUserData {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
}

export interface SessionCreateOptions {
  sessionType?: 'web' | 'mobile' | 'api' | 'desktop';
  rememberMe?: boolean;
  deviceInfo?: {
    browser: string;
    os: string;
    device: string;
    language: string;
    timezone: string;
  };
  location?: {
    country?: string;
    city?: string;
    coordinates?: { lat: number; lng: number };
  };
}

// Authentication service class
export class AuthServicePostgreSQL {
  // Hash password
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  // Verify password
  static async verifyPassword(
    password: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  // Generate JWT access token
  static generateAccessToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  }

  // Verify JWT access token
  static verifyAccessToken(token: string): JWTPayload {
    try {
      return jwt.verify(token, JWT_SECRET) as JWTPayload;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  // Extract request metadata
  static extractRequestMetadata(req: Request): {
    ipAddress: string;
    userAgent: string;
    deviceInfo: any;
  } {
    const ipAddress = req.ip ||
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string) ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      'unknown';

    const userAgent = req.headers['user-agent'] || '';

    // Parse device info from user agent
    const deviceInfo = SessionService.parseUserAgent(userAgent);

    return {
      ipAddress,
      userAgent,
      deviceInfo,
    };
  }

  // Check rate limiting for login attempts
  static checkRateLimit(identifier: string): boolean {
    const now = Date.now();
    const attempts = failedAttempts.get(identifier);

    if (!attempts || now > attempts.resetTime) {
      // Reset or initialize attempts
      failedAttempts.set(identifier, {
        count: 1,
        resetTime: now + RATE_LIMIT_WINDOW,
      });
      return true;
    }

    if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
      return false; // Rate limited
    }

    attempts.count++;
    return true;
  }

  // Clear failed attempts on successful login
  static clearFailedAttempts(identifier: string): void {
    failedAttempts.delete(identifier);
  }

  // Find user by email
  static async findUserByEmail(email: string) {
    const user = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.email, email.toLowerCase()),
          isNull(users.deletedAt),
        ),
      )
      .limit(1);
    return user[0] || null;
  }

  // Find user by ID
  static async findUserById(id: string) {
    const user = await db
      .select()
      .from(users)
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .limit(1);
    return user[0] || null;
  }

  // Create user
  static async createUser(userData: CreateUserData) {
    const { name, email, password, role = 'participant' } = userData;

    // Check if user already exists
    const existingUser = await this.findUserByEmail(email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await this.hashPassword(password);

    // Generate unique OpenID
    const openId = `local:${email.toLowerCase()}`;

    // Create user
    const [newUser] = await db
      .insert(users)
      .values({
        name,
        email: email.toLowerCase(),
        password: hashedPassword,
        openId,
        role,
        isActive: true,
        emailVerified: false,
      })
      .returning();

    // Remove password from response
    const { password: _, ...userWithoutPassword } = newUser;
    return userWithoutPassword;
  }

  // Login user
  static async login(
    email: string,
    password: string,
    ipAddress: string,
    userAgent: string,
    deviceInfo?: any,
    options?: SessionCreateOptions
  ): Promise<LoginResponse> {
    // Check rate limiting
    if (!this.checkRateLimit(email)) {
      throw new Error(`Too many failed login attempts. Please try again later.`);
    }

    // Find user
    const user = await this.findUserByEmail(email);
    if (!user || !user.password) {
      await this.logFailedAttempt(email, ipAddress, userAgent);
      throw new Error('Invalid credentials');
    }

    // Verify password
    const isValidPassword = await this.verifyPassword(password, user.password);
    if (!isValidPassword) {
      await this.logFailedAttempt(email, ipAddress, userAgent);
      throw new Error('Invalid credentials');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new Error('Account is deactivated');
    }

    // Clear failed attempts
    this.clearFailedAttempts(email);

    // Create session using SessionService
    const req = {
      headers: { 'user-agent': userAgent },
      ip: ipAddress,
      body: {},
    } as Request;

    const sessionResult = await SessionService.createSession(user.id, req, {
      sessionType: options?.sessionType || 'web',
      rememberMe: options?.rememberMe,
      deviceInfo: options?.deviceInfo || deviceInfo,
      location: options?.location,
    });

    // Create JWT payload
    const jwtPayload: JWTPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      sessionId: sessionResult.sessionId,
    };

    const accessToken = this.generateAccessToken(jwtPayload);

    // Create audit log
    await this.createAuditLog(
      user.id,
      'users',
      user.id,
      'LOGIN',
      null,
      {
        ip: ipAddress,
        userAgent,
        sessionId: sessionResult.sessionId,
      },
      ipAddress,
      userAgent
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerified: user.emailVerified,
        lastLoginAt: user.lastLoginAt,
      },
      tokens: {
        accessToken,
        refreshToken: sessionResult.refreshToken,
        expiresIn: 15 * 60, // 15 minutes
        tokenType: 'Bearer',
      },
      sessionId: sessionResult.sessionId,
    };
  }

  // Refresh access token
  static async refreshToken(
    refreshToken: string,
    ipAddress: string,
    userAgent: string
  ): Promise<AuthTokens> {
    const req = {
      headers: { 'user-agent': userAgent },
      ip: ipAddress,
      body: {},
    } as Request;

    const sessionResult = await SessionService.refreshAccessToken(refreshToken, req);

    if (!sessionResult) {
      throw new Error('Invalid or expired refresh token');
    }

    // Get session data to create JWT
    const session = await SessionService.validateSession(sessionResult.accessToken);
    if (!session) {
      throw new Error('Session validation failed');
    }

    // Get user data
    const user = await this.findUserById(session.userId);
    if (!user || !user.isActive) {
      throw new Error('User not found or inactive');
    }

    // Create new JWT
    const jwtPayload: JWTPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      sessionId: session.sessionId,
    };

    const accessToken = this.generateAccessToken(jwtPayload);

    // Create audit log
    await this.createAuditLog(
      user.id,
      'user_sessions',
      session.id,
      'TOKEN_REFRESH',
      null,
      {
        ip: ipAddress,
        userAgent,
      },
      ipAddress,
      userAgent
    );

    return {
      accessToken,
      refreshToken: sessionResult.refreshToken,
      expiresIn: 15 * 60,
      tokenType: 'Bearer',
    };
  }

  // Logout user
  static async logout(
    userId: string,
    refreshToken: string,
    sessionId: string,
    ipAddress: string,
    userAgent: string
  ): Promise<void> {
    // Revoke session
    await SessionService.revokeSession(sessionId, 'user_logout');

    // Create audit log
    await this.createAuditLog(
      userId,
      'user_sessions',
      sessionId,
      'LOGOUT',
      null,
      {
        ip: ipAddress,
        userAgent,
      },
      ipAddress,
      userAgent
    );
  }

  // Logout user from all devices
  static async logoutAll(
    userId: string,
    ipAddress: string,
    userAgent: string
  ): Promise<void> {
    // Revoke all sessions
    await SessionService.revokeAllUserSessions(userId, 'user_logout_all');

    // Create audit log
    await this.createAuditLog(
      userId,
      'users',
      userId,
      'LOGOUT_ALL',
      null,
      {
        ip: ipAddress,
        userAgent,
      },
      ipAddress,
      userAgent
    );
  }

  // Get user sessions
  static async getUserSessions(userId: string) {
    return await SessionService.getUserSessions(userId);
  }

  // Record consent
  static async recordConsent(
    userId: string,
    consentType: string,
    granted: boolean,
    ipAddress: string,
    userAgent: string
  ): Promise<void> {
    await db.insert(consents).values({
      userId,
      consentType,
      granted,
      ipAddress,
      userAgent,
    });
  }

  // Create audit log
  static async createAuditLog(
    userId: string | null,
    tableName: string,
    recordId: string,
    operation: string,
    oldValues: any = null,
    newValues: any = null,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      await db.insert(auditLogs).values({
        userId,
        tableName,
        recordId,
        operation,
        oldValues: oldValues ? JSON.stringify(oldValues) : null,
        newValues: newValues ? JSON.stringify(newValues) : null,
        ipAddress,
        userAgent,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('Failed to create audit log:', error);
    }
  }

  // Log failed login attempt
  private static async logFailedAttempt(
    email: string,
    ipAddress: string,
    userAgent: string
  ): Promise<void> {
    try {
      // Log to audit logs if user exists
      const user = await this.findUserByEmail(email);
      if (user) {
        await this.createAuditLog(
          user.id,
          'users',
          user.id,
          'LOGIN_FAILED',
          null,
          {
            reason: 'invalid_credentials',
            ip: ipAddress,
            userAgent,
          },
          ipAddress,
          userAgent
        );
      }
    } catch (error) {
      console.error('Failed to log failed attempt:', error);
    }
  }

  // GDPR compliance: Delete user data
  static async deleteUserData(userId: string): Promise<void> {
    // Delete sessions
    await SessionService.deleteUserSessions(userId);

    // Soft delete user
    await db
      .update(users)
      .set({
        isActive: false,
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    // Create audit log
    await this.createAuditLog(
      userId,
      'users',
      userId,
      'GDPR_DELETE',
      null,
      null,
    );
  }

  // Change password
  static async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    ipAddress: string,
    userAgent: string
  ): Promise<void> {
    // Get user with password
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user || !user.password) {
      throw new Error('User not found');
    }

    // Verify current password
    const isValidPassword = await this.verifyPassword(currentPassword, user.password);
    if (!isValidPassword) {
      throw new Error('Current password is incorrect');
    }

    // Hash new password
    const hashedNewPassword = await this.hashPassword(newPassword);

    // Update password
    await db
      .update(users)
      .set({
        password: hashedNewPassword,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    // Revoke all sessions for security
    await SessionService.revokeAllUserSessions(userId, 'password_change');

    // Create audit log
    await this.createAuditLog(
      userId,
      'users',
      userId,
      'PASSWORD_CHANGE',
      null,
      {
        ip: ipAddress,
        userAgent,
      },
      ipAddress,
      userAgent
    );
  }
}

export default AuthServicePostgreSQL;