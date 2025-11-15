import { Router, Request, Response } from 'express';
import { performanceMonitoringService, DetailedMetrics, PerformanceAlert, PerformanceTrend, AnomalyDetection } from '../../services/performance-monitoring-service';
import { cachingService, CacheStats } from '../../services/caching-service';
import { optimizedRedisService } from '../../config/optimized-redis';
import { performanceMiddleware } from '../../middleware/performanceMiddleware';
import { logger } from '../../utils/logger';

const router = Router();

/**
 * Performance Analytics Dashboard API
 *
 * Provides comprehensive performance metrics, analytics, and optimization recommendations
 * for the WorkshopsAI CMS system. Integrates with performance monitoring and caching services.
 */

// Middleware to add performance tracking to API calls
router.use((req: Request, res: Response, next) => {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.debug(`Performance API call: ${req.method} ${req.path} - ${duration}ms`);
  });

  next();
});

/**
 * GET /api/performance/health
 * Get system health score and basic metrics
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const healthScore = performanceMonitoringService.getHealthScore();
    const currentMetrics = performanceMonitoringService.getCurrentMetrics();
    const redisHealth = await optimizedRedisService.healthCheck();

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
    };

    res.json(health);
  } catch (error) {
    logger.error('Performance health check failed:', error);
    res.status(500).json({ error: 'Failed to get health metrics' });
  }
});

/**
 * GET /api/performance/metrics
 * Get detailed current performance metrics
 */
router.get('/metrics', (req: Request, res: Response) => {
  try {
    const metrics = performanceMonitoringService.getCurrentMetrics();
    const cacheStats = cachingService.getStats();
    const middlewareMetrics = performanceMiddleware.getMetrics();

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
        uptime: process.uptime(),
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
      cache: {
        l1: {
          hitRate: (cacheStats.L1.hitRate * 100).toFixed(2) + '%',
          size: cacheStats.L1.size,
          totalSize: (cacheStats.L1.totalSize / 1024 / 1024).toFixed(2) + ' MB',
        },
        l2: {
          hitRate: (cacheStats.L2.hitRate * 100).toFixed(2) + '%',
          totalKeys: cacheStats.L2.totalKeys,
          memoryUsage: (cacheStats.L2.memoryUsage / 1024 / 1024).toFixed(2) + ' MB',
        },
        l3: {
          hitRate: (cacheStats.L3.hitRate * 100).toFixed(2) + '%',
          queryCount: cacheStats.L3.queryCount,
        },
        overall: {
          hitRate: (cacheStats.overall.overallHitRate * 100).toFixed(2) + '%',
          totalSize: (cacheStats.overall.totalSize / 1024 / 1024).toFixed(2) + ' MB',
        },
      },
      middleware: middlewareMetrics,
      timestamp: metrics.timestamp,
    };

    res.json(detailedMetrics);
  } catch (error) {
    logger.error('Failed to get performance metrics:', error);
    res.status(500).json({ error: 'Failed to get performance metrics' });
  }
});

/**
 * GET /api/performance/metrics/historical
 * Get historical performance metrics for analysis
 * Query params:
 * - metric: metric name (response_time, memory_usage, error_rate, etc.)
 * - startTime: ISO timestamp
 * - endTime: ISO timestamp
 */
router.get('/metrics/historical', async (req: Request, res: Response) => {
  try {
    const { metric, startTime, endTime } = req.query;

    if (!metric || !startTime || !endTime) {
      return res.status(400).json({
        error: 'Missing required parameters: metric, startTime, endTime',
      });
    }

    const start = new Date(startTime as string);
    const end = new Date(endTime as string);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        error: 'Invalid timestamp format. Use ISO format.',
      });
    }

    const historicalData = await performanceMonitoringService.getHistoricalMetrics(
      metric as string,
      start,
      end
    );

    res.json({
      metric,
      startTime: start,
      endTime: end,
      dataPoints: historicalData.length,
      data: historicalData,
    });
  } catch (error) {
    logger.error('Failed to get historical metrics:', error);
    res.status(500).json({ error: 'Failed to get historical metrics' });
  }
});

/**
 * GET /api/performance/trends
 * Get performance trends for specified metrics
 * Query params:
 * - metrics: comma-separated list of metric names
 */
