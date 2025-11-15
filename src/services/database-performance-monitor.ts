/**
 * Database Performance Monitor
 *
 * Real-time database performance tracking with comprehensive metrics,
 * alerting, and trend analysis for the WorkshopsAI CMS PostgreSQL database.
 *
 * Features:
 * - Real-time query performance tracking
 * - Connection pool monitoring
 * - Lock detection and analysis
 * - Table bloat monitoring
 * - Performance trend analysis
 * - Alerting and notifications
 * - Historical data retention
 */

import { client, db } from '../config/postgresql-database';
import { redisService } from '../config/redis';
import { EventEmitter } from 'events';
import { databaseQueryOptimizationService } from './database-optimization-service';

/**
 * Performance metrics snapshot
 */
export interface PerformanceSnapshot {
  timestamp: Date;
  connections: {
    active: number;
    idle: number;
    total: number;
    waiting: number;
    maxUsed: number;
  };
  queries: {
    totalQueries: number;
    averageExecutionTime: number;
    slowQueries: number;
    longestQuery: number;
    queriesPerSecond: number;
  };
  cache: {
    hitRatio: number;
    indexHitRatio: number;
    tableHitRatio: number;
  };
  locks: {
    waitingLocks: number;
    grantedLocks: number;
    deadlocks: number;
    lockTimeouts: number;
  };
  io: {
    sequentialScans: number;
    indexScans: number;
    tuplesRead: number;
    tuplesReturned: number;
    diskReads: number;
    bufferHits: number;
  };
  transactions: {
    committed: number;
    rolledBack: number;
    active: number;
  };
  vacuum: {
    autoVacuumRuns: number;
    manualVacuumRuns: number;
    deadTuples: number;
    liveTuples: number;
  };
  memory: {
    sharedBuffersUsed: number;
    workMemUsed: number;
    maintenanceWorkMemUsed: number;
  };
}

/**
 * Performance alert definition
 */
export interface PerformanceAlert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  category: 'connections' | 'queries' | 'locks' | 'io' | 'memory' | 'vacuum';
  title: string;
  description: string;
  value: number;
  threshold: number;
  timestamp: Date;
  resolved?: boolean;
  resolvedAt?: Date;
}

/**
 * Performance trend data
 */
export interface PerformanceTrend {
  metric: string;
  timeframe: '1h' | '6h' | '24h' | '7d' | '30d';
  data: Array<{
    timestamp: Date;
    value: number;
  }>;
  trend: 'increasing' | 'decreasing' | 'stable';
  changeRate: number; // percentage change
  prediction?: number; // predicted next value
}

/**
 * Table performance statistics
 */
export interface TablePerformanceStats {
  tableName: string;
  size: number; // in MB
  rows: number;
  deadRows: number;
  bloat: number; // percentage
  lastVacuum?: Date;
  lastAnalyze?: Date;
  indexUsage: number;
  sequentialScans: number;
  indexScans: number;
  tuplesRead: number;
  tuplesReturned: number;
  insertRate: number; // per minute
  updateRate: number; // per minute
  deleteRate: number; // per minute
}

/**
 * Performance monitor configuration
 */
export interface PerformanceMonitorConfig {
  enabled: boolean;
  interval: number; // in milliseconds
  retention: {
    snapshots: number; // number of snapshots to keep
    alerts: number; // number of days to keep alerts
    trends: number; // number of days to keep trend data
  };
  thresholds: {
    connections: {
      maxActive: number;
      maxWaiting: number;
      maxUtilization: number; // percentage
    };
    queries: {
      maxExecutionTime: number; // in milliseconds
      maxSlowQueries: number;
      minHitRatio: number; // percentage
    };
    locks: {
      maxWaiting: number;
      maxDeadlocks: number;
    };
    io: {
      maxDiskReadRatio: number; // percentage
      maxSequentialScans: number;
    };
    memory: {
      maxSharedBuffersUsage: number; // percentage
      maxWorkMemUsage: number; // percentage
    };
    vacuum: {
      maxBloat: number; // percentage
      maxDeadTuples: number; // percentage
    };
  };
  alerts: {
    enabled: boolean;
    cooldown: number; // in milliseconds
    webhook?: string;
    email?: string;
  };
  autoOptimization: {
    enabled: boolean;
    autoVacuum: boolean;
    autoAnalyze: boolean;
    indexMaintenance: boolean;
  };
}

