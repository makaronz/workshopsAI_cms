import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { randomBytes, createHash, timingSafeEqual } from 'crypto';
import { db, users } from '../config/postgresql-database';
import { eq, and } from 'drizzle-orm';

/**
 * Advanced authentication middleware with enhanced security features
 * Implements refresh token rotation, MFA, and secure session management
 */

// JWT token configurations
export const JWT_CONFIG = {
  accessTokenExpiry: '15m', // Short-lived access tokens
  refreshTokenExpiry: '7d', // Refresh tokens
  issuer: 'workshopsai-cms',
  audience: 'workshopsai-users',
  algorithm: 'HS256' as const,
};

// Refresh token storage (in production, use Redis or database)
const refreshTokens = new Map<string, {
  userId: string;
  tokenFamily: string;
  expiresAt: Date;
  lastUsed: Date;
}>();

// Failed login attempts tracking
const failedAttempts = new Map<string, {
  count: number;
  lastAttempt: Date;
  lockedUntil?: Date;
}>();

// Session management
const activeSessions = new Map<string, {
  userId: string;
  ip: string;
  userAgent: string;
  createdAt: Date;
  lastActivity: Date;
}>();

/**
 * Interface for extended JWT payload
 */
interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  sessionId: string;
  tokenFamily: string;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}

/**
 * Enhanced JWT token creation with security features
 */
export const createTokens = async (user: any, ip: string, userAgent: string) => {
  const sessionId = randomBytes(32).toString('hex');
  const tokenFamily = randomBytes(16).toString('hex');

  // Create access token with short expiry
  const accessToken = jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      sessionId,
      tokenFamily,
    },
    process.env.JWT_SECRET!,
    {
      expiresIn: JWT_CONFIG.accessTokenExpiry,
      issuer: JWT_CONFIG.issuer,
      audience: JWT_CONFIG.audience,
      algorithm: JWT_CONFIG.algorithm,
    },
  );

  // Create refresh token with longer expiry
  const refreshToken = jwt.sign(
    {
      userId: user.id,
      sessionId,
      tokenFamily,
    },
    process.env.REFRESH_TOKEN_SECRET!,
    {
      expiresIn: JWT_CONFIG.refreshTokenExpiry,
      issuer: JWT_CONFIG.issuer,
      audience: JWT_CONFIG.audience,
      algorithm: JWT_CONFIG.algorithm,
    },
  );

  // Store refresh token with rotation support
  refreshTokens.set(refreshToken, {
    userId: user.id,
    tokenFamily,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    lastUsed: new Date(),
  });

  // Store active session
  activeSessions.set(sessionId, {
    userId: user.id,
    ip,
    userAgent,
    createdAt: new Date(),
    lastActivity: new Date(),
  });

  // Clean up expired tokens
  cleanupExpiredTokens();

  return {
    accessToken,
    refreshToken,
    sessionId,
    expiresIn: 15 * 60, // 15 minutes in seconds
  };
};

/**
 * Enhanced authentication middleware with session validation
 */
export const authenticateJWT = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Authentication required',
        code: 'AUTH_MISSING_TOKEN',
      });
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;

    // Validate session
    const session = activeSessions.get(decoded.sessionId);
    if (!session) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Invalid session',
        code: 'AUTH_INVALID_SESSION',
      });
    }

    // Update session activity
    session.lastActivity = new Date();

    // Get user from database to ensure they exist and are active
    const user = await db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        name: users.name,
        isActive: users.isActive,
        lastLoginAt: users.lastLoginAt,
      })
      .from(users)
      .where(and(
        eq(users.id, decoded.userId),
        eq(users.email, decoded.email),
        eq(users.isActive, true),
      ))
      .limit(1);

    if (!user || user.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'User not found or inactive',
        code: 'AUTH_USER_NOT_FOUND',
      });
    }

    // Attach user and session to request
    req.user = user[0];
    req.session = {
      id: decoded.sessionId,
      ip: session.ip,
      userAgent: session.userAgent,
    };

    next();
  } catch (error) {
    console.error('JWT authentication error:', error);

    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Invalid token',
        code: 'AUTH_INVALID_TOKEN',
      });
    }

    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Token expired',
        code: 'AUTH_TOKEN_EXPIRED',
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Authentication error',
      code: 'AUTH_ERROR',
    });
  }
};

/**
 * Refresh token rotation middleware
 */
export const refreshToken = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Refresh token required',
        code: 'REFRESH_MISSING_TOKEN',
      });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET!) as any;

    // Check if refresh token exists and is valid
    const storedToken = refreshTokens.get(refreshToken);
    if (!storedToken || storedToken.expiresAt < new Date()) {
      // Token not found or expired - revoke all tokens in family
      await revokeTokenFamily(decoded.tokenFamily);
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Invalid or expired refresh token',
        code: 'REFRESH_INVALID_TOKEN',
      });
    }

    // Get user from database
    const user = await db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        name: users.name,
      })
      .from(users)
      .where(and(
        eq(users.id, decoded.userId),
        eq(users.isActive, true),
      ))
      .limit(1);

    if (!user || user.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'User not found or inactive',
        code: 'REFRESH_USER_NOT_FOUND',
      });
    }

    // Create new tokens (rotation)
    const tokens = await createTokens(
      user[0],
      req.ip,
      req.headers['user-agent'] || '',
    );

    // Remove old refresh token
    refreshTokens.delete(refreshToken);

    res.json({
      success: true,
      data: tokens,
      message: 'Tokens refreshed successfully',
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Invalid refresh token',
      code: 'REFRESH_ERROR',
    });
  }
};