router.get('/trends', (req: Request, res: Response) => {
  try {
    const { metrics } = req.query;

    if (!metrics) {
      return res.status(400).json({
        error: 'Missing required parameter: metrics',
      });
    }

    const metricList = (metrics as string).split(',').map(m => m.trim());
    const trends = performanceMonitoringService.getTrends(metricList);

    res.json({
      trends,
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('Failed to get performance trends:', error);
    res.status(500).json({ error: 'Failed to get performance trends' });
  }
});

/**
 * GET /api/performance/alerts
 * Get active performance alerts
 */
router.get('/alerts', (req: Request, res: Response) => {
  try {
    const alerts = performanceMonitoringService.getActiveAlerts();

    res.json({
      alerts,
      count: alerts.length,
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('Failed to get performance alerts:', error);
    res.status(500).json({ error: 'Failed to get performance alerts' });
  }
});

/**
 * POST /api/performance/alerts/:alertId/resolve
 * Resolve a performance alert
 */
router.post('/alerts/:alertId/resolve', (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;

    performanceMonitoringService.resolveAlert(alertId);

    res.json({
      message: 'Alert resolved successfully',
      alertId,
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('Failed to resolve performance alert:', error);
    res.status(500).json({ error: 'Failed to resolve alert' });
  }
});

/**
 * GET /api/performance/anomalies
 * Get recent performance anomalies
 * Query params:
 * - limit: maximum number of anomalies to return (default: 50)
 */
router.get('/anomalies', (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const anomalies = performanceMonitoringService.getRecentAnomalies(limit);

    res.json({
      anomalies,
      count: anomalies.length,
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('Failed to get performance anomalies:', error);
    res.status(500).json({ error: 'Failed to get performance anomalies' });
  }
});

/**
 * GET /api/performance/recommendations
 * Get optimization recommendations based on current metrics
 */
router.get('/recommendations', (req: Request, res: Response) => {
  try {
    const recommendations = performanceMonitoringService.getOptimizationRecommendations();

    res.json({
      recommendations,
      count: recommendations.length,
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('Failed to get optimization recommendations:', error);
    res.status(500).json({ error: 'Failed to get recommendations' });
  }
});

/**
 * GET /api/performance/cache/stats
 * Get detailed cache statistics
 */
router.get('/cache/stats', (req: Request, res: Response) => {
  try {
    const cacheStats = cachingService.getStats();
    const redisStats = optimizedRedisService.getStats();

    res.json({
      cacheStats,
      redisStats,
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('Failed to get cache statistics:', error);
    res.status(500).json({ error: 'Failed to get cache statistics' });
  }
});

/**
 * POST /api/performance/cache/warm
 * Trigger cache warming
 * Query params:
 * - strategy: specific warming strategy name (optional)
 */
router.post('/cache/warm', async (req: Request, res: Response) => {
  try {
    const { strategy } = req.query;

    // Trigger cache warming
    await cachingService.warmCache(strategy as string);

    res.json({
      message: strategy ? `Cache warming triggered for strategy: ${strategy}` : 'Cache warming triggered for all strategies',
      strategy: strategy || 'all',
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('Failed to trigger cache warming:', error);
    res.status(500).json({ error: 'Failed to trigger cache warming' });
  }
});

/**
 * POST /api/performance/cache/invalidate
 * Invalidate cache entries
 * Body: { key?: string, tag?: string, all?: boolean }
 */
router.post('/cache/invalidate', async (req: Request, res: Response) => {
  try {
    const { key, tag, all } = req.body;

    let invalidatedCount = 0;

    if (all) {
      await cachingService.clear();
      invalidatedCount = -1; // Indicates all cleared
    } else if (tag) {
      invalidatedCount = await cachingService.invalidateByTag(tag);
    } else if (key) {
      const invalidated = await cachingService.invalidate(key);
      invalidatedCount = invalidated ? 1 : 0;
    } else {
      return res.status(400).json({
        error: 'Must specify one of: key, tag, or all',
      });
    }

    res.json({
      message: `Cache invalidation completed`,
      invalidatedCount,
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('Failed to invalidate cache:', error);
    res.status(500).json({ error: 'Failed to invalidate cache' });
  }
});

/**
 * GET /api/performance/dashboard
 * Get comprehensive dashboard data (combined metrics for UI)
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
    ] = await Promise.all([
      Promise.resolve(performanceMonitoringService.getHealthScore()),
      Promise.resolve(performanceMonitoringService.getCurrentMetrics()),
      Promise.resolve(cachingService.getStats()),
      Promise.resolve(performanceMonitoringService.getActiveAlerts()),
      Promise.resolve(performanceMonitoringService.getRecentAnomalies(10)),
      Promise.resolve(performanceMonitoringService.getOptimizationRecommendations()),
      Promise.resolve(performanceMonitoringService.getTrends(['response_times', 'memory_usage', 'error_rate'])),
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
      recommendations: recommendations.slice(0, 3), // Top 3 recommendations
      trends: trends.slice(0, 5), // Top 5 trends
      cache: {
        overall: {
          hitRate: (cacheStats.overall.overallHitRate * 100).toFixed(1),
          totalSize: (cacheStats.overall.totalSize / 1024 / 1024).toFixed(2),
        },
        l1: {
          hitRate: (cacheStats.L1.hitRate * 100).toFixed(1),
          size: cacheStats.L1.size,
        },
        l2: {
          hitRate: (cacheStats.L2.hitRate * 100).toFixed(1),
          totalKeys: cacheStats.L2.totalKeys,
        },
      },
    };

    res.json(dashboard);
  } catch (error) {
    logger.error('Failed to get dashboard data:', error);
    res.status(500).json({ error: 'Failed to get dashboard data' });
  }
});

/**
 * POST /api/performance/monitoring/start
 * Start performance monitoring service
 */
router.post('/monitoring/start', (req: Request, res: Response) => {
  try {
    performanceMonitoringService.startMonitoring();

    res.json({
      message: 'Performance monitoring started',
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('Failed to start performance monitoring:', error);
    res.status(500).json({ error: 'Failed to start performance monitoring' });
  }
});

/**
 * POST /api/performance/monitoring/stop
 * Stop performance monitoring service
 */
router.post('/monitoring/stop', (req: Request, res: Response) => {
  try {
    performanceMonitoringService.stopMonitoring();

    res.json({
      message: 'Performance monitoring stopped',
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('Failed to stop performance monitoring:', error);
    res.status(500).json({ error: 'Failed to stop performance monitoring' });
  }
});

export default router;