/**
 * Database Performance Monitor
 */
export class DatabasePerformanceMonitor extends EventEmitter {
  private config: PerformanceMonitorConfig;
  private isMonitoring: boolean = false;
  private monitoringInterval?: NodeJS.Timeout;
  private lastSnapshot?: PerformanceSnapshot;
  private alertCooldowns: Map<string, Date> = new Map();
  private activeAlerts: Map<string, PerformanceAlert> = new Map();

  constructor(config?: Partial<PerformanceMonitorConfig>) {
    super();

    this.config = {
      enabled: true,
      interval: 30000, // 30 seconds
      retention: {
        snapshots: 1440, // 24 hours worth of 30-second snapshots
        alerts: 7, // 7 days
        trends: 30, // 30 days
      },
      thresholds: {
        connections: {
          maxActive: 8,
          maxWaiting: 2,
          maxUtilization: 0.8, // 80%
        },
        queries: {
          maxExecutionTime: 5000, // 5 seconds
          maxSlowQueries: 10,
          minHitRatio: 0.9, // 90%
        },
        locks: {
          maxWaiting: 5,
          maxDeadlocks: 1,
        },
        io: {
          maxDiskReadRatio: 0.2, // 20%
          maxSequentialScans: 1000,
        },
        memory: {
          maxSharedBuffersUsage: 0.8, // 80%
          maxWorkMemUsage: 0.7, // 70%
        },
        vacuum: {
          maxBloat: 0.2, // 20%
          maxDeadTuples: 0.15, // 15%
        },
      },
      alerts: {
        enabled: true,
        cooldown: 300000, // 5 minutes
      },
      autoOptimization: {
        enabled: true,
        autoVacuum: true,
        autoAnalyze: true,
        indexMaintenance: true,
      },
      ...config,
    };

    this.initializeMonitor();
  }

  /**
   * Initialize the performance monitor
   */
  private async initializeMonitor(): Promise<void> {
    try {
      // Load historical data
      await this.loadHistoricalData();

      // Start monitoring if enabled
      if (this.config.enabled) {
        this.startMonitoring();
      }

      console.log('Database Performance Monitor initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Database Performance Monitor:', error);
    }
  }

