import { Request, Response, NextFunction } from 'express';
import { AuthService, UserRole, redisService } from '../services/authService';

// Middleware: Authentication
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'No token provided',
      });
      return;
    }

    const token = authHeader.substring(7);

    try {
      const payload = AuthService.verifyAccessToken(token);

      // Check if session exists in Redis
      const session = await redisService.getSession(payload.sessionId);
      if (!session) {
        res.status(401).json({
          error: 'Invalid session',
          message: 'Session not found or expired',
        });
        return;
      }

      // Verify session matches the token
      if (
        session.userId !== payload.userId ||
        session.email !== payload.email
      ) {
        res.status(401).json({
          error: 'Invalid session',
          message: 'Session data mismatch',
        });
        return;
      }

      // Find user to ensure they still exist and are active
      const user = await AuthService.findUserById(payload.userId);

      if (!user || !user.isActive) {
        res.status(401).json({
          error: 'Invalid token',
          message: 'User not found or inactive',
        });
        return;
      }

      // Check if user role matches (in case role was changed)
      if (user.role !== payload.role) {
        res.status(401).json({
          error: 'Invalid token',
          message: 'User role has changed, please re-authenticate',
        });
        return;
      }

      // Attach user to request
      req.user = {
        id: payload.userId,
        email: payload.email,
        role: payload.role,
        sessionId: payload.sessionId,
      };

      next();
    } catch (jwtError: any) {
      if (jwtError.name === 'TokenExpiredError') {
        res.status(401).json({
          error: 'Token expired',
          message: 'Access token has expired, please refresh',
        });
        return;
      }

      if (jwtError.name === 'JsonWebTokenError') {
        res.status(401).json({
          error: 'Invalid token',
          message: 'Token verification failed',
        });
        return;
      }

      res.status(401).json({
        error: 'Token error',
        message: 'Token processing failed',
      });
      return;
    }
  } catch (error) {
    console.error('Authentication middleware error:', error);
    res.status(500).json({
      error: 'Authentication error',
      message: 'Internal server error',
    });
    return;
  }
};

// Middleware: Authorization
export const authorize = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'User not authenticated',
      });
      return;
    }

    if (!AuthService.hasPermission(req.user.role, permission)) {
      res.status(403).json({
        error: 'Access denied',
        message: 'Insufficient permissions',
        required: permission,
        userRole: req.user.role,
      });
      return;
    }

    next();
  };
};

// Middleware: Role-based access
export const requireRole = (roles: UserRole | UserRole[]) => {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];

  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'User not authenticated',
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: 'Access denied',
        message: 'Insufficient role permissions',
        requiredRoles: allowedRoles,
        userRole: req.user.role,
      });
      return;
    }

    next();
  };
};

// Middleware: Resource owner or admin
export const requireOwnerOrAdmin = (
  getResourceOwnerId: (req: Request) => Promise<string | null>,
) => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'User not authenticated',
      });
      return;
    }

    // Admins can access everything
    if (req.user.role === 'admin') {
      next();
      return;
    }

    // Check if user owns the resource
    const resourceOwnerId = await getResourceOwnerId(req);

    if (resourceOwnerId === req.user.id) {
      next();
      return;
    }

    res.status(403).json({
      error: 'Access denied',
      message: 'You can only access your own resources',
    });
    return;
  };
};

// Middleware: Check user consent
export const requireConsent = (consentType: string) => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'User not authenticated',
      });
      return;
    }

    const hasConsent = await AuthService.hasUserConsent(
      req.user.id,
      consentType,
    );

    if (!hasConsent) {
      res.status(403).json({
        error: 'Consent required',
        message: `User consent is required for: ${consentType}`,
        consentType,
      });
      return;
    }

    next();
  };
};

// Middleware: Optional authentication (doesn't fail if no token)
export const optionalAuthenticate = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token provided, continue without authentication
      next();
      return;
    }

    const token = authHeader.substring(7);

    try {
      const payload = AuthService.verifyAccessToken(token);

      // Check if session exists in Redis
      const session = await redisService.getSession(payload.sessionId);
      if (!session) {
        // Invalid session, continue without authentication
        next();
        return;
      }

      // Find user to ensure they still exist and are active
      const user = await AuthService.findUserById(payload.userId);

      if (user && user.isActive && user.role === payload.role) {
        // Attach user to request if valid
        req.user = {
          id: payload.userId,
          email: payload.email,
          role: payload.role,
          sessionId: payload.sessionId,
        };
      }
    } catch (jwtError) {
      // Token invalid, continue without authentication
    }

    next();
  } catch (error) {
    console.error('Optional authentication middleware error:', error);
    // Continue without authentication on errors
    next();
  }
};

// Middleware: Rate limiting based on user
export const userRateLimit = (maxRequests: number, windowMs: number) => {
  const userRequests = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      // Apply IP-based rate limiting for unauthenticated users
      return next();
    }

    const userId = req.user.id;
    const now = Date.now();
    const userLimit = userRequests.get(userId);

    if (!userLimit || now > userLimit.resetTime) {
      // New window for this user
      userRequests.set(userId, {
        count: 1,
        resetTime: now + windowMs,
      });
      return next();
    }

    if (userLimit.count >= maxRequests) {
      res.status(429).json({
        error: 'Rate limit exceeded',
        message: `Too many requests. Maximum ${maxRequests} requests per ${windowMs / 1000} seconds.`,
        retryAfter: Math.ceil((userLimit.resetTime - now) / 1000),
      });
      return;
    }

    userLimit.count++;
    next();
  };
};

// Middleware: Check if user email is verified
export const requireEmailVerification = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (!req.user) {
    res.status(401).json({
      error: 'Authentication required',
      message: 'User not authenticated',
    });
    return;
  }

  // Get user details to check email verification
  AuthService.findUserById(req.user.id)
    .then(user => {
      if (!user) {
        res.status(404).json({
          error: 'User not found',
          message: 'User account not found',
        });
        return;
      }

      if (!user.emailVerified) {
        res.status(403).json({
          error: 'Email not verified',
          message: 'Please verify your email address to access this feature',
        });
        return;
      }

      next();
    })
    .catch(error => {
      console.error('Email verification check error:', error);
      res.status(500).json({
        error: 'Verification check failed',
        message: 'Internal server error',
      });
    });
};

// Middleware: Check if user is active
export const requireActiveUser = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (!req.user) {
    res.status(401).json({
      error: 'Authentication required',
      message: 'User not authenticated',
    });
    return;
  }

  AuthService.findUserById(req.user.id)
    .then(user => {
      if (!user) {
        res.status(404).json({
          error: 'User not found',
          message: 'User account not found',
        });
        return;
      }

      if (!user.isActive) {
        res.status(403).json({
          error: 'Account inactive',
          message: 'Your account has been deactivated. Please contact support.',
        });
        return;
      }

      next();
    })
    .catch(error => {
      console.error('Active user check error:', error);
      res.status(500).json({
        error: 'Account check failed',
        message: 'Internal server error',
      });
    });
};

export {
  authenticate,
  authorize,
  requireRole,
  requireOwnerOrAdmin,
  requireConsent,
  optionalAuthenticate,
  userRateLimit,
  requireEmailVerification,
  requireActiveUser,
};
