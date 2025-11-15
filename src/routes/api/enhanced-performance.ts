import { Router, Request, Response } from 'express';
import { enhancedPerformanceMonitoringService, DetailedMetrics, PerformanceAlert, PerformanceTrend, AnomalyDetection, OptimizationRecommendation } from '../../services/enhanced-performance-monitoring-service';
import { enhancedCachingService, CacheAnalytics } from '../../services/enhanced-caching-service';
import { optimizedRedisService } from '../../config/optimized-redis';
import { performanceMiddleware } from '../../middleware/performanceMiddleware';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Enhanced Performance Analytics Dashboard API
 *
 * Provides comprehensive performance metrics, analytics, and optimization recommendations
 * for the WorkshopsAI CMS system. Integrates with enhanced performance monitoring and caching services.
 */

// Middleware to add performance tracking to API calls
router.use((req: Request, res: Response, next) => {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;

    // Track endpoint performance
    if (enhancedPerformanceMonitoringService) {
      enhancedPerformanceMonitoringService.trackEndpoint(req.path, duration, res.statusCode);
    }

    logger.debug(`Enhanced Performance API call: ${req.method} ${req.path} - ${duration}ms`);
  });

  next();
});

/**
 * GET /api/performance/enhanced/health
 * Get enhanced system health score and basic metrics
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const healthScore = enhancedPerformanceMonitoringService.getHealthScore();
    const currentMetrics = enhancedPerformanceMonitoringService.getCurrentMetrics();
    const redisHealth = await optimizedRedisService.healthCheck();
    const bottlenecks = enhancedPerformanceMonitoringService.getBottlenecks();

    const health = {
      score: healthScore,
      status: healthScore >= 80 ? 'healthy' : healthScore >= 60 ? 'warning' : 'critical',
      timestamp: new Date(),
      metrics: {
        responseTime: currentMetrics.p95ResponseTime,
        errorRate: currentMetrics.errorRate,
        memoryUsagePercent: ((currentMetrics.heapUsed / currentMetrics.heapTotal) * 100).toFixed(1),
        requestsPerSecond: currentMetrics.requestsPerSecond,
      },
      services: {
        redis: redisHealth.healthy ? 'healthy' : 'unhealthy',
        database: 'healthy', // Would integrate with DB health check
        cache: 'healthy',
      },
      bottlenecks: {
        count: bottlenecks.length,
        critical: bottlenecks.filter(b => b.severity === 'critical').length,
      },
    };

    res.json(health);
  } catch (error) {
    logger.error('Enhanced performance health check failed:', error);
    res.status(500).json({ error: 'Failed to get health metrics' });
  }
});

/**
 * GET /api/performance/enhanced/metrics
 * Get enhanced detailed performance metrics
 */
router.get('/metrics', (req: Request, res: Response) => {
  try {
    const metrics = enhancedPerformanceMonitoringService.getCurrentMetrics();
    const cacheStats = enhancedCachingService.getStats();
    const middlewareMetrics = performanceMiddleware.getMetrics();
    const endpointPerformance = enhancedPerformanceMonitoringService.getEndpointPerformance();

    const detailedMetrics = {
      system: {
        memory: {
          heapUsed: (metrics.heapUsed / 1024 / 1024).toFixed(2) + ' MB',
          heapTotal: (metrics.heapTotal / 1024 / 1024).toFixed(2) + ' MB',
          external: (metrics.external / 1024 / 1024).toFixed(2) + ' MB',
          rss: (metrics.rss / 1024 / 1024).toFixed(2) + ' MB',
        },
        cpu: {
          user: metrics.cpuUsage.user,
          system: metrics.cpuUsage.system,
        },
        load: metrics.systemLoad,
        uptime: metrics.uptime,
      },
      performance: {
        requestCount: metrics.requestCount,
        averageResponseTime: metrics.averageResponseTime.toFixed(2) + ' ms',
        p95ResponseTime: metrics.p95ResponseTime + ' ms',
        p99ResponseTime: metrics.p99ResponseTime + ' ms',
        requestsPerSecond: metrics.requestsPerSecond.toFixed(2),
        errorRate: (metrics.errorRate * 100).toFixed(2) + '%',
        errorCount: metrics.errorCount,
        activeConnections: metrics.activeConnections,
      },
      endpoints: endpointPerformance,
      cache: {
        l1: {
          hitRate: (cacheStats.L1.hitRate * 100).toFixed(2) + '%',
          size: cacheStats.L1.size,
          totalSize: (cacheStats.L1.totalSize / 1024 / 1024).toFixed(2) + ' MB',
          hotKeys: cacheStats.L1.hotKeys,
        },
        l2: {
          hitRate: (cacheStats.L2.hitRate * 100).toFixed(2) + '%',
          totalKeys: cacheStats.L2.totalKeys,
          memoryUsage: (cacheStats.L2.memoryUsage / 1024 / 1024).toFixed(2) + ' MB',
          avgResponseTime: cacheStats.L2.avgResponseTime.toFixed(2) + ' ms',
        },
        l3: {
          hitRate: (cacheStats.L3.hitRate * 100).toFixed(2) + '%',
          queryCount: cacheStats.L3.queryCount,
          avgResponseTime: cacheStats.L3.avgResponseTime.toFixed(2) + ' ms',
        },
        overall: {
          hitRate: (cacheStats.overall.overallHitRate * 100).toFixed(2) + '%',
          totalSize: (cacheStats.overall.totalSize / 1024 / 1024).toFixed(2) + ' MB',
          avgResponseTime: cacheStats.overall.avgResponseTime.toFixed(2) + ' ms',
          predictiveAccuracy: (cacheStats.predictions.accuracy * 100).toFixed(2) + '%',
        },
      },
      middleware: middlewareMetrics,
      timestamp: metrics.timestamp,
    };

    res.json(detailedMetrics);
  } catch (error) {
    logger.error('Failed to get enhanced performance metrics:', error);
    res.status(500).json({ error: 'Failed to get performance metrics' });
  }
});

