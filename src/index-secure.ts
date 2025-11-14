import express from 'express';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import hpp from 'hpp';
import mongoSanitize from 'express-mongo-sanitize';
import { createServer } from 'http';
import { config } from 'dotenv';

// Import enhanced security middleware
import securityMiddleware, {
  rateLimiters,
  inputSanitization,
  csrfProtection,
  validateContentType,
  validateRequestSize,
  ipBlocking,
  securityLogging,
  gdprCompliance,
  cspNonce,
  apiSecurityHeaders,
} from './middleware/security';

// Import advanced authentication
import authenticateJWT, {
  refreshToken,
  logout,
  authRateLimit,
} from './middleware/advanced-auth';

// Import GDPR middleware
import gdprMiddleware, {
  gdprHeaders,
  cookieConsent,
  dataBreachDetection,
  dpiaValidation,
  dataMinimization,
  purposeLimitation,
} from './middleware/gdpr-middleware';

// Import security monitoring
import securityMonitor, {
  securityMonitoringMiddleware,
  getSecurityMetrics,
  isIPBlocked,
} from './services/security-monitoring';

// Import routes
import workshopRoutes from './routes/workshops';
import enrollmentRoutes from './routes/enrollments';
import questionnaireRoutes from './routes/api/questionnaires-new';
import responseRoutes from './routes/responses';
import publicRoutes from './routes/public';
import authRoutes from './routes/auth';
import fileRoutes from './routes/api/files';
import fileSignedRoutes from './routes/api/files-signed';

// Import configuration
import {
  checkDatabaseHealth,
  closeDatabaseConnection,
} from './config/postgresql-database';
import { redisService } from './config/redis';

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

// ===== SECURITY MIDDLEWARE STACK =====

// 1. IP-based blocking for known malicious IPs
const blockedIPs = process.env.BLOCKED_IPS?.split(',') || [];
app.use(ipBlocking(blockedIPs));

// 2. Enhanced security headers
app.use(securityMiddleware.securityHeaders);
app.use(apiSecurityHeaders);

// 3. GDPR compliance headers
app.use(gdprHeaders);

// 4. Security logging and monitoring
app.use(securityLogging);
app.use(securityMonitoringMiddleware);

// 5. Data breach detection
app.use(dataBreachDetection);

// 6. Rate limiting (general)
app.use(rateLimiters.general);

// 7. Enhanced CORS configuration with security considerations
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);

      // Check if origin is in allowed list
      const allowedOrigins = CORS_ORIGIN.split(',').map(o => o.trim());
      if (allowedOrigins.includes(origin) || NODE_ENV === 'development') {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'), false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-CSRF-Token',
      'X-Processing-Purpose',
    ],
    exposedHeaders: ['X-Total-Count', 'X-Rate-Limit-Remaining'],
    maxAge: 86400, // 24 hours
    optionsSuccessStatus: 200,
  }),
);

// 8. Body parsing with size limits and validation
app.use(express.json({
  limit: '10mb',
  strict: true,
  type: ['application/json', 'application/vnd.api+json'],
}));
app.use(express.urlencoded({
  extended: true,
  limit: '10mb',
  parameterLimit: 1000,
}));

// 9. Request size validation for security
app.use(validateRequestSize(10 * 1024 * 1024)); // 10MB

// 10. Content type validation for API routes
app.use('/api', validateContentType(['application/json', 'application/vnd.api+json']));

// 11. Enhanced data sanitization
app.use(inputSanitization);
app.use(mongoSanitize());
app.use(hpp());

// 12. Compression
app.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
}));

// 13. CSP nonce generation
app.use(cspNonce);

// 14. GDPR compliance middleware
app.use(gdprCompliance);
app.use(cookieConsent);

// 15. Enhanced logging
if (NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', {
    skip: (req, res) => {
      // Skip logging for health checks and static assets
      return req.path === '/health' || req.path.startsWith('/static');
    },
  }));
}

// ===== SECURITY ENDPOINTS =====

// Security metrics endpoint (admin only)
app.get('/api/admin/security/metrics', authenticateJWT, (req, res) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const metrics = getSecurityMetrics();
  res.json({
    success: true,
    data: metrics,
    timestamp: new Date().toISOString(),
  });
});

// Security events endpoint (admin only)
app.get('/api/admin/security/events', authenticateJWT, (req, res) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const events = securityMonitor.getEvents(req.query);
  res.json({
    success: true,
    data: events,
    timestamp: new Date().toISOString(),
  });
});

// Block IP endpoint (admin only)
app.post('/api/admin/security/block-ip', authenticateJWT, (req, res) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { ip, reason } = req.body;
  if (!ip || !reason) {
    return res.status(400).json({ error: 'IP and reason are required' });
  }

  const event = securityMonitor.blockIP(ip, reason);
  res.json({
    success: true,
    data: { eventId: event.id },
    message: `IP ${ip} has been blocked`,
  });
});

// Token refresh endpoint
app.post('/api/auth/refresh', refreshToken);

// Logout endpoint
app.post('/api/auth/logout', logout);

