/**
 * Database Query Optimization Service
 *
 * Provides comprehensive query performance analysis, optimization, and monitoring
 * for the WorkshopsAI CMS PostgreSQL database.
 *
 * Features:
 * - Query plan analysis and optimization
 * - Slow query detection and logging
 * - Index usage monitoring and recommendations
 * - Connection pool optimization
 * - Query fingerprinting for performance tracking
 */

import { db, client } from '../config/postgresql-database';
import { redisService } from '../config/redis';
import { createHash } from 'crypto';

/**
 * Query analysis result interface
 */
export interface QueryAnalysisResult {
  query: string;
  fingerprint: string;
  executionTime: number;
  planCost: number;
  actualRows: number;
  plannedRows: number;
  buffersHit: number;
  buffersRead: number;
  indexesUsed: string[];
  recommendations: QueryOptimizationRecommendation[];
  status: 'optimal' | 'suboptimal' | 'poor';
  timestamp: Date;
}

/**
 * Query optimization recommendation
 */
export interface QueryOptimizationRecommendation {
  type: 'index' | 'query_rewrite' | 'partitioning' | 'configuration';
  priority: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  impact: string;
  implementation: string;
  estimatedImprovement: number; // percentage
}

/**
 * Database performance metrics
 */
export interface DatabasePerformanceMetrics {
  connectionPool: {
    active: number;
    idle: number;
    total: number;
    waiting: number;
  };
  slowQueries: {
    count: number;
    averageExecutionTime: number;
    worstExecutionTime: number;
  };
  indexUsage: {
    totalIndexes: number;
    unusedIndexes: string[];
    frequentlyUsedIndexes: Array<{ name: string; usageCount: number }>;
  };
  cacheHitRatio: number;
  lockWaits: number;
  deadlocks: number;
}

/**
 * Query fingerprint configuration
 */
interface QueryFingerprintConfig {
  normalizeLiterals: boolean;
  removeComments: boolean;
  compressWhitespace: boolean;
  standardizeCase: boolean;
}

/**
 * Slow query configuration
 */
interface SlowQueryConfig {
  thresholdMs: number;
  logFrequency: 'always' | 'sampled' | 'threshold';
  sampleRate: number;
  maxLogEntries: number;
}

/**
 * Database optimization configuration
 */
interface DatabaseOptimizationConfig {
  queryFingerprinting: QueryFingerprintConfig;
  slowQueries: SlowQueryConfig;
  monitoring: {
    enabled: boolean;
    intervalMs: number;
    retentionDays: number;
  };
  indexing: {
    autoRecommend: boolean;
    usageThreshold: number;
    analysisIntervalMs: number;
  };
  connectionPool: {
    minConnections: number;
    maxConnections: number;
    idleTimeoutMs: number;
    connectionTimeoutMs: number;
  };
}

/**
 * Database Query Optimization Service
 */
export class DatabaseQueryOptimizationService {
  private config: DatabaseOptimizationConfig;
  private queryStats: Map<string, QueryStats> = new Map();
  private slowQueryLog: Array<SlowQueryEntry> = [];
  private indexUsageStats: Map<string, IndexUsageStats> = new Map();
  private isMonitoring: boolean = false;
  private monitoringInterval?: NodeJS.Timeout;

  constructor(config?: Partial<DatabaseOptimizationConfig>) {
    this.config = {
      queryFingerprinting: {
        normalizeLiterals: true,
        removeComments: true,
        compressWhitespace: true,
        standardizeCase: true,
      },
      slowQueries: {
        thresholdMs: 1000,
        logFrequency: 'threshold',
        sampleRate: 0.1,
        maxLogEntries: 1000,
      },
      monitoring: {
        enabled: true,
        intervalMs: 30000, // 30 seconds
        retentionDays: 7,
      },
      indexing: {
        autoRecommend: true,
        usageThreshold: 10,
        analysisIntervalMs: 300000, // 5 minutes
      },
      connectionPool: {
        minConnections: 2,
        maxConnections: 10,
        idleTimeoutMs: 20000,
        connectionTimeoutMs: 10000,
      },
      ...config,
    };

    this.initializeService();
  }

