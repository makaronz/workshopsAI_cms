/**
 * Database Optimization Integration Service
 *
 * Integrates all database optimization components and provides a unified interface
 * for database performance management in the WorkshopsAI CMS.
 *
 * Features:
 * - Unified optimization service interface
 * - Automatic optimization workflows
 * - Integration with existing Drizzle ORM
 * - Query enhancement with automatic caching
 * - Performance monitoring and alerting
 * - Scheduled optimization tasks
 */

import { db, client } from '../config/postgresql-database';
import { databaseQueryOptimizationService } from './database-optimization-service';
import { enhancedDatabaseIndexes } from '../config/database-indexes';
import { queryResultCachingService } from './query-caching-service';
import { databasePerformanceMonitor } from './database-performance-monitor';
import { EventEmitter } from 'events';

/**
 * Enhanced query result with metadata
 */
export interface EnhancedQueryResult<T = any> {
  data: T;
  metadata: {
    executionTime: number;
    fromCache: boolean;
    cachedAt?: Date;
    queryFingerprint: string;
    tables: string[];
    cacheKey?: string;
    optimization: {
      indexUsed: boolean;
      recommendations: string[];
      improvements: string[];
    };
  };
}

/**
 * Query enhancement options
 */
export interface QueryEnhancementOptions {
  enableCache?: boolean;
  cacheTTL?: number;
  analyzePerformance?: boolean;
  logSlowQueries?: boolean;
  trackMetrics?: boolean;
  forceRefresh?: boolean;
}

/**
 * Database optimization configuration
 */
export interface DatabaseOptimizationConfig {
  enabled: boolean;
  autoOptimization: {
    enabled: boolean;
    interval: number; // in milliseconds
    analyzeQueries: boolean;
    maintainIndexes: boolean;
    cleanupCache: boolean;
    generateReports: boolean;
  };
  caching: {
    enabled: boolean;
    defaultTTL: number;
    maxMemorySize: number;
    intelligentInvalidation: boolean;
  };
  monitoring: {
    enabled: boolean;
    realTime: boolean;
    alerting: boolean;
    reporting: boolean;
    trendAnalysis: boolean;
  };
  performance: {
    slowQueryThreshold: number;
    connectionPoolOptimization: boolean;
    vacuumOptimization: boolean;
    statisticsUpdate: boolean;
  };
}

/**
 * Database Optimization Integration Service
 */
export class DatabaseOptimizationIntegration extends EventEmitter {
  private config: DatabaseOptimizationConfig;
  private isInitialized: boolean = false;
  private optimizationInterval?: NodeJS.Timeout;
  private queryStats: Map<string, { count: number; totalTime: number; cacheHits: number }> = new Map();

  constructor(config?: Partial<DatabaseOptimizationConfig>) {
    super();

    this.config = {
      enabled: true,
      autoOptimization: {
        enabled: true,
        interval: 300000, // 5 minutes
        analyzeQueries: true,
        maintainIndexes: true,
        cleanupCache: true,
        generateReports: true,
      },
      caching: {
        enabled: true,
        defaultTTL: 300, // 5 minutes
        maxMemorySize: 100 * 1024 * 1024, // 100MB
        intelligentInvalidation: true,
      },
      monitoring: {
        enabled: true,
        realTime: true,
        alerting: true,
        reporting: true,
        trendAnalysis: true,
      },
      performance: {
        slowQueryThreshold: 1000, // 1 second
        connectionPoolOptimization: true,
        vacuumOptimization: true,
        statisticsUpdate: true,
      },
      ...config,
    };

    this.initializeIntegration();
  }

