import { EventEmitter } from 'events';
import { performanceMiddleware } from '../middleware/performanceMiddleware';
import { optimizedRedisService } from '../config/optimized-redis';
import { logger } from '../utils/logger';

/**
 * Performance monitoring service for real-time metrics collection and analysis
 * 
 * Features:
 * - Real-time metrics collection (response times, memory usage, error rates)
 * - Performance trend analysis and anomaly detection
 * - Alert system for performance degradation
 * - Integration with existing performanceMiddleware.ts
 * - Event-driven architecture for real-time monitoring
 */
export interface PerformanceMetrics {
  requestCount: number;
  totalResponseTime: number;
  averageResponseTime: number;
  errorRate: number;
  lastResetTime: Date;
}

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
}

export interface PerformanceAlert {
  id: string;
  type: 'memory' | 'response_time' | 'error_rate' | 'cpu' | 'disk_space';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  value: number;
  threshold: number;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
}

export interface PerformanceTrend {
  metric: string;
  currentValue: number;
  previousValue: number;
  changePercent: number;
  trend: 'improving' | 'degrading' | 'stable';
  timeframe: '1h' | '6h' | '24h' | '7d';
}

export interface AnomalyDetection {
  metric: string;
  value: number;
  expectedRange: { min: number; max: number };
  severity: 'low' | 'medium' | 'high';
  timestamp: Date;
  description: string;
}

/**
 * Enhanced Performance Monitoring Service
 * 
 * This service provides comprehensive performance monitoring with real-time metrics
 * collection, trend analysis, anomaly detection, and alerting capabilities.
 */
export class PerformanceMonitoringService extends EventEmitter {
  private metrics: Map<string, number[]> = new Map();
  private alerts: Map<string, PerformanceAlert> = new Map();
  private trends: Map<string, PerformanceTrend[]> = new Map();
  private anomalies: AnomalyDetection[] = [];
  private isMonitoring = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private readonly METRIC_RETENTION_PERIOD = 7 * 24 * 60 * 60 * 1000; // 7 days
  private readonly ANOMALY_THRESHOLD_MULTIPLIER = 2; // Standard deviations
  
  // Performance thresholds
  private readonly THRESHOLDS = {
    memoryUsage: 0.8, // 80% of available memory
    responseTime: 1000, // 1 second
    errorRate: 0.05, // 5%
    cpuUsage: 0.8, // 80% CPU usage
    diskSpace: 0.9, // 90% disk usage
  };

  constructor() {
    super();
    this.setupEventHandlers();
  }

  /**
   * Start performance monitoring
   */
  startMonitoring(): void {
    if (this.isMonitoring) {
      logger.warn('Performance monitoring is already running');
      return;
    }

    this.isMonitoring = true;
    logger.info('Starting performance monitoring service');

    // Start collecting metrics every 30 seconds
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
      this.analyzeTrends();
      this.detectAnomalies();
      this.checkThresholds();
    }, 30000);

    // Initial metrics collection
    this.collectMetrics();
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      logger.warn('Performance monitoring is not running');
      return;
    }

    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    logger.info('Performance monitoring service stopped');
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
    };
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
      // In a production environment, you might want to use a time-series database
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
      const previousValue = values[values.length - 2];
      const changePercent = ((currentValue - previousValue) / previousValue) * 100;
      
      let trend: 'improving' | 'degrading' | 'stable';
      if (Math.abs(changePercent) < 5) {
        trend = 'stable';
      } else if (this.isImprovingMetric(metric)) {
        trend = changePercent > 0 ? 'improving' : 'degrading';
      } else {
        trend = changePercent < 0 ? 'improving' : 'degrading';
      }

      trends.push({
        metric,
        currentValue,
        previousValue,
        changePercent,
        trend,
        timeframe: '1h', // Default timeframe
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
   * Get recent anomalies
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
   * Get system health score (0-100)
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

    // Active alerts impact
    const activeAlerts = this.getActiveAlerts();
    score -= activeAlerts.length * 5;

    return Math.max(0, score);
  }

  /**
   * Get optimization recommendations based on current metrics
   */
  getOptimizationRecommendations(): Array<{
    category: 'memory' | 'performance' | 'reliability' | 'scalability';
    priority: 'low' | 'medium' | 'high' | 'critical';
    recommendation: string;
    expectedImpact: string;
  }> {
    const metrics = this.getCurrentMetrics();
    const recommendations = [];

    // Memory recommendations
    const memoryUsagePercent = metrics.heapUsed / metrics.heapTotal;
    if (memoryUsagePercent > 0.8) {
      recommendations.push({
        category: 'memory',
        priority: memoryUsagePercent > 0.9 ? 'critical' : 'high',
        recommendation: 'High memory usage detected. Consider implementing memory pooling or increasing available memory.',
        expectedImpact: 'Reduce memory-related errors and improve stability',
      });
    }

    // Response time recommendations
    if (metrics.p95ResponseTime > 2000) {
      recommendations.push({
        category: 'performance',
        priority: 'high',
        recommendation: 'Slow response times detected. Consider optimizing database queries or implementing caching.',
        expectedImpact: 'Improve user experience and reduce server load',
      });
    }

    // Error rate recommendations
    if (metrics.errorRate > 0.05) {
      recommendations.push({
        category: 'reliability',
        priority: 'high',
        recommendation: 'High error rate detected. Review error logs and implement better error handling.',
        expectedImpact: 'Reduce system failures and improve reliability',
      });
    }

    // RPS recommendations
    if (metrics.requestsPerSecond > 100) {
      recommendations.push({
        category: 'scalability',
        priority: 'medium',
        recommendation: 'High request volume detected. Consider implementing rate limiting or horizontal scaling.',
        expectedImpact: 'Improve system stability under load',
      });
    }

    return recommendations;
  }

  private setupEventHandlers(): void {
    this.on('alert', (alert: PerformanceAlert) => {
      logger.warn('Performance alert triggered', alert);
      this.alerts.set(alert.id, alert);
    });

    this.on('anomaly', (anomaly: AnomalyDetection) => {
      logger.warn('Performance anomaly detected', anomaly);
      this.anomalies.push(anomaly);
      
      // Keep only recent anomalies (last 24 hours)
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      this.anomalies = this.anomalies.filter(a => a.timestamp.getTime() > cutoff);
    });
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
          metric,
          value: currentValue,
          expectedRange: {
            min: mean - threshold,
            max: mean + threshold,
          },
          severity: Math.abs(currentValue - mean) > threshold * 2 ? 'high' : 'medium',
          timestamp: new Date(),
          description: `${metric} value ${currentValue} is outside expected range [${(mean - threshold).toFixed(2)}, ${(mean + threshold).toFixed(2)}]`,
        };
        
        this.emit('anomaly', anomaly);
      }
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
    };
    
    this.emit('alert', alert);
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
    // Lower values are better for these metrics
    const improvingMetrics = ['response_times', 'memory_usage', 'error_rate'];
    return improvingMetrics.includes(metric);
  }

  private getActiveConnections(): number {
    // This would typically come from your HTTP server
    // For now, return a placeholder value
    return 0;
  }
}

// Create and export singleton instance
export const performanceMonitoringService = new PerformanceMonitoringService();