  /**
   * Initialize the optimization service
   */
  private async initializeService(): Promise<void> {
    try {
      // Enable pg_stat_statements extension if not already enabled
      await this.enableQueryStatistics();

      // Load existing query statistics from Redis
      await this.loadCachedStatistics();

      // Start monitoring if enabled
      if (this.config.monitoring.enabled) {
        this.startMonitoring();
      }

      console.log('Database Query Optimization Service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Database Query Optimization Service:', error);
    }
  }

  /**
   * Enable PostgreSQL query statistics extension
   */
  private async enableQueryStatistics(): Promise<void> {
    try {
      await client`CREATE EXTENSION IF NOT EXISTS pg_stat_statements`;
      await client`CREATE EXTENSION IF NOT EXISTS pg_buffercache`;
    } catch (error) {
      console.warn('Failed to enable PostgreSQL extensions:', error);
    }
  }

  /**
   * Analyze query performance using EXPLAIN ANALYZE
   */
  async analyzeQuery(
    query: string,
    params?: any[]
  ): Promise<QueryAnalysisResult> {
    const startTime = Date.now();
    const fingerprint = this.generateQueryFingerprint(query);

    try {
      // Get query execution plan
      const explainQuery = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`;
      const planResult = await client.query(explainQuery, params || []);

      const plan = planResult[0];
      const executionPlan = plan['QUERY PLAN'][0];

      const executionTime = Date.now() - startTime;

      // Extract metrics from execution plan
      const analysis: QueryAnalysisResult = {
        query,
        fingerprint,
        executionTime,
        planCost: executionPlan['Total Cost'] || 0,
        actualRows: executionPlan['Actual Rows'] || 0,
        plannedRows: executionPlan['Plan Rows'] || 0,
        buffersHit: executionPlan['Shared Hit Blocks'] || 0,
        buffersRead: executionPlan['Shared Read Blocks'] || 0,
        indexesUsed: this.extractIndexesUsed(executionPlan),
        recommendations: await this.generateRecommendations(query, executionPlan),
        status: this.determineQueryStatus(executionTime, executionPlan),
        timestamp: new Date(),
      };

      // Update query statistics
      this.updateQueryStats(fingerprint, analysis);

      // Log slow query if applicable
      if (this.isSlowQuery(executionTime)) {
        await this.logSlowQuery(analysis);
      }

      // Cache analysis result
      await this.cacheQueryAnalysis(fingerprint, analysis);

      return analysis;
    } catch (error) {
      console.error('Query analysis failed:', error);
      throw new Error(`Query analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generate query fingerprint for normalization
   */
  private generateQueryFingerprint(query: string): string {
    let normalized = query;

    if (this.config.queryFingerprinting.removeComments) {
      normalized = normalized.replace(/--.*$/gm, '');
      normalized = normalized.replace(/\/\*[\s\S]*?\*\//g, '');
    }

    if (this.config.queryFingerprinting.compressWhitespace) {
      normalized = normalized.replace(/\s+/g, ' ').trim();
    }

    if (this.config.queryFingerprinting.standardizeCase) {
      normalized = normalized.toLowerCase();
    }

    if (this.config.queryFingerprinting.normalizeLiterals) {
      // Replace string literals with placeholders
      normalized = normalized.replace(/'([^']*)'/g, '?');
      normalized = normalized.replace(/"([^"]*)"/g, '?');
      // Replace numeric literals with placeholders
      normalized = normalized.replace(/\b\d+\b/g, '?');
    }

    return createHash('md5').update(normalized).digest('hex');
  }

  /**
   * Extract indexes used from execution plan
   */
  private extractIndexesUsed(plan: any): string[] {
    const indexes: string[] = [];

    const extractFromPlan = (node: any) => {
      if (node['Node Type'] === 'Index Scan' || node['Node Type'] === 'Index Only Scan') {
        const indexName = node['Index Name'];
        if (indexName) {
          indexes.push(indexName);
        }
      }

      if (node['Plans']) {
        node['Plans'].forEach(extractFromPlan);
      }
    };

    extractFromPlan(plan);
    return indexes;
  }

  /**
   * Generate optimization recommendations
   */
  private async generateRecommendations(
    query: string,
    executionPlan: any
  ): Promise<QueryOptimizationRecommendation[]> {
    const recommendations: QueryOptimizationRecommendation[] = [];

    // Check for sequential scans on large tables
    if (executionPlan['Node Type'] === 'Seq Scan' && executionPlan['Actual Rows'] > 1000) {
      recommendations.push({
        type: 'index',
        priority: 'high',
        description: 'Sequential scan detected on large table',
        impact: 'Adding an index could significantly improve query performance',
        implementation: await this.generateIndexRecommendation(query),
        estimatedImprovement: 80,
      });
    }

    // Check for poor buffer cache hit ratio
    const hitRatio = executionPlan['Shared Hit Blocks'] /
                   (executionPlan['Shared Hit Blocks'] + executionPlan['Shared Read Blocks'] || 1);

    if (hitRatio < 0.8) {
      recommendations.push({
        type: 'configuration',
        priority: 'medium',
        description: 'Low buffer cache hit ratio detected',
        impact: 'Increasing shared_buffers may improve performance',
        implementation: 'Consider increasing shared_buffers to 25% of RAM',
        estimatedImprovement: 30,
      });
    }

    // Check for estimated vs actual row count mismatch
    const rowsRatio = executionPlan['Actual Rows'] / (executionPlan['Plan Rows'] || 1);
    if (rowsRatio > 10 || rowsRatio < 0.1) {
      recommendations.push({
        type: 'configuration',
        priority: 'medium',
        description: 'Significant planner estimate error detected',
        impact: 'Running ANALYZE may improve query planning',
        implementation: 'Run ANALYZE on affected tables to update statistics',
        estimatedImprovement: 20,
      });
    }

    // Check for nested loops with large result sets
    if (executionPlan['Node Type'] === 'Nested Loop' && executionPlan['Actual Rows'] > 10000) {
      recommendations.push({
        type: 'query_rewrite',
        priority: 'high',
        description: 'Nested loop with large result set detected',
        impact: 'Query rewrite may improve performance',
        implementation: 'Consider using JOIN with proper conditions or EXISTS clause',
        estimatedImprovement: 60,
      });
    }

    return recommendations;
  }

  /**
   * Generate index recommendation for query
   */
  private async generateIndexRecommendation(query: string): Promise<string> {
    // Simple heuristic to extract potential index columns
    const whereMatch = query.match(/where\s+(.+?)(?:\s+order\s+by|\s+group\s+by|\s+limit|$)/is);
    if (!whereMatch) return 'Analyze WHERE clause for index opportunities';

    const whereClause = whereMatch[1];
    const columns = this.extractColumnsFromWhereClause(whereClause);

    if (columns.length === 0) return 'Analyze WHERE clause for index opportunities';

    return `CREATE INDEX CONCURRENTLY idx_${Date.now()} ON table_name (${columns.join(', ')});`;
  }

  /**
   * Extract columns from WHERE clause for index recommendation
   */
  private extractColumnsFromWhereClause(whereClause: string): string[] {
    const columns: string[] = [];

    // Simple regex to extract column references (basic implementation)
    const columnMatches = whereClause.match(/\b(\w+)\s*(?:=|!=|>|<|>=|<=|like|in)/gi);

    if (columnMatches) {
      columnMatches.forEach(match => {
        const column = match.replace(/\s*(?:=|!=|>|<|>=|<=|like|in).*$/i, '').trim();
        if (!columns.includes(column) && column.toLowerCase() !== 'and' && column.toLowerCase() !== 'or') {
          columns.push(column);
        }
      });
    }

    return columns;
  }

  /**
   * Determine query performance status
   */
  private determineQueryStatus(executionTime: number, executionPlan: any): 'optimal' | 'suboptimal' | 'poor' {
    if (executionTime < 100) return 'optimal';
    if (executionTime < 1000) return 'suboptimal';
    return 'poor';
  }

  /**
   * Check if query is considered slow
   */
  private isSlowQuery(executionTime: number): boolean {
    return executionTime > this.config.slowQueries.thresholdMs;
  }

  /**
   * Log slow query entry
   */
  private async logSlowQuery(analysis: QueryAnalysisResult): Promise<void> {
    const entry: SlowQueryEntry = {
      fingerprint: analysis.fingerprint,
      query: analysis.query,
      executionTime: analysis.executionTime,
      timestamp: analysis.timestamp,
      recommendations: analysis.recommendations,
    };

    // Add to in-memory log
    this.slowQueryLog.push(entry);

    // Maintain log size limit
    if (this.slowQueryLog.length > this.config.slowQueries.maxLogEntries) {
      this.slowQueryLog = this.slowQueryLog.slice(-this.config.slowQueries.maxLogEntries);
    }

    // Persist to Redis
    await redisService.getClient().zadd(
      'slow_queries',
      Date.now(),
      JSON.stringify(entry)
    );

    // Clean old entries
    const cutoff = Date.now() - (this.config.monitoring.retentionDays * 24 * 60 * 60 * 1000);
    await redisService.getClient().zremrangebyscore('slow_queries', 0, cutoff);
  }

  /**
   * Update query statistics
   */
  private updateQueryStats(fingerprint: string, analysis: QueryAnalysisResult): void {
    const existing = this.queryStats.get(fingerprint) || {
      fingerprint,
      executionCount: 0,
      totalExecutionTime: 0,
      averageExecutionTime: 0,
      minExecutionTime: Infinity,
      maxExecutionTime: 0,
      lastExecuted: new Date(),
      recommendations: [],
    };

    existing.executionCount++;
    existing.totalExecutionTime += analysis.executionTime;
    existing.averageExecutionTime = existing.totalExecutionTime / existing.executionCount;
    existing.minExecutionTime = Math.min(existing.minExecutionTime, analysis.executionTime);
    existing.maxExecutionTime = Math.max(existing.maxExecutionTime, analysis.executionTime);
    existing.lastExecuted = analysis.timestamp;
    existing.recommendations = analysis.recommendations;

    this.queryStats.set(fingerprint, existing);
  }

  /**
   * Cache query analysis result
   */
  private async cacheQueryAnalysis(fingerprint: string, analysis: QueryAnalysisResult): Promise<void> {
    const key = `query_analysis:${fingerprint}`;
    await redisService.getClient().setex(
      key,
      3600, // 1 hour
      JSON.stringify(analysis)
    );
  }

  /**
   * Load cached statistics from Redis
   */
  private async loadCachedStatistics(): Promise<void> {
    try {
      // Load query statistics
      const queryStatsData = await redisService.getClient().get('query_statistics');
      if (queryStatsData) {
        const stats = JSON.parse(queryStatsData);
        stats.forEach((stat: QueryStats) => {
          this.queryStats.set(stat.fingerprint, stat);
        });
      }

      // Load slow query log
      const slowQueries = await redisService.getClient().zrange('slow_queries', 0, -1);
      slowQueries.forEach(entry => {
        this.slowQueryLog.push(JSON.parse(entry));
      });

    } catch (error) {
      console.warn('Failed to load cached statistics:', error);
    }
  }

  /**
   * Get current database performance metrics
   */
  async getPerformanceMetrics(): Promise<DatabasePerformanceMetrics> {
    try {
      // Get connection pool metrics
      const poolMetrics = await this.getConnectionPoolMetrics();

      // Get slow query metrics
      const slowQueryMetrics = this.getSlowQueryMetrics();

      // Get index usage metrics
      const indexMetrics = await this.getIndexUsageMetrics();

      // Get cache hit ratio
      const cacheHitRatio = await this.getCacheHitRatio();

      // Get lock metrics
      const lockMetrics = await this.getLockMetrics();

      return {
        connectionPool: poolMetrics,
        slowQueries: slowQueryMetrics,
        indexUsage: indexMetrics,
        cacheHitRatio,
        lockWaits: lockMetrics.lockWaits,
        deadlocks: lockMetrics.deadlocks,
      };
    } catch (error) {
      console.error('Failed to get performance metrics:', error);
      throw error;
    }
  }

  /**
   * Get connection pool metrics
   */
  private async getConnectionPoolMetrics(): Promise<DatabasePerformanceMetrics['connectionPool']> {
    try {
      const result = await client`
        SELECT
          count(*) as total_connections,
          count(*) FILTER (WHERE state = 'active') as active_connections,
          count(*) FILTER (WHERE state = 'idle') as idle_connections,
          count(*) FILTER (WHERE wait_event IS NOT NULL) as waiting_connections
        FROM pg_stat_activity
        WHERE datname = current_database()
      `;

      const stats = result[0];

      return {
        active: stats.active_connections,
        idle: stats.idle_connections,
        total: stats.total_connections,
        waiting: stats.waiting_connections,
      };
    } catch (error) {
      console.warn('Failed to get connection pool metrics:', error);
      return {
        active: 0,
        idle: 0,
        total: 0,
        waiting: 0,
      };
    }
  }

  /**
   * Get slow query metrics
   */
  private getSlowQueryMetrics(): DatabasePerformanceMetrics['slowQueries'] {
    if (this.slowQueryLog.length === 0) {
      return {
        count: 0,
        averageExecutionTime: 0,
        worstExecutionTime: 0,
      };
    }

    const executionTimes = this.slowQueryLog.map(entry => entry.executionTime);
    const total = executionTimes.reduce((sum, time) => sum + time, 0);

    return {
      count: this.slowQueryLog.length,
      averageExecutionTime: total / executionTimes.length,
      worstExecutionTime: Math.max(...executionTimes),
    };
  }

  /**
   * Get index usage metrics
   */
  private async getIndexUsageMetrics(): Promise<DatabasePerformanceMetrics['indexUsage']> {
    try {
      const result = await client`
        SELECT
          schemaname,
          tablename,
          indexname,
          idx_scan,
          idx_tup_read,
          idx_tup_fetch
        FROM pg_stat_user_indexes
        ORDER BY idx_scan DESC
      `;

      const unusedIndexes: string[] = [];
      const frequentlyUsedIndexes: Array<{ name: string; usageCount: number }> = [];

      result.forEach(row => {
        if (row.idx_scan === 0) {
          unusedIndexes.push(`${row.schemaname}.${row.tablename}.${row.indexname}`);
        } else if (row.idx_scan > this.config.indexing.usageThreshold) {
          frequentlyUsedIndexes.push({
            name: `${row.schemaname}.${row.tablename}.${row.indexname}`,
            usageCount: row.idx_scan,
          });
        }
      });

      return {
        totalIndexes: result.length,
        unusedIndexes,
        frequentlyUsedIndexes,
      };
    } catch (error) {
      console.warn('Failed to get index usage metrics:', error);
      return {
        totalIndexes: 0,
        unusedIndexes: [],
        frequentlyUsedIndexes: [],
      };
    }
  }

  /**
   * Get cache hit ratio
   */
  private async getCacheHitRatio(): Promise<number> {
    try {
      const result = await client`
        SELECT
          sum(heap_blks_hit) as heap_hits,
          sum(heap_blks_read) as heap_reads,
          sum(idx_blks_hit) as idx_hits,
          sum(idx_blks_read) as idx_reads
        FROM pg_statio_user_tables
      `;

      const stats = result[0];
      const totalHits = stats.heap_hits + stats.idx_hits;
      const totalReads = stats.heap_reads + stats.idx_reads;

      if (totalHits + totalReads === 0) return 0;

      return totalHits / (totalHits + totalReads);
    } catch (error) {
      console.warn('Failed to get cache hit ratio:', error);
      return 0;
    }
  }

  /**
   * Get lock metrics
   */
  private async getLockMetrics(): Promise<{ lockWaits: number; deadlocks: number }> {
    try {
      const lockResult = await client`
        SELECT count(*) as lock_waits
        FROM pg_locks l
        JOIN pg_stat_activity a ON l.pid = a.pid
        WHERE l.granted = false
        AND a.datname = current_database()
      `;

      const deadlockResult = await client`
        SELECT count(*) as deadlocks
        FROM pg_stat_database
        WHERE datname = current_database()
      `;

      return {
        lockWaits: lockResult[0]?.lock_waits || 0,
        deadlocks: deadlockResult[0]?.deadlocks || 0,
      };
    } catch (error) {
      console.warn('Failed to get lock metrics:', error);
      return { lockWaits: 0, deadlocks: 0 };
    }
  }

  /**
   * Optimize database configuration based on current metrics
   */
  async optimizeDatabaseConfiguration(): Promise<string[]> {
    const recommendations: string[] = [];

    try {
      const metrics = await this.getPerformanceMetrics();

      // Connection pool optimization
      if (metrics.connectionPool.waiting > 0) {
        recommendations.push(
          `Increase connection pool size. Currently ${metrics.connectionPool.waiting} connections waiting.`
        );
      }

      // Cache optimization
      if (metrics.cacheHitRatio < 0.9) {
        recommendations.push(
          `Cache hit ratio is ${(metrics.cacheHitRatio * 100).toFixed(1)}%. Consider increasing shared_buffers.`
        );
      }

      // Index optimization
      if (metrics.indexUsage.unusedIndexes.length > 0) {
        recommendations.push(
          `Found ${metrics.indexUsage.unusedIndexes.length} unused indexes. Consider dropping them.`
        );
      }

      // Lock optimization
      if (metrics.lockWaits > 0) {
        recommendations.push(
          `${metrics.lockWaits} lock waits detected. Consider optimizing queries or increasing lock_timeout.`
        );
      }

      // Slow query optimization
      if (metrics.slowQueries.count > 10) {
        recommendations.push(
          `${metrics.slowQueries.count} slow queries detected. Average execution time: ${metrics.slowQueries.averageExecutionTime.toFixed(2)}ms`
        );
      }

      return recommendations;
    } catch (error) {
      console.error('Failed to generate configuration recommendations:', error);
      return ['Failed to analyze database performance'];
    }
  }

  /**
   * Get top slow queries
   */
  async getTopSlowQueries(limit: number = 10): Promise<SlowQueryEntry[]> {
    return this.slowQueryLog
      .sort((a, b) => b.executionTime - a.executionTime)
      .slice(0, limit);
  }

  /**
   * Get query statistics for fingerprint
   */
  async getQueryStats(fingerprint: string): Promise<QueryStats | null> {
    return this.queryStats.get(fingerprint) || null;
  }

  /**
   * Get all query statistics
   */
  getAllQueryStats(): Map<string, QueryStats> {
    return new Map(this.queryStats);
  }

  /**
   * Start performance monitoring
   */
  startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.collectMonitoringMetrics();
        await this.updateIndexUsageStats();
        await this.persistStatistics();
      } catch (error) {
        console.error('Monitoring error:', error);
      }
    }, this.config.monitoring.intervalMs);

    console.log('Database performance monitoring started');
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
  }

  /**
   * Collect monitoring metrics
   */
  private async collectMonitoringMetrics(): Promise<void> {
    const metrics = await this.getPerformanceMetrics();

    // Store metrics for trend analysis
    const key = `metrics:${Date.now()}`;
    await redisService.getClient().setex(
      key,
      this.config.monitoring.retentionDays * 24 * 60 * 60,
      JSON.stringify(metrics)
    );
  }

  /**
   * Update index usage statistics
   */
  private async updateIndexUsageStats(): Promise<void> {
    try {
      const result = await client`
        SELECT
          schemaname,
          tablename,
          indexname,
          idx_scan,
          idx_tup_read,
          idx_tup_fetch
        FROM pg_stat_user_indexes
      `;

      result.forEach(row => {
        const key = `${row.schemaname}.${row.tablename}.${row.indexname}`;
        const existing = this.indexUsageStats.get(key) || {
          name: key,
          usageCount: 0,
          lastUpdated: new Date(),
        };

        existing.usageCount = row.idx_scan;
        existing.lastUpdated = new Date();

        this.indexUsageStats.set(key, existing);
      });
    } catch (error) {
      console.warn('Failed to update index usage stats:', error);
    }
  }

  /**
   * Persist statistics to Redis
   */
  private async persistStatistics(): Promise<void> {
    try {
      // Persist query statistics
      const queryStatsArray = Array.from(this.queryStats.values());
      await redisService.getClient().setex(
        'query_statistics',
        this.config.monitoring.retentionDays * 24 * 60 * 60,
        JSON.stringify(queryStatsArray)
      );
    } catch (error) {
      console.warn('Failed to persist statistics:', error);
    }
  }

  /**
   * Clear all statistics and logs
   */
  async clearStatistics(): Promise<void> {
    this.queryStats.clear();
    this.slowQueryLog = [];
    this.indexUsageStats.clear();

    await redisService.getClient().del('query_statistics');
    await redisService.getClient().del('slow_queries');

    console.log('Database optimization statistics cleared');
  }

  /**
   * Generate performance report
   */
  async generatePerformanceReport(): Promise<string> {
    const metrics = await this.getPerformanceMetrics();
    const topSlowQueries = await this.getTopSlowQueries(5);
    const recommendations = await this.optimizeDatabaseConfiguration();

    const report = `
Database Performance Report
Generated: ${new Date().toISOString()}

=== CONNECTION POOL ===
Active Connections: ${metrics.connectionPool.active}
Idle Connections: ${metrics.connectionPool.idle}
Total Connections: ${metrics.connectionPool.total}
Waiting Connections: ${metrics.connectionPool.waiting}

=== PERFORMANCE METRICS ===
Cache Hit Ratio: ${(metrics.cacheHitRatio * 100).toFixed(2)}%
Lock Waits: ${metrics.lockWaits}
Deadlocks: ${metrics.deadlocks}

=== SLOW QUERIES ===
Count: ${metrics.slowQueries.count}
Average Execution Time: ${metrics.slowQueries.averageExecutionTime.toFixed(2)}ms
Worst Execution Time: ${metrics.slowQueries.worstExecutionTime.toFixed(2)}ms

Top 5 Slow Queries:
${topSlowQueries.map((query, i) => `
${i + 1}. Execution Time: ${query.executionTime}ms
   Query: ${query.query.substring(0, 100)}...
`).join('')}

=== INDEX USAGE ===
Total Indexes: ${metrics.indexUsage.totalIndexes}
Unused Indexes: ${metrics.indexUsage.unusedIndexes.length}
Frequently Used Indexes: ${metrics.indexUsage.frequentlyUsedIndexes.length}

=== OPTIMIZATION RECOMMENDATIONS ===
${recommendations.map(rec => `• ${rec}`).join('\n')}
`;

    return report;
  }
}

// Supporting interfaces
interface QueryStats {
  fingerprint: string;
  executionCount: number;
  totalExecutionTime: number;
  averageExecutionTime: number;
  minExecutionTime: number;
  maxExecutionTime: number;
  lastExecuted: Date;
  recommendations: QueryOptimizationRecommendation[];
}

interface SlowQueryEntry {
  fingerprint: string;
  query: string;
  executionTime: number;
  timestamp: Date;
  recommendations: QueryOptimizationRecommendation[];
}

interface IndexUsageStats {
  name: string;
  usageCount: number;
  lastUpdated: Date;
}

// Export singleton instance
export const databaseQueryOptimizationService = new DatabaseQueryOptimizationService();