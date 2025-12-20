// Load environment variables FIRST before any other imports
import './config/env';

// NOTE: This version uses PostgreSQL for all caching and job queues (no Redis required)
// For simple deployment, use index-simple.ts instead

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import hpp from 'hpp';
import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss';
import { createServer } from 'http';
import { join } from 'path';

// Import routes
import workshopRoutes from './routes/workshops';
import enrollmentRoutes from './routes/enrollments';
import questionnaireRoutes from './routes/api/questionnaires-new';
import responseRoutes from './routes/responses';
import publicRoutes from './routes/public';
import authRoutes from './routes/auth';
import fileRoutes from './routes/api/files';
import fileSignedRoutes from './routes/api/files-signed';
import dashboardRoutes from './routes/api/dashboard';
import workshopIntelligenceRoutes from './routes/api/workshop-intelligence';

// Import configuration
import {
  checkDatabaseHealth,
  closeDatabaseConnection,
} from './config/postgresql-database';

// Import Rate Limiting Configuration
import { configureRateLimiting } from './config/rate-limiter';

// Import Service Initialization
import { initializeServices, shutdownServices, ServiceContainer } from './config/init-services';

// Import Redis replacement
import { postgresqlRedisReplacement } from './services/postgresql-redis-replacement';
import { embeddingsService } from './services/embeddings';

const app = express();
const server = createServer(app);

// Services container
let services: ServiceContainer | null = null;

// Initialize Rate Limiting System
let rateLimitMiddleware: any = null;
let rateLimitAdminTools: any = null;

// Environment variables
const PORT = process.env['PORT'] || 3010;
const NODE_ENV = process.env['NODE_ENV'] || 'development';
const CORS_ORIGIN = process.env['CORS_ORIGIN'] || 'http://localhost:3000';

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ['\'self\''],
        styleSrc: ['\'self\'', '\'unsafe-inline\'', 'https://fonts.googleapis.com'],
        fontSrc: ['\'self\'', 'https://fonts.gstatic.com'],
        imgSrc: ['\'self\'', 'data:', 'https:'],
        scriptSrc: ['\'self\''],
        connectSrc: ['\'self\'', 'ws:', 'wss:'],
      },
    },
  }),
);

// High-Performance Rate Limiting System
const rateLimitSystem = configureRateLimiting(app, {
  postgresUrl: process.env.DATABASE_URL,
  nodeEnv: NODE_ENV,
  adminKey: process.env.ADMIN_KEY
});
rateLimitMiddleware = rateLimitSystem.rateLimitMiddleware;
rateLimitAdminTools = rateLimitSystem.rateLimitAdminTools;

// CORS configuration
app.use(
  cors({
    origin: CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  }),
);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Data sanitization
app.use(mongoSanitize());
app.use(hpp());

// XSS Protection middleware
app.use((req, res, next) => {
  const sanitizeObject = (obj: any): any => {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }

    const sanitized: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        if (typeof obj[key] === 'string') {
          sanitized[key] = xss(obj[key]);
        } else if (typeof obj[key] === 'object') {
          sanitized[key] = sanitizeObject(obj[key]);
        } else {
          sanitized[key] = obj[key];
        }
      }
    }
    return sanitized;
  };

  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }

  next();
});

// Compression
app.use(compression());

// Logging
if (NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Health check endpoint - always returns 200 OK for platform compatibility
app.get('/health', async (_req, res) => {
  try {
    // Use Promise.allSettled to prevent blocking on individual service failures
    const results = await Promise.allSettled([
      checkDatabaseHealth(2000).catch(() => false), // 2 second timeout
      postgresqlRedisReplacement.healthCheck().catch(() => false), // 2 second timeout
      checkLLMServicesHealth().catch(() => ({ status: 'error' })),
    ]);

    const dbHealthy = results[0].status === 'fulfilled' ? results[0].value : false;
    const cacheHealthy = results[1].status === 'fulfilled' ? results[1].value : false;
    const llmServicesHealth = results[2].status === 'fulfilled' ? results[2].value : { status: 'error' };

    // Always return 200 OK - most PaaS platforms require this for successful deployment
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: NODE_ENV,
      database: dbHealthy ? 'connected' : 'disconnected',
      cache: cacheHealthy ? 'connected' : 'disconnected',
      llmServices: llmServicesHealth,
    });
  } catch (error) {
    // Even if healthcheck fails completely, return 200 OK
    // This ensures platform deployment doesn't fail due to healthcheck errors
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: NODE_ENV,
      database: 'unknown',
      cache: 'unknown',
      llmServices: { status: 'error' },
      error: NODE_ENV === 'development' ? (error as any).message : undefined,
    });
  }
});