  /**
   * Start performance monitoring
   */
  startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.collectMetrics();
        await this.analyzePerformance();
        await this.checkThresholds();
        await this.updateTrends();
      } catch (error) {
        console.error('Performance monitoring error:', error);
        this.emit('monitoringError', error);
      }
    }, this.config.interval);

    console.log('Database performance monitoring started');
    this.emit('monitoringStarted');
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    console.log('Database performance monitoring stopped');
    this.emit('monitoringStopped');
  }

  /**
   * Collect current performance metrics
   */
  async collectMetrics(): Promise<PerformanceSnapshot> {
    const snapshot: PerformanceSnapshot = {
      timestamp: new Date(),
      connections: await this.collectConnectionMetrics(),
      queries: await this.collectQueryMetrics(),
      cache: await this.collectCacheMetrics(),
      locks: await this.collectLockMetrics(),
      io: await this.collectIOMetrics(),
      transactions: await this.collectTransactionMetrics(),
      vacuum: await this.collectVacuumMetrics(),
      memory: await this.collectMemoryMetrics(),
    };

    this.lastSnapshot = snapshot;

    // Store snapshot
    await this.storeSnapshot(snapshot);

    // Emit snapshot event
    this.emit('snapshot', snapshot);

    return snapshot;
  }

  /**
   * Collect connection metrics
   */
  private async collectConnectionMetrics(): Promise<PerformanceSnapshot['connections']> {
    try {
      const result = await client.query(`
        SELECT
          COUNT(*) FILTER (WHERE state = 'active') as active,
          COUNT(*) FILTER (WHERE state = 'idle') as idle,
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE wait_event IS NOT NULL) as waiting,
          (SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'active') as max_used
        FROM pg_stat_activity
        WHERE datname = current_database()
      `);

      const stats = result[0];
      return {
        active: stats.active,
        idle: stats.idle,
        total: stats.total,
        waiting: stats.waiting,
        maxUsed: stats.max_used,
      };
    } catch (error) {
      console.warn('Failed to collect connection metrics:', error);
      return { active: 0, idle: 0, total: 0, waiting: 0, maxUsed: 0 };
    }
  }

  /**
   * Collect query metrics
   */
  private async collectQueryMetrics(): Promise<PerformanceSnapshot['queries']> {
    try {
      const result = await client.query(`
        SELECT
          calls as total_queries,
          total_time / 1000 as total_time_ms,
          mean_time / 1000 as avg_time_ms,
          max_time / 1000 as max_time_ms,
          (calls / EXTRACT(EPOCH FROM (NOW() - reset_time))) as queries_per_second
        FROM pg_stat_statements
        ORDER BY total_time DESC
        LIMIT 1
      `);

      const slowQueriesResult = await client.query(`
        SELECT COUNT(*) as slow_queries
        FROM pg_stat_statements
        WHERE mean_time > $1
      `, [this.config.thresholds.queries.maxExecutionTime]);

      if (result.length === 0) {
        return {
          totalQueries: 0,
          averageExecutionTime: 0,
          slowQueries: slowQueriesResult[0]?.slow_queries || 0,
          longestQuery: 0,
          queriesPerSecond: 0,
        };
      }

      const stats = result[0];
      return {
        totalQueries: stats.total_queries,
        averageExecutionTime: stats.avg_time_ms,
        slowQueries: slowQueriesResult[0]?.slow_queries || 0,
        longestQuery: stats.max_time_ms,
        queriesPerSecond: stats.queries_per_second || 0,
      };
    } catch (error) {
      console.warn('Failed to collect query metrics:', error);
      return {
        totalQueries: 0,
        averageExecutionTime: 0,
        slowQueries: 0,
        longestQuery: 0,
        queriesPerSecond: 0,
      };
    }
  }

  /**
   * Collect cache metrics
   */
  private async collectCacheMetrics(): Promise<PerformanceSnapshot['cache']> {
    try {
      const result = await client.query(`
        SELECT
          sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) as table_hit_ratio,
          sum(idx_blks_hit) / (sum(idx_blks_hit) + sum(idx_blks_read)) as index_hit_ratio,
          (sum(heap_blks_hit) + sum(idx_blks_hit)) /
          (sum(heap_blks_hit) + sum(heap_blks_read) + sum(idx_blks_hit) + sum(idx_blks_read)) as overall_hit_ratio
        FROM pg_statio_user_tables
      `);

      const stats = result[0];
      return {
        hitRatio: stats.overall_hit_ratio || 0,
        indexHitRatio: stats.index_hit_ratio || 0,
        tableHitRatio: stats.table_hit_ratio || 0,
      };
    } catch (error) {
      console.warn('Failed to collect cache metrics:', error);
      return { hitRatio: 0, indexHitRatio: 0, tableHitRatio: 0 };
    }
  }

  /**
   * Collect lock metrics
   */
  private async collectLockMetrics(): Promise<PerformanceSnapshot['locks']> {
    try {
      const result = await client.query(`
        SELECT
          COUNT(*) FILTER (WHERE NOT granted) as waiting_locks,
          COUNT(*) FILTER (WHERE granted) as granted_locks
        FROM pg_locks
        WHERE database = (SELECT oid FROM pg_database WHERE datname = current_database())
      `);

      const deadlockResult = await client.query(`
        SELECT deadlocks
        FROM pg_stat_database
        WHERE datname = current_database()
      `);

      const stats = result[0];
      return {
        waitingLocks: stats.waiting_locks || 0,
        grantedLocks: stats.granted_locks || 0,
        deadlocks: deadlockResult[0]?.deadlocks || 0,
        lockTimeouts: 0, // Would need additional monitoring for timeouts
      };
    } catch (error) {
      console.warn('Failed to collect lock metrics:', error);
      return { waitingLocks: 0, grantedLocks: 0, deadlocks: 0, lockTimeouts: 0 };
    }
  }

  /**
   * Collect I/O metrics
   */
  private async collectIOMetrics(): Promise<PerformanceSnapshot['io']> {
    try {
      const result = await client.query(`
        SELECT
          sum(seq_scan) as sequential_scans,
          sum(idx_scan) as index_scans,
          sum(seq_tup_read) as tuples_read,
          sum(idx_tup_fetch) as tuples_returned,
          sum(heap_blks_read) as disk_reads,
          sum(heap_blks_hit) as buffer_hits
        FROM pg_stat_user_tables
      `);

      const stats = result[0];
      return {
        sequentialScans: stats.sequential_scans || 0,
        indexScans: stats.index_scans || 0,
        tuplesRead: stats.tuples_read || 0,
        tuplesReturned: stats.tuples_returned || 0,
        diskReads: stats.disk_reads || 0,
        bufferHits: stats.buffer_hits || 0,
      };
    } catch (error) {
      console.warn('Failed to collect I/O metrics:', error);
      return {
        sequentialScans: 0,
        indexScans: 0,
        tuplesRead: 0,
        tuplesReturned: 0,
        diskReads: 0,
        bufferHits: 0,
      };
    }
  }

  /**
   * Collect transaction metrics
   */
  private async collectTransactionMetrics(): Promise<PerformanceSnapshot['transactions']> {
    try {
      const result = await client.query(`
        SELECT
          xact_commit as committed,
          xact_rollback as rolled_back
        FROM pg_stat_database
        WHERE datname = current_database()
      `);

      const activeResult = await client.query(`
        SELECT COUNT(*) as active
        FROM pg_stat_activity
        WHERE state = 'active' AND datname = current_database()
      `);

      const stats = result[0];
      return {
        committed: stats.committed || 0,
        rolledBack: stats.rolled_back || 0,
        active: activeResult[0]?.active || 0,
      };
    } catch (error) {
      console.warn('Failed to collect transaction metrics:', error);
      return { committed: 0, rolledBack: 0, active: 0 };
    }
  }

  /**
   * Collect vacuum metrics
   */
  private async collectVacuumMetrics(): Promise<PerformanceSnapshot['vacuum']> {
    try {
      const result = await client.query(`
        SELECT
          sum(n_tup_ins) + sum(n_tup_upd) + sum(n_tup_del) as total_activity,
          sum(n_live_tup) as live_tuples,
          sum(n_dead_tup) as dead_tuples,
          sum(vacuum_count) as auto_vacuum_runs,
          sum(autovacuum_count) as manual_vacuum_runs
        FROM pg_stat_user_tables
      `);

      const stats = result[0];
      return {
        autoVacuumRuns: stats.auto_vacuum_runs || 0,
        manualVacuumRuns: stats.manual_vacuum_runs || 0,
        deadTuples: stats.dead_tuples || 0,
        liveTuples: stats.live_tuples || 0,
      };
    } catch (error) {
      console.warn('Failed to collect vacuum metrics:', error);
      return {
        autoVacuumRuns: 0,
        manualVacuumRuns: 0,
        deadTuples: 0,
        liveTuples: 0,
      };
    }
  }

  /**
   * Collect memory metrics
   */
  private async collectMemoryMetrics(): Promise<PerformanceSnapshot['memory']> {
    try {
      // These are estimated values - actual memory monitoring would require
      // additional extensions or system-level monitoring
      const sharedBuffersSize = 128 * 1024 * 1024; // 128MB default
      const workMemSize = 4 * 1024 * 1024; // 4MB default

      return {
        sharedBuffersUsed: 0, // Would need additional monitoring
        workMemUsed: 0, // Would need additional monitoring
        maintenanceWorkMemUsed: 0, // Would need additional monitoring
      };
    } catch (error) {
      console.warn('Failed to collect memory metrics:', error);
      return { sharedBuffersUsed: 0, workMemUsed: 0, maintenanceWorkMemUsed: 0 };
    }
  }

  /**
   * Analyze performance data
   */
  private async analyzePerformance(): Promise<void> {
    if (!this.lastSnapshot) return;

    // Analyze query performance
    if (this.lastSnapshot.queries.averageExecutionTime > this.config.thresholds.queries.maxExecutionTime) {
      await this.createQueryPerformanceAlert(this.lastSnapshot.queries.averageExecutionTime);
    }

    // Analyze connection usage
    const connectionUtilization = this.lastSnapshot.connections.active / 10; // Assuming max 10 connections
    if (connectionUtilization > this.config.thresholds.connections.maxUtilization) {
      await this.createConnectionAlert(connectionUtilization);
    }

    // Analyze lock waits
    if (this.lastSnapshot.locks.waitingLocks > this.config.thresholds.locks.maxWaiting) {
      await this.createLockAlert(this.lastSnapshot.locks.waitingLocks);
    }

    // Analyze cache performance
    if (this.lastSnapshot.cache.hitRatio < this.config.thresholds.queries.minHitRatio) {
      await this.createCacheAlert(this.lastSnapshot.cache.hitRatio);
    }

    // Analyze I/O performance
    const diskReadRatio = this.lastSnapshot.io.diskReads / (this.lastSnapshot.io.diskReads + this.lastSnapshot.io.bufferHits || 1);
    if (diskReadRatio > this.config.thresholds.io.maxDiskReadRatio) {
      await this.createIOAlert(diskReadRatio);
    }
  }

  /**
   * Check thresholds and create alerts
   */
  private async checkThresholds(): Promise<void> {
    if (!this.lastSnapshot) return;

    // Connection threshold checks
    if (this.lastSnapshot.connections.waiting > this.config.thresholds.connections.maxWaiting) {
      await this.createAlert({
        type: 'warning',
        category: 'connections',
        title: 'High Connection Waiting',
        description: `${this.lastSnapshot.connections.waiting} connections are waiting`,
        value: this.lastSnapshot.connections.waiting,
        threshold: this.config.thresholds.connections.maxWaiting,
      });
    }

    // Query threshold checks
    if (this.lastSnapshot.queries.slowQueries > this.config.thresholds.queries.maxSlowQueries) {
      await this.createAlert({
        type: 'warning',
        category: 'queries',
        title: 'High Number of Slow Queries',
        description: `${this.lastSnapshot.queries.slowQueries} slow queries detected`,
        value: this.lastSnapshot.queries.slowQueries,
        threshold: this.config.thresholds.queries.maxSlowQueries,
      });
    }

    // Lock threshold checks
    if (this.lastSnapshot.locks.deadlocks > this.config.thresholds.locks.maxDeadlocks) {
      await this.createAlert({
        type: 'critical',
        category: 'locks',
        title: 'Database Deadlocks Detected',
        description: `${this.lastSnapshot.locks.deadlocks} deadlocks occurred`,
        value: this.lastSnapshot.locks.deadlocks,
        threshold: this.config.thresholds.locks.maxDeadlocks,
      });
    }
  }

  /**
   * Update performance trends
   */
  private async updateTrends(): Promise<void> {
    if (!this.lastSnapshot) return;

    try {
      const timestamp = this.lastSnapshot.timestamp.toISOString();

      // Store individual metrics for trend analysis
      await redisService.getClient().zadd(
        'trend:queries:avg_time',
        Date.now(),
        JSON.stringify({
          timestamp,
          value: this.lastSnapshot.queries.averageExecutionTime,
        })
      );

      await redisService.getClient().zadd(
        'trend:connections:active',
        Date.now(),
        JSON.stringify({
          timestamp,
          value: this.lastSnapshot.connections.active,
        })
      );

      await redisService.getClient().zadd(
        'trend:cache:hit_ratio',
        Date.now(),
        JSON.stringify({
          timestamp,
          value: this.lastSnapshot.cache.hitRatio,
        })
      );

      // Clean old trend data (older than retention period)
      const cutoff = Date.now() - (this.config.retention.trends * 24 * 60 * 60 * 1000);
      await redisService.getClient().zremrangebyscore('trend:*', 0, cutoff);

    } catch (error) {
      console.warn('Failed to update trends:', error);
    }
  }

  /**
   * Get table performance statistics
   */
  async getTablePerformanceStats(tableName?: string): Promise<TablePerformanceStats[]> {
    try {
      const whereClause = tableName ? `WHERE tablename = '${tableName}'` : '';

      const result = await client.query(`
        SELECT
          schemaname,
          tablename,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size_pretty,
          pg_total_relation_size(schemaname||'.'||tablename) as size_bytes,
          n_live_tup as rows,
          n_dead_tup as dead_rows,
          n_tup_ins as inserts,
          n_tup_upd as updates,
          n_tup_del as deletes,
          seq_scan,
          idx_scan,
          seq_tup_read,
          idx_tup_fetch,
          last_vacuum,
          last_analyze,
          last_autoanalyze
        FROM pg_stat_user_tables
        ${whereClause}
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
      `);

      return result.map(row => ({
        tableName: `${row.schemaname}.${row.tablename}`,
        size: Math.round(row.size_bytes / (1024 * 1024) * 100) / 100, // Convert to MB
        rows: row.rows,
        deadRows: row.dead_rows,
        bloat: row.rows > 0 ? row.dead_rows / (row.rows + row.dead_rows) : 0,
        lastVacuum: row.last_vacuum ? new Date(row.last_vacuum) : undefined,
        lastAnalyze: row.last_analyze ? new Date(row.last_analyze) : undefined,
        indexUsage: row.idx_scan / (row.seq_scan + row.idx_scan || 1),
        sequentialScans: row.seq_scan,
        indexScans: row.idx_scan,
        tuplesRead: row.seq_tup_read,
        tuplesReturned: row.idx_tup_fetch,
        insertRate: this.calculateRate(row.inserts),
        updateRate: this.calculateRate(row.updates),
        deleteRate: this.calculateRate(row.deletes),
      }));
    } catch (error) {
      console.error('Failed to get table performance stats:', error);
      return [];
    }
  }

  /**
   * Calculate rate per minute
   */
  private calculateRate(count: number): number {
    // This is a simplified calculation - in practice you'd need to
    // track changes over time using historical data
    return count / 60; // Assuming stats are per minute
  }

  /**
   * Get performance trend data
   */
  async getPerformanceTrend(
    metric: string,
    timeframe: '1h' | '6h' | '24h' | '7d' | '30d' = '24h'
  ): Promise<PerformanceTrend | null> {
    try {
      const now = Date.now();
      const timeframes = {
        '1h': 60 * 60 * 1000,
        '6h': 6 * 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000,
      };

      const cutoff = now - timeframes[timeframe];
      const result = await redisService.getClient().zrangebyscore(
        `trend:${metric}`,
        cutoff,
        now,
        'WITHSCORES'
      );

      const data = result.map(([value, score]) => ({
        timestamp: new Date(parseInt(score)),
        value: JSON.parse(value).value,
      }));

      if (data.length < 2) return null;

      // Calculate trend
      const firstValue = data[0].value;
      const lastValue = data[data.length - 1].value;
      const changeRate = ((lastValue - firstValue) / firstValue) * 100;

      let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
      if (changeRate > 5) trend = 'increasing';
      else if (changeRate < -5) trend = 'decreasing';

      // Simple linear prediction
      const prediction = lastValue + (lastValue - firstValue);

      return {
        metric,
        timeframe,
        data,
        trend,
        changeRate,
        prediction,
      };
    } catch (error) {
      console.error('Failed to get performance trend:', error);
      return null;
    }
  }

  /**
   * Create performance alert
   */
  private async createAlert(alertData: Omit<PerformanceAlert, 'id' | 'timestamp'>): Promise<void> {
    const alert: PerformanceAlert = {
      ...alertData,
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };

    // Check cooldown
    const cooldownKey = `${alert.category}_${alert.title}`;
    const lastAlert = this.alertCooldowns.get(cooldownKey);

    if (lastAlert && Date.now() - lastAlert.getTime() < this.config.alerts.cooldown) {
      return; // Still in cooldown period
    }

    this.alertCooldowns.set(cooldownKey, new Date());
    this.activeAlerts.set(alert.id, alert);

    // Store alert
    await redisService.getClient().zadd(
      'alerts',
      Date.now(),
      JSON.stringify(alert)
    );

    // Clean old alerts
    const cutoff = Date.now() - (this.config.retention.alerts * 24 * 60 * 60 * 1000);
    await redisService.getClient().zremrangebyscore('alerts', 0, cutoff);

    // Emit alert event
    this.emit('alert', alert);

    console.log(`Performance alert created: ${alert.title} (${alert.type})`);
  }

  /**
   * Create query performance alert
   */
  private async createQueryPerformanceAlert(executionTime: number): Promise<void> {
    await this.createAlert({
      type: executionTime > 10000 ? 'critical' : 'warning',
      category: 'queries',
      title: 'Slow Query Performance',
      description: `Average query execution time is ${executionTime.toFixed(2)}ms`,
      value: executionTime,
      threshold: this.config.thresholds.queries.maxExecutionTime,
    });
  }

  /**
   * Create connection alert
   */
  private async createConnectionAlert(utilization: number): Promise<void> {
    await this.createAlert({
      type: 'warning',
      category: 'connections',
      title: 'High Connection Utilization',
      description: `Connection pool utilization is ${(utilization * 100).toFixed(1)}%`,
      value: utilization,
      threshold: this.config.thresholds.connections.maxUtilization,
    });
  }

  /**
   * Create lock alert
   */
  private async createLockAlert(waitingLocks: number): Promise<void> {
    await this.createAlert({
      type: waitingLocks > 10 ? 'critical' : 'warning',
      category: 'locks',
      title: 'Database Lock Contention',
      description: `${waitingLocks} queries are waiting for locks`,
      value: waitingLocks,
      threshold: this.config.thresholds.locks.maxWaiting,
    });
  }

  /**
   * Create cache alert
   */
  private async createCacheAlert(hitRatio: number): Promise<void> {
    await this.createAlert({
      type: 'warning',
      category: 'queries',
      title: 'Low Cache Hit Ratio',
      description: `Cache hit ratio is ${(hitRatio * 100).toFixed(1)}%`,
      value: hitRatio,
      threshold: this.config.thresholds.queries.minHitRatio,
    });
  }

  /**
   * Create I/O alert
   */
  private async createIOAlert(diskReadRatio: number): Promise<void> {
    await this.createAlert({
      type: 'warning',
      category: 'io',
      title: 'High Disk I/O',
      description: `Disk read ratio is ${(diskReadRatio * 100).toFixed(1)}%`,
      value: diskReadRatio,
      threshold: this.config.thresholds.io.maxDiskReadRatio,
    });
  }

  /**
   * Store performance snapshot
   */
  private async storeSnapshot(snapshot: PerformanceSnapshot): Promise<void> {
    try {
      const key = `snapshot:${snapshot.timestamp.getTime()}`;
      await redisService.getClient().setex(
        key,
        this.config.retention.snapshots * (this.config.interval / 1000),
        JSON.stringify(snapshot)
      );

      // Add to sorted set for time-based queries
      await redisService.getClient().zadd(
        'snapshots',
        snapshot.timestamp.getTime(),
        key
      );

      // Clean old snapshots
      const cutoff = Date.now() - (this.config.retention.snapshots * this.config.interval);
      await redisService.getClient().zremrangebyscore('snapshots', 0, cutoff);

    } catch (error) {
      console.warn('Failed to store snapshot:', error);
    }
  }

  /**
   * Load historical data
   */
  private async loadHistoricalData(): Promise<void> {
    try {
      // Load active alerts
      const alerts = await redisService.getClient().zrange('alerts', 0, -1);
      for (const alertData of alerts) {
        const alert = JSON.parse(alertData);
        this.activeAlerts.set(alert.id, alert);
      }

      console.log(`Loaded ${this.activeAlerts.size} active alerts`);
    } catch (error) {
      console.warn('Failed to load historical data:', error);
    }
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): PerformanceAlert[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string): Promise<void> {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) return;

    alert.resolved = true;
    alert.resolvedAt = new Date();

    // Update in Redis
    await redisService.getClient().zadd(
      'alerts',
      alert.timestamp.getTime(),
      JSON.stringify(alert)
    );

    this.activeAlerts.delete(alertId);

    // Emit alert resolved event
    this.emit('alertResolved', alert);

    console.log(`Alert resolved: ${alert.title}`);
  }

  /**
   * Get latest performance snapshot
   */
  getLatestSnapshot(): PerformanceSnapshot | undefined {
    return this.lastSnapshot;
  }

  /**
   * Generate performance report
   */
  async generatePerformanceReport(): Promise<string> {
    const snapshot = this.lastSnapshot || await this.collectMetrics();
    const tableStats = await this.getTablePerformanceStats();
    const activeAlerts = this.getActiveAlerts();
    const queryTrend = await this.getPerformanceTrend('queries:avg_time');

    const criticalAlerts = activeAlerts.filter(a => a.type === 'critical');
    const warningAlerts = activeAlerts.filter(a => a.type === 'warning');

    const report = `
Database Performance Report
Generated: ${new Date().toISOString()}

=== OVERVIEW ===
Active Connections: ${snapshot.connections.active}/${snapshot.connections.total}
Connection Utilization: ${((snapshot.connections.active / 10) * 100).toFixed(1)}%
Average Query Time: ${snapshot.queries.averageExecutionTime.toFixed(2)}ms
Query Hit Ratio: ${(snapshot.cache.hitRatio * 100).toFixed(2)}%
Cache Hit Ratio: ${(snapshot.cache.indexHitRatio * 100).toFixed(2)}%

=== PERFORMANCE METRICS ===
Queries: ${snapshot.queries.totalQueries} total, ${snapshot.queries.slowQueries} slow
Query Rate: ${snapshot.queries.queriesPerSecond.toFixed(2)}/sec
Longest Query: ${snapshot.queries.longestQuery.toFixed(2)}ms

=== I/O PERFORMANCE ===
Sequential Scans: ${snapshot.io.sequentialScans}
Index Scans: ${snapshot.io.indexScans}
Buffer Hit Ratio: ${((snapshot.io.bufferHits / (snapshot.io.bufferHits + snapshot.io.diskReads || 1)) * 100).toFixed(2)}%

=== LOCKS ===
Waiting Locks: ${snapshot.locks.waitingLocks}
Deadlocks: ${snapshot.locks.deadlocks}
Granted Locks: ${snapshot.locks.grantedLocks}

=== TRANSACTIONS ===
Committed: ${snapshot.transactions.committed}
Rolled Back: ${snapshot.transactions.rolledBack}
Active: ${snapshot.transactions.active}

=== TABLES (Top 5 by Size) ===
${tableStats.slice(0, 5).map(table => `
• ${table.tableName}
  Size: ${table.size.toFixed(2)} MB
  Rows: ${table.rows.toLocaleString()}
  Dead Rows: ${table.deadRows.toLocaleString()} (${(table.bloat * 100).toFixed(1)}%)
  Index Usage: ${(table.indexUsage * 100).toFixed(1)}%
`).join('')}

=== ALERTS ===
Critical: ${criticalAlerts.length}
Warnings: ${warningAlerts.length}
${activeAlerts.map(alert => `
• ${alert.title} (${alert.type.toUpperCase()})
  ${alert.description}
  Value: ${alert.value} (Threshold: ${alert.threshold})
  Created: ${alert.timestamp.toISOString()}
`).join('')}

=== TRENDS ===
Query Performance: ${queryTrend ?
  `${queryTrend.trend} (${queryTrend.changeRate.toFixed(1)}%)` :
  'No data available'}

=== RECOMMENDATIONS ===
${this.generateRecommendations(snapshot, tableStats, activeAlerts)}
`;

    return report;
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(
    snapshot: PerformanceSnapshot,
    tableStats: TablePerformanceStats[],
    alerts: PerformanceAlert[]
  ): string {
    const recommendations: string[] = [];

    // Connection recommendations
    const connectionUtilization = snapshot.connections.active / 10;
    if (connectionUtilization > 0.8) {
      recommendations.push('• Consider increasing connection pool size or optimizing query performance');
    }

    // Query recommendations
    if (snapshot.queries.averageExecutionTime > 1000) {
      recommendations.push('• High average query time detected. Review slow queries and consider optimization');
    }

    if (snapshot.cache.hitRatio < 0.9) {
      recommendations.push('• Low cache hit ratio. Consider increasing shared_buffers or optimizing indexes');
    }

    // Lock recommendations
    if (snapshot.locks.waitingLocks > 0) {
      recommendations.push('• Lock contention detected. Review transaction isolation levels and query patterns');
    }

    // Table recommendations
    const bloatedTables = tableStats.filter(t => t.bloat > 0.2);
    if (bloatedTables.length > 0) {
      recommendations.push(`• ${bloatedTables.length} tables have high bloat (>20%). Consider running VACUUM`);
    }

    const tablesNeedingAnalyze = tableStats.filter(t => !t.lastAnalyze ||
      (t.lastAnalyze && Date.now() - t.lastAnalyze.getTime() > 7 * 24 * 60 * 60 * 1000));
    if (tablesNeedingAnalyze.length > 0) {
      recommendations.push(`• ${tablesNeedingAnalyze.length} tables need ANALYZE. Run to update statistics`);
    }

    // Alert-based recommendations
    if (alerts.some(a => a.category === 'io')) {
      recommendations.push('• I/O performance issues detected. Consider adding indexes or optimizing queries');
    }

    return recommendations.length > 0 ? recommendations.join('\n') : '• Database performance is optimal';
  }

  /**
   * Gracefully shutdown the performance monitor
   */
  async shutdown(): Promise<void> {
    this.stopMonitoring();

    // Clear intervals
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    console.log('Database Performance Monitor shutdown completed');
  }
}

// Export singleton instance
export const databasePerformanceMonitor = new DatabasePerformanceMonitor();