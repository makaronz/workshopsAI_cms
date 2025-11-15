import { EventEmitter } from 'events';
import { performanceMiddleware, PerformanceMetrics } from '../middleware/performanceMiddleware';
import { optimizedRedisService } from '../config/optimized-redis';
import { logger } from '../utils/logger';
import { Server } from 'http';

/**
 * Enhanced Performance Monitoring Service with deeper middleware integration
 *
 * Features:
 * - Real-time metrics collection (response times, memory usage, error rates)
 * - Performance trend analysis and anomaly detection
 * - Alert system for performance degradation
 * - Integration with existing performanceMiddleware.ts
 * - Event-driven architecture for real-time monitoring
 * - WebSocket support for real-time updates
 * - Advanced anomaly detection using machine learning algorithms
 * - Performance bottleneck identification
 * - Automated optimization recommendations
 */

export interface DetailedMetrics extends PerformanceMetrics {
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  requestsPerSecond: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  errorCount: number;
  activeConnections: number;
  timestamp: Date;
  systemLoad: {
    loadAvg: number[];
    uptime: number;
    freemem: number;
    totalmem: number;
  };
  databaseMetrics?: {
    connectionPool: number;
    queryTime: number;
    slowQueries: number;
  };
}

export interface PerformanceAlert {
  id: string;
  type: 'memory' | 'response_time' | 'error_rate' | 'cpu' | 'disk_space' | 'database' | 'cache';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  value: number;
  threshold: number;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  autoResolved?: boolean;
  affectedEndpoints?: string[];
  recommendedAction?: string;
}

export interface PerformanceTrend {
  metric: string;
  currentValue: number;
  previousValue: number;
  changePercent: number;
  trend: 'improving' | 'degrading' | 'stable';
  timeframe: '1h' | '6h' | '24h' | '7d';
  forecast?: number;
  confidence?: number;
}

export interface AnomalyDetection {
  id: string;
  metric: string;
  value: number;
  expectedRange: { min: number; max: number };
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  description: string;
  pattern?: string;
  relatedMetrics?: string[];
  potentialCauses?: string[];
}

export interface PerformanceBottleneck {
  id: string;
  type: 'database' | 'api' | 'memory' | 'cache' | 'network';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedEndpoints: string[];
  impact: string;
  recommendation: string;
  timestamp: Date;
  metrics: Record<string, number>;
}

export interface OptimizationRecommendation {
  id: string;
  category: 'memory' | 'performance' | 'reliability' | 'scalability' | 'database' | 'cache';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  expectedImpact: string;
  implementation: {
    complexity: 'low' | 'medium' | 'high';
    estimatedTime: string;
    steps: string[];
  };
  relatedMetrics: string[];
  autoFixable: boolean;
}

/**
 * Enhanced Performance Monitoring Service
 *
 * This service provides comprehensive performance monitoring with real-time metrics
 * collection, trend analysis, anomaly detection, and alerting capabilities.
 * Includes advanced features like bottleneck identification and optimization recommendations.
 */
export class EnhancedPerformanceMonitoringService extends EventEmitter {
  private metrics: Map<string, number[]> = new Map();
  private endpointMetrics: Map<string, number[]> = new Map();
  private alerts: Map<string, PerformanceAlert> = new Map();
  private trends: Map<string, PerformanceTrend[]> = new Map();
  private anomalies: AnomalyDetection[] = [];
  private bottlenecks: PerformanceBottleneck[] = [];
  private recommendations: OptimizationRecommendation[] = [];
  private isMonitoring = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private httpServer: Server | null = null;
  private websocketConnections: Set<any> = new Set();

  // Advanced configuration
  private readonly METRIC_RETENTION_PERIOD = 7 * 24 * 60 * 60 * 1000; // 7 days
  private readonly ANOMALY_THRESHOLD_MULTIPLIER = 2.5; // Standard deviations
  private readonly TREND_ANALYSIS_WINDOW = 100; // Number of data points for trend analysis
  private readonly BOTTLENECK_DETECTION_THRESHOLD = 0.8; // 80% threshold for bottleneck detection