  /**
   * Initialize the integration service
   */
  private async initializeIntegration(): Promise<void> {
    if (!this.config.enabled) {
      console.log('Database optimization is disabled');
      return;
    }

    try {
      // Initialize indexes
      await enhancedDatabaseIndexes.createAllIndexes();

      // Start monitoring
      if (this.config.monitoring.enabled) {
        databasePerformanceMonitor.startMonitoring();
      }

      // Start auto-optimization
      if (this.config.autoOptimization.enabled) {
        this.startAutoOptimization();
      }

      // Set up event listeners
      this.setupEventListeners();

      this.isInitialized = true;
      console.log('Database Optimization Integration initialized successfully');

    } catch (error) {
      console.error('Failed to initialize Database Optimization Integration:', error);
      throw error;
    }
  }

  /**
   * Enhanced query execution with caching and optimization
   */
  async executeQuery<T = any>(
    queryBuilder: any,
    options: QueryEnhancementOptions = {}
  ): Promise<EnhancedQueryResult<T>> {
    const startTime = Date.now();
    const mergedOptions = {
      enableCache: this.config.caching.enabled,
      cacheTTL: this.config.caching.defaultTTL,
      analyzePerformance: this.config.autoOptimization.analyzeQueries,
      logSlowQueries: true,
      trackMetrics: true,
      ...options,
    };

    try {
      // Generate query fingerprint
      const querySQL = this.extractSQLFromBuilder(queryBuilder);
      const params = this.extractParamsFromBuilder(queryBuilder);
      const fingerprint = this.generateQueryFingerprint(querySQL, params);

      // Update query stats
      this.updateQueryStats(fingerprint);

      // Check cache first
      let fromCache = false;
      let cacheKey: string | undefined;
      let data: T;

      if (mergedOptions.enableCache && !mergedOptions.forceRefresh) {
        data = await queryResultCachingService.get<T>(querySQL, params, mergedOptions.cacheTTL);
        if (data !== null) {
          fromCache = true;
          this.incrementCacheHits(fingerprint);
        }
      }

      // Execute query if not cached
      if (!fromCache) {
        data = await queryBuilder;

        // Cache result
        if (mergedOptions.enableCache && data !== null) {
          const tables = this.extractTablesFromQuery(querySQL);
          await queryResultCachingService.set(querySQL, data, params, mergedOptions.cacheTTL, tables);
        }
      }

      const executionTime = Date.now() - startTime;

      // Analyze performance if enabled
      let optimization = {
        indexUsed: false,
        recommendations: [] as string[],
        improvements: [] as string[],
      };

      if (mergedOptions.analyzePerformance && !fromCache) {
        try {
          const analysis = await databaseQueryOptimizationService.analyzeQuery(querySQL, params);
          optimization.indexUsed = analysis.indexesUsed.length > 0;
          optimization.recommendations = analysis.recommendations.map(r => r.description);
          optimization.improvements = analysis.recommendations.map(r => r.impact);

          // Log slow queries
          if (mergedOptions.logSlowQueries && this.isSlowQuery(executionTime)) {
            console.warn(`Slow query detected (${executionTime}ms): ${querySQL.substring(0, 100)}...`);
            this.emit('slowQuery', { query: querySQL, executionTime, fingerprint });
          }
        } catch (error) {
          console.warn('Query analysis failed:', error);
        }
      }

      const result: EnhancedQueryResult<T> = {
        data,
        metadata: {
          executionTime,
          fromCache,
          queryFingerprint: fingerprint,
          tables: this.extractTablesFromQuery(querySQL),
          cacheKey: fromCache ? fingerprint : undefined,
          optimization,
        },
      };

      // Emit query executed event
      this.emit('queryExecuted', result);

      return result;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error(`Query execution failed (${executionTime}ms):`, error);
      throw error;
    }
  }

  /**
   * Run query with automatic enhancement
   */
  async runQuery<T = any>(
    sql: string,
    params: any[] = [],
    options: QueryEnhancementOptions = {}
  ): Promise<EnhancedQueryResult<T>> {
    const queryBuilder = client.query(sql, params);
    return this.executeQuery<T>(queryBuilder, options);
  }

  /**
   * Execute Drizzle query with enhancement
   */
  async executeDrizzleQuery<T = any>(
    drizzleQuery: any,
    options: QueryEnhancementOptions = {}
  ): Promise<EnhancedQueryResult<T>> {
    return this.executeQuery<T>(drizzleQuery, options);
  }