/**
 * GET /api/performance/enhanced/bottlenecks
 * Get identified performance bottlenecks
 */
router.get('/bottlenecks', (req: Request, res: Response) => {
  try {
    const bottlenecks = enhancedPerformanceMonitoringService.getBottlenecks();

    res.json({
      bottlenecks,
      count: bottlenecks.length,
      criticalCount: bottlenecks.filter(b => b.severity === 'critical').length,
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('Failed to get performance bottlenecks:', error);
    res.status(500).json({ error: 'Failed to get performance bottlenecks' });
  }
});

/**
 * GET /api/performance/enhanced/recommendations
 * Get enhanced optimization recommendations
 */
router.get('/recommendations', (req: Request, res: Response) => {
  try {
    const recommendations = enhancedPerformanceMonitoringService.getOptimizationRecommendations();

    res.json({
      recommendations,
      count: recommendations.length,
      criticalCount: recommendations.filter(r => r.priority === 'critical').length,
      autoFixableCount: recommendations.filter(r => r.autoFixable).length,
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('Failed to get optimization recommendations:', error);
    res.status(500).json({ error: 'Failed to get recommendations' });
  }
});

/**
 * GET /api/performance/enhanced/analytics
 * Get comprehensive cache analytics
 */
router.get('/analytics', (req: Request, res: Response) => {
  try {
    const cacheAnalytics = enhancedCachingService.getAnalytics();

    res.json({
      cacheAnalytics,
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('Failed to get cache analytics:', error);
    res.status(500).json({ error: 'Failed to get cache analytics' });
  }
});

/**
 * POST /api/performance/enhanced/monitoring/start
 * Start enhanced performance monitoring
 */
router.post('/monitoring/start', (req: Request, res: Response) => {
  try {
    enhancedPerformanceMonitoringService.startMonitoring();

    res.json({
      message: 'Enhanced performance monitoring started',
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('Failed to start enhanced performance monitoring:', error);
    res.status(500).json({ error: 'Failed to start performance monitoring' });
  }
});

/**
 * POST /api/performance/enhanced/monitoring/stop
 * Stop enhanced performance monitoring
 */
router.post('/monitoring/stop', (req: Request, res: Response) => {
  try {
    enhancedPerformanceMonitoringService.stopMonitoring();

    res.json({
      message: 'Enhanced performance monitoring stopped',
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('Failed to stop enhanced performance monitoring:', error);
    res.status(500).json({ error: 'Failed to stop performance monitoring' });
  }
});

/**
 * POST /api/performance/enhanced/cache/warm
 * Trigger enhanced cache warming
 */
router.post('/cache/warm', async (req: Request, res: Response) => {
  try {
    const { strategy } = req.query;

    // Trigger enhanced cache warming
    await enhancedCachingService.warmCache(strategy as string);

    res.json({
      message: strategy ? `Enhanced cache warming triggered for strategy: ${strategy}` : 'Enhanced cache warming triggered for all strategies',
      strategy: strategy || 'all',
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('Failed to trigger enhanced cache warming:', error);
    res.status(500).json({ error: 'Failed to trigger cache warming' });
  }
});

/**
 * GET /api/performance/enhanced/dashboard
 * Get comprehensive enhanced dashboard data
 */
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const [
      healthScore,
      currentMetrics,
      cacheStats,
      alerts,
      anomalies,
      recommendations,
      trends,
      bottlenecks,
      cacheAnalytics,
    ] = await Promise.all([
      Promise.resolve(enhancedPerformanceMonitoringService.getHealthScore()),
      Promise.resolve(enhancedPerformanceMonitoringService.getCurrentMetrics()),
      Promise.resolve(enhancedCachingService.getStats()),
      Promise.resolve(enhancedPerformanceMonitoringService.getActiveAlerts()),
      Promise.resolve(enhancedPerformanceMonitoringService.getRecentAnomalies(10)),
      Promise.resolve(enhancedPerformanceMonitoringService.getOptimizationRecommendations()),
      Promise.resolve(enhancedPerformanceMonitoringService.getTrends(['response_times', 'memory_usage', 'error_rate'])),
      Promise.resolve(enhancedPerformanceMonitoringService.getBottlenecks()),
      Promise.resolve(enhancedCachingService.getAnalytics()),
    ]);

    const dashboard = {
      overview: {
        healthScore,
        status: healthScore >= 80 ? 'healthy' : healthScore >= 60 ? 'warning' : 'critical',
        lastUpdated: new Date(),
      },
      keyMetrics: {
        responseTime: currentMetrics.p95ResponseTime,
        errorRate: currentMetrics.errorRate,
        memoryUsage: (currentMetrics.heapUsed / currentMetrics.heapTotal) * 100,
        requestsPerSecond: currentMetrics.requestsPerSecond,
        cacheHitRate: cacheStats.overall.overallHitRate * 100,
        predictiveAccuracy: cacheStats.predictions.accuracy * 100,
      },
      alerts: {
        active: alerts.length,
        critical: alerts.filter(a => a.severity === 'critical').length,
        recent: alerts.slice(0, 5),
      },
      anomalies: {
        recent: anomalies.slice(0, 5),
        count: anomalies.length,
      },
      bottlenecks: {
        count: bottlenecks.length,
        critical: bottlenecks.filter(b => b.severity === 'critical').length,
        top3: bottlenecks.slice(0, 3),
      },
      recommendations: recommendations.slice(0, 3), // Top 3 recommendations
      trends: trends.slice(0, 5), // Top 5 trends
      cache: {
        overall: {
          hitRate: (cacheStats.overall.overallHitRate * 100).toFixed(1),
          totalSize: (cacheStats.overall.totalSize / 1024 / 1024).toFixed(2),
          avgResponseTime: cacheStats.overall.avgResponseTime.toFixed(2),
          predictiveAccuracy: (cacheStats.predictions.accuracy * 100).toFixed(1),
        },
        l1: {
          hitRate: (cacheStats.L1.hitRate * 100).toFixed(1),
          size: cacheStats.L1.size,
          hotKeys: cacheStats.L1.hotKeys,
        },
        l2: {
          hitRate: (cacheStats.L2.hitRate * 100).toFixed(1),
          totalKeys: cacheStats.L2.totalKeys,
          avgResponseTime: cacheStats.L2.avgResponseTime.toFixed(2),
        },
        topKeys: cacheAnalytics.topKeys.slice(0, 10),
        accessPatterns: cacheAnalytics.accessPatterns.slice(0, 5),
      },
      system: {
        uptime: currentMetrics.uptime,
        loadAvg: currentMetrics.systemLoad.loadAvg,
        memory: {
          used: (currentMetrics.heapUsed / 1024 / 1024).toFixed(2),
          total: (currentMetrics.heapTotal / 1024 / 1024).toFixed(2),
          free: ((currentMetrics.heapTotal - currentMetrics.heapUsed) / 1024 / 1024).toFixed(2),
        },
        freemem: (currentMetrics.systemLoad.freemem / 1024 / 1024).toFixed(2),
        totalmem: (currentMetrics.systemLoad.totalmem / 1024 / 1024).toFixed(2),
      },
    };

    res.json(dashboard);
  } catch (error) {
    logger.error('Failed to get enhanced dashboard data:', error);
    res.status(500).json({ error: 'Failed to get dashboard data' });
  }
});

export default router;