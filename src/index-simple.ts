// Load environment variables FIRST before any other imports
import './config/env';

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
import { initializePreviewRoutes } from './routes/api/preview';
import fileSignedRoutes from './routes/api/files-signed';
import dashboardRoutes from './routes/api/dashboard';
import workshopIntelligenceRoutes from './routes/api/workshop-intelligence';

// Import configuration
import {
  checkDatabaseHealth,
  closeDatabaseConnection,
} from './config/postgresql-database';

// Import LLM services
import { getLLMAnalysisWorker } from './services/llm-worker';
import { embeddingsService } from './services/embeddings';

// Import WebSocket and Preview services
import { WebSocketService } from './services/websocketService';
import { PreviewService } from './services/previewService';

// Simple in-memory cache for small team
class SimpleCache {
  private cache = new Map();

  set(key: string, value: any, ttlSeconds?: number): void {
    this.cache.set(key, { value, expires: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null });
  }

  get(key: string): any {
    const item = this.cache.get(key);
    if (!item) return null;
    if (item.expires && Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }
    return item.value;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }
}

const app = express();
const server = createServer(app);

// Initialize simple cache
const simpleCache = new SimpleCache();

// Initialize services
let webSocketService: WebSocketService;
let previewService: PreviewService;

// LLM worker - disabled for simple setup
let llmAnalysisWorker: ReturnType<typeof getLLMAnalysisWorker> | null = null;

// Environment variables
const PORT = process.env['PORT'] || 3010;
const NODE_ENV = process.env['NODE_ENV'] || 'development';
const CORS_ORIGIN = process.env['CORS_ORIGIN'] || 'http://localhost:3000';

// Security middleware (simplified)
app.use(helmet());

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

// XSS Protection middleware (simplified)
app.use((req, res, next) => {
  const sanitizeString = (str: string): string => {
    return xss(str);
  };

  if (req.body && typeof req.body === 'object') {
    for (const key in req.body) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitizeString(req.body[key]);
      }
    }
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
  try {
    const dbHealthy = await checkDatabaseHealth(2000).catch(() => false);

    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: NODE_ENV,
      database: dbHealthy ? 'connected' : 'disconnected',
      cache: 'in-memory',
    });
  } catch (error) {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: NODE_ENV,
      database: 'unknown',
      cache: 'in-memory',
      error: NODE_ENV === 'development' ? (error as any).message : undefined,
    });
  }
});

// API path rewrite middleware
app.use('/api', (req, res, next) => {
  if (!req.path.startsWith('/v1/')) {
    req.url = '/v1' + req.url;
  }
  next();
});

// Static file serving
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

// Preview routes
app.get('/login', (_req, res) => {
  res.sendFile(join(__dirname, '../public/login.html'));
});

// API 404 handlers
app.all('/api', (_req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: 'The requested resource does not exist',
  });
});

app.use('/api/*', (_req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: 'The requested resource does not exist',
  });
});

// SPA fallback
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
      message: NODE_ENV === 'development' ? err.message : 'Something went wrong',
    });
  },
);

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(async () => {
    try {
      await closeDatabaseConnection();
      console.log('✅ All services terminated gracefully');
    } catch (error) {
      console.error('❌ Error during shutdown:', error.message);
    }
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(async () => {
    try {
      await closeDatabaseConnection();
      console.log('✅ All services terminated gracefully');
    } catch (error) {
      console.error('❌ Error during shutdown:', error.message);
    }
    process.exit(0);
  });
});

// Start server
const startServer = async () => {
  console.log('🚀 Starting simple WorkshopsAI CMS...');

  // WebSocket service (simplified)
  try {
    webSocketService = new WebSocketService(server);
    previewService = new PreviewService(webSocketService);
    const previewRouter = initializePreviewRoutes(previewService);
    app.use('/api/v1/preview', previewRouter);
    console.log('✅ WebSocket service initialized');
  } catch (error) {
    console.warn('⚠️ WebSocket service initialization failed:', error.message);
  }

  server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT} in ${NODE_ENV} mode`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🔗 API base URL: http://localhost:${PORT}/api`);
    console.log('✅ Simple WorkshopsAI CMS ready for up to 10 users');
  });
};

if (require.main === module) {
  startServer().catch(err => {
    console.error('Startup error:', err);
    process.exit(1);
  });
}

export { app, server, startServer };