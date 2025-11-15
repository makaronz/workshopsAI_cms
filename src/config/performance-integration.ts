import { Server } from 'http';
import express from 'express';
import { enhancedPerformanceMonitoringService } from '../services/enhanced-performance-monitoring-service';
import { enhancedCachingService } from '../services/enhanced-caching-service';
import { enhancedPerformanceMiddleware, enhancedRequestTiming, adaptiveRateLimit, enhancedMemoryMonitor, intelligentCache } from '../middleware/enhanced-performance-middleware';
import { logger } from '../utils/logger';

/**
 * Performance Integration Configuration
 *
 * This module provides integration utilities to set up the comprehensive
 * performance monitoring and caching system for the WorkshopsAI CMS.
 */

export interface PerformanceIntegrationConfig {
  enableMonitoring?: boolean;
  enableCaching?: boolean;
  enableEnhancedMiddleware?: boolean;
  monitoringInterval?: number;
  cacheWarmingInterval?: number;
  logLevel?: string;
  customWarmingStrategies?: Array<{
    name: string;
    patterns: string[];
    warmupFunction: () => Promise<void>;
  }>;
}

/**
 * Initialize performance monitoring and caching system
 */
export async function initializePerformanceSystem(
  app: express.Application,
  httpServer: Server,
  config: PerformanceIntegrationConfig = {}
): Promise<void> {
  const {
    enableMonitoring = true,
    enableCaching = true,
    enableEnhancedMiddleware = true,
    monitoringInterval = 30000,
    cacheWarmingInterval = 300000,
    logLevel = 'info',
    customWarmingStrategies = [],
  } = config;

  logger.info('Initializing Performance Monitoring and Caching System', {
    enableMonitoring,
    enableCaching,
    enableEnhancedMiddleware,
  });

  try {
    // Initialize enhanced performance monitoring service
    if (enableMonitoring) {
      enhancedPerformanceMonitoringService.initializeWithServer(httpServer);
      enhancedPerformanceMonitoringService.startMonitoring();

      logger.info('Enhanced performance monitoring service started');
    }

    // Initialize enhanced caching service
    if (enableCaching) {
      // Add custom warming strategies if provided
      customWarmingStrategies.forEach(strategy => {
        enhancedCachingService.addWarmingStrategy({
          name: strategy.name,
          description: `Custom warming strategy for ${strategy.name}`,
          enabled: true,
          patterns: strategy.patterns,
          priority: 10,
          warmupFunction: strategy.warmupFunction,
        });
      });

      // Set up event listeners for cache events
      enhancedCachingService.on('cacheHit', ({ tier, key, responseTime }) => {
        logger.debug(`Cache hit on ${tier} for key: ${key} (${responseTime}ms)`);
      });

      enhancedCachingService.on('cacheMiss', ({ key, responseTime }) => {
        logger.debug(`Cache miss for key: ${key} (${responseTime}ms)`);
      });

      enhancedCachingService.on('cacheWarmed', () => {
        logger.info('Cache warming completed');
      });

      logger.info('Enhanced caching service initialized');
    }

    // Set up enhanced middleware
    if (enableEnhancedMiddleware) {
      setupEnhancedMiddleware(app);
      logger.info('Enhanced performance middleware configured');
    }

    // Set up API routes
    setupPerformanceRoutes(app);

    // Set up graceful shutdown
    setupGracefulShutdown();

    logger.info('Performance system initialization completed successfully');
  } catch (error) {
    logger.error('Failed to initialize performance system:', error);
    throw error;
  }
}

/**
 * Configure enhanced middleware for Express app
 */
function setupEnhancedMiddleware(app: express.Application): void {
  // Apply enhanced performance middleware to all routes
  app.use(enhancedRequestTiming());
  app.use(enhancedMemoryMonitor());

  // Apply intelligent caching to API routes
  app.use('/api/', intelligentCache({
    ttl: 300, // 5 minutes
    condition: (req) => req.method === 'GET' && !req.path.includes('/performance/'),
    vary: ['authorization'],
  }));

  // Apply adaptive rate limiting
  app.use('/api/', adaptiveRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    baseMax: 1000, // Base limit of 1000 requests
    scaleFactor: 1.5,
  }));

  // Apply profiling to a sample of requests
  app.use(profileRequests({
    sampleRate: 0.05, // 5% of requests
    threshold: 2000, // Profile requests > 2s
  }));
}