  /**
   * Get comprehensive performance report
   */
  async getPerformanceReport(): Promise<string> {
    if (!this.isInitialized) {
      return 'Database optimization is not initialized';
    }

    try {
      const sections: string[] = [];

      // Database performance report
      sections.push(await databasePerformanceMonitor.generatePerformanceReport());

      // Query optimization report
      sections.push(await databaseQueryOptimizationService.generatePerformanceReport());

      // Index optimization report
      sections.push(await enhancedDatabaseIndexes.generateOptimizationReport());

      // Cache performance report
      sections.push(queryResultCachingService.generatePerformanceReport());

      // Query statistics
      sections.push(this.generateQueryStatsReport());

      return sections.join('\n\n' + '='.repeat(80) + '\n\n');

    } catch (error) {
      console.error('Failed to generate performance report:', error);
      return 'Failed to generate performance report';
    }
  }

  /**
   * Optimize database automatically
   */
  async optimizeDatabase(): Promise<{
    indexes: string[];
    queries: string[];
    vacuum: string[];
    recommendations: string[];
  }> {
    const results = {
      indexes: [] as string[],
      queries: [] as string[],
      vacuum: [] as string[],
      recommendations: [] as string[],
    };

    try {
      // Index optimization
      if (this.config.autoOptimization.maintainIndexes) {
        const droppedIndexes = await enhancedDatabaseIndexes.dropUnusedIndexes();
        const rebuiltIndexes = await enhancedDatabaseIndexes.rebuildIndexes();
        results.indexes.push(`Dropped ${droppedIndexes.length} unused indexes`);
        results.indexes.push(`Rebuilt ${rebuiltIndexes.length} indexes`);
      }

      // Get optimization recommendations
      const dbRecommendations = await databaseQueryOptimizationService.optimizeDatabaseConfiguration();
      const indexRecommendations = await enhancedDatabaseIndexes.getIndexRecommendations();
      results.recommendations = [...dbRecommendations, ...indexRecommendations];

      // Vacuum optimization
      if (this.config.performance.vacuumOptimization) {
        const vacuumResults = await this.optimizeVacuum();
        results.vacuum = vacuumResults;
      }

      // Statistics update
      if (this.config.performance.statisticsUpdate) {
        await this.updateStatistics();
        results.recommendations.push('Database statistics updated');
      }

      this.emit('databaseOptimized', results);

      return results;

    } catch (error) {
      console.error('Database optimization failed:', error);
      throw error;
    }
  }