// Health check endpoint with security status
app.get('/health', async (_req, res) => {
  const [dbHealthy, redisHealthy, llmServicesHealth] = await Promise.all([
    checkDatabaseHealth(),
    redisService.healthCheck(),
    checkLLMServicesHealth(),
  ]);

  // Get security metrics
  const securityMetrics = getSecurityMetrics();

  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: NODE_ENV,
    database: dbHealthy ? 'connected' : 'disconnected',
    redis: redisHealthy ? 'connected' : 'disconnected',
    llmServices: llmServicesHealth,
    security: {
      criticalEvents: securityMetrics.criticalEvents,
      highEvents: securityMetrics.highEvents,
      totalEvents: securityMetrics.totalEvents,
      uniqueIPs: securityMetrics.uniqueIPs,
    },
  });
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

// ===== API ROUTES WITH ENHANCED SECURITY =====

// Apply authentication rate limiting to auth routes
app.use('/api/v1/auth', authRateLimit, authRoutes);

// Apply DPIA validation to data processing routes
app.use('/api/v1/responses', dpiaValidation('research_analysis'), responseRoutes);
app.use('/api/v1/questionnaires', dpiaValidation('research_analysis'), questionnaireRoutes);

// Apply data minimization to enrollment routes
app.use('/api/v1/enrollments', dataMinimization([
  'workshopId', 'participantId', 'status', 'notes', 'specialRequirements',
]), enrollmentRoutes);

// Apply purpose limitation to workshop routes
app.use('/api/v1/workshops', purposeLimitation('workshop_management'), workshopRoutes);

// File upload routes with enhanced security
app.use('/api/v1/files', rateLimiters.fileUpload, fileRoutes);
app.use('/api/v1/files/signed', rateLimiters.fileUpload, fileSignedRoutes);

// Public routes (no authentication required but still secured)
app.use('/api/v1/public', publicRoutes);

// ===== CSRF PROTECTION FOR STATE-CHANGING OPERATIONS =====
app.use('/api/v1', csrfProtection);

// ===== ROOT AND ERROR HANDLING =====

// Root endpoint
app.get('/', (_req, res) => {
  res.json({
    message: 'WorkshopsAI CMS API - Secured',
    version: '1.0.0',
    environment: NODE_ENV,
    security: 'Enhanced security measures active',
    compliance: 'GDPR compliant',
  });
});

// 404 handler
app.use('*', (_req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: 'The requested resource does not exist',
    code: 'ROUTE_NOT_FOUND',
  });
});

// Enhanced global error handler
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    // Log security-related errors
    if (err.name === 'UnauthorizedError' || err.message.includes('security')) {
      securityMonitor.recordEvent({
        type: 'SECURITY_ERROR',
        severity: 'HIGH',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        userId: req.user?.id,
        sessionId: req.session?.id,
        details: {
          error: err.message,
          stack: err.stack,
          url: req.url,
          method: req.method,
        },
      });
    }

    console.error('Unhandled error:', err);

    // Don't expose internal errors in production
    const message = NODE_ENV === 'development' ? err.message : 'Something went wrong';
    const code = err.name === 'ValidationError' ? 400 : 500;

    res.status(code).json({
      error: 'Internal server error',
      message,
      code: 'INTERNAL_ERROR',
      ...(NODE_ENV === 'development' && { stack: err.stack }),
    });
  },
);

// ===== GRACEFUL SHUTDOWN WITH SECURITY CLEANUP =====

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');

  // Log shutdown event
  securityMonitor.recordEvent({
    type: 'SYSTEM_SHUTDOWN',
    severity: 'MEDIUM',
    ip: 'system',
    details: { reason: 'SIGTERM' },
  });

  server.close(async () => {
    await llmAnalysisWorker.shutdown();
    await redisService.disconnect();
    await closeDatabaseConnection();
    console.log('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');

  // Log shutdown event
  securityMonitor.recordEvent({
    type: 'SYSTEM_SHUTDOWN',
    severity: 'MEDIUM',
    ip: 'system',
    details: { reason: 'SIGINT' },
  });

  server.close(async () => {
    await llmAnalysisWorker.shutdown();
    await redisService.disconnect();
    await closeDatabaseConnection();
    console.log('Process terminated');
    process.exit(0);
  });
});

// ===== START SERVER =====

const startServer = async () => {
  try {
    // Log startup event
    securityMonitor.recordEvent({
      type: 'SYSTEM_STARTUP',
      severity: 'MEDIUM',
      ip: 'system',
      details: { environment: NODE_ENV, port: PORT },
    });

    // Initialize WebSocket service
    console.log('🔌 Initializing WebSocket service...');
    webSocketService = new WebSocketService(server);

    // Initialize Preview service
    console.log('👁️ Initializing Preview service...');
    previewService = new PreviewService(webSocketService);

    // Initialize preview routes
    console.log('🛣️ Initializing Preview routes...');
    const { initializePreviewRoutes } = require('./routes/api/preview');
    const previewRouter = initializePreviewRoutes(previewService);
    app.use('/api/v1/preview', previewRouter);

    server.listen(PORT, () => {
      console.log(`🚀 Secure server running on port ${PORT} in ${NODE_ENV} mode`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`🔗 API base URL: http://localhost:${PORT}/api`);
      console.log('🔌 WebSocket service initialized');
      console.log('👁️ Preview service initialized');
      console.log('📱 Real-time preview functionality available');
      console.log('🛡️ Enhanced security measures active');
      console.log('📋 GDPR compliance implemented');
      console.log('📊 Security monitoring enabled');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export { app, server };