/**
 * Set up performance monitoring API routes
 */
function setupPerformanceRoutes(app: express.Application): void {
  try {
    // Import the enhanced performance routes
    const enhancedPerformanceRoutes = require('../routes/api/enhanced-performance').default;
    const performanceRoutes = require('../routes/api/performance').default;

    // Mount the routes
    app.use('/api/performance', performanceRoutes);
    app.use('/api/performance/enhanced', enhancedPerformanceRoutes);

    logger.info('Performance API routes configured');
  } catch (error) {
    logger.error('Failed to set up performance routes:', error);
  }
}

/**
 * Set up graceful shutdown for performance services
 */
function setupGracefulShutdown(): void {
  const shutdown = async () => {
    logger.info('Shutting down performance monitoring and caching services...');

    try {
      // Stop monitoring
      enhancedPerformanceMonitoringService.stopMonitoring();

      // Stop cache warming
      enhancedCachingService.stopWarming();

      logger.info('Performance services stopped gracefully');
    } catch (error) {
      logger.error('Error during performance services shutdown:', error);
    }
  };

  // Register shutdown handlers
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  process.on('SIGUSR2', shutdown); // For nodemon restarts
}

/**
 * Get performance system status
 */
export function getPerformanceSystemStatus(): {
  monitoring: boolean;
  caching: boolean;
  health: any;
  cacheStats: any;
} {
  return {
    monitoring: true, // This would be tracked in the service
    caching: true, // This would be tracked in the service
    health: enhancedPerformanceMonitoringService.getHealthScore(),
    cacheStats: enhancedCachingService.getStats(),
  };
}

/**
 * Configure performance monitoring based on environment
 */
export function configureForEnvironment(env: string = process.env.NODE_ENV || 'development'): PerformanceIntegrationConfig {
  const baseConfig: PerformanceIntegrationConfig = {
    enableMonitoring: true,
    enableCaching: true,
    enableEnhancedMiddleware: true,
  };

  switch (env.toLowerCase()) {
    case 'production':
      return {
        ...baseConfig,
        monitoringInterval: 30000, // 30 seconds
        cacheWarmingInterval: 600000, // 10 minutes
        logLevel: 'warn',
      };

    case 'staging':
      return {
        ...baseConfig,
        monitoringInterval: 60000, // 1 minute
        cacheWarmingInterval: 300000, // 5 minutes
        logLevel: 'info',
      };

    case 'development':
    default:
      return {
        ...baseConfig,
        monitoringInterval: 120000, // 2 minutes
        cacheWarmingInterval: 600000, // 10 minutes
        logLevel: 'debug',
      };
  }
}

/**
 * Add custom performance monitoring for specific modules
 */
export function addModuleMonitoring(moduleName: string, options: {
  metrics?: string[];
  alerts?: Array<{
    metric: string;
    threshold: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }>;
  caching?: {
    patterns: string[];
    ttl: number;
  };
}): void {
  logger.info(`Adding performance monitoring for module: ${moduleName}`);

  // This would integrate with the monitoring service
  // Implementation would depend on specific module requirements
}

/**
 * Create performance monitoring middleware for specific routes
 */
export function createRouteMonitoring(options: {
  routePattern: string;
  enableCaching?: boolean;
  cacheTTL?: number;
  enableProfiling?: boolean;
  rateLimit?: {
    windowMs: number;
    max: number;
  };
}) {
  const middleware: express.RequestHandler[] = [];

  // Add basic monitoring
  middleware.push(enhancedRequestTiming());
  middleware.push(enhancedMemoryMonitor());

  // Add caching if enabled
  if (options.enableCaching) {
    middleware.push(intelligentCache({
      ttl: options.cacheTTL || 300,
    }));
  }

  // Add rate limiting if specified
  if (options.rateLimit) {
    middleware.push(adaptiveRateLimit(options.rateLimit));
  }

  // Add profiling if enabled
  if (options.enableProfiling) {
    middleware.push(profileRequests({
      sampleRate: 0.1,
      threshold: 1000,
    }));
  }

  return middleware;
}

// Export the performance middleware for direct use
export {
  enhancedRequestTiming,
  adaptiveRateLimit,
  enhancedMemoryMonitor,
  intelligentCache,
};