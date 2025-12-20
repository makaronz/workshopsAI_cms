import { Express } from 'express';
import { createRateLimitMiddleware } from '../rate-limiting/middleware';
import { RateLimitAdminTools } from '../rate-limiting/admin-tools';

export let rateLimitMiddleware: any = null;
export let rateLimitAdminTools: RateLimitAdminTools | null = null;

interface RateLimiterConfig {
  postgresUrl?: string;
  nodeEnv: string;
  adminKey?: string;
}

export const configureRateLimiting = (app: Express, config: RateLimiterConfig) => {
  console.log('🚦 Initializing High-Performance Rate Limiting System...');
  
  rateLimitMiddleware = createRateLimitMiddleware({
    // PostgreSQL URL for distributed rate limiting
    postgresUrl: config.postgresUrl,

    // Node identifier for clustering
    nodeId: `api-node-${process.pid}`,

    // Custom rate limit configuration
    defaultConfig: {
      second: { limit: 30, windowMs: 1000 },    // 30 requests per second
      minute: { limit: 1000, windowMs: 60000 },  // 1000 requests per minute
      hour: { limit: 20000, windowMs: 3600000 }, // 20K requests per hour
      day: { limit: 200000, windowMs: 86400000 } // 200K requests per day
    },

    // Custom rate limit rules for different endpoints
    rules: [
      {
        id: 'auth-endpoints',
        pattern: /^\/api\/v1\/auth/,
        config: {
          second: { limit: 5, windowMs: 1000, penaltyMs: 60000 },
          minute: { limit: 20, windowMs: 60000, penaltyMs: 300000 },
          hour: { limit: 100, windowMs: 3600000 },
        },
        priority: 10,
        enabled: true,
      },
      {
        id: 'file-upload-endpoints',
        pattern: /^\/api\/v1\/files.*upload/,
        config: {
          second: { limit: 2, windowMs: 1000 },
          minute: { limit: 10, windowMs: 60000 },
          hour: { limit: 50, windowMs: 3600000 },
        },
        priority: 10,
        enabled: true,
      },
      {
        id: 'workshop-intelligence',
        pattern: /^\/api\/v1\/workshop-intelligence/,
        config: {
          second: { limit: 10, windowMs: 1000 },
          minute: { limit: 100, windowMs: 60000 },
          hour: { limit: 1000, windowMs: 3600000 },
        },
        priority: 8,
        enabled: true,
      },
      {
        id: 'api-endpoints',
        pattern: /^\/api\//,
        config: {
          second: { limit: 50, windowMs: 1000 },
          minute: { limit: 2000, windowMs: 60000 },
        },
        priority: 5,
        enabled: true,
      },
      {
        id: 'public-endpoints',
        pattern: /^\/api\/v1\/public/,
        config: {
          second: { limit: 100, windowMs: 1000 },
          minute: { limit: 5000, windowMs: 60000 },
        },
        priority: 3,
        enabled: true,
      }
    ],

    // Enable adaptive rate limiting based on system load
    enableAdaptive: true,

    // Enable analytics tracking
    enableAnalytics: true,

    // Custom key generator that considers user authentication
    keyGenerator: (req) => {
      const user = (req as any).user;
      if (user?.id) {
        // Different limits for authenticated users based on role
        const role = user.role || 'user';
        return `user:${user.id}:${role}`;
      }

      // Fall back to IP address for anonymous users
      const ip = req.ip || req.connection.remoteAddress || 'unknown';
      return `ip:${ip}`;
    },

    // Custom error handler for rate limit violations
    errorHandler: (error, req, res, _next) => {
      // Log rate limit hits for monitoring
      console.warn('Rate limit exceeded', {
        ip: req.ip,
        path: req.path,
        method: req.method,
        userAgent: req.get('User-Agent'),
        errorCode: error.code
      });

      // Return custom error response
      res.status(429).json({
        error: true,
        code: error.code,
        message: error.code === 'RATE_LIMIT_PENALTY_BOX'
          ? 'Access temporarily blocked due to repeated violations. Please try again later.'
          : 'Too many requests. Please try again later.',
        retryAfter: error.retryAfter,
        details: config.nodeEnv === 'development' ? error.details : undefined,
      });
    }
  });

  // Apply rate limiting to all routes
  app.use(rateLimitMiddleware);

  // Initialize admin tools for rate limit management (only in non-production)
  if (config.nodeEnv !== 'production') {
    rateLimitAdminTools = new RateLimitAdminTools(
      // Limiter and middleware instances would be passed here
      null as any,
      rateLimitMiddleware,
      {
        enabled: true,
        authMiddleware: (req, res, next) => {
          // Simple admin authentication for development
          const adminKey = req.get('X-Admin-Key');
          if (adminKey !== (config.adminKey || 'dev-admin-key')) {
            return res.status(401).json({ error: 'Unauthorized' });
          }
          next();
        },
        prefix: '/admin/rate-limit',
      },
    );

    // Mount admin routes
    app.use('/admin', rateLimitAdminTools.getRouter());
  }

  console.log('✅ Rate Limiting System initialized');
  return { rateLimitMiddleware, rateLimitAdminTools };
};
