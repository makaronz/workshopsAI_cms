import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import hpp from 'hpp';
import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss';
import { createServer } from 'http';
import { config } from 'dotenv';

// Import optimized services
import {
  checkDatabaseHealth,
  closeDatabaseConnection,
} from './config/postgresql-database';
import { optimizedRedisService } from './config/optimized-redis';
import { monitoringService } from './services/monitoringService';

// Import performance middleware
import {
  requestTiming,
  rateLimit as smartRateLimit,
  memoryMonitor,
} from './middleware/performanceMiddleware';

// Import routes
import workshopRoutes from './routes/workshops';
import enrollmentRoutes from './routes/enrollments';
import questionnaireRoutes from './routes/api/questionnaires-new';
import responseRoutes from './routes/responses';
import publicRoutes from './routes/public';
import authRoutes from './routes/auth';
import fileRoutes from './routes/api/files';
import fileSignedRoutes from './routes/api/files-signed';

// Import LLM services
import { llmAnalysisWorker } from './services/llm-worker';
import { embeddingsService } from './services/embeddings';

// Import WebSocket and Preview services
import { WebSocketService } from './services/websocketService';
import { PreviewService } from './services/previewService';

// Load environment variables
config();

const app = express();
const server = createServer(app);

// Initialize services
let webSocketService: WebSocketService;
let previewService: PreviewService;

// Environment variables - Fix index signature access
const PORT = process.env['PORT'] || 3001;
const NODE_ENV = process.env['NODE_ENV'] || 'development';
const CORS_ORIGIN = process.env['CORS_ORIGIN'] || 'http://localhost:3000';

// Enhanced security middleware with performance optimizations
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
    // Enable HSTS for production
    hsts: NODE_ENV === 'production' ? {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    } : false,
  }),
);

// Performance monitoring middleware (must be first)
app.use(requestTiming());
app.use(memoryMonitor());

// Intelligent rate limiting with different limits for different environments
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: NODE_ENV === 'production' ? 100 : 1000, // Different limits for production/dev
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip successful requests to reduce overhead
  skipSuccessfulRequests: NODE_ENV === 'production',
  // Skip failed requests to prevent abuse amplification
  skipFailedRequests: false,
  // Custom key generator for better rate limiting
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress || 'unknown';
  },
});

app.use(limiter);

// CORS configuration with performance optimizations
app.use(
  cors({
    origin: CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    // Pre-flight cache duration
    maxAge: 86400, // 24 hours
  }),
);

// Body parsing middleware with optimized limits
app.use(express.json({ 
  limit: '10mb',
  // Enable strict JSON parsing for security
  strict: true,
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb',
  // Extended URL encoding with parameter limit
  parameterLimit: 1000,
}));

// Data sanitization
app.use(mongoSanitize());
app.use(hpp());

// Optimized XSS Protection middleware with caching
const xssCache = new Map<string, string>();
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
      if (obj.hasOwnProperty(key)) {
        if (typeof obj[key] === 'string') {
          // Use cache for XSS protection
          const cached = xssCache.get(obj[key]);
          if (cached) {
            sanitized[key] = cached;
          } else {
            const clean = xss(obj[key]);
            xssCache.set(obj[key], clean);
            sanitized[key] = clean;
          }
        } else if (typeof obj[key] === 'object') {
          sanitized[key] = sanitizeObject(obj[key]);
        } else {
          sanitized[key] = obj[key];
        }
      }
    }
    return sanitized;
  };

  // Sanitize request data
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

// Compression with performance optimizations
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    // Skip compression for small responses
    return compression.filter(req, res);
  },
  threshold: 1024, // Only compress responses larger than 1KB
  level: 6, // Balanced compression level
}));

// Enhanced logging with performance metrics
if (NODE_ENV === 'development') {
  app.use(morgan('dev', {
    // Add custom tokens for performance tracking
    stream: {
      write: (message: string) => {
        // Log to console in development
        console.log(message.trim());
      }
    }
  }));
} else {
  app.use(morgan('combined', {
    // Add performance tracking
    skip: (req, res) => {
      // Skip logging for health checks and metrics
      return req.url === '/health' || req.url === '/metrics';
    }
  }));
}

