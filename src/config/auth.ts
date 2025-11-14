import type { DatabasePool } from '../config/database';
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  refreshTokenExpiresIn: string;
  bcryptRounds: number;
  sessionMaxAge: number;
  passwordMinLength: number;
  requireEmailVerification: boolean;
  enableSocialLogin: boolean;
  enabledProviders: string[];
  rateLimiting: {
    windowMs: number;
    maxAttempts: number;
    blockDurationMs: number;
  };
}

export const authConfig: AuthConfig = {
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12'),
  sessionMaxAge: parseInt(process.env.SESSION_MAX_AGE || '86400000'), // 24 hours
  passwordMinLength: parseInt(process.env.PASSWORD_MIN_LENGTH || '8'),
  requireEmailVerification: process.env.REQUIRE_EMAIL_VERIFICATION === 'true',
  enableSocialLogin: process.env.ENABLE_SOCIAL_LOGIN === 'true',
  enabledProviders: (process.env.ENABLED_PROVIDERS || '').split(',').filter(Boolean),
  rateLimiting: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
    maxAttempts: parseInt(process.env.RATE_LIMIT_MAX_ATTEMPTS || '5'),
    blockDurationMs: parseInt(process.env.RATE_LIMIT_BLOCK_DURATION_MS || '1800000'), // 30 minutes
  },
};

export interface SocialProvider {
  name: string;
  clientId: string;
  clientSecret: string;
  scope?: string[];
  callbackUrl?: string;
}

export const socialProviders: Record<string, SocialProvider> = {
  google: {
    name: 'google',
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    scope: ['openid', 'email', 'profile'],
    callbackUrl: process.env.GOOGLE_CALLBACK_URL,
  },
  facebook: {
    name: 'facebook',
    clientId: process.env.FACEBOOK_CLIENT_ID || '',
    clientSecret: process.env.FACEBOOK_CLIENT_SECRET || '',
    scope: ['email', 'public_profile'],
    callbackUrl: process.env.FACEBOOK_CALLBACK_URL,
  },
  github: {
    name: 'github',
    clientId: process.env.GITHUB_CLIENT_ID || '',
    clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
    scope: ['user:email'],
    callbackUrl: process.env.GITHUB_CALLBACK_URL,
  },
};

// Authentication middleware
export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, authConfig.jwtSecret) as any;
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }
};

// Role-based authorization middleware
export const requireRole = (roles: string | string[]) => {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];

  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
};

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
        name: string;
        [key: string]: any;
      };
    }
  }
}