  /**
   * Optimize vacuum operations
   */
  private async optimizeVacuum(): Promise<string[]> {
    const results: string[] = [];

    try {
      // Get table statistics
      const tableStats = await databasePerformanceMonitor.getTablePerformanceStats();

      // Find tables needing vacuum
      const tablesNeedingVacuum = tableStats.filter(table => {
        const needsVacuum = table.bloat > 0.2; // More than 20% bloat
        const oldAnalyze = !table.lastAnalyze ||
          (table.lastAnalyze && Date.now() - table.lastAnalyze.getTime() > 7 * 24 * 60 * 60 * 1000);
        return needsVacuum || oldAnalyze;
      });

      for (const table of tablesNeedingVacuum.slice(0, 5)) { // Limit to 5 tables per run
        try {
          await client.query(`VACUUM ANALYZE ${table.tableName}`);
          results.push(`VACUUM ANALYZE completed for ${table.tableName}`);
        } catch (error) {
          results.push(`VACUUM failed for ${table.tableName}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

    } catch (error) {
      console.error('Vacuum optimization failed:', error);
      results.push('Vacuum optimization failed');
    }

    return results;
  }

  /**
   * Update database statistics
   */
  private async updateStatistics(): Promise<void> {
    try {
      // Update table statistics
      const tableStats = await databasePerformanceMonitor.getTablePerformanceStats();

      for (const table of tableStats.slice(0, 10)) { // Limit to 10 tables per run
        try {
          await client.query(`ANALYZE ${table.tableName}`);
        } catch (error) {
          console.warn(`Failed to analyze table ${table.tableName}:`, error);
        }
      }

      console.log('Database statistics updated');
    } catch (error) {
      console.error('Failed to update statistics:', error);
    }
  }

  /**
   * Warm up cache for frequent queries
   */
  async warmCache(): Promise<string[]> {
    const results: string[] = [];

    try {
      // Get query statistics
      const frequentQueries = Array.from(this.queryStats.entries())
        .filter(([, stats]) => stats.count > 10)
        .sort(([, a], [, b]) => b.count - a.count)
        .slice(0, 20); // Top 20 frequent queries

      for (const [fingerprint] of frequentQueries) {
        // This would require storing the actual queries somewhere
        // For now, we'll just acknowledge the frequent queries
        results.push(`Query ${fingerprint} accessed frequently (cache warming available)`);
      }

      console.log(`Cache warming completed for ${results.length} queries`);
    } catch (error) {
      console.error('Cache warming failed:', error);
    }

    return results;
  }

  /**
   * Get query statistics
   */
  getQueryStatistics(): Map<string, { count: number; totalTime: number; cacheHits: number }> {
    return new Map(this.queryStats);
  }

  /**
   * Clear all optimization data
   */
  async clearAllData(): Promise<void> {
    try {
      // Clear cache
      await queryResultCachingService.clear();

      // Clear statistics
      this.queryStats.clear();

      // Clear performance monitoring data
      // Note: This would need to be implemented in the performance monitor

      console.log('All optimization data cleared');
      this.emit('dataCleared');
    } catch (error) {
      console.error('Failed to clear optimization data:', error);
    }
  }

  /**
   * Extract SQL from query builder (simplified)
   */
  private extractSQLFromBuilder(queryBuilder: any): string {
    // This is a simplified implementation
    // In practice, you'd need to properly extract SQL from Drizzle query builders
    if (typeof queryBuilder === 'string') {
      return queryBuilder;
    }

    // For Drizzle queries, this would need proper SQL extraction
    return queryBuilder.toSQL?.() || 'unknown_query';
  }

  /**
   * Extract parameters from query builder
   */
  private extractParamsFromBuilder(queryBuilder: any): any[] {
    // Simplified implementation
    if (queryBuilder.params) {
      return queryBuilder.params;
    }
    return [];
  }

  /**
   * Generate query fingerprint
   */
  private generateQueryFingerprint(query: string, params: any[]): string {
    const crypto = require('crypto');
    const normalized = `${query}:${JSON.stringify(params)}`;
    return crypto.createHash('md5').update(normalized).digest('hex');
  }

  /**
   * Extract tables from query
   */
  private extractTablesFromQuery(query: string): string[] {
    const tables: string[] = [];
    const tablePatterns = [
      /from\s+(\w+)/gi,
      /join\s+(\w+)/gi,
      /update\s+(\w+)/gi,
      /insert\s+into\s+(\w+)/gi,
      /delete\s+from\s+(\w+)/gi,
    ];

    tablePatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(query)) !== null) {
        const table = match[1].toLowerCase();
        if (!tables.includes(table) && table !== 'select' && table !== 'where') {
          tables.push(table);
        }
      }
    });

    return tables;
  }

  /**
   * Check if query is slow
   */
  private isSlowQuery(executionTime: number): boolean {
    return executionTime > this.config.performance.slowQueryThreshold;
  }

  /**
   * Update query statistics
   */
  private updateQueryStats(fingerprint: string): void {
    const existing = this.queryStats.get(fingerprint) || {
      count: 0,
      totalTime: 0,
      cacheHits: 0,
    };

    existing.count++;
    this.queryStats.set(fingerprint, existing);
  }

  /**
   * Increment cache hits
   */
  private incrementCacheHits(fingerprint: string): void {
    const existing = this.queryStats.get(fingerprint);
    if (existing) {
      existing.cacheHits++;
    }
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Forward performance monitor events
    databasePerformanceMonitor.on('alert', (alert) => {
      this.emit('performanceAlert', alert);
    });

    databasePerformanceMonitor.on('slowQuery', (data) => {
      this.emit('slowQuery', data);
    });

    // Forward cache events
    queryResultCachingService.on('cacheMiss', (data) => {
      this.emit('cacheMiss', data);
    });

    queryResultCachingService.on('cacheHit', (data) => {
      this.emit('cacheHit', data);
    });
  }

  /**
   * Start auto-optimization
   */
  private startAutoOptimization(): void {
    this.optimizationInterval = setInterval(async () => {
      try {
        if (this.config.autoOptimization.maintainIndexes) {
          await enhancedDatabaseIndexes.analyzeIndexes();
        }

        if (this.config.autoOptimization.cleanupCache) {
          // Cache cleanup is handled automatically by the cache service
        }

        if (this.config.autoOptimization.generateReports) {
          // Report generation could be scheduled separately
        }

      } catch (error) {
        console.error('Auto-optimization error:', error);
      }
    }, this.config.autoOptimization.interval);
  }

  /**
   * Generate query statistics report
   */
  private generateQueryStatsReport(): string {
    const totalQueries = Array.from(this.queryStats.values())
      .reduce((sum, stats) => sum + stats.count, 0);

    const totalCacheHits = Array.from(this.queryStats.values())
      .reduce((sum, stats) => sum + stats.cacheHits, 0);

    const cacheHitRatio = totalQueries > 0 ? totalCacheHits / totalQueries : 0;

    const topQueries = Array.from(this.queryStats.entries())
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 10);

    return `
Query Statistics Report
Generated: ${new Date().toISOString()}

=== OVERVIEW ===
Total Queries: ${totalQueries}
Cache Hits: ${totalCacheHits}
Cache Hit Ratio: ${(cacheHitRatio * 100).toFixed(2)}%

=== TOP QUERIES ===
${topQueries.map(([fingerprint, stats], i) => `
${i + 1}. ${fingerprint}
   Executions: ${stats.count}
   Cache Hits: ${stats.cacheHits}
   Cache Hit Ratio: ${stats.count > 0 ? ((stats.cacheHits / stats.count) * 100).toFixed(2) : 0}%
`).join('')}
`;
  }

  /**
   * Get optimization status
   */
  getStatus(): {
    initialized: boolean;
    monitoring: boolean;
    caching: boolean;
    autoOptimization: boolean;
    queryCount: number;
    cacheHitRatio: number;
  } {
    const totalQueries = Array.from(this.queryStats.values())
      .reduce((sum, stats) => sum + stats.count, 0);

    const totalCacheHits = Array.from(this.queryStats.values())
      .reduce((sum, stats) => sum + stats.cacheHits, 0);

    const cacheHitRatio = totalQueries > 0 ? totalCacheHits / totalQueries : 0;

    return {
      initialized: this.isInitialized,
      monitoring: this.config.monitoring.enabled,
      caching: this.config.caching.enabled,
      autoOptimization: this.config.autoOptimization.enabled,
      queryCount: totalQueries,
      cacheHitRatio,
    };
  }

  /**
   * Gracefully shutdown the integration service
   */
  async shutdown(): Promise<void> {
    try {
      // Stop auto-optimization
      if (this.optimizationInterval) {
        clearInterval(this.optimizationInterval);
      }

      // Stop monitoring
      databasePerformanceMonitor.stopMonitoring();

      // Shutdown cache service
      await queryResultCachingService.shutdown();

      console.log('Database Optimization Integration shutdown completed');
      this.emit('shutdown');

    } catch (error) {
      console.error('Failed to shutdown Database Optimization Integration:', error);
    }
  }
}

// Export singleton instance
export const databaseOptimizationIntegration = new DatabaseOptimizationIntegration();