// Health check endpoint with comprehensive system status
app.get('/health', async (_req, res) => {
  try {
    const [dbHealthy, redisHealthy, llmServicesHealth] = await Promise.all([
      checkDatabaseHealth(),
      optimizedRedisService.healthCheck(),
      checkLLMServicesHealth(),
    ]);

    const systemStatus = monitoringService.getSystemStatus();
    const redisStats = optimizedRedisService.getStats();

    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: NODE_ENV,
      database: dbHealthy ? 'connected' : 'disconnected',
      redis: redisHealthy.healthy ? 'connected' : 'disconnected',
      llmServices: llmServicesHealth,
      performance: {
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        system: systemStatus,
      },
      cache: {
        hitRate: redisStats.hitRate,
        totalKeys: redisStats.totalKeys,
        avgResponseTime: redisStats.avgResponseTime,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Health check failed',
      error: NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
});

// Metrics endpoint for Prometheus
app.get('/metrics', async (_req, res) => {
  try {
    const systemStatus = monitoringService.getSystemStatus();
    const performanceMetrics = monitoringService.getPerformanceMetrics();
    
    // Create Prometheus metrics format
    const metrics = [
      `# HELP workshopsai_uptime_seconds Application uptime in seconds`,
      `# TYPE workshopsai_uptime_seconds counter`,
      `workshopsai_uptime_seconds ${systemStatus.uptime}`,
      '',
      `# HELP workshopsai_requests_total Total number of requests`,
      `# TYPE workshopsai_requests_total counter`,
      `workshopsai_requests_total ${performanceMetrics.requestCount}`,
      '',
      `# HELP workshopsai_response_time_ms Average response time in milliseconds`,
      `# TYPE workshopsai_response_time_ms gauge`,
      `workshopsai_response_time_ms ${performanceMetrics.averageResponseTime}`,
      '',
      `# HELP workshopsai_error_rate Percentage of requests that resulted in errors`,
      `# TYPE workshopsai_error_rate gauge`,
      `workshopsai_error_rate ${performanceMetrics.errorRate}`,
      '',
      `# HELP workshopsai_memory_bytes Memory usage in bytes`,
      `# TYPE workshopsai_memory_bytes gauge`,
      `workshopsai_memory_bytes{type="heap_used"} ${systemStatus.metrics.memory.heapUsed}`,
      `workshopsai_memory_bytes{type="heap_total"} ${systemStatus.metrics.memory.heapTotal}`,
      `workshopsai_memory_bytes{type="rss"} ${systemStatus.metrics.memory.rss}`,
      '',
    ];

    res.set('Content-Type', 'text/plain');
    res.send(metrics.join('\n'));
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get metrics',
      message: error.message,
    });
  }
});

// System status endpoint for detailed monitoring
app.get('/api/v1/system/status', async (_req, res) => {
  try {
    const systemStatus = monitoringService.getSystemStatus();
    res.json(systemStatus);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get system status',
      message: error.message,
    });
  }
});

// Performance metrics endpoint
app.get('/api/v1/system/metrics', async (_req, res) => {
  try {
    const healthChecks = monitoringService.getHealthChecks();
    const alerts = monitoringService.getAlerts({ limit: 50 });
    const performanceMetrics = monitoringService.getPerformanceMetrics();
    const redisStats = optimizedRedisService.getStats();

    res.json({
      healthChecks,
      alerts,
      performance: performanceMetrics,
      cache: redisStats,
      system: monitoringService.getSystemMetrics(),
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get metrics',
      message: error.message,
    });
  }
});

// LLM services health check
async function checkLLMServicesHealth() {
  try {
    const health = await embeddingsService.healthCheck();
    const queueStats = await llmAnalysisWorker.getQueueStats();

    return {
      embeddings: health,
      analysisWorker: {
        status: 'active',
        queue: queueStats,
      },
    };
  } catch (error) {
    return {
      embeddings: { status: 'error', error: error.message },
      analysisWorker: { status: 'error', error: error.message },
    };
  }
}

// API routes with performance optimizations
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/workshops', workshopRoutes);
app.use('/api/v1/enrollments', enrollmentRoutes);
app.use('/api/v1/questionnaires', questionnaireRoutes);
app.use('/api/v1/responses', responseRoutes);
app.use('/api/v1/files', fileRoutes);
app.use('/api/v1/files/signed', fileSignedRoutes);
app.use('/api/v1/public', publicRoutes);

