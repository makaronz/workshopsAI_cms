import { logger } from '../../utils/logger';
import { db } from '../../config/database';
import {
  vector_search_queries,
  document_embeddings,
} from '../../models/vector-schema';
import { eq, sql, desc, and, gte, lte } from 'drizzle-orm';

/**
 * Performance metrics for vector operations
 */
export interface VectorPerformanceMetrics {
  embeddingOperations: {
    totalOperations: number;
    averageTime: number;
    successRate: number;
    errorCount: number;
    totalTokens: number;
    totalCost: number;
  };
  searchOperations: {
    totalQueries: number;
    averageTime: number;
    averageResults: number;
    averageSimilarity: number;
    cacheHitRate: number;
  };
  databaseOperations: {
    totalEmbeddings: number;
    averageDimension: number;
    indexUtilization: number;
    queryPerformance: number;
  };
  systemHealth: {
    memoryUsage: number;
    diskUsage: number;
    cpuUsage: number;
    uptime: number;
  };
}

/**
 * Performance alert configuration
 */
export interface PerformanceAlert {
  metric: string;
  threshold: number;
  operator: '>' | '<' | '=' | '>=' | '<=';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  action?: string;
}

/**
 * Performance monitoring service
 * Tracks and analyzes vector database performance
 */
export class VectorPerformanceMonitor {
  private metrics: VectorPerformanceMetrics;
  private alerts: PerformanceAlert[];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
    this.metrics = this.initializeMetrics();
    this.alerts = this.initializeAlerts();
  }

  /**
   * Start performance monitoring
   */
  startMonitoring(intervalMs: number = 60000): void {
    if (this.monitoringInterval) {
      logger.warn('Performance monitoring already started');
      return;
    }

    logger.info('Starting vector performance monitoring');

    this.monitoringInterval = setInterval(async () => {
      try {
        await this.collectMetrics();
        await this.checkAlerts();
        await this.logMetrics();
      } catch (error) {
        logger.error('Performance monitoring error:', error);
      }
    }, intervalMs);
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      logger.info('Vector performance monitoring stopped');
    }
  }

  /**
   * Get current performance metrics
   */
  async getCurrentMetrics(): Promise<VectorPerformanceMetrics> {
    await this.collectMetrics();
    return { ...this.metrics };
  }

  /**
   * Get performance report for a time range
   */
  async getPerformanceReport(timeRange: { start: Date; end: Date }): Promise<{
    summary: VectorPerformanceMetrics;
    trends: {
      queryVolume: Array<{ timestamp: Date; count: number }>;
      responseTime: Array<{ timestamp: Date; avgTime: number }>;
      errorRate: Array<{ timestamp: Date; rate: number }>;
    };
    recommendations: string[];
  }> {
    const summary = await this.getMetricsForTimeRange(timeRange);
    const trends = await this.getPerformanceTrends(timeRange);
    const recommendations = this.generateRecommendations(summary);

    return {
      summary,
      trends,
      recommendations,
    };
  }

  /**
   * Record embedding operation
   */
  recordEmbeddingOperation(
    duration: number,
    success: boolean,
    tokens: number = 0,
    cost: number = 0,
  ): void {
    this.metrics.embeddingOperations.totalOperations++;

    if (success) {
      // Update average time
      const total =
        this.metrics.embeddingOperations.averageTime *
        (this.metrics.embeddingOperations.totalOperations - 1);
      this.metrics.embeddingOperations.averageTime =
        (total + duration) / this.metrics.embeddingOperations.totalOperations;

      this.metrics.embeddingOperations.totalTokens += tokens;
      this.metrics.embeddingOperations.totalCost += cost;
    } else {
      this.metrics.embeddingOperations.errorCount++;
    }

    this.metrics.embeddingOperations.successRate =
      (this.metrics.embeddingOperations.totalOperations -
        this.metrics.embeddingOperations.errorCount) /
      this.metrics.embeddingOperations.totalOperations;
  }

  /**
   * Record search operation
   */
  recordSearchOperation(
    duration: number,
    resultCount: number,
    averageSimilarity: number,
    cacheHit: boolean = false,
  ): void {
    this.metrics.searchOperations.totalQueries++;

    // Update averages
    const totalTime =
      this.metrics.searchOperations.averageTime *
      (this.metrics.searchOperations.totalQueries - 1);
    this.metrics.searchOperations.averageTime =
      (totalTime + duration) / this.metrics.searchOperations.totalQueries;

    const totalResults =
      this.metrics.searchOperations.averageResults *
      (this.metrics.searchOperations.totalQueries - 1);
    this.metrics.searchOperations.averageResults =
      (totalResults + resultCount) / this.metrics.searchOperations.totalQueries;

    const totalSimilarity =
      this.metrics.searchOperations.averageSimilarity *
      (this.metrics.searchOperations.totalQueries - 1);
    this.metrics.searchOperations.averageSimilarity =
      (totalSimilarity + averageSimilarity) /
      this.metrics.searchOperations.totalQueries;

    // Update cache hit rate
    if (cacheHit) {
      const hitCount =
        this.metrics.searchOperations.cacheHitRate *
          (this.metrics.searchOperations.totalQueries - 1) +
        1;
      this.metrics.searchOperations.cacheHitRate =
        hitCount / this.metrics.searchOperations.totalQueries;
    }
  }

  /**
   * Get real-time performance dashboard data
   */
  async getDashboardData(): Promise<{
    currentMetrics: VectorPerformanceMetrics;
    recentQueries: Array<{
      query: string;
      timestamp: Date;
      duration: number;
      results: number;
    }>;
    systemStatus: 'healthy' | 'warning' | 'critical';
    topQueries: Array<{
      query: string;
      count: number;
      avgTime: number;
    }>;
  }> {
    const currentMetrics = await this.getCurrentMetrics();
    const recentQueries = await this.getRecentQueries();
    const systemStatus = this.getSystemStatus(currentMetrics);
    const topQueries = await this.getTopQueries();

    return {
      currentMetrics,
      recentQueries,
      systemStatus,
      topQueries,
    };
  }

  // Private helper methods

  private initializeMetrics(): VectorPerformanceMetrics {
    return {
      embeddingOperations: {
        totalOperations: 0,
        averageTime: 0,
        successRate: 1.0,
        errorCount: 0,
        totalTokens: 0,
        totalCost: 0,
      },
      searchOperations: {
        totalQueries: 0,
        averageTime: 0,
        averageResults: 0,
        averageSimilarity: 0,
        cacheHitRate: 0,
      },
      databaseOperations: {
        totalEmbeddings: 0,
        averageDimension: 1536,
        indexUtilization: 0,
        queryPerformance: 0,
      },
      systemHealth: {
        memoryUsage: 0,
        diskUsage: 0,
        cpuUsage: 0,
        uptime: 0,
      },
    };
  }

  private initializeAlerts(): PerformanceAlert[] {
    return [
      {
        metric: 'embeddingOperations.averageTime',
        threshold: 5000,
        operator: '>',
        severity: 'high',
        message: 'Embedding operations taking too long (>5s)',
        action: 'Check embedding service and API limits',
      },
      {
        metric: 'embeddingOperations.successRate',
        threshold: 0.9,
        operator: '<',
        severity: 'critical',
        message: 'Embedding success rate too low (<90%)',
        action: 'Check API keys and service availability',
      },
      {
        metric: 'searchOperations.averageTime',
        threshold: 1000,
        operator: '>',
        severity: 'medium',
        message: 'Search queries taking too long (>1s)',
        action: 'Consider optimizing vector indexes',
      },
      {
        metric: 'searchOperations.averageResults',
        threshold: 1,
        operator: '<',
        severity: 'medium',
        message: 'Search queries returning too few results (<1 avg)',
        action: 'Review similarity thresholds and data quality',
      },
      {
        metric: 'systemHealth.memoryUsage',
        threshold: 0.9,
        operator: '>',
        severity: 'critical',
        message: 'High memory usage (>90%)',
        action: 'Scale up or implement memory optimization',
      },
    ];
  }

  private async collectMetrics(): Promise<void> {
    try {
      // Collect database metrics
      const dbStats = await this.collectDatabaseMetrics();
      this.metrics.databaseOperations = dbStats;

      // Collect system health metrics
      const systemStats = await this.collectSystemMetrics();
      this.metrics.systemHealth = systemStats;

      this.metrics.systemHealth.uptime = Date.now() - this.startTime;
    } catch (error) {
      logger.error('Failed to collect performance metrics:', error);
    }
  }

  private async collectDatabaseMetrics(): Promise<
    VectorPerformanceMetrics['databaseOperations']
    > {
    try {
      const [embeddingCount, avgDimensions] = await Promise.all([
        db.select({ count: sql<number>`COUNT(*)` }).from(document_embeddings),
        db
          .select({ avg: sql<number>`AVG(array_length(embedding, 1))` })
          .from(document_embeddings),
      ]);

      return {
        totalEmbeddings: embeddingCount[0]?.count || 0,
        averageDimension: Math.round(avgDimensions[0]?.avg || 1536),
        indexUtilization: 0.8, // Mock value - would need actual calculation
        queryPerformance: this.metrics.searchOperations.averageTime,
      };
    } catch (error) {
      logger.error('Failed to collect database metrics:', error);
      return this.metrics.databaseOperations;
    }
  }

  private async collectSystemMetrics(): Promise<
    VectorPerformanceMetrics['systemHealth']
    > {
    try {
      const usage = process.memoryUsage();
      const memoryUsage = usage.heapUsed / usage.heapTotal;

      return {
        memoryUsage,
        diskUsage: 0.5, // Mock value - would need actual disk usage check
        cpuUsage: 0.3, // Mock value - would need actual CPU usage check
        uptime: Date.now() - this.startTime,
      };
    } catch (error) {
      logger.error('Failed to collect system metrics:', error);
      return this.metrics.systemHealth;
    }
  }

  private async checkAlerts(): Promise<void> {
    for (const alert of this.alerts) {
      const value = this.getNestedValue(this.metrics, alert.metric);

      if (this.evaluateCondition(value, alert.threshold, alert.operator)) {
        logger.warn(`Performance alert: ${alert.message}`, {
          metric: alert.metric,
          value,
          threshold: alert.threshold,
          severity: alert.severity,
          action: alert.action,
        });

        // In a production system, you might send notifications here
        if (alert.severity === 'critical') {
          // Send critical alert notification
          await this.sendCriticalAlert(alert);
        }
      }
    }
  }

  private getNestedValue(obj: any, path: string): number {
    return path.split('.').reduce((current, key) => current?.[key], obj) || 0;
  }

  private evaluateCondition(
    value: number,
    threshold: number,
    operator: string,
  ): boolean {
    switch (operator) {
    case '>':
      return value > threshold;
    case '<':
      return value < threshold;
    case '>=':
      return value >= threshold;
    case '<=':
      return value <= threshold;
    case '=':
      return Math.abs(value - threshold) < 0.001;
    default:
      return false;
    }
  }

  private async logMetrics(): Promise<void> {
    logger.info('Vector performance metrics', {
      embeddingOps: this.metrics.embeddingOperations.totalOperations,
      embeddingAvgTime: this.metrics.embeddingOperations.averageTime,
      embeddingSuccessRate: this.metrics.embeddingOperations.successRate,
      searchQueries: this.metrics.searchOperations.totalQueries,
      searchAvgTime: this.metrics.searchOperations.averageTime,
      cacheHitRate: this.metrics.searchOperations.cacheHitRate,
      totalEmbeddings: this.metrics.databaseOperations.totalEmbeddings,
      memoryUsage: this.metrics.systemHealth.memoryUsage,
      uptime: this.metrics.systemHealth.uptime,
    });
  }

  private async getMetricsForTimeRange(timeRange: {
    start: Date;
    end: Date;
  }): Promise<VectorPerformanceMetrics> {
    // Query search metrics from database
    const searchStats = await db
      .select({
        count: sql<number>`COUNT(*)`,
        avgTime: sql<number>`AVG(search_time)`,
        avgResults: sql<number>`AVG(results_found)`,
        avgSimilarity: sql<number>`AVG(avg_similarity)`,
      })
      .from(vector_search_queries)
      .where(
        and(
          gte(vector_search_queries.createdAt, timeRange.start),
          lte(vector_search_queries.createdAt, timeRange.end),
        ),
      );

    const searchData = searchStats[0];

    return {
      embeddingOperations: this.metrics.embeddingOperations, // Would need separate tracking
      searchOperations: {
        totalQueries: searchData?.count || 0,
        averageTime: searchData?.avgTime || 0,
        averageResults: searchData?.avgResults || 0,
        averageSimilarity: searchData?.avgSimilarity || 0,
        cacheHitRate: this.metrics.searchOperations.cacheHitRate,
      },
      databaseOperations: this.metrics.databaseOperations,
      systemHealth: this.metrics.systemHealth,
    };
  }

  private async getPerformanceTrends(timeRange: {
    start: Date;
    end: Date;
  }): Promise<{
    queryVolume: Array<{ timestamp: Date; count: number }>;
    responseTime: Array<{ timestamp: Date; avgTime: number }>;
    errorRate: Array<{ timestamp: Date; rate: number }>;
  }> {
    // Query trends from database - simplified implementation
    const hourlyStats = await db
      .select({
        hour: sql<Date>`DATE_TRUNC('hour', created_at)`,
        count: sql<number>`COUNT(*)`,
        avgTime: sql<number>`AVG(search_time)`,
      })
      .from(vector_search_queries)
      .where(
        and(
          gte(vector_search_queries.createdAt, timeRange.start),
          lte(vector_search_queries.createdAt, timeRange.end),
        ),
      )
      .groupBy(sql`DATE_TRUNC('hour', created_at)`)
      .orderBy(sql`DATE_TRUNC('hour', created_at)`);

    return {
      queryVolume: hourlyStats.map(stat => ({
        timestamp: stat.hour,
        count: stat.count,
      })),
      responseTime: hourlyStats.map(stat => ({
        timestamp: stat.hour,
        avgTime: stat.avgTime,
      })),
      errorRate: [], // Would need separate error tracking
    };
  }

  private generateRecommendations(metrics: VectorPerformanceMetrics): string[] {
    const recommendations: string[] = [];

    if (metrics.embeddingOperations.averageTime > 3000) {
      recommendations.push(
        'Consider using a faster embedding model or increasing batch sizes',
      );
    }

    if (metrics.searchOperations.averageTime > 1000) {
      recommendations.push(
        'Optimize vector indexes or reduce search result count',
      );
    }

    if (metrics.searchOperations.cacheHitRate < 0.5) {
      recommendations.push('Implement query caching to improve performance');
    }

    if (metrics.systemHealth.memoryUsage > 0.8) {
      recommendations.push(
        'Scale up memory or implement memory optimization strategies',
      );
    }

    if (
      metrics.databaseOperations.totalEmbeddings > 100000 &&
      metrics.databaseOperations.indexUtilization < 0.7
    ) {
      recommendations.push(
        'Rebuild or optimize vector indexes for better utilization',
      );
    }

    return recommendations;
  }

  private getSystemStatus(
    metrics: VectorPerformanceMetrics,
  ): 'healthy' | 'warning' | 'critical' {
    let score = 100;

    if (metrics.embeddingOperations.successRate < 0.95) score -= 30;
    if (metrics.searchOperations.averageTime > 1000) score -= 20;
    if (metrics.systemHealth.memoryUsage > 0.8) score -= 25;
    if (metrics.embeddingOperations.averageTime > 5000) score -= 15;

    if (score >= 80) return 'healthy';
    if (score >= 60) return 'warning';
    return 'critical';
  }

  private async getRecentQueries(): Promise<
    Array<{
      query: string;
      timestamp: Date;
      duration: number;
      results: number;
    }>
    > {
    const recent = await db
      .select({
        query: vector_search_queries.queryText,
        timestamp: vector_search_queries.createdAt,
        duration: vector_search_queries.searchTime,
        results: vector_search_queries.resultsFound,
      })
      .from(vector_search_queries)
      .orderBy(desc(vector_search_queries.createdAt))
      .limit(10);

    return recent.map(item => ({
      query: item.query,
      timestamp: item.timestamp,
      duration: item.duration || 0,
      results: item.resultsFound || 0,
    }));
  }

  private async getTopQueries(): Promise<
    Array<{
      query: string;
      count: number;
      avgTime: number;
    }>
    > {
    const topQueries = await db
      .select({
        query: vector_search_queries.queryText,
        count: sql<number>`COUNT(*)`,
        avgTime: sql<number>`AVG(search_time)`,
      })
      .from(vector_search_queries)
      .groupBy(vector_search_queries.queryText)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(5);

    return topQueries.map(item => ({
      query: item.query,
      count: item.count,
      avgTime: item.avgTime || 0,
    }));
  }

  private async sendCriticalAlert(alert: PerformanceAlert): Promise<void> {
    // Implement critical alert notification (email, Slack, etc.)
    logger.error('CRITICAL PERFORMANCE ALERT', {
      message: alert.message,
      action: alert.action,
      metrics: this.metrics,
    });
  }
}

// Export singleton instance
export const vectorPerformanceMonitor = new VectorPerformanceMonitor();
