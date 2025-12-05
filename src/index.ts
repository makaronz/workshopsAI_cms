// Load environment variables FIRST before any other imports
import './config/env';

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
import { join } from 'path';

// Import routes
import workshopRoutes from './routes/workshops';
import enrollmentRoutes from './routes/enrollments';
import questionnaireRoutes from './routes/api/questionnaires-new';
import responseRoutes from './routes/responses';
import publicRoutes from './routes/public';
import authRoutes from './routes/auth';
import fileRoutes from './routes/api/files';
import { initializePreviewRoutes } from './routes/api/preview';
import fileSignedRoutes from './routes/api/files-signed';
import dashboardRoutes from './routes/api/dashboard';
import workshopIntelligenceRoutes from './routes/api/workshop-intelligence';

// Import configuration
import {
  checkDatabaseHealth,
  closeDatabaseConnection,
} from './config/postgresql-database';
import { redisService } from './config/redis';

// Import LLM services
import { getLLMAnalysisWorker } from './services/llm-worker';
const llmAnalysisWorker = getLLMAnalysisWorker();
import { embeddingsService } from './services/embeddings';

// Import WebSocket and Preview services
import { WebSocketService } from './services/websocketService';
import { PreviewService } from './services/previewService';

// Import Performance Optimization Services
import { initializePerformanceSystem } from './config/performance-integration';
import { DatabaseOptimizationIntegration } from './services/database-optimization-integration';
import { StreamingLLMAnalysisWorker } from './services/streaming-llm-worker';

const app = express();
const server = createServer(app);

// Initialize services
let webSocketService: WebSocketService;
let previewService: PreviewService;

// Initialize Performance Optimization Services
let performanceSystem: any;
let dbOptimization: DatabaseOptimizationIntegration;
let streamingWorker: StreamingLLMAnalysisWorker;

// Environment variables - Fix index signature access
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

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: NODE_ENV === 'production' ? 100 : 1000, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

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
      if (obj.hasOwnProperty(key)) {
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

// Health check endpoint
app.get('/health', async (_req, res) => {
  const [dbHealthy, redisHealthy, llmServicesHealth] = await Promise.all([
    checkDatabaseHealth(),
    redisService.healthCheck(),
    checkLLMServicesHealth(),
  ]);

  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: NODE_ENV,
    database: dbHealthy ? 'connected' : 'disconnected',
    redis: redisHealthy ? 'connected' : 'disconnected',
    llmServices: llmServicesHealth,
  });
});

// LLM services health check
async function checkLLMServicesHealth() {
  try {
    const health = await embeddingsService.healthCheck();
    const queueStats = await llmAnalysisWorker.getQueueStats();
    const streamingStats = streamingWorker ? await streamingWorker.getQueueStats() : { status: 'initializing' };

    return {
      embeddings: health,
      analysisWorker: {
        status: 'active',
        queue: queueStats,
      },
      streamingWorker: streamingStats,
      performanceSystem: performanceSystem ? { status: 'active' } : { status: 'initializing' },
      dbOptimization: dbOptimization ? { status: 'active' } : { status: 'initializing' },
    };
  } catch (error) {
    return {
      embeddings: { status: 'error', error: (error as any).message },
      analysisWorker: { status: 'error', error: (error as any).message },
      streamingWorker: { status: 'error', error: (error as any).message },
      performanceSystem: { status: 'error', error: (error as any).message },
      dbOptimization: { status: 'error', error: (error as any).message },
    };
  }
}

// API path rewrite middleware for frontend compatibility
// Frontend may call /api/auth/*, rewrite to /api/v1/auth/*
app.use('/api', (req, res, next) => {
  if (!req.path.startsWith('/v1/')) {
    req.url = '/v1' + req.url;
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

// Performance monitoring routes (will be initialized after services are set up)

// Preview routes will be initialized dynamically after services are set up

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
    console.log('🔄 Shutting down optimization services...');

    // Shutdown performance optimization services
    // Performance system shutdown is handled by setupGracefulShutdown() in performance-integration.ts

    if (dbOptimization) {
      await dbOptimization.shutdown();
    }
    if (streamingWorker) {
      await streamingWorker.shutdown();
    }

    await llmAnalysisWorker.shutdown();
    await redisService.disconnect();
    await closeDatabaseConnection();
    console.log('✅ All services terminated gracefully');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(async () => {
    console.log('🔄 Shutting down optimization services...');

    // Shutdown performance optimization services  
    // Performance system shutdown is handled by setupGracefulShutdown() in performance-integration.ts

    if (dbOptimization) {
      await dbOptimization.shutdown();
    }
    if (streamingWorker) {
      await streamingWorker.shutdown();
    }

    await llmAnalysisWorker.shutdown();
    await redisService.disconnect();
    await closeDatabaseConnection();
    console.log('✅ All services terminated gracefully');
    process.exit(0);
  });
});

// Start server
const startServer = async () => {
  try {
    // Initialize Performance Optimization Services
    console.log('⚡ Initializing Performance Optimization System...');
    performanceSystem = await initializePerformanceSystem(app, server);

    console.log('🗄️ Initializing Database Optimization System...');
    dbOptimization = new DatabaseOptimizationIntegration();
    await dbOptimization.initialize();

    console.log('🚀 Initializing Streaming LLM Worker...');
    streamingWorker = new StreamingLLMAnalysisWorker();
    await streamingWorker.initialize();

    // Initialize WebSocket service
    console.log('🔌 Initializing WebSocket service...');
    webSocketService = new WebSocketService(server);

    // Initialize Preview service
    console.log('👁️ Initializing Preview service...');
    previewService = new PreviewService(webSocketService);

    // Initialize preview routes
    console.log('🛣️ Initializing Preview routes...');
    const previewRouter = initializePreviewRoutes(previewService);
    app.use('/api/v1/preview', previewRouter);

    // Performance monitoring routes are already initialized in initializePerformanceSystem()
    console.log('📊 Performance monitoring routes initialized');

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
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export { app, server };
// Trigger restart Fri Nov 21 06:13:35 CET 2025
