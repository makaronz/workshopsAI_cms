import { Request, Response } from 'express';
import { enhancedLLMAnalysisWorker } from '../services/enhanced-llm-worker';
import { AnalysisWebSocketService } from '../services/analysis-websocket';
import { logger } from '../utils/logger';

export class DashboardController {
  /**
   * Get dashboard overview with key metrics
   */
  public async getOverview(req: Request, res: Response): Promise<void> {
    try {
      const [
        queueStats,
        costStats,
      ] = await Promise.all([
        enhancedLLMAnalysisWorker.getQueueStats(),
        enhancedLLMAnalysisWorker.getCostStats(),
      ]);

      const performanceMetrics = { /* Mock performance metrics */ };
      const cacheStats = { /* Mock cache stats */ };
      const throughputStats = { /* Mock throughput stats */ };

      const overview = {
        timestamp: new Date().toISOString(),
        queue: queueStats,
        costs: costStats,
        performance: performanceMetrics,
        cache: cacheStats,
        throughput: throughputStats,
        health: {
          status: 'healthy',
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          version: process.env.npm_package_version || '1.0.0',
        },
      };

      res.json({
        success: true,
        data: overview,
      });
    } catch (error) {
      logger.error('Dashboard overview error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch dashboard overview',
      });
    }
  }

  /**
   * Get detailed job information
   */
  public async getJobDetails(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;

      if (!jobId) {
        res.status(400).json({
          success: false,
          error: 'Job ID is required',
        });
        return;
      }

      // Mock implementation for job status and progress
      const jobStatus = { status: 'processing', progress: 50 };
      const jobProgress = { percentage: 50, currentStep: 'analysis', totalSteps: 2 };

      const jobDetails = {
        jobId,
        status: jobStatus,
        progress: jobProgress,
        timestamp: new Date().toISOString(),
      };

      res.json({
        success: true,
        data: jobDetails,
      });
    } catch (error) {
      logger.error('Job details error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch job details',
      });
    }
  }

  /**
   * Get cost analysis with breakdowns
   */
  public async getCostAnalysis(req: Request, res: Response): Promise<void> {
    try {
      const { period = '24h' } = req.query;

      const costStats = await enhancedLLMAnalysisWorker.getCostStats();

      // Calculate period-specific metrics
      const now = new Date();
      let periodStart: Date;

      switch (period) {
      case '1h':
        periodStart = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '24h':
        periodStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        periodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        periodStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      }

      const costAnalysis = {
        period,
        periodStart: periodStart.toISOString(),
        periodEnd: now.toISOString(),
        ...costStats,
        costTrends: {
          // Mock cost trends
          projectedDaily: 5.25,
          projectedMonthly: 157.50,
        },
        efficiency: {
          costPerJob: 2.50,
          costPerToken: 0.0001,
          averageJobCost: 2.50,
        },
      };

      res.json({
        success: true,
        data: costAnalysis,
      });
    } catch (error) {
      logger.error('Cost analysis error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch cost analysis',
      });
    }
  }

  /**
   * Get performance metrics with detailed breakdowns
   */
  public async getPerformanceMetrics(req: Request, res: Response): Promise<void> {
    try {
      const performanceMetrics = await enhancedLLMAnalysisWorker.getPerformanceMetrics();

      const detailedMetrics = {
        ...performanceMetrics,
        systemHealth: {
          cpu: process.cpuUsage(),
          memory: {
            used: process.memoryUsage().heapUsed,
            total: process.memoryUsage().heapTotal,
            external: process.memoryUsage().external,
            rss: process.memoryUsage().rss,
          },
          uptime: process.uptime(),
        },
        providerComparison: performanceMetrics.providerPerformance || {},
        trends: {
          // These would typically come from historical data
          responseTimeTrend: 'stable', // improving, degrading, stable
          throughputTrend: 'stable',
          errorRateTrend: 'stable',
        },
      };

      res.json({
        success: true,
        data: detailedMetrics,
      });
    } catch (error) {
      logger.error('Performance metrics error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch performance metrics',
      });
    }
  }

  /**
   * Get active jobs with detailed information
   */
  public async getActiveJobs(req: Request, res: Response): Promise<void> {
    try {
      const { status = 'all', limit = 50, offset = 0 } = req.query;

      let jobStatuses: string[] = [];
      if (status !== 'all') {
        jobStatuses = Array.isArray(status) ? status as string[] : [status as string];
      }

      const queueStats = await enhancedLLMAnalysisWorker.getQueueStats();

      // This would typically query the actual job queue
      const activeJobs = {
        jobs: [], // Would be populated with actual job data
        pagination: {
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
          total: queueStats.waiting + queueStats.active,
        },
        summary: queueStats,
      };

      res.json({
        success: true,
        data: activeJobs,
      });
    } catch (error) {
      logger.error('Active jobs error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch active jobs',
      });
    }
  }

  /**
   * Get WebSocket connection statistics
   */
  public async getWebSocketStats(req: Request, res: Response): Promise<void> {
    try {
      const wsService = req.app.get('wsService') as AnalysisWebSocketService;

      if (!wsService) {
        res.status(503).json({
          success: false,
          error: 'WebSocket service not available',
        });
        return;
      }

      const connectionCount = wsService.getActiveConnectionsCount();
      const subscriptionStats = wsService.getSubscriptionStats();

      const wsStats = {
        activeConnections: connectionCount,
        subscriptions: subscriptionStats,
        timestamp: new Date().toISOString(),
      };

      res.json({
        success: true,
        data: wsStats,
      });
    } catch (error) {
      logger.error('WebSocket stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch WebSocket statistics',
      });
    }
  }

  /**
   * Get system health check
   */
  public async getHealthCheck(req: Request, res: Response): Promise<void> {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        checks: {
          database: 'healthy', // Would check actual DB connection
          redis: 'healthy', // Would check actual Redis connection
          llmProviders: {
            openai: 'healthy', // Would check with actual API call
            anthropic: 'healthy', // Would check with actual API call
          },
          websockets: 'healthy',
        },
        metrics: {
          memory: process.memoryUsage(),
          cpu: process.cpuUsage(),
        },
      };

      // Determine overall health status
      const allChecksHealthy = Object.values(health.checks).every(
        check => typeof check === 'string' ? check === 'healthy' :
          Object.values(check as any).every((c: any) => c === 'healthy'),
      );

      health.status = allChecksHealthy ? 'healthy' : 'degraded';

      const statusCode = health.status === 'healthy' ? 200 : 503;

      res.status(statusCode).json({
        success: health.status === 'healthy',
        data: health,
      });
    } catch (error) {
      logger.error('Health check error:', error);
      res.status(500).json({
        success: false,
        error: 'Health check failed',
        status: 'unhealthy',
      });
    }
  }

  /**
   * Get API usage statistics
   */
  public async getApiUsage(req: Request, res: Response): Promise<void> {
    try {
      const { period = '24h' } = req.query;

      // This would typically come from API usage tracking
      const apiUsage = {
        period,
        endpoints: {
          analysis: {
            requests: 1250,
            errors: 12,
            avgResponseTime: 850,
          },
          jobs: {
            requests: 890,
            errors: 5,
            avgResponseTime: 320,
          },
          export: {
            requests: 156,
            errors: 2,
            avgResponseTime: 1200,
          },
        },
        rateLimiting: {
          activeLimits: 23,
          blockedRequests: 45,
          totalRequests: 2296,
        },
        timestamp: new Date().toISOString(),
      };

      res.json({
        success: true,
        data: apiUsage,
      });
    } catch (error) {
      logger.error('API usage error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch API usage statistics',
      });
    }
  }

  /**
   * Get export statistics
   */
  public async getExportStats(req: Request, res: Response): Promise<void> {
    try {
      const { period = '24h' } = req.query;

      // This would typically come from export tracking
      const exportStats = {
        period,
        exports: {
          json: 145,
          csv: 89,
          ods: 34,
        },
        totalExports: 268,
        averageFileSize: {
          json: 2.4 * 1024 * 1024, // 2.4MB
          csv: 1.8 * 1024 * 1024, // 1.8MB
          ods: 3.2 * 1024 * 1024, // 3.2MB
        },
        totalBandwidth: 598 * 1024 * 1024, // 598MB
        timestamp: new Date().toISOString(),
      };

      res.json({
        success: true,
        data: exportStats,
      });
    } catch (error) {
      logger.error('Export stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch export statistics',
      });
    }
  }
}

export const dashboardController = new DashboardController();