// Preview routes will be initialized dynamically after services are set up

// Root endpoint
app.get('/', (_req, res) => {
  res.json({
    message: 'WorkshopsAI CMS API - Optimized',
    version: '1.0.0',
    environment: NODE_ENV,
    performance: {
      optimized: true,
      monitoring: true,
      caching: true,
    },
  });
});

// 404 handler with performance logging
app.use('*', (req, res) => {
  logger.warn('404 - Route not found', {
    method: req.method,
    url: req.url,
    userAgent: req.headers['user-agent'],
    ip: req.ip,
  });

  res.status(404).json({
    error: 'Route not found',
    message: 'The requested resource does not exist',
    path: req.url,
  });
});

// Enhanced global error handler with performance monitoring
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    // Log error with performance context
    logger.error('Unhandled error:', {
      error: err.message,
      stack: err.stack,
      method: req.method,
      url: req.url,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
      memory: process.memoryUsage(),
    });

    // Create alert for critical errors
    if (err.name === 'TypeError' || err.name === 'ReferenceError') {
      monitoringService.createAlert({
        severity: 'high',
        type: 'application_error',
        message: 'Critical application error: ' + err.message,
        metadata: {
          method: req.method,
          url: req.url,
          stack: err.stack,
        },
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      message:
        NODE_ENV === 'development' ? err.message : 'Something went wrong',
      requestId: req.headers['x-request-id'],
    });
  },
);

// Enhanced graceful shutdown with monitoring
const gracefulShutdown = async (signal: string) => {
  logger.info(`${signal} received, shutting down gracefully`);
  
  try {
    // Stop accepting new connections
    server.close(async () => {
      logger.info('HTTP server closed');
      
      // Shutdown services in order
      await Promise.all([
        llmAnalysisWorker.shutdown(),
        optimizedRedisService.disconnect(),
        closeDatabaseConnection(),
        monitoringService.stopMonitoring(),
      ]);

      logger.info('All services shut down successfully');
      process.exit(0);
    });

    // Force shutdown after 30 seconds
    setTimeout(() => {
      logger.error('Forced shutdown due to timeout');
      process.exit(1);
    }, 30000);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

// Optimized server startup
const startServer = async () => {
  try {
    // Start monitoring first
    logger.info('🔍 Starting monitoring service...');
    monitoringService.startMonitoring();

    // Initialize WebSocket service
    logger.info('🔌 Initializing WebSocket service...');
    webSocketService = new WebSocketService(server);

    // Initialize Preview service
    logger.info('👁️ Initializing Preview service...');
    previewService = new PreviewService(webSocketService);

    // Initialize preview routes
    logger.info('🛣️ Initializing Preview routes...');
    const { initializePreviewRoutes } = require('./routes/api/preview');
    const previewRouter = initializePreviewRoutes(previewService);
    app.use('/api/v1/preview', previewRouter);

    // Warm up Redis cache with common data
    logger.info('🔥 Warming up cache...');
    // await optimizedRedisService.warmCache([
    //   {
    //     key: 'common-workshops',
    //     fetchFunction: () => workshopService.getPublishedWorkshops(),
    //     options: { ttl: 3600, tags: ['workshops'] },
    //   },
    //   // Add more cache warming as needed
    // ]);

    server.listen(PORT, () => {
      logger.info(`🚀 Optimized server running on port ${PORT} in ${NODE_ENV} mode`);
      logger.info(`📊 Health check: http://localhost:${PORT}/health`);
      logger.info(`📈 Metrics: http://localhost:${PORT}/metrics`);
      logger.info(`🔗 API base URL: http://localhost:${PORT}/api`);
      logger.info('🔌 WebSocket service initialized');
      logger.info('👁️ Preview service initialized');
      logger.info('📱 Real-time preview functionality available');
      logger.info('⚡ Performance optimizations enabled');
      logger.info('🔍 Monitoring and alerting active');
    });

    // Log system information
    logger.info('System Information:', {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      memory: process.memoryUsage(),
      uptime: process.uptime(),
    });

  } catch (error) {
    logger.error('Failed to start optimized server:', error);
    process.exit(1);
  }
};

startServer();

export { app, server };
