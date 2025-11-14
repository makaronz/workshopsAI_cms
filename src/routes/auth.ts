import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { AuthService, UserRole } from '../services/authService';
import { redisService } from '../config/redis';
import { db } from '../config/postgresql-database';
import { users } from '../models/postgresql-schema';
import { eq } from 'drizzle-orm';

const router = Router();

// Validation schemas
const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  rememberMe: z.boolean().optional().default(false),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

const logoutSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
  sessionId: z.string().min(1, 'Session ID is required'),
});

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'New password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Password confirmation is required'),
  })
  .refine(data => data.newPassword === data.confirmPassword, {
    message: 'Passwords don\'t match',
    path: ['confirmPassword'],
  });

const registerSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email format'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Password confirmation is required'),
    role: z.enum(['participant', 'facilitator']).default('participant'),
    agreeToTerms: z.boolean().refine(val => val === true, {
      message: 'You must agree to the terms and conditions',
    }),
  })
  .refine(data => data.password === data.confirmPassword, {
    message: 'Passwords don\'t match',
    path: ['confirmPassword'],
  });

// Rate limiting for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  message: {
    error: 'Too many authentication attempts',
    message: 'Please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: req => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    return `${ip}:${userAgent}`;
  },
});

const strictAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Stricter limit for sensitive operations
  message: {
    error: 'Too many sensitive operations',
    message: 'Please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Error handling helper
const handleAsync =
  (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

/**
 * @route   POST /api/v1/auth/login
 * @desc    Authenticate user with email/password
 * @access  Public
 */
router.post(
  '/login',
  authLimiter,
  handleAsync(async (req: Request, res: Response) => {
    const { data, error } = loginSchema.safeParse(req.body);

    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Invalid input data',
        details: error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      });
    }

    const { ipAddress, userAgent, deviceInfo } =
      AuthService.extractRequestMetadata(req);

    try {
      const result = await AuthService.login(
        data.email,
        data.password,
        ipAddress,
        userAgent,
        deviceInfo,
      );

      // Set HTTP-only cookie for refresh token if remember me is enabled
      if (data.rememberMe) {
        res.cookie('refreshToken', result.tokens.refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
          path: '/api/v1/auth/refresh',
        });
      }

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          user: result.user,
          tokens: result.tokens,
          sessionId: result.sessionId,
        },
      });
    } catch (error: any) {
      console.error('Login error:', error);

      // Handle specific error cases
      if (error.message.includes('Too many failed login attempts')) {
        return res.status(429).json({
          error: 'Too many attempts',
          message: error.message,
        });
      }

      if (error.message.includes('Invalid credentials')) {
        return res.status(401).json({
          error: 'Authentication failed',
          message: 'Invalid email or password',
        });
      }

      res.status(500).json({
        error: 'Login failed',
        message: 'An unexpected error occurred',
      });
    }
  }),
);

/**
 * @route   POST /api/v1/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
router.post(
  '/refresh',
  authLimiter,
  handleAsync(async (req: Request, res: Response) => {
    const { refreshToken } = req.body;
    const cookieToken = req.cookies.refreshToken;

    // Use token from body or cookie
    const tokenToUse = refreshToken || cookieToken;

    if (!tokenToUse) {
      return res.status(401).json({
        error: 'Token required',
        message: 'No refresh token provided',
      });
    }

    const { ipAddress, userAgent } = AuthService.extractRequestMetadata(req);

    try {
      const result = await AuthService.refreshToken(
        tokenToUse,
        ipAddress,
        userAgent,
      );

      res.status(200).json({
        success: true,
        message: 'Token refreshed successfully',
        data: result,
      });
    } catch (error: any) {
      console.error('Token refresh error:', error);

      if (error.message.includes('Invalid refresh token')) {
        // Clear invalid cookie
        res.clearCookie('refreshToken', { path: '/api/v1/auth/refresh' });

        return res.status(401).json({
          error: 'Invalid token',
          message: 'Refresh token is invalid or expired',
        });
      }

      res.status(500).json({
        error: 'Token refresh failed',
        message: 'An unexpected error occurred',
      });
    }
  }),
);

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout user and invalidate tokens
 * @access  Public
 */
router.post(
  '/logout',
  handleAsync(async (req: Request, res: Response) => {
    const { data, error } = logoutSchema.safeParse(req.body);

    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Invalid input data',
        details: error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      });
    }

    const { ipAddress, userAgent } = AuthService.extractRequestMetadata(req);

    try {
      // Try to extract user info from the token for audit logging
      let userId = null;
      try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          const payload = AuthService.verifyAccessToken(token);
          userId = payload.userId;
        }
      } catch {
        // Token might be expired, continue without user info
      }

      await AuthService.logout(
        userId || 'unknown',
        data.refreshToken,
        data.sessionId,
        ipAddress,
        userAgent,
      );

      // Clear refresh token cookie
      res.clearCookie('refreshToken', { path: '/api/v1/auth/refresh' });

      res.status(200).json({
        success: true,
        message: 'Logout successful',
      });
    } catch (error: any) {
      console.error('Logout error:', error);

      res.status(500).json({
        error: 'Logout failed',
        message: 'An unexpected error occurred',
      });
    }
  }),
);

/**
 * @route   POST /api/v1/auth/logout-all
 * @desc    Logout user from all devices
 * @access  Private
 */
