// Load environment variables FIRST before any other imports
import './config/env';

// NOTE: This version uses PostgreSQL for all caching (no Redis required)
// For simple deployment, use index-simple.ts instead

import express, { RequestHandler } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { createServer } from 'http';
import { join } from 'path';

// Import routes
import authRoutes from './routes/auth';
import workshopRoutes from './routes/workshops';
import questionnaireRoutes from './routes/questionnaires';

const app = express();
const server = createServer(app);

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

// Compression
app.use(compression());

// Request logging
app.use(morgan('combined'));

// API routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/workshops', workshopRoutes);
app.use('/api/v1/questionnaires', questionnaireRoutes);

// Static file serving for frontend
app.use(express.static(join(__dirname, '../public'), {
  index: ['index.html', 'index.htm'],
}));

// Health check endpoint
app.get('/health', async (_req, res) => {
  try {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: NODE_ENV,
      message: 'Application is running (minimal mode)',
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: NODE_ENV,
    });
  }
});

// SPA fallback - serve index.html for all other routes
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
      error: 'Internal Server Error',
      message: NODE_ENV === 'development' ? err.message : 'An error occurred',
    });
  },
);

// Graceful shutdown
const gracefulShutdown = async () => {
  console.log('\n🔄 Starting graceful shutdown...');

  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('❌ Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

// Handle shutdown signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT} in ${NODE_ENV} mode`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🌐 CORS origin: ${CORS_ORIGIN}`);
  console.log(`\n✅ Minimal mode - only healthcheck and static files`);
});

if (require.main === module) {
  // Start server only if this file is run directly
  gracefulShutdown;
}
