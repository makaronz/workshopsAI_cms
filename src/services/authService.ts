import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { Request } from 'express';
import { db, RLSHelper } from '../config/postgresql-database';
import { redisService } from '../config/redis';
import { users, auditLogs, consents } from '../models/postgresql-schema';
import { eq, and, desc } from 'drizzle-orm';

// JWT configuration
const JWT_SECRET =
  process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = '15m'; // 15 minutes for access token
const REFRESH_TOKEN_SECRET =
  process.env.REFRESH_TOKEN_SECRET || 'your-refresh-secret-key';
const REFRESH_TOKEN_EXPIRES_IN = '7d'; // 7 days for refresh token

// Password configuration
const SALT_ROUNDS = parseInt(process.env.SALT_ROUNDS || '12');

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

// Authentication service class
export class AuthService {
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

  // Generate session ID
  static generateSessionId(): string {
    return randomBytes(32).toString('hex');
  }

  // Generate access token
  static generateAccessToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  }

  // Generate refresh token
  static generateRefreshToken(): string {
    return randomBytes(64).toString('hex');
  }

  // Verify access token
  static verifyAccessToken(token: string): JWTPayload {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  }

  // Verify refresh token format (not JWT, just a random string)
  static isValidRefreshTokenFormat(token: string): boolean {
    return token.length === 128 && /^[a-f0-9]+$/i.test(token);
  }

  // Find user by email
  static async findUserByEmail(email: string) {
    const user = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.email, email.toLowerCase()),
          eq(users.deletedAt, null as any),
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
      .where(and(eq(users.id, id), eq(users.deletedAt, null as any)))
      .limit(1);
    return user[0] || null;
  }

  // Create user
  static async createUser(userData: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
  }) {
    const hashedPassword = await this.hashPassword(userData.password);

    // Generate openId for local auth
    const openId = `local_${Date.now()}_${Math.random().toString(36).substring(2)}`;

    const newUser = {
      openId,
      name: userData.name,
      email: userData.email.toLowerCase(),
      password: hashedPassword,
      loginMethod: 'local' as const,
      isActive: true,
      emailVerified: false,
      role: userData.role,
    };

    await db.insert(users).values(newUser);

    // Get the inserted user
    const insertedUser = await this.findUserByEmail(userData.email);
    if (!insertedUser) {
      throw new Error('Failed to create user');
    }

    return insertedUser;
  }

  // Validate credentials
  static async validateCredentials(email: string, password: string) {
    const user = await this.findUserByEmail(email);

    if (!user || !user.password || !user.isActive) {
      return null;
    }

    const isValid = await this.verifyPassword(password, user.password);

    if (!isValid) {
      return null;
    }

    return user;
  }

  // Update last login
  static async updateLastLogin(userId: string): Promise<void> {
    await db
      .update(users)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  // Check if user has permission
  static hasPermission(userRole: UserRole, permission: string): boolean {
    const permissions = ROLE_PERMISSIONS[userRole] as string[];
    return permissions.includes('*') || permissions.includes(permission);
  }

  // Check if user can access resource
  static canAccessResource(
    userRole: UserRole,
    action: string,
    resource: string,
  ): boolean {
    const permission = `${action}:${resource}`;
    return this.hasPermission(userRole, permission);
  }

  // Create audit log entry
  static async createAuditLog(
    userId: string | null,
    operation: string,
    tableName: string,
    recordId: string,
    oldValues: any = null,
    newValues: any = null,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    try {
      await db.insert(auditLogs).values({
        userId,
        operation,
        tableName,
        recordId,
        oldValues,
        newValues,
        ipAddress,
        userAgent,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('Failed to create audit log:', error);
    }
  }

  // Record user consent
  static async recordConsent(
    userId: string,
    consentType: string,
    granted: boolean,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    try {
      await db.insert(consents).values({
        userId,
        consentType,
        granted,
        ipAddress,
        userAgent,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error('Failed to record consent:', error);
    }
  }

  // Check user consent
  static async hasUserConsent(
    userId: string,
    consentType: string,
  ): Promise<boolean> {
    try {
      const consent = await db
        .select()
        .from(consents)
        .where(
          and(
            eq(consents.userId, userId),
            eq(consents.consentType, consentType),
            eq(consents.granted, true),
          ),
        )
        .orderBy(desc(consents.createdAt))
        .limit(1);

      return consent.length > 0;
    } catch (error) {
      console.error('Failed to check user consent:', error);
      return false;
    }
  }

  // Login with email/password
  static async login(
    email: string,
    password: string,
    ipAddress?: string,
    userAgent?: string,
    deviceInfo?: string,
  ): Promise<LoginResponse> {
    // Validate credentials
    const user = await this.validateCredentials(email, password);

    if (!user) {
      // Record failed login attempt
      await redisService.recordAuthAttempt(email, ipAddress || 'unknown');

      // Create audit log for failed login attempt
      await this.createAuditLog(
        null,
        'LOGIN_FAILED',
        'users',
        email, // Use email as identifier for failed attempts
        null,
        { email, reason: 'invalid_credentials' },
        ipAddress,
        userAgent,
      );

      throw new Error('Invalid credentials');
    }

    // Check rate limiting
    const attempts = await redisService.getAuthAttempts(
      email,
      ipAddress || 'unknown',
    );
    if (attempts > 5) {
      throw new Error(
        'Too many failed login attempts. Please try again later.',
      );
    }

    // Clear failed attempts on successful login
    await redisService.clearAuthAttempts(email, ipAddress || 'unknown');

    // Generate session ID
    const sessionId = this.generateSessionId();

    // Generate tokens
    const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
      userId: user.id,
      email: user.email,
      role: user.role,
      sessionId,
    };

    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken();

    // Store refresh token in Redis
    await redisService.storeRefreshToken(
      user.id,
      refreshToken,
      deviceInfo,
      ipAddress,
    );

    // Store session data
    await redisService.storeSession(sessionId, {
      userId: user.id,
      email: user.email,
      role: user.role,
      ipAddress,
      userAgent,
      deviceInfo,
      createdAt: new Date().toISOString(),
    });

    // Update last login
    await this.updateLastLogin(user.id);

    // Create audit log for successful login
    await this.createAuditLog(
      user.id,
      'LOGIN',
      'users',
      user.id,
      null,
      { sessionId, refreshToken: '****', deviceInfo },
      ipAddress,
      userAgent,
    );

    // Record consent if this is a new session
    if (!(await this.hasUserConsent(user.id, 'session_tracking'))) {
      await this.recordConsent(
        user.id,
        'session_tracking',
        true,
        ipAddress,
        userAgent,
      );
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerified: user.emailVerified,
        lastLoginAt: user.lastLoginAt || undefined,
      },
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: 15 * 60, // 15 minutes in seconds
        tokenType: 'Bearer',
      },
      sessionId,
    };
  }

  // Refresh access token
  static async refreshToken(
    refreshToken: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ accessToken: string; expiresIn: number; tokenType: string }> {
    // Validate refresh token format
    if (!this.isValidRefreshTokenFormat(refreshToken)) {
      throw new Error('Invalid refresh token format');
    }

    // Find the refresh token in Redis - we need to iterate through user tokens
    // This is less efficient but necessary for security
    // In a production system, you might want to maintain a reverse index
    const users = await db
      .select({ id: users.id, email: users.email, role: users.role })
      .from(users)
      .where(eq(users.isActive, true))
      .limit(1000); // Reasonable limit to prevent scanning entire database

    let tokenData = null;
    let userRecord = null;

    for (const user of users) {
      tokenData = await redisService.getRefreshToken(user.id, refreshToken);
      if (tokenData) {
        userRecord = user;
        break;
      }
    }

    if (!tokenData || !userRecord) {
      throw new Error('Invalid or expired refresh token');
    }

    // Update last used timestamp
    await redisService.updateRefreshTokenUsage(userRecord.id, refreshToken);

    // Generate new access token
    const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
      userId: userRecord.id,
      email: userRecord.email,
      role: userRecord.role,
      sessionId: this.generateSessionId(), // New session ID for refresh
    };

    const accessToken = this.generateAccessToken(payload);

    // Create audit log
    await this.createAuditLog(
      userRecord.id,
      'TOKEN_REFRESH',
      'users',
      userRecord.id,
      null,
      { sessionId: payload.sessionId },
      ipAddress,
      userAgent,
    );

    return {
      accessToken,
      expiresIn: 15 * 60, // 15 minutes
      tokenType: 'Bearer',
    };
  }

  // Logout user
  static async logout(
    userId: string,
    refreshToken: string,
    sessionId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    // Revoke refresh token
    await redisService.revokeRefreshToken(userId, refreshToken);

    // Delete session
    await redisService.deleteSession(sessionId);

    // Create audit log
    await this.createAuditLog(
      userId,
      'LOGOUT',
      'users',
      userId,
      null,
      { sessionId },
      ipAddress,
      userAgent,
    );
  }

  // Logout all sessions for a user
  static async logoutAll(
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    // Revoke all refresh tokens
    await redisService.revokeAllUserTokens(userId);

    // Create audit log
    await this.createAuditLog(
      userId,
      'LOGOUT_ALL',
      'users',
      userId,
      null,
      {},
      ipAddress,
      userAgent,
    );
  }

  // Get user sessions
  static async getUserSessions(userId: string): Promise<any[]> {
    const tokens = await redisService.getUserTokens(userId);
    const sessions = [];

    for (const token of tokens) {
      const tokenData = await redisService.getRefreshToken(userId, token);
      if (tokenData) {
        sessions.push(tokenData);
      }
    }

    return sessions;
  }

  // Extract request metadata
  static extractRequestMetadata(req: Request): {
    ipAddress: string;
    userAgent: string;
    deviceInfo: string;
  } {
    const ipAddress =
      req.ip ||
      (req.headers['x-forwarded-for'] as string) ||
      (req.headers['x-real-ip'] as string) ||
      req.connection.remoteAddress ||
      'unknown';

    const userAgent = req.headers['user-agent'] || 'unknown';

    // Simple device detection
    let deviceInfo = 'unknown';
    if (userAgent.includes('Mobile')) {
      deviceInfo = 'mobile';
    } else if (userAgent.includes('Tablet')) {
      deviceInfo = 'tablet';
    } else if (userAgent.includes('Desktop') || userAgent.includes('Mozilla')) {
      deviceInfo = 'desktop';
    }

    return {
      ipAddress: Array.isArray(ipAddress) ? ipAddress[0] : ipAddress,
      userAgent,
      deviceInfo,
    };
  }
}

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: UserRole;
        sessionId: string;
      };
    }
  }
}