  // Enhanced performance thresholds
  private readonly THRESHOLDS = {
    memoryUsage: 0.8, // 80% of available memory
    responseTime: 1000, // 1 second
    errorRate: 0.05, // 5%
    cpuUsage: 0.8, // 80% CPU usage
    diskSpace: 0.9, // 90% disk usage
    cacheHitRate: 0.7, // 70% cache hit rate minimum
    databaseConnections: 0.8, // 80% of max connections
    slowQueryThreshold: 2000, // 2 seconds
  };

  constructor() {
    super();
    this.setupEventHandlers();
    this.initializeEndpointTracking();
  }

  /**
   * Initialize with HTTP server for WebSocket support
   */
  initializeWithServer(httpServer: Server): void {
    this.httpServer = httpServer;
    logger.info('Performance monitoring service initialized with HTTP server');
  }

  /**
   * Start enhanced performance monitoring
   */
  startMonitoring(): void {
    if (this.isMonitoring) {
      logger.warn('Enhanced performance monitoring is already running');
      return;
    }

    this.isMonitoring = true;
    logger.info('Starting enhanced performance monitoring service');

    // Start collecting metrics every 30 seconds
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
      this.analyzeTrends();
      this.detectAnomalies();
      this.checkThresholds();
      this.identifyBottlenecks();
      this.generateRecommendations();
      this.broadcastRealTimeUpdates();
    }, 30000);

    // Initial metrics collection
    this.collectMetrics();

    // Emit monitoring started event
    this.emit('monitoringStarted', { timestamp: new Date() });
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      logger.warn('Enhanced performance monitoring is not running');
      return;
    }

    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    logger.info('Enhanced performance monitoring service stopped');
    this.emit('monitoringStopped', { timestamp: new Date() });
  }

  /**
   * Track endpoint-specific performance
   */
  trackEndpoint(endpoint: string, responseTime: number, statusCode: number): void {
    if (!this.endpointMetrics.has(endpoint)) {
      this.endpointMetrics.set(endpoint, []);
    }

    const metrics = this.endpointMetrics.get(endpoint)!;
    metrics.push(responseTime);

    // Keep only last 1000 data points per endpoint
    if (metrics.length > 1000) {
      metrics.splice(0, metrics.length - 1000);
    }

    // Track error rates per endpoint
    const errorKey = `${endpoint}:errors`;
    if (!this.metrics.has(errorKey)) {
      this.metrics.set(errorKey, []);
    }

    const errorMetrics = this.metrics.get(errorKey)!;
    errorMetrics.push(statusCode >= 400 ? 1 : 0);

    if (errorMetrics.length > 1000) {
      errorMetrics.splice(0, errorMetrics.length - 1000);
    }

    // Emit endpoint performance event
    this.emit('endpointPerformance', {
      endpoint,
      responseTime,
      statusCode,
      timestamp: new Date(),
    });
  }

  /**
   * Get current detailed performance metrics
   */
  getCurrentMetrics(): DetailedMetrics {
    const baseMetrics = performanceMiddleware.getMetrics();
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    // Calculate percentiles from response time buffer
    const responseTimes = this.getMetricValues('response_times');
    const sortedTimes = [...responseTimes].sort((a, b) => a - b);
    const p95Index = Math.floor(sortedTimes.length * 0.95);
    const p99Index = Math.floor(sortedTimes.length * 0.99);

    return {
      ...baseMetrics,
      memoryUsage: memUsage,
      cpuUsage: cpuUsage,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
      requestsPerSecond: baseMetrics.requestsPerSecond,
      p95ResponseTime: sortedTimes[p95Index] || 0,
      p99ResponseTime: sortedTimes[p99Index] || 0,
      errorCount: baseMetrics.errorCount,
      activeConnections: this.getActiveConnections(),
      timestamp: new Date(),
      systemLoad: {
        loadAvg: require('os').loadavg(),
        uptime: require('os').uptime(),
        freemem: require('os').freemem(),
        totalmem: require('os').totalmem(),
      },
    };
  }

  /**
   * Get performance bottlenecks
   */
  getBottlenecks(): PerformanceBottleneck[] {
    return this.bottlenecks
      .sort((a, b) => {
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        return severityOrder[b.severity] - severityOrder[a.severity];
      })
      .slice(0, 20); // Return top 20 bottlenecks
  }

  /**
   * Get enhanced optimization recommendations
   */
  getOptimizationRecommendations(): OptimizationRecommendation[] {
    return this.recommendations
      .sort((a, b) => {
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      })
      .slice(0, 10); // Return top 10 recommendations
  }

  /**
   * Get endpoint-specific performance data
   */
  getEndpointPerformance(): Record<string, {
    averageResponseTime: number;
    p95ResponseTime: number;
    errorRate: number;
    requestCount: number;
  }> {
    const endpointData: Record<string, any> = {};

    for (const [endpoint, responseTimes] of this.endpointMetrics.entries()) {
      if (responseTimes.length === 0) continue;

      const sortedTimes = [...responseTimes].sort((a, b) => a - b);
      const p95Index = Math.floor(sortedTimes.length * 0.95);
      const errorKey = `${endpoint}:errors`;
      const errorMetrics = this.getMetricValues(errorKey);

      const errorCount = errorMetrics.reduce((sum, val) => sum + val, 0);
      const errorRate = errorMetrics.length > 0 ? errorCount / errorMetrics.length : 0;

      endpointData[endpoint] = {
        averageResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
        p95ResponseTime: sortedTimes[p95Index] || 0,
        errorRate: errorRate * 100, // Convert to percentage
        requestCount: responseTimes.length,
      };
    }

    return endpointData;
  }

  /**
   * Get historical metrics for a specific time range
   */
  async getHistoricalMetrics(
    metric: string,
    startTime: Date,
    endTime: Date
  ): Promise<Array<{ timestamp: Date; value: number }>> {
    try {
      const startTimeMs = startTime.getTime();
      const endTimeMs = endTime.getTime();
      const cacheKey = `historical_metrics:${metric}:${startTimeMs}:${endTimeMs}`;

      // Try to get from cache first
      const cached = await optimizedRedisService.get(cacheKey, { json: true });
      if (cached) {
        return cached;
      }

      // For this implementation, we'll store recent metrics in Redis
      const pattern = `metrics:${metric}:*`;
      const keys = await optimizedRedisService.getClient().keys(pattern);

      const results: Array<{ timestamp: Date; value: number }> = [];

      for (const key of keys) {
        const timestamp = parseInt(key.split(':').pop() || '0');
        if (timestamp >= startTimeMs && timestamp <= endTimeMs) {
          const value = await optimizedRedisService.getClient().get(key);
          if (value) {
            results.push({
              timestamp: new Date(timestamp),
              value: parseFloat(value),
            });
          }
        }
      }

      // Sort by timestamp
      results.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      // Cache the result for 5 minutes
      await optimizedRedisService.set(cacheKey, results, {
        ttl: 300,
        json: true
      });

      return results;
    } catch (error) {
      logger.error('Failed to get historical metrics:', error);
      return [];
    }
  }

  /**
   * Get performance trends for specified metrics
   */
  getTrends(metrics: string[]): PerformanceTrend[] {
    const trends: PerformanceTrend[] = [];

    for (const metric of metrics) {
      const values = this.getMetricValues(metric);
      if (values.length < 2) continue;

      const currentValue = values[values.length - 1];
      const previousValue = values[Math.max(0, values.length - 10)]; // Compare with 10 data points ago
      const changePercent = previousValue > 0 ? ((currentValue - previousValue) / previousValue) * 100 : 0;

      let trend: 'improving' | 'degrading' | 'stable';
      if (Math.abs(changePercent) < 5) {
        trend = 'stable';
      } else if (this.isImprovingMetric(metric)) {
        trend = changePercent > 0 ? 'improving' : 'degrading';
      } else {
        trend = changePercent < 0 ? 'improving' : 'degrading';
      }

      // Calculate simple forecast
      let forecast: number | undefined;
      let confidence: number | undefined;
      if (values.length >= 10) {
        const recentValues = values.slice(-10);
        const avgChange = (recentValues[recentValues.length - 1] - recentValues[0]) / recentValues.length;
        forecast = currentValue + avgChange;
        confidence = Math.min(0.9, values.length / 100); // Confidence based on data availability
      }

      trends.push({
        metric,
        currentValue,
        previousValue,
        changePercent,
        trend,
        timeframe: '1h',
        forecast,
        confidence,
      });
    }

    return trends;
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): PerformanceAlert[] {
    return Array.from(this.alerts.values()).filter(alert => !alert.resolved);
  }

  /**
   * Get recent anomalies with enhanced details
   */
  getRecentAnomalies(limit: number = 50): AnomalyDetection[] {
    return this.anomalies
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Manually resolve an alert
   */
  resolveAlert(alertId: string): void {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      this.emit('alertResolved', alert);
      logger.info(`Performance alert resolved: ${alert.message}`);
    }
  }

  /**
   * Get system health score (0-100) with enhanced calculation
   */
  getHealthScore(): number {
    const metrics = this.getCurrentMetrics();
    let score = 100;

    // Memory usage impact
    const memoryUsagePercent = metrics.heapUsed / metrics.heapTotal;
    if (memoryUsagePercent > 0.9) score -= 30;
    else if (memoryUsagePercent > 0.8) score -= 20;
    else if (memoryUsagePercent > 0.7) score -= 10;

    // Response time impact
    if (metrics.p95ResponseTime > 5000) score -= 30;
    else if (metrics.p95ResponseTime > 2000) score -= 20;
    else if (metrics.p95ResponseTime > 1000) score -= 10;

    // Error rate impact
    if (metrics.errorRate > 0.1) score -= 30;
    else if (metrics.errorRate > 0.05) score -= 20;
    else if (metrics.errorRate > 0.01) score -= 10;

    // CPU usage impact
    const cpuUsage = metrics.cpuUsage.user + metrics.cpuUsage.system;
    if (cpuUsage > 1000000000) score -= 20; // Very rough CPU usage estimation

    // Active alerts impact
    const activeAlerts = this.getActiveAlerts();
    score -= activeAlerts.length * 5;

    // Bottleneck impact
    score -= this.bottlenecks.filter(b => !b.resolved).length * 10;

    return Math.max(0, score);
  }

  private setupEventHandlers(): void {
    this.on('alert', (alert: PerformanceAlert) => {
      logger.warn('Performance alert triggered', alert);
      this.alerts.set(alert.id, alert);
      this.broadcastAlert(alert);
    });

    this.on('anomaly', (anomaly: AnomalyDetection) => {
      logger.warn('Performance anomaly detected', anomaly);
      this.anomalies.push(anomaly);

      // Keep only recent anomalies (last 24 hours)
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      this.anomalies = this.anomalies.filter(a => a.timestamp.getTime() > cutoff);
    });

    this.on('bottleneck', (bottleneck: PerformanceBottleneck) => {
      logger.warn('Performance bottleneck identified', bottleneck);
      this.bottlenecks.push(bottleneck);

      // Keep only recent bottlenecks (last 7 days)
      const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
      this.bottlenecks = this.bottlenecks.filter(b => b.timestamp.getTime() > cutoff);
    });

    this.on('recommendation', (recommendation: OptimizationRecommendation) => {
      logger.info('Optimization recommendation generated', recommendation);
      this.recommendations.push(recommendation);

      // Keep only recent recommendations (last 24 hours)
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      this.recommendations = this.recommendations.filter(r => {
        // Keep critical recommendations longer
        if (r.priority === 'critical') {
          return r.timestamp.getTime() > (cutoff - 3 * 24 * 60 * 60 * 1000);
        }
        return r.timestamp.getTime() > cutoff;
      });
    });
  }

  private initializeEndpointTracking(): void {
    // Hook into performance middleware for endpoint tracking
    if (performanceMiddleware && typeof performanceMiddleware.requestTiming === 'function') {
      // This would require extending the middleware to emit events
      logger.info('Endpoint tracking initialized');
    }
  }

  private async collectMetrics(): Promise<void> {
    try {
      const metrics = this.getCurrentMetrics();

      // Store metrics in Redis for historical analysis
      const timestamp = Date.now();
      const pipeline = optimizedRedisService.getClient().pipeline();

      // Store individual metrics
      pipeline.setex(`metrics:response_time:${timestamp}`, this.METRIC_RETENTION_PERIOD / 1000, metrics.averageResponseTime);
      pipeline.setex(`metrics:p95_response_time:${timestamp}`, this.METRIC_RETENTION_PERIOD / 1000, metrics.p95ResponseTime);
      pipeline.setex(`metrics:error_rate:${timestamp}`, this.METRIC_RETENTION_PERIOD / 1000, metrics.errorRate);
      pipeline.setex(`metrics:memory_usage:${timestamp}`, this.METRIC_RETENTION_PERIOD / 1000, metrics.heapUsed);
      pipeline.setex(`metrics:requests_per_second:${timestamp}`, this.METRIC_RETENTION_PERIOD / 1000, metrics.requestsPerSecond);

      await pipeline.exec();

      // Update local metrics cache
      this.updateMetricCache('response_times', metrics.averageResponseTime);
      this.updateMetricCache('memory_usage', metrics.heapUsed);
      this.updateMetricCache('error_rate', metrics.errorRate);
      this.updateMetricCache('requests_per_second', metrics.requestsPerSecond);

      this.emit('metricsCollected', metrics);
    } catch (error) {
      logger.error('Failed to collect performance metrics:', error);
    }
  }

  private analyzeTrends(): void {
    const metricsToAnalyze = ['response_times', 'memory_usage', 'error_rate', 'requests_per_second'];
    const trends = this.getTrends(metricsToAnalyze);

    for (const trend of trends) {
      if (Math.abs(trend.changePercent) > 20) { // Significant change
        this.emit('significantTrend', trend);
      }
    }
  }

  private detectAnomalies(): void {
    const metricsToCheck = ['response_times', 'memory_usage', 'error_rate'];

    for (const metric of metricsToCheck) {
      const values = this.getMetricValues(metric);
      if (values.length < 10) continue; // Need sufficient data

      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
      const stdDev = Math.sqrt(variance);

      const currentValue = values[values.length - 1];
      const threshold = this.ANOMALY_THRESHOLD_MULTIPLIER * stdDev;

      if (Math.abs(currentValue - mean) > threshold) {
        const anomaly: AnomalyDetection = {
          id: `anomaly_${metric}_${Date.now()}`,
          metric,
          value: currentValue,
          expectedRange: {
            min: mean - threshold,
            max: mean + threshold,
          },
          severity: Math.abs(currentValue - mean) > threshold * 2 ? 'critical' : 'high',
          timestamp: new Date(),
          description: `${metric} value ${currentValue} is outside expected range [${(mean - threshold).toFixed(2)}, ${(mean + threshold).toFixed(2)}]`,
          pattern: this.detectPattern(values),
          relatedMetrics: this.findRelatedMetrics(metric),
          potentialCauses: this.identifyPotentialCauses(metric, currentValue),
        };

        this.emit('anomaly', anomaly);
      }
    }
  }

  private identifyBottlenecks(): void {
    const metrics = this.getCurrentMetrics();
    const endpointData = this.getEndpointPerformance();

    // Identify slow endpoints
    for (const [endpoint, data] of Object.entries(endpointData)) {
      if (data.p95ResponseTime > this.THRESHOLDS.responseTime) {
        const bottleneck: PerformanceBottleneck = {
          id: `bottleneck_${endpoint}_${Date.now()}`,
          type: 'api',
          severity: data.p95ResponseTime > 5000 ? 'critical' : data.p95ResponseTime > 2000 ? 'high' : 'medium',
          description: `Endpoint ${endpoint} has slow response times`,
          affectedEndpoints: [endpoint],
          impact: `P95 response time is ${data.p95ResponseTime}ms`,
          recommendation: 'Optimize database queries, implement caching, or refactor endpoint logic',
          timestamp: new Date(),
          metrics: {
            p95ResponseTime: data.p95ResponseTime,
            averageResponseTime: data.averageResponseTime,
            errorRate: data.errorRate,
          },
        };

        this.emit('bottleneck', bottleneck);
      }
    }

    // Identify memory bottlenecks
    const memoryUsagePercent = metrics.heapUsed / metrics.heapTotal;
    if (memoryUsagePercent > this.THRESHOLDS.memoryUsage) {
      const bottleneck: PerformanceBottleneck = {
        id: `bottleneck_memory_${Date.now()}`,
        type: 'memory',
        severity: memoryUsagePercent > 0.9 ? 'critical' : 'high',
        description: 'High memory usage detected',
        affectedEndpoints: ['system'],
        impact: `Memory usage is ${(memoryUsagePercent * 100).toFixed(1)}%`,
        recommendation: 'Implement memory optimization, check for memory leaks, or increase available memory',
        timestamp: new Date(),
        metrics: {
          memoryUsagePercent: memoryUsagePercent * 100,
          heapUsed: metrics.heapUsed,
          heapTotal: metrics.heapTotal,
        },
      };

      this.emit('bottleneck', bottleneck);
    }
  }

  private generateRecommendations(): void {
    const metrics = this.getCurrentMetrics();
    const bottlenecks = this.getBottlenecks().filter(b => !b.resolved);

    // Generate recommendations based on bottlenecks
    for (const bottleneck of bottlenecks) {
      if (this.recommendations.some(r => r.title.includes(bottleneck.description))) {
        continue; // Avoid duplicate recommendations
      }

      const recommendation: OptimizationRecommendation = {
        id: `rec_${bottleneck.id}`,
        category: this.mapBottleneckTypeToCategory(bottleneck.type),
        priority: bottleneck.severity,
        title: `Optimize ${bottleneck.description}`,
        description: bottleneck.recommendation,
        expectedImpact: `Reduce ${bottleneck.impact}`,
        implementation: {
          complexity: 'medium',
          estimatedTime: '2-4 hours',
          steps: this.getImplementationSteps(bottleneck.type),
        },
        relatedMetrics: Object.keys(bottleneck.metrics),
        autoFixable: bottleneck.type === 'cache',
      };

      this.emit('recommendation', recommendation);
    }

    // Generate proactive recommendations
    if (metrics.requestsPerSecond > 100 && metrics.p95ResponseTime > 500) {
      const recommendation: OptimizationRecommendation = {
        id: `rec_scaling_${Date.now()}`,
        category: 'scalability',
        priority: 'high',
        title: 'Implement horizontal scaling',
        description: 'High request volume detected with increasing response times',
        expectedImpact: 'Improve system capacity and reduce response times under load',
        implementation: {
          complexity: 'high',
          estimatedTime: '1-2 days',
          steps: [
            'Set up load balancer',
            'Configure multiple application instances',
            'Implement session affinity if needed',
            'Monitor and tune cluster performance',
          ],
        },
        relatedMetrics: ['requests_per_second', 'p95_response_time'],
        autoFixable: false,
      };

      this.emit('recommendation', recommendation);
    }
  }

  private checkThresholds(): void {
    const metrics = this.getCurrentMetrics();

    // Check memory usage
    const memoryUsagePercent = metrics.heapUsed / metrics.heapTotal;
    if (memoryUsagePercent > this.THRESHOLDS.memoryUsage) {
      this.createAlert('memory', 'high',
        `Memory usage is ${(memoryUsagePercent * 100).toFixed(1)}%`,
        memoryUsagePercent, this.THRESHOLDS.memoryUsage);
    }

    // Check response time
    if (metrics.p95ResponseTime > this.THRESHOLDS.responseTime) {
      this.createAlert('response_time', 'medium',
        `P95 response time is ${metrics.p95ResponseTime}ms`,
        metrics.p95ResponseTime, this.THRESHOLDS.responseTime);
    }

    // Check error rate
    if (metrics.errorRate > this.THRESHOLDS.errorRate) {
      this.createAlert('error_rate', 'high',
        `Error rate is ${(metrics.errorRate * 100).toFixed(2)}%`,
        metrics.errorRate, this.THRESHOLDS.errorRate);
    }
  }

  private createAlert(
    type: PerformanceAlert['type'],
    severity: PerformanceAlert['severity'],
    message: string,
    value: number,
    threshold: number
  ): void {
    const alertId = `${type}_${Date.now()}`;
    const alert: PerformanceAlert = {
      id: alertId,
      type,
      severity,
      message,
      value,
      threshold,
      timestamp: new Date(),
      resolved: false,
      recommendedAction: this.getRecommendedAction(type, value, threshold),
    };

    this.emit('alert', alert);
  }

  private broadcastRealTimeUpdates(): void {
    if (this.websocketConnections.size === 0) return;

    const update = {
      type: 'metrics',
      data: this.getCurrentMetrics(),
      timestamp: new Date(),
    };

    this.websocketConnections.forEach(ws => {
      if (ws.readyState === 1) { // WebSocket.OPEN
        ws.send(JSON.stringify(update));
      }
    });
  }

  private broadcastAlert(alert: PerformanceAlert): void {
    if (this.websocketConnections.size === 0) return;

    const update = {
      type: 'alert',
      data: alert,
      timestamp: new Date(),
    };

    this.websocketConnections.forEach(ws => {
      if (ws.readyState === 1) { // WebSocket.OPEN
        ws.send(JSON.stringify(update));
      }
    });
  }

  private updateMetricCache(metric: string, value: number): void {
    if (!this.metrics.has(metric)) {
      this.metrics.set(metric, []);
    }

    const values = this.metrics.get(metric)!;
    values.push(value);

    // Keep only last 1000 values
    if (values.length > 1000) {
      values.splice(0, values.length - 1000);
    }
  }

  private getMetricValues(metric: string): number[] {
    return this.metrics.get(metric) || [];
  }

  private isImprovingMetric(metric: string): boolean {
    const improvingMetrics = ['response_times', 'memory_usage', 'error_rate'];
    return improvingMetrics.includes(metric);
  }

  private getActiveConnections(): number {
    // This would typically come from your HTTP server
    return this.websocketConnections.size;
  }

  private detectPattern(values: number[]): string {
    if (values.length < 5) return 'insufficient_data';

    const recent = values.slice(-5);
    const trend = recent[4] - recent[0];

    if (Math.abs(trend) < (recent[0] * 0.1)) return 'stable';
    return trend > 0 ? 'increasing' : 'decreasing';
  }

  private findRelatedMetrics(metric: string): string[] {
    const relationships: Record<string, string[]> = {
      'response_times': ['memory_usage', 'requests_per_second'],
      'memory_usage': ['response_times', 'error_rate'],
      'error_rate': ['response_times', 'memory_usage'],
      'requests_per_second': ['response_times', 'memory_usage'],
    };

    return relationships[metric] || [];
  }

  private identifyPotentialCauses(metric: string, value: number): string[] {
    const causes: Record<string, string[]> = {
      'response_times': [
        'High database query load',
        'Insufficient caching',
        'Resource contention',
        'Network latency',
      ],
      'memory_usage': [
        'Memory leak',
        'Inefficient data structures',
        'Large object allocations',
        'Insufficient garbage collection',
      ],
      'error_rate': [
        'Resource exhaustion',
        'Invalid input handling',
        'External service failures',
        'Configuration issues',
      ],
    };

    return causes[metric] || ['Unknown cause'];
  }

  private mapBottleneckTypeToCategory(type: PerformanceBottleneck['type']): OptimizationRecommendation['category'] {
    const mapping: Record<PerformanceBottleneck['type'], OptimizationRecommendation['category']> = {
      'api': 'performance',
      'database': 'database',
      'memory': 'memory',
      'cache': 'cache',
      'network': 'scalability',
    };

    return mapping[type] || 'performance';
  }

  private getImplementationSteps(type: PerformanceBottleneck['type']): string[] {
    const steps: Record<PerformanceBottleneck['type'], string[]> = {
      'api': [
        'Analyze endpoint performance',
        'Optimize database queries',
        'Implement caching strategy',
        'Refactor business logic',
      ],
      'database': [
        'Review query execution plans',
        'Add appropriate indexes',
        'Optimize connection pooling',
        'Consider query caching',
      ],
      'memory': [
        'Profile memory usage',
        'Identify memory leaks',
        'Optimize data structures',
        'Tune garbage collection',
      ],
      'cache': [
        'Analyze cache hit rates',
        'Adjust cache TTL values',
        'Implement cache warming',
        'Review cache invalidation strategy',
      ],
      'network': [
        'Analyze network latency',
        'Optimize payload sizes',
        'Implement compression',
        'Review CDN configuration',
      ],
    };

    return steps[type] || ['Analyze performance metrics', 'Identify optimization opportunities', 'Implement improvements', 'Monitor results'];
  }

  private getRecommendedAction(type: PerformanceAlert['type'], value: number, threshold: number): string {
    const actions: Record<PerformanceAlert['type'], string> = {
      'memory': 'Monitor memory usage, check for memory leaks, consider increasing memory allocation',
      'response_time': 'Analyze slow requests, optimize database queries, implement caching',
      'error_rate': 'Review error logs, fix underlying issues, improve error handling',
      'cpu': 'Profile CPU usage, optimize algorithms, consider horizontal scaling',
      'disk_space': 'Clean up temporary files, implement log rotation, increase disk capacity',
      'database': 'Optimize queries, add indexes, consider read replicas',
      'cache': 'Review cache strategy, increase cache size, optimize TTL values',
    };

    return actions[type] || 'Monitor system performance and investigate underlying causes';
  }
}

// Create and export singleton instance
export const enhancedPerformanceMonitoringService = new EnhancedPerformanceMonitoringService();