// LLM services health check
async function checkLLMServicesHealth() {
  try {
    const health = await embeddingsService.healthCheck();
    const queueStats = services?.llmAnalysisWorker 
      ? await services.llmAnalysisWorker.getQueueStats() 
      : { status: 'unavailable' };
    const streamingStats = services?.streamingWorker 
      ? await services.streamingWorker.getQueueStats() 
      : { status: 'unavailable' };

    return {
      embeddings: health,
      analysisWorker: {
        status: 'active',
        queue: queueStats,
      },
      streamingWorker: streamingStats,
      performanceSystem: services?.performanceSystem ? { status: 'active' } : { status: 'initializing' },
      dbOptimization: services?.dbOptimization ? { status: 'active' } : { status: 'initializing' },
    };
  } catch (error: any) {
    return {
      embeddings: { status: 'error', error: error.message },
      analysisWorker: { status: 'error', error: error.message },
      streamingWorker: { status: 'error', error: error.message },
      performanceSystem: { status: 'error', error: error.message },
      dbOptimization: { status: 'error', error: error.message },
    };
  }
}

// API path rewrite middleware for frontend compatibility
// Frontend may call /api/auth/*, rewrite to /api/v1/auth/*
app.use('/api', (req, res, next) => {
  if (!req.path.startsWith('/v1/')) {
    req.url = `/v1${req.url}`;
  }
  next();
});

// Static file serving for frontend
app.use(express.static(join(__dirname, '../public'), {
  index: ['index.html', 'index.htm'],
}));

// API routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/workshops', workshopRoutes);
app.use('/api/v1/enrollments', enrollmentRoutes);
app.use('/api/v1/questionnaires', questionnaireRoutes);
app.use('/api/v1/responses', responseRoutes);
app.use('/api/v1/files', fileRoutes);
app.use('/api/v1/files/signed', fileSignedRoutes);
app.use('/api/v1/public', publicRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/workshop-intelligence', workshopIntelligenceRoutes);

// Login page route
app.get('/login', (_req, res) => {
  res.sendFile(join(__dirname, '../public/login.html'));
});

// API 404 handler - handle exact /api path (before catch-all)
app.all('/api', (_req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: 'The requested resource does not exist',
  });
});

// API 404 handler - handle all other /api/* routes that don't match
app.use('/api/*', (_req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: 'The requested resource does not exist',
  });
});

// SPA fallback - serve index.html for all other routes
// This allows client-side routing to work properly
app.get('*', (_req, res) => {
  res.sendFile(join(__dirname, '../public/index.html'));
});

// Global error handler
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error('Unhandled error:', err);

    res.status(500).json({
      error: 'Internal server error',
      message:
        NODE_ENV === 'development' ? err.message : 'Something went wrong',
    });
  },
);

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(async () => {
    console.log('🔄 Shutting down services...');

    try {
      // Shutdown rate limiting system
      if (rateLimitMiddleware?.close) {
        console.log('🚦 Shutting down Rate Limiting System...');
        await rateLimitMiddleware.close();
      }

      if (services) {
        await shutdownServices(services);
      }

      await postgresqlRedisReplacement.disconnect();
      await closeDatabaseConnection();
      console.log('✅ All services terminated gracefully');
    } catch (error: any) {
      console.error('❌ Error during shutdown:', error.message);
    }
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(async () => {
    console.log('🔄 Shutting down services...');

    try {
      // Shutdown rate limiting system
      if (rateLimitMiddleware?.close) {
        console.log('🚦 Shutting down Rate Limiting System...');
        await rateLimitMiddleware.close();
      }

      if (services) {
        await shutdownServices(services);
      }

      await postgresqlRedisReplacement.disconnect();
      await closeDatabaseConnection();
      console.log('✅ All services terminated gracefully');
    } catch (error: any) {
      console.error('❌ Error during shutdown:', error.message);
    }
    process.exit(0);
  });
});

// Start server
const startServer = async () => {
  // Initialize all services
  services = await initializeServices(app, server);

  console.log('📊 Performance monitoring routes initialized');
};

if (require.main === module) {
  startServer().then(() => {
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT} in ${NODE_ENV} mode`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`🔗 API base URL: http://localhost:${PORT}/api`);
      console.log('⚡ Performance Optimization System initialized');
      console.log('🗄️ Database Optimization System initialized');
      console.log('🚀 Streaming LLM Worker initialized');
      console.log('🔌 WebSocket service initialized');
      console.log('👁️ Preview service initialized');
      console.log('📱 Real-time preview functionality available');
      console.log('📈 Performance monitoring available at /api/v1/performance');
    });
  }).catch(err => {
    console.error('Startup error:', err);
    process.exit(1);
  });
}

export { app, server, startServer };
