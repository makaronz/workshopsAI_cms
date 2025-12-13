/**
 * Rate Limiting Integration Example
 *
 * Shows how to integrate the high-performance rate limiting system
 * into an Express application with various configurations
 */

import express from 'express';
import { createRateLimitMiddleware, RateLimitAdminTools } from '../src/rate-limiting';

async function createApp() {
  const app = express();

  // Basic middleware
  app.use(express.json());

  // Create rate limiting middleware with custom configuration
  const rateLimitMiddleware = createRateLimitMiddleware({
    // PostgreSQL URL for distributed rate limiting (optional)
    postgresUrl: process.env.DATABASE_URL,

    // Node identifier for clustering
    nodeId: `api-node-${process.pid}`,

    // Custom default configuration
    defaultConfig: {
      second: { limit: 20, windowMs: 1000 },    // 20 requests per second
      minute: { limit: 500, windowMs: 60000 },  // 500 requests per minute
      hour: { limit: 10000, windowMs: 3600000 }, // 10K requests per hour
      day: { limit: 100000, windowMs: 86400000 } // 100K requests per day
    },

    // Custom rate limit rules
    rules: [
      {
        id: 'auth-strict',
        pattern: /^\/api\/v1\/auth/,
        config: {
          second: { limit: 5, windowMs: 1000, penaltyMs: 30000 },
          minute: { limit: 20, windowMs: 60000, penaltyMs: 300000 }
        },
        priority: 10,
        enabled: true
      },
      {
        id: 'file-upload',
        pattern: /^\/api\/v1\/files\/upload/,
        config: {
          second: { limit: 2, windowMs: 1000 },
          minute: { limit: 10, windowMs: 60000 },
          hour: { limit: 50, windowMs: 3600000 }
        },
        priority: 10,
        enabled: true
      },
      {
        id: 'api-endpoints',
        pattern: /^\/api\//,
        config: {
          second: { limit: 50, windowMs: 1000 },
          minute: { limit: 1000, windowMs: 60000 }
        },
        priority: 5,
        enabled: true
      },
      {
        id: 'premium-users',
        pattern: /^\/api\/v1\/premium/,
        config: {
          second: { limit: 100, windowMs: 1000 },
          minute: { limit: 5000, windowMs: 60000 },
          hour: { limit: 50000, windowMs: 3600000 }
        },
        priority: 15,
        enabled: true,
        matcher: (req) => {
          // Only apply to premium users
          return (req as any).user?.tier === 'premium';
        }
      }
    ],

    // Enable adaptive rate limiting based on system load
    enableAdaptive: true,

    // Enable analytics tracking
    enableAnalytics: true,

    // Custom key generator that considers user authentication
    keyGenerator: (req) => {
      const user = (req as any).user;
      if (user && user.id) {
        // Different limits for authenticated users
        return `user:${user.id}:${user.tier || 'basic'}`;
      }

      // Fall back to IP address for anonymous users
      const ip = req.ip || req.connection.remoteAddress || 'unknown';
      return `ip:${ip}`;
    },

    // Skip rate limiting for successful health checks
    skipSuccessfulRequests: false,

    // Custom error handler for rate limit violations
    errorHandler: (error, req, res, next) => {
      // Log rate limit hits for monitoring
      console.warn('Rate limit exceeded', {
        ip: req.ip,
        path: req.path,
        method: req.method,
        userAgent: req.get('User-Agent'),
        error: error.message
      });

      // Return custom error response
      res.status(429).json({
        error: true,
        code: error.code,
        message: error.code === 'RATE_LIMIT_PENALTY_BOX'
          ? 'Access temporarily blocked due to repeated violations. Please try again later.'
          : 'Too many requests. Please try again later.',
        retryAfter: error.retryAfter,
        details: process.env.NODE_ENV === 'development' ? {
          limit: error.details?.limit,
          current: error.details?.current,
          resetTime: error.details?.resetTime,
          restrictiveLevel: error.details?.restrictiveLevel
        } : undefined
      });
    }
  });

  // Apply rate limiting to all routes
  app.use(rateLimitMiddleware);

  // Create admin tools for rate limit management
  const adminTools = new RateLimitAdminTools(
    // This would be the actual limiter instance from middleware
    null as any,
    // This would be the actual middleware instance
    rateLimitMiddleware as any,
    {
      enabled: process.env.NODE_ENV !== 'production',
      authMiddleware: (req, res, next) => {
        // Simple admin authentication - in production, use proper auth
        const adminKey = req.get('X-Admin-Key');
        if (adminKey !== process.env.ADMIN_KEY) {
          return res.status(401).json({ error: 'Unauthorized' });
        }
        next();
      },
      prefix: '/admin/rate-limit'
    }
  );

  // Mount admin routes
  app.use('/admin', adminTools.getRouter());

  // API Routes with different rate limiting characteristics

  // Authentication endpoints - strict limits
  app.post('/api/v1/auth/login', async (req, res) => {
    // Simulate authentication
    res.json({
      success: true,
      token: 'mock-jwt-token',
      user: { id: 'user123', tier: 'basic' }
    });
  });

  app.post('/api/v1/auth/register', async (req, res) => {
    // Simulate registration
    res.json({
      success: true,
      message: 'User registered successfully'
    });
  });

  // Regular API endpoints
  app.get('/api/v1/data', async (req, res) => {
    res.json({
      data: ['item1', 'item2', 'item3'],
      timestamp: new Date().toISOString()
    });
  });

  // File upload endpoint - very strict limits
  app.post('/api/v1/files/upload', async (req, res) => {
    // Simulate file upload
    res.json({
      success: true,
      fileId: 'file123',
      url: 'https://example.com/files/file123'
    });
  });

  // Premium endpoints with higher limits
  app.get('/api/v1/premium/analytics', async (req, res) => {
    // Simulate premium analytics
    res.json({
      analytics: {
        views: 10000,
        conversions: 500,
        revenue: 5000
      }
    });
  });

  // Public endpoints with higher limits
  app.get('/api/v1/public/content', async (req, res) => {
    res.json({
      content: 'Public content available to everyone',
      public: true
    });
  });

  // Endpoint to check current rate limit status
  app.get('/api/v1/rate-limit-status', async (req, res) => {
    try {
      const status = await (rateLimitMiddleware as any).getStatus(req);
      res.json({
        status,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get rate limit status' });
    }
  });

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  return app;
}

// Example of how to use the rate limiting system
async function demonstrateRateLimiting() {
  console.log('🚀 Rate Limiting Integration Example\n');

  const app = await createApp();
  const server = app.listen(3010, () => {
    console.log('📡 Example server running on http://localhost:3010');
    console.log('\n📋 Available Endpoints:');
    console.log('  GET  /health - Health check');
    console.log('  GET  /api/v1/rate-limit-status - Check current rate limit status');
    console.log('  POST /api/v1/auth/login - Authentication (strict limits)');
    console.log('  GET  /api/v1/data - Regular API endpoint');
    console.log('  POST /api/v1/files/upload - File upload (very strict limits)');
    console.log('  GET  /api/v1/premium/analytics - Premium endpoint (high limits)');
    console.log('  GET  /api/v1/public/content - Public endpoint (high limits)');

    if (process.env.NODE_ENV !== 'production') {
      console.log('\n🔧 Admin Endpoints:');
      console.log('  GET  /admin/rate-limit/analytics - View rate limit analytics');
      console.log('  GET  /admin/rate-limit/rules - View rate limit rules');
      console.log('  GET  /admin/rate-limit/metrics - System metrics');
      console.log('  POST /admin/rate-limit/clients/:clientId/reset - Reset client limits');
    }

    console.log('\n💡 Try making rapid requests to see rate limiting in action!');
    console.log('   Use curl or Postman to test different endpoints');
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('\n🔄 Shutting down rate limiting system...');

    // Close rate limiter
    await (rateLimitMiddleware as any).close();

    server.close(() => {
      console.log('✅ Server shutdown complete');
      process.exit(0);
    });
  });
}

// Run the example if this file is executed directly
if (require.main === module) {
  demonstrateRateLimiting().catch(console.error);
}

export { createApp };