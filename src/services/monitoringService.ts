import { logger } from '../utils/logger';
import { optimizedRedisService } from '../config/optimized-redis';
import { performanceMiddleware } from '../middleware/performanceMiddleware';
import { checkDatabaseHealth } from '../config/postgresql-database';

interface HealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  lastCheck: Date;
  details?: any;
  error?: string;
}

interface SystemMetrics {
  cpu: number;
  memory: NodeJS.MemoryUsage;
  disk: number;
  uptime: number;
  loadAverage: number[];
  eventLoopLag: number;
}

interface Alert {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: string;
  message: string;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  metadata?: any;
}

class MonitoringService {
  private healthChecks: Map<string, HealthCheck> = new Map();
  private alerts: Alert[] = [];
  private metrics: SystemMetrics;
  private isRunning = false;
  private monitoringInterval?: NodeJS.Timeout;

  constructor() {
    this.metrics = this.getInitialMetrics();
    this.setupHealthChecks();
    this.startMonitoring();
  }

  // Start continuous monitoring
  startMonitoring(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    logger.info('Starting system monitoring');

    // Run health checks every 30 seconds
    this.monitoringInterval = setInterval(async () => {
      await this.runHealthChecks();
      this.collectSystemMetrics();
      this.checkThresholds();
    }, 30000);

    // Run initial health checks
    this.runHealthChecks();
  }

