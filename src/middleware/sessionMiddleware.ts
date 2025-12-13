/**
 * Session Middleware for Express
 *
 * This middleware integrates the PostgreSQL-based session management system
 * with Express applications. It provides authentication, session validation,
 * and automatic token refresh capabilities.
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import SessionService, { SessionData } from '../services/sessionService';
import { db, users } from '../config/postgresql-database';
import { eq, and, isNull } from 'drizzle-orm';

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      session?: SessionData;
      user?: {
        id: string;
        email: string;
        name: string;
        role: string;
        emailVerified: boolean;
        lastLoginAt?: Date;
      };
      sessionId?: string;
    }
  }
}

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = '15m';

// Session middleware options
export interface SessionMiddlewareOptions {
  required?: boolean;
  refreshToken?: boolean;
  checkSuspicious?: boolean;
  rateLimitByUser?: boolean;
  maxSessions?: number;
}

/**
 * Authentication middleware
 * Validates session and attaches user information to request
 */
export const authenticateSession = (
  options: SessionMiddlewareOptions = {}
) => {
  const {
    required = true,
    refreshToken = true,
    checkSuspicious = true,
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        if (required) {
          return res.status(401).json({
            error: 'Authentication required',
            message: 'No session token provided',
          });
        }
        return next();
      }

      const accessToken = authHeader.substring(7);

      // Validate session in PostgreSQL
      const session = await SessionService.validateSession(accessToken);

      if (!session) {
        if (refreshToken && req.headers['x-refresh-token']) {
          // Attempt to refresh the token
          const refreshToken = req.headers['x-refresh-token'] as string;
          const newTokens = await SessionService.refreshAccessToken(refreshToken, req);

          if (newTokens) {
            // Set new tokens in response headers
            res.setHeader('X-New-Access-Token', newTokens.accessToken);
            res.setHeader('X-New-Refresh-Token', newTokens.refreshToken);
            res.setHeader('X-Token-Expires-At', newTokens.expiresAt.toISOString());

            // Validate new session
            const newSession = await SessionService.validateSession(newTokens.accessToken);
            if (newSession) {
              req.session = newSession;
              req.sessionId = newSession.sessionId;
              await attachUserToRequest(req, newSession.userId);
              return next();
            }
          }
        }

        if (required) {
          return res.status(401).json({
            error: 'Invalid session',
            message: 'Session is invalid or expired',
          });
        }
        return next();
      }

      // Check for suspicious activity
      if (checkSuspicious && session.riskScore > 5) {
        await SessionService.logSessionActivity(
          session.id,
          session.userId,
          'high_risk_access',
          {
            riskScore: session.riskScore,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
          }
        );

        if (session.riskScore > 8) {
          // Block access for very high risk scores
          return res.status(403).json({
            error: 'Access denied',
            message: 'Suspicious activity detected. Please login again.',
          });
        }
      }

      // Attach session and user to request
      req.session = session;
      req.sessionId = session.sessionId;
      await attachUserToRequest(req, session.userId);

      next();
    } catch (error) {
      console.error('Session middleware error:', error);

      if (required) {
        return res.status(500).json({
          error: 'Session validation failed',
          message: 'An unexpected error occurred',
        });
      }

      next();
    }
  };
};

/**
 * Optional authentication middleware
 * Attaches user if session exists but doesn't require it
 */
export const optionalAuth = authenticateSession({ required: false });

/**
 * Role-based authorization middleware
 */
export const requireRole = (roles: string | string[]) => {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];

  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'User not authenticated',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        message: `Required role: ${allowedRoles.join(', ')}`,
      });
    }

    next();
  };
};

/**
 * Session rate limiting middleware
 * Limits requests per session rather than per IP
 */
export const sessionRateLimit = (options: {
  windowMs: number;
  maxRequests: number;
  message?: string;
}) => {
  const { windowMs, maxRequests, message } = options;
  const requests = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.sessionId) {
      return next(); // Skip if no session
    }

    const now = Date.now();
    const key = req.sessionId;
    const current = requests.get(key);

    if (!current || now > current.resetTime) {
      requests.set(key, {
        count: 1,
        resetTime: now + windowMs,
      });
      return next();
    }

    if (current.count >= maxRequests) {
      return res.status(429).json({
        error: 'Too many requests',
        message: message || `Rate limit exceeded. Max ${maxRequests} requests per ${windowMs / 1000} seconds.`,
      });
    }

    current.count++;
    next();
  };
};

/**
 * Concurrent session checker
 * Prevents too many concurrent sessions for the same user
 */
export const checkConcurrentSessions = (maxSessions: number = 5) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next();
    }

    try {
      const sessions = await SessionService.getUserSessions(req.user.id);
      const activeSessions = sessions.filter(s => s.status === 'active');

      if (activeSessions.length >= maxSessions) {
        return res.status(429).json({
          error: 'Session limit exceeded',
          message: `Maximum ${maxSessions} concurrent sessions allowed`,
        });
      }

      next();
    } catch (error) {
      console.error('Concurrent session check error:', error);
      next(); // Allow request on error
    }
  };
};

/**
 * Session security headers middleware
 * Adds security headers related to session management
 */