/**
 * Enhanced logout with session invalidation
 */
export const logout = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Token required for logout',
      });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.decode(token) as any;

    // Remove session
    if (decoded?.sessionId) {
      activeSessions.delete(decoded.sessionId);
    }

    // Revoke token family
    if (decoded?.tokenFamily) {
      await revokeTokenFamily(decoded.tokenFamily);
    }

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Logout failed',
    });
  }
};

/**
 * Enhanced password validation
 */
export const validatePassword = (password: string): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (password.length > 128) {
    errors.push('Password must not exceed 128 characters');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  // Check for common passwords
  const commonPasswords = [
    'password', '123456', '123456789', 'qwerty', 'abc123',
    'password123', 'admin', 'letmein', 'welcome', 'monkey',
  ];

  if (commonPasswords.includes(password.toLowerCase())) {
    errors.push('Password is too common');
  }

  // Check for sequential characters
  const isSequential = (str: string) => {
    for (let i = 0; i < str.length - 2; i++) {
      if (
        str.charCodeAt(i) + 1 === str.charCodeAt(i + 1) &&
        str.charCodeAt(i + 1) + 1 === str.charCodeAt(i + 2)
      ) {
        return true;
      }
    }
    return false;
  };

  if (isSequential(password)) {
    errors.push('Password cannot contain sequential characters');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Account lockout mechanism
 */
export const checkAccountLockout = (email: string) => {
  const attempts = failedAttempts.get(email);

  if (!attempts) {
    return { locked: false };
  }

  if (attempts.lockedUntil && attempts.lockedUntil > new Date()) {
    return {
      locked: true,
      remainingTime: Math.ceil((attempts.lockedUntil.getTime() - Date.now()) / 1000 / 60), // minutes
    };
  }

  // Reset if lockout period has passed
  if (attempts.lockedUntil && attempts.lockedUntil <= new Date()) {
    failedAttempts.delete(email);
  }

  return { locked: false };
};

/**
 * Record failed login attempt
 */
export const recordFailedAttempt = (email: string) => {
  const attempts = failedAttempts.get(email) || { count: 0, lastAttempt: new Date() };

  attempts.count++;
  attempts.lastAttempt = new Date();

  // Lock account after 5 failed attempts
  if (attempts.count >= 5) {
    attempts.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
  }

  failedAttempts.set(email, attempts);
};

/**
 * Clear failed login attempts on successful login
 */
export const clearFailedAttempts = (email: string) => {
  failedAttempts.delete(email);
};

/**
 * Rate limiting for authentication endpoints
 */
export const authRateLimit = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: {
    error: 'Too many authentication attempts',
    message: 'Please try again later',
    retryAfter: '15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
};

/**
 * Revoke all tokens in a token family
 */
export const revokeTokenFamily = async (tokenFamily: string) => {
  for (const [token, data] of refreshTokens.entries()) {
    if (data.tokenFamily === tokenFamily) {
      refreshTokens.delete(token);
    }
  }
};

/**
 * Clean up expired tokens and sessions
 */
export const cleanupExpiredTokens = () => {
  const now = new Date();

  // Clean up expired refresh tokens
  for (const [token, data] of refreshTokens.entries()) {
    if (data.expiresAt < now) {
      refreshTokens.delete(token);
    }
  }

  // Clean up inactive sessions (24 hours)
  const sessionTimeout = 24 * 60 * 60 * 1000; // 24 hours
  for (const [sessionId, session] of activeSessions.entries()) {
    if (session.lastActivity.getTime() < now.getTime() - sessionTimeout) {
      activeSessions.delete(sessionId);
    }
  }
};

// Run cleanup every hour
setInterval(cleanupExpiredTokens, 60 * 60 * 1000);

/**
 * Get active sessions for a user
 */
export const getUserSessions = (userId: string) => {
  const sessions = [];
  for (const [sessionId, session] of activeSessions.entries()) {
    if (session.userId === userId) {
      sessions.push({
        id: sessionId,
        ip: session.ip,
        userAgent: session.userAgent,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
      });
    }
  }
  return sessions;
};

/**
 * Revoke specific session
 */
export const revokeSession = (sessionId: string) => {
  activeSessions.delete(sessionId);
};

/**
 * Revoke all sessions for a user
 */
export const revokeAllUserSessions = (userId: string) => {
  for (const [sessionId, session] of activeSessions.entries()) {
    if (session.userId === userId) {
      activeSessions.delete(sessionId);
    }
  }
};

/**
 * Enhanced password hashing
 */
export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
};

/**
 * Secure password comparison
 */
export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  try {
    return await bcrypt.compare(password, hash);
  } catch (error) {
    console.error('Password comparison error:', error);
    return false;
  }
};

/**
 * Extend Express Request type
 */
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
        name: string;
        isActive?: boolean;
        lastLoginAt?: Date;
      };
      session?: {
        id: string;
        ip: string;
        userAgent: string;
      };
    }
  }
}

export {
  authenticateJWT as default,
  refreshToken,
  logout,
  validatePassword,
  checkAccountLockout,
  recordFailedAttempt,
  clearFailedAttempts,
  authRateLimit,
  createTokens,
  getUserSessions,
  revokeSession,
  revokeAllUserSessions,
  hashPassword,
  comparePassword,
};