  // Stop monitoring
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    this.isRunning = false;
    logger.info('System monitoring stopped');
  }

  // Setup individual health checks
  private setupHealthChecks(): void {
    // Database health check
    this.healthChecks.set('database', {
      name: 'PostgreSQL Database',
      status: 'healthy',
      responseTime: 0,
      lastCheck: new Date(),
    });

    // Redis health check
    this.healthChecks.set('redis', {
      name: 'Redis Cache',
      status: 'healthy',
      responseTime: 0,
      lastCheck: new Date(),
    });

    // Memory health check
    this.healthChecks.set('memory', {
      name: 'Memory Usage',
      status: 'healthy',
      responseTime: 0,
      lastCheck: new Date(),
    });

    // CPU health check
    this.healthChecks.set('cpu', {
      name: 'CPU Usage',
      status: 'healthy',
      responseTime: 0,
      lastCheck: new Date(),
    });

    // Event Loop health check
    this.healthChecks.set('eventloop', {
      name: 'Event Loop Lag',
      status: 'healthy',
      responseTime: 0,
      lastCheck: new Date(),
    });
  }

  // Run all health checks
  private async runHealthChecks(): Promise<void> {
    const checks = [
      this.checkDatabaseHealth(),
      this.checkRedisHealth(),
      this.checkMemoryHealth(),
      this.checkCpuHealth(),
      this.checkEventLoopHealth(),
    ];

    await Promise.allSettled(checks);
  }

  // Database health check
  private async checkDatabaseHealth(): Promise<void> {
    const startTime = Date.now();
    try {
      const isHealthy = await checkDatabaseHealth();
      const responseTime = Date.now() - startTime;

      const healthCheck: HealthCheck = {
        name: 'PostgreSQL Database',
        status: isHealthy ? 'healthy' : 'unhealthy',
        responseTime,
        lastCheck: new Date(),
      };

      this.healthChecks.set('database', healthCheck);

      if (!isHealthy) {
        this.createAlert({
          severity: 'critical',
          type: 'database',
          message: 'Database connection failed',
          metadata: { responseTime },
        });
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const healthCheck: HealthCheck = {
        name: 'PostgreSQL Database',
        status: 'unhealthy',
        responseTime,
        lastCheck: new Date(),
        error: error.message,
      };

      this.healthChecks.set('database', healthCheck);

      this.createAlert({
        severity: 'critical',
        type: 'database',
        message: 'Database health check failed: ' + error.message,
        metadata: { responseTime, error: error.message },
      });
    }
  }

  // Redis health check
  private async checkRedisHealth(): Promise<void> {
    const startTime = Date.now();
    try {
      const healthResult = await optimizedRedisService.healthCheck();
      const responseTime = Date.now() - startTime;

      const healthCheck: HealthCheck = {
        name: 'Redis Cache',
        status: healthResult.healthy ? 'healthy' : 'unhealthy',
        responseTime,
        lastCheck: new Date(),
        details: healthResult.details,
      };

      this.healthChecks.set('redis', healthCheck);

      if (!healthResult.healthy) {
        this.createAlert({
          severity: 'high',
          type: 'redis',
          message: 'Redis connection failed',
          metadata: { responseTime, details: healthResult.details },
        });
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const healthCheck: HealthCheck = {
        name: 'Redis Cache',
        status: 'unhealthy',
        responseTime,
        lastCheck: new Date(),
        error: error.message,
      };

      this.healthChecks.set('redis', healthCheck);

      this.createAlert({
        severity: 'high',
        type: 'redis',
        message: 'Redis health check failed: ' + error.message,
        metadata: { responseTime, error: error.message },
      });
    }
  }

  // Memory health check
  private async checkMemoryHealth(): Promise<void> {
    const memUsage = process.memoryUsage();
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
    const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
    const heapUsagePercent = (heapUsedMB / heapTotalMB) * 100;

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (heapUsagePercent > 90) {
      status = 'unhealthy';
    } else if (heapUsagePercent > 75) {
      status = 'degraded';
    }

    const healthCheck: HealthCheck = {
      name: 'Memory Usage',
      status,
      responseTime: 0,
      lastCheck: new Date(),
      details: {
        heapUsed: heapUsedMB.toFixed(2) + 'MB',
        heapTotal: heapTotalMB.toFixed(2) + 'MB',
        usagePercent: heapUsagePercent.toFixed(2) + '%',
      },
    };

    this.healthChecks.set('memory', healthCheck);

    if (status === 'unhealthy') {
      this.createAlert({
        severity: 'critical',
        type: 'memory',
        message: 'High memory usage: ' + heapUsagePercent.toFixed(2) + '%',
        metadata: { heapUsedMB, heapTotalMB, heapUsagePercent },
      });
    }
  }

  // CPU health check
  private async checkCpuHealth(): Promise<void> {
    const loadAvg = require('os').loadavg();
    const cpuCount = require('os').cpus().length;
    const loadAverage1m = loadAvg[0];
    const loadPercent = (loadAverage1m / cpuCount) * 100;

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (loadPercent > 90) {
      status = 'unhealthy';
    } else if (loadPercent > 75) {
      status = 'degraded';
    }

    const healthCheck: HealthCheck = {
      name: 'CPU Usage',
      status,
      responseTime: 0,
      lastCheck: new Date(),
      details: {
        loadAverage1m: loadAverage1m.toFixed(2),
        cpuCount,
        loadPercent: loadPercent.toFixed(2) + '%',
      },
    };

    this.healthChecks.set('cpu', healthCheck);

    if (status === 'unhealthy') {
      this.createAlert({
        severity: 'high',
        type: 'cpu',
        message: 'High CPU usage: ' + loadPercent.toFixed(2) + '%',
        metadata: { loadAverage1m, cpuCount, loadPercent },
      });
    }
  }

  // Event loop health check
  private async checkEventLoopHealth(): Promise<void> {
    return new Promise((resolve) => {
      const start = Date.now();
      setImmediate(() => {
        const lag = Date.now() - start;

        let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
        if (lag > 100) {
          status = 'unhealthy';
        } else if (lag > 50) {
          status = 'degraded';
        }

        const healthCheck: HealthCheck = {
          name: 'Event Loop Lag',
          status,
          responseTime: lag,
          lastCheck: new Date(),
          details: {
            lag: lag + 'ms',
          },
        };

        this.healthChecks.set('eventloop', healthCheck);

        if (status === 'unhealthy') {
          this.createAlert({
            severity: 'high',
            type: 'eventloop',
            message: 'High event loop lag: ' + lag + 'ms',
            metadata: { lag },
          });
        }

        resolve();
      });
    });
  }

  // Collect system metrics
  private collectSystemMetrics(): void {
    const os = require('os');

    this.metrics = {
      cpu: os.loadavg()[0],
      memory: process.memoryUsage(),
      disk: 0, // Would need to implement disk usage check
      uptime: process.uptime(),
      loadAverage: os.loadavg(),
      eventLoopLag: 0, // Measured in health check
    };
  }

  // Check thresholds and create alerts
  private checkThresholds(): void {
    const performanceMetrics = performanceMiddleware.getMetrics();

    // Check response time
    if (performanceMetrics.averageResponseTime > 500) {
      this.createAlert({
        severity: 'medium',
        type: 'performance',
        message: 'High average response time: ' + performanceMetrics.averageResponseTime.toFixed(2) + 'ms',
        metadata: { averageResponseTime: performanceMetrics.averageResponseTime },
      });
    }

    // Check error rate
    if (performanceMetrics.errorRate > 5) {
      this.createAlert({
        severity: 'high',
        type: 'error_rate',
        message: 'High error rate: ' + performanceMetrics.errorRate.toFixed(2) + '%',
        metadata: { errorRate: performanceMetrics.errorRate },
      });
    }

    // Check P95 response time
    if (performanceMetrics.p95ResponseTime > 1000) {
      this.createAlert({
        severity: 'medium',
        type: 'performance',
        message: 'High P95 response time: ' + performanceMetrics.p95ResponseTime.toFixed(2) + 'ms',
        metadata: { p95ResponseTime: performanceMetrics.p95ResponseTime },
      });
    }
  }

  // Create alert
  private createAlert(alertData: Omit<Alert, 'id' | 'timestamp' | 'resolved'>): void {
    const alert: Alert = {
      id: this.generateAlertId(),
      timestamp: new Date(),
      resolved: false,
      ...alertData,
    };

    this.alerts.push(alert);

    // Keep only last 1000 alerts
    if (this.alerts.length > 1000) {
      this.alerts = this.alerts.slice(-1000);
    }

    // Log alert
    logger.warn('Alert created', {
      id: alert.id,
      severity: alert.severity,
      type: alert.type,
      message: alert.message,
      metadata: alert.metadata,
    });

    // Send critical alerts to external monitoring (would integrate with Slack, etc.)
    if (alert.severity === 'critical') {
      this.sendCriticalAlert(alert);
    }
  }

  // Send critical alert to external systems
  private sendCriticalAlert(alert: Alert): void {
    // This would integrate with external alerting systems
    // For now, just log at error level
    logger.error('CRITICAL ALERT', {
      id: alert.id,
      type: alert.type,
      message: alert.message,
      metadata: alert.metadata,
    });
  }

  // Get all health checks
  getHealthChecks(): HealthCheck[] {
    return Array.from(this.healthChecks.values());
  }

  // Get system metrics
  getSystemMetrics(): SystemMetrics {
    return { ...this.metrics };
  }

  // Get performance metrics
  getPerformanceMetrics() {
    return performanceMiddleware.getMetrics();
  }

  // Get alerts
  getAlerts(options: { severity?: string; resolved?: boolean; limit?: number } = {}): Alert[] {
    let filteredAlerts = [...this.alerts];

    if (options.severity) {
      filteredAlerts = filteredAlerts.filter(alert => alert.severity === options.severity);
    }

    if (options.resolved !== undefined) {
      filteredAlerts = filteredAlerts.filter(alert => alert.resolved === options.resolved);
    }

    if (options.limit) {
      filteredAlerts = filteredAlerts.slice(-options.limit);
    }

    return filteredAlerts.reverse(); // Most recent first
  }

  // Resolve alert
  resolveAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      logger.info('Alert resolved', { id: alertId, message: alert.message });
    }
  }

  // Get overall system status
  getSystemStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    uptime: number;
    healthChecks: HealthCheck[];
    alerts: Alert[];
    metrics: SystemMetrics;
    performance: any;
    } {
    const healthChecks = this.getHealthChecks();
    const criticalAlerts = this.getAlerts({ severity: 'critical', resolved: false });
    const highAlerts = this.getAlerts({ severity: 'high', resolved: false });

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (criticalAlerts.length > 0) {
      status = 'unhealthy';
    } else if (highAlerts.length > 0 || healthChecks.some(hc => hc.status === 'unhealthy')) {
      status = 'degraded';
    }

    return {
      status,
      uptime: process.uptime(),
      healthChecks,
      alerts: this.getAlerts({ limit: 10 }),
      metrics: this.getSystemMetrics(),
      performance: this.getPerformanceMetrics(),
    };
  }

  private getInitialMetrics(): SystemMetrics {
    return {
      cpu: 0,
      memory: process.memoryUsage(),
      disk: 0,
      uptime: 0,
      loadAverage: [0, 0, 0],
      eventLoopLag: 0,
    };
  }

  private generateAlertId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }
}

// Create and export singleton instance
export const monitoringService = new MonitoringService();