router.post(
  '/logout-all',
  handleAsync(async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'User not authenticated',
      });
    }

    const { ipAddress, userAgent } = AuthService.extractRequestMetadata(req);

    try {
      await AuthService.logoutAll(req.user.id, ipAddress, userAgent);

      // Clear refresh token cookie
      res.clearCookie('refreshToken', { path: '/api/v1/auth/refresh' });

      res.status(200).json({
        success: true,
        message: 'Logged out from all devices successfully',
      });
    } catch (error: any) {
      console.error('Logout all error:', error);

      res.status(500).json({
        error: 'Logout all failed',
        message: 'An unexpected error occurred',
      });
    }
  }),
);

/**
 * @route   GET /api/v1/auth/sessions
 * @desc    Get user's active sessions
 * @access  Private
 */
router.get(
  '/sessions',
  handleAsync(async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'User not authenticated',
      });
    }

    try {
      const sessions = await AuthService.getUserSessions(req.user.id);

      res.status(200).json({
        success: true,
        data: {
          sessions,
          count: sessions.length,
        },
      });
    } catch (error: any) {
      console.error('Get sessions error:', error);

      res.status(500).json({
        error: 'Failed to retrieve sessions',
        message: 'An unexpected error occurred',
      });
    }
  }),
);

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register new user
 * @access  Public
 */
router.post(
  '/register',
  strictAuthLimiter,
  handleAsync(async (req: Request, res: Response) => {
    const { data, error } = registerSchema.safeParse(req.body);

    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Invalid input data',
        details: error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      });
    }

    const { ipAddress, userAgent, deviceInfo } =
      AuthService.extractRequestMetadata(req);

    try {
      // Check if user already exists
      const existingUser = await AuthService.findUserByEmail(data.email);
      if (existingUser) {
        return res.status(409).json({
          error: 'User already exists',
          message: 'An account with this email already exists',
        });
      }

      // Create new user
      const user = await AuthService.createUser({
        name: data.name,
        email: data.email,
        password: data.password,
        role: data.role,
      });

      // Record consent for terms and conditions
      await AuthService.recordConsent(
        user.id,
        'terms_and_conditions',
        true,
        ipAddress,
        userAgent,
      );

      // Auto-login after registration
      const loginResult = await AuthService.login(
        data.email,
        data.password,
        ipAddress,
        userAgent,
        deviceInfo,
      );

      res.status(201).json({
        success: true,
        message: 'Registration successful',
        data: {
          user: loginResult.user,
          tokens: loginResult.tokens,
          sessionId: loginResult.sessionId,
        },
      });
    } catch (error: any) {
      console.error('Registration error:', error);

      res.status(500).json({
        error: 'Registration failed',
        message: 'An unexpected error occurred',
      });
    }
  }),
);

/**
 * @route   POST /api/v1/auth/change-password
 * @desc    Change user password
 * @access  Private
 */
router.post(
  '/change-password',
  strictAuthLimiter,
  handleAsync(async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'User not authenticated',
      });
    }

    const { data, error } = changePasswordSchema.safeParse(req.body);

    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Invalid input data',
        details: error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      });
    }

    try {
      // Verify current password
      const user = await AuthService.findUserById(req.user.id);
      if (!user || !user.password) {
        return res.status(404).json({
          error: 'User not found',
          message: 'User account not found',
        });
      }

      const isValidPassword = await AuthService.verifyPassword(
        data.currentPassword,
        user.password,
      );
      if (!isValidPassword) {
        return res.status(401).json({
          error: 'Invalid password',
          message: 'Current password is incorrect',
        });
      }

      // Hash new password
      const hashedPassword = await AuthService.hashPassword(data.newPassword);

      // Update password in database
      await db
        .update(users)
        .set({
          password: hashedPassword,
          updatedAt: new Date(),
        })
        .where(eq(users.id, req.user.id));

      // Revoke all refresh tokens for security
      await redisService.revokeAllUserTokens(req.user.id);

      // Create audit log
      const { ipAddress, userAgent } = AuthService.extractRequestMetadata(req);
      await AuthService.createAuditLog(
        req.user.id,
        'PASSWORD_CHANGE',
        'users',
        req.user.id,
        null,
        { operation: 'password_change' },
        ipAddress,
        userAgent,
      );

      res.status(200).json({
        success: true,
        message: 'Password changed successfully. Please login again.',
      });
    } catch (error: any) {
      console.error('Change password error:', error);

      res.status(500).json({
        error: 'Password change failed',
        message: 'An unexpected error occurred',
      });
    }
  }),
);

/**
 * @route   GET /api/v1/auth/me
 * @desc    Get current user information
 * @access  Private
 */
router.get(
  '/me',
  handleAsync(async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'User not authenticated',
      });
    }

    try {
      const user = await AuthService.findUserById(req.user.id);
      if (!user) {
        return res.status(404).json({
          error: 'User not found',
          message: 'User account not found',
        });
      }

      res.status(200).json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          emailVerified: user.emailVerified,
          isActive: user.isActive,
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt,
        },
      });
    } catch (error: any) {
      console.error('Get user error:', error);

      res.status(500).json({
        error: 'Failed to retrieve user information',
        message: 'An unexpected error occurred',
      });
    }
  }),
);

export default router;
