import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db, users } from '../config/postgresql-database';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
        name: string;
      };
    }
  }
}

interface JWTPayload {
  userId: string;
  email: string;
  role: string;
}

/**
 * JWT Authentication Middleware
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
      });
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Token not provided',
      });
    }

    // Verify JWT token
    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      throw new Error('JWT_SECRET environment variable not set');
    }

    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;

    // Get user from database to ensure they exist and are active
    const user = await db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        name: users.name,
      })
      .from(users)
      .where((users, { eq, and }) =>
        and(
          eq(users.id, decoded.userId),
          eq(users.email, decoded.email),
          eq(users.isActive, true),
        ),
      )
      .limit(1);

    if (!user || user.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'User not found or inactive',
      });
    }

    // Attach user to request
    req.user = user[0];

    next();
  } catch (error) {
    console.error('JWT authentication error:', error);

    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Invalid token',
      });
    }

    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Token expired',
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Authentication error',
    });
  }
};

/**
 * Role-based Authorization Middleware
 */
export const authorizeRoles = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Insufficient permissions',
      });
    }

    next();
  };
};

/**
 * Optional authentication middleware - attaches user if token is present but doesn't require it
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token, continue without user
      return next();
    }

    const token = authHeader.substring(7);

    if (!token) {
      return next();
    }

    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      return next();
    }

    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;

    const user = await db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        name: users.name,
      })
      .from(users)
      .where((users, { eq, and }) =>
        and(
          eq(users.id, decoded.userId),
          eq(users.email, decoded.email),
          eq(users.isActive, true),
        ),
      )
      .limit(1);

    if (user && user.length > 0) {
      req.user = user[0];
    }

    next();
  } catch (error) {
    // Ignore authentication errors for optional auth
    next();
  }
};

/**
 * Check if user can access questionnaire
 */
export const canAccessQuestionnaire = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    // Admins can access everything
    if (req.user.role === 'admin') {
      return next();
    }

    // For now, sociologist-editors can access all questionnaires
    // In a real implementation, you might want to check ownership or other permissions
    const allowedRoles = ['sociologist-editor', 'moderator', 'facilitator'];

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Insufficient permissions to access questionnaires',
      });
    }

    next();
  } catch (error) {
    console.error('Questionnaire access check error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Error checking questionnaire access',
    });
  }
};