export const sessionSecurityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // XSS Protection
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions Policy
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  // Session security
  if (req.session) {
    res.setHeader('X-Session-ID', req.session.sessionId);
    res.setHeader('X-Session-Expires', req.session.expiresAt.toISOString());
  }

  next();
};

/**
 * Session activity tracker
 * Tracks user activity for analytics and security
 */
export const trackSessionActivity = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.session) {
      return next();
    }

    // Track activity after response is sent
    res.on('finish', async () => {
      try {
        await SessionService.updateSessionAccess(req.session!.id);

        // Log the activity
        await SessionService.logSessionActivity(
          req.session!.id,
          req.session!.userId,
          'access',
          {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
          }
        );
      } catch (error) {
        console.error('Activity tracking error:', error);
      }
    });

    next();
  };
};

/**
 * Logout middleware
 * Handles session termination
 */
export const logoutMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.session) {
      await SessionService.revokeSession(req.session.sessionId, 'user_logout');

      // Clear session from request
      delete req.session;
      delete req.user;
      delete req.sessionId;
    }

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: 'Logout failed',
      message: 'An unexpected error occurred',
    });
  }
};

/**
 * Logout all devices middleware
 */
export const logoutAllDevicesMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user) {
      await SessionService.revokeAllUserSessions(req.user.id, 'user_logout_all');

      // Clear session from request
      delete req.session;
      delete req.user;
      delete req.sessionId;
    }

    res.status(200).json({
      success: true,
      message: 'Logged out from all devices successfully',
    });
  } catch (error) {
    console.error('Logout all devices error:', error);
    res.status(500).json({
      error: 'Logout failed',
      message: 'An unexpected error occurred',
    });
  }
};

/**
 * Get current session info
 */
export const getSessionInfoMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.session) {
      return res.status(401).json({
        error: 'No active session',
        message: 'User not authenticated',
      });
    }

    res.status(200).json({
      success: true,
      data: {
        sessionId: req.session.sessionId,
        sessionType: req.session.sessionType,
        loginAt: req.session.loginAt,
        lastAccessedAt: req.session.lastAccessedAt,
        expiresAt: req.session.expiresAt,
        riskScore: req.session.riskScore,
        deviceInfo: req.session.metadata,
      },
    });
  } catch (error) {
    console.error('Get session info error:', error);
    res.status(500).json({
      error: 'Failed to get session info',
      message: 'An unexpected error occurred',
    });
  }
};

/**
 * Get all user sessions
 */
export const getUserSessionsMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'User not authenticated',
      });
    }

    const sessions = await SessionService.getUserSessions(req.user.id);

    res.status(200).json({
      success: true,
      data: {
        sessions,
        count: sessions.length,
      },
    });
  } catch (error) {
    console.error('Get user sessions error:', error);
    res.status(500).json({
      error: 'Failed to retrieve sessions',
      message: 'An unexpected error occurred',
    });
  }
};

/**
 * Helper function to attach user to request
 */
async function attachUserToRequest(req: Request, userId: string): Promise<void> {
  try {
    const user = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        emailVerified: users.emailVerified,
        lastLoginAt: users.lastLoginAt,
      })
      .from(users)
      .where(and(
        eq(users.id, userId),
        eq(users.isActive, true),
        isNull(users.deletedAt),
      ))
      .limit(1);

    if (user[0]) {
      req.user = user[0];
    }
  } catch (error) {
    console.error('Error attaching user to request:', error);
  }
}

/**
 * CSRF Protection middleware
 * Generates and validates CSRF tokens for state-changing operations
 */
export const csrfProtection = () => {
  const tokens = new Map<string, { token: string; expires: number }>();

  return {
    // Generate CSRF token
    generateToken: (req: Request, res: Response) => {
      if (!req.session) return;

      const token = require('crypto').randomBytes(32).toString('hex');
      const expires = Date.now() + (60 * 60 * 1000); // 1 hour

      tokens.set(req.session.sessionId, { token, expires });

      res.setHeader('X-CSRF-Token', token);
    },

    // Validate CSRF token
    validateToken: (req: Request, res: Response, next: NextFunction) => {
      if (!req.session) {
        return res.status(401).json({ error: 'No session' });
      }

      const sessionToken = tokens.get(req.session.sessionId);
      const requestToken = req.headers['x-csrf-token'] as string;

      if (!sessionToken || !requestToken) {
        return res.status(403).json({ error: 'CSRF token missing' });
      }

      if (Date.now() > sessionToken.expires) {
        tokens.delete(req.session.sessionId);
        return res.status(403).json({ error: 'CSRF token expired' });
      }

      if (sessionToken.token !== requestToken) {
        return res.status(403).json({ error: 'Invalid CSRF token' });
      }

      // Regenerate token after successful validation
      const newToken = require('crypto').randomBytes(32).toString('hex');
      tokens.set(req.session.sessionId, {
        token: newToken,
        expires: Date.now() + (60 * 60 * 1000),
      });

      res.setHeader('X-CSRF-Token', newToken);
      next();
    },
  };
};

export default {
  authenticateSession,
  optionalAuth,
  requireRole,
  sessionRateLimit,
  checkConcurrentSessions,
  sessionSecurityHeaders,
  trackSessionActivity,
  logoutMiddleware,
  logoutAllDevicesMiddleware,
  getSessionInfoMiddleware,
  getUserSessionsMiddleware,
  csrfProtection,
};