import { Pool, PoolClient } from 'pg';
import {
  vectorDatabaseManager,
  type VectorIndexConfig,
} from './vectorDatabaseManager';
import { db } from '../../config/database';
import {
  vector_index_configs,
  document_embeddings,
} from '../../models/vector-schema';
import { eq, sql, and, desc } from 'drizzle-orm';
import { logger } from '../../utils/logger';

/**
 * Index performance metrics
 */
export interface IndexPerformanceMetrics {
  queryCount: number;
  avgQueryTime: number;
  indexSize: number; // in MB
  recallScore: number;
  precisionScore: number;
  lastUpdated: Date;
  buildTime?: number; // in seconds
}

/**
 * Index optimization recommendations
 */
export interface IndexOptimizationRecommendation {
  type: 'create' | 'rebuild' | 'drop' | 'modify';
  indexName: string;
  reason: string;
  expectedImprovement: string;
  estimatedCost: number; // in minutes
  priority: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Index health status
 */
export interface IndexHealthStatus {
  indexName: string;
  isActive: boolean;
  tableSize: number;
  indexSize: number;
  lastAnalyzed: Date;
  fragmentation: number;
  usage: number;
  performance: IndexPerformanceMetrics;
}

/**
 * Vector Index Manager
 * Manages creation, maintenance, and optimization of vector indexes
 */
export class VectorIndexManager {
  private pool: Pool;
  private indexMaintenanceInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      max: 5,
      idleTimeoutMillis: 30000,
    });
  }

  /**
   * Initialize index manager and start maintenance tasks
   */
  async initialize(): Promise<void> {
    await this.ensureDefaultIndexes();
    await this.startMaintenanceTasks();
    logger.info('Vector index manager initialized');
  }

  /**
   * Create optimal vector index based on data characteristics
   */
  async createOptimalIndex(
    tableName: string = 'document_embeddings',
    columnName: string = 'embedding',
    options: {
      metric?: 'cosine' | 'l2' | 'inner_product';
      type?: 'ivfflat' | 'hnsw' | 'exact';
      forceRecreate?: boolean;
    } = {},
  ): Promise<string> {
    const { metric = 'cosine', type = 'auto', forceRecreate = false } = options;

    // Get table statistics
    const stats = await this.getTableStatistics(tableName);

    // Determine optimal index type
    const indexType =
      type === 'auto' ? this.determineOptimalIndexType(stats) : type;

    // Calculate index parameters
    const indexParams = this.calculateIndexParameters(indexType, stats);

    const indexName = `idx_${tableName}_${columnName}_${metric}_${indexType}`;

    // Check if index already exists
    const existingIndex = await this.getIndexConfiguration(indexName);

    if (existingIndex && !forceRecreate) {
      logger.info(`Index ${indexName} already exists, skipping creation`);
      return indexName;
    }

    const client = await this.pool.connect();
    try {
      // Drop existing index if forcing recreation
      if (existingIndex && forceRecreate) {
        await client.query(`DROP INDEX CONCURRENTLY IF EXISTS ${indexName}`);
        logger.info(`Dropped existing index: ${indexName}`);
      }

      // Create new index
      const startTime = Date.now();

      if (indexType === 'exact') {
        // Exact search doesn't need special indexing
        logger.info('Using exact search (no index needed)');
        return 'exact_search';
      }

      let createIndexSQL = `CREATE INDEX CONCURRENTLY ${indexName} ON ${tableName} `;

      if (indexType === 'ivfflat') {
        createIndexSQL += `USING ivfflat (${columnName} ${metric}_ops)`;
        if (indexParams.lists) {
          createIndexSQL += ` WITH (lists = ${indexParams.lists})`;
        }
      } else if (indexType === 'hnsw') {
        createIndexSQL += `USING hnsw (${columnName} ${metric}_ops)`;
        const hnswParams = [];
        if (indexParams.m) hnswParams.push(`m = ${indexParams.m}`);
        if (indexParams.efConstruction)
          hnswParams.push(`ef_construction = ${indexParams.efConstruction}`);
        if (hnswParams.length > 0) {
          createIndexSQL += ` WITH (${hnswParams.join(', ')})`;
        }
      }

      logger.info(`Creating index: ${indexName} (type: ${indexType})`);
      await client.query(createIndexSQL);

      const buildTime = (Date.now() - startTime) / 1000;

      // Store index configuration
      await this.storeIndexConfiguration({
        indexName,
        indexType,
        tableName,
        columnName,
        metric,
        dimensions: stats.avgDimensions,
        isActive: true,
        configuration: indexParams,
        sizeEstimate: 0, // Will be updated later
        performance: {
          queryCount: 0,
          avgQueryTime: 0,
          indexSize: 0,
          recallScore: 0,
          precisionScore: 0,
          lastUpdated: new Date(),
          buildTime,
        },
      });

      // Analyze the new index
      await this.analyzeIndex(client, indexName);

      logger.info(`Index ${indexName} created successfully in ${buildTime}s`);
      return indexName;
    } finally {
      client.release();
    }
  }

  /**
   * Optimize existing indexes for better performance
   */
  async optimizeIndexes(): Promise<{
    recommendations: IndexOptimizationRecommendation[];
    appliedOptimizations: string[];
  }> {
    const recommendations: IndexOptimizationRecommendation[] = [];
    const appliedOptimizations: string[] = [];

    // Get current index health status
    const healthStatuses = await this.getIndexHealthStatuses();
    const tableStats = await this.getTableStatistics('document_embeddings');

    // Analyze each index
    for (const health of healthStatuses) {
      // Check for fragmentation
      if (health.fragmentation > 0.3) {
        recommendations.push({
          type: 'rebuild',
          indexName: health.indexName,
          reason: `High fragmentation (${(health.fragmentation * 100).toFixed(1)}%)`,
          expectedImprovement: '20-50% faster queries',
          estimatedCost: 5,
          priority: health.usage > 0.5 ? 'high' : 'medium',
        });
      }

      // Check for underutilized indexes
      if (health.usage < 0.1 && health.indexSize > 100) {
        recommendations.push({
          type: 'drop',
          indexName: health.indexName,
          reason: 'Low usage index consuming significant space',
          expectedImprovement: `${health.indexSize}MB storage freed`,
          estimatedCost: 1,
          priority: 'low',
        });
      }

      // Check for missing indexes on large tables
      if (tableStats.rowCount > 10000 && !health.isActive) {
        recommendations.push({
          type: 'create',
          indexName: 'idx_document_embeddings_embedding_cosine_hnsw',
          reason: 'Large table without vector index',
          expectedImprovement: '10-100x faster similarity searches',
          estimatedCost: 10,
          priority: 'high',
        });
      }
    }

    // Apply automatic optimizations for high-priority items
    for (const rec of recommendations) {
      if (rec.priority === 'critical' || rec.priority === 'high') {
        try {
          if (rec.type === 'rebuild') {
            await this.rebuildIndex(rec.indexName);
            appliedOptimizations.push(`Rebuilt index: ${rec.indexName}`);
          } else if (rec.type === 'create') {
            await this.createOptimalIndex();
            appliedOptimizations.push(`Created index: ${rec.indexName}`);
          }
        } catch (error) {
          logger.warn(
            `Failed to apply optimization for ${rec.indexName}:`,
            error,
          );
        }
      }
    }

    return { recommendations, appliedOptimizations };
  }

  /**
   * Get comprehensive index health report
   */
  async getHealthReport(): Promise<{
    overallHealth: 'excellent' | 'good' | 'fair' | 'poor';
    indexes: IndexHealthStatus[];
    summary: {
      totalIndexes: number;
      activeIndexes: number;
      totalSize: number;
      avgQueryTime: number;
      fragmentationScore: number;
    };
    recommendations: IndexOptimizationRecommendation[];
  }> {
    const healthStatuses = await this.getIndexHealthStatuses();
    const { recommendations } = await this.optimizeIndexes();

    const summary = {
      totalIndexes: healthStatuses.length,
      activeIndexes: healthStatuses.filter(h => h.isActive).length,
      totalSize: healthStatuses.reduce((sum, h) => sum + h.indexSize, 0),
      avgQueryTime:
        healthStatuses.length > 0
          ? healthStatuses.reduce(
            (sum, h) => sum + h.performance.avgQueryTime,
            0,
          ) / healthStatuses.length
          : 0,
      fragmentationScore:
        healthStatuses.length > 0
          ? healthStatuses.reduce((sum, h) => sum + h.fragmentation, 0) /
            healthStatuses.length
          : 0,
    };

    // Determine overall health
    let overallHealth: 'excellent' | 'good' | 'fair' | 'poor';
    if (summary.avgQueryTime < 50 && summary.fragmentationScore < 0.1) {
      overallHealth = 'excellent';
    } else if (summary.avgQueryTime < 100 && summary.fragmentationScore < 0.2) {
      overallHealth = 'good';
    } else if (summary.avgQueryTime < 200 && summary.fragmentationScore < 0.3) {
      overallHealth = 'fair';
    } else {
      overallHealth = 'poor';
    }

    return {
      overallHealth,
      indexes: healthStatuses,
      summary,
      recommendations,
    };
  }

  /**
   * Update index performance metrics
   */
  async updatePerformanceMetrics(
    indexName: string,
    queryTime: number,
    resultsCount: number,
  ): Promise<void> {
    try {
      const existingConfig = await this.getIndexConfiguration(indexName);

      if (existingConfig && existingConfig.performance) {
        const currentMetrics = existingConfig.performance;
        const newQueryCount = (currentMetrics.queryCount || 0) + 1;
        const newAvgQueryTime =
          (currentMetrics.avgQueryTime * currentMetrics.queryCount +
            queryTime) /
          newQueryCount;

        await db
          .update(vector_index_configs)
          .set({
            performance: {
              ...currentMetrics,
              queryCount: newQueryCount,
              avgQueryTime: newAvgQueryTime,
              lastUpdated: new Date(),
            },
          })
          .where(eq(vector_index_configs.indexName, indexName));
      }
    } catch (error) {
      logger.warn(
        `Failed to update performance metrics for ${indexName}:`,
        error,
      );
    }
  }

  /**
   * Clean up and shutdown
   */
  async shutdown(): Promise<void> {
    if (this.indexMaintenanceInterval) {
      clearInterval(this.indexMaintenanceInterval);
      this.indexMaintenanceInterval = null;
    }

    await this.pool.end();
    logger.info('Vector index manager shutdown completed');
  }

  // Private helper methods

  private async ensureDefaultIndexes(): Promise<void> {
    const stats = await this.getTableStatistics('document_embeddings');

    if (stats.rowCount > 1000) {
      await this.createOptimalIndex('document_embeddings', 'embedding', {
        metric: 'cosine',
        type: 'auto',
      });
    }
  }

  private async startMaintenanceTasks(): Promise<void> {
    // Run maintenance every 6 hours
    this.indexMaintenanceInterval = setInterval(
      async () => {
        try {
          await this.performMaintenanceTasks();
        } catch (error) {
          logger.error('Index maintenance failed:', error);
        }
      },
      6 * 60 * 60 * 1000,
    );
  }

  private async performMaintenanceTasks(): Promise<void> {
    logger.info('Starting index maintenance tasks');

    // Analyze table statistics
    await this.analyzeTableStatistics();

    // Update index sizes
    await this.updateIndexSizes();

    // Clean up old indexes
    await this.cleanupOldIndexes();

    // Optimize indexes if needed
    const { appliedOptimizations } = await this.optimizeIndexes();

    logger.info('Index maintenance completed', { appliedOptimizations });
  }

  private async getTableStatistics(tableName: string): Promise<{
    rowCount: number;
    tableSize: number; // in MB
    avgDimensions: number;
    hasVectors: boolean;
  }> {
    const client = await this.pool.connect();
    try {
      // Get row count and table size
      const sizeResult = await client.query(`
        SELECT
          (SELECT COUNT(*) FROM ${tableName}) as row_count,
          pg_size_pretty(pg_total_relation_size('${tableName}')) as table_size_pretty,
          pg_total_relation_size('${tableName}') as table_size_bytes
      `);

      // Get average vector dimensions
      const dimensionsResult = await client.query(`
        SELECT AVG(array_length(embedding, 1)) as avg_dimensions,
               COUNT(*) as vector_count
        FROM ${tableName}
        WHERE embedding IS NOT NULL
        LIMIT 1000
      `);

      return {
        rowCount: parseInt(sizeResult.rows[0].row_count),
        tableSize: Math.round(
          sizeResult.rows[0].table_size_bytes / (1024 * 1024),
        ),
        avgDimensions: Math.round(
          parseFloat(dimensionsResult.rows[0].avg_dimensions) || 0,
        ),
        hasVectors: parseInt(dimensionsResult.rows[0].vector_count) > 0,
      };
    } finally {
      client.release();
    }
  }

  private determineOptimalIndexType(stats: any): 'ivfflat' | 'hnsw' | 'exact' {
    if (stats.rowCount < 1000) {
      return 'exact'; // Small tables don't need indexing
    }

    if (stats.rowCount < 100000) {
      return 'ivfflat'; // Good balance of speed and build time
    }

    return 'hnsw'; // Best for large datasets
  }

  private calculateIndexParameters(
    indexType: string,
    stats: any,
  ): Record<string, any> {
    if (indexType === 'ivfflat') {
      return {
        lists: Math.min(Math.max(stats.rowCount / 10, 10), 1000),
      };
    }

    if (indexType === 'hnsw') {
      return {
        m: 16,
        efConstruction: Math.min(stats.rowCount / 10, 200),
        ef: 64,
      };
    }

    return {};
  }

  private async getIndexConfiguration(indexName: string): Promise<any> {
    try {
      const configs = await db.query.vector_index_configs.findFirst({
        where: eq(vector_index_configs.indexName, indexName),
      });
      return configs;
    } catch (error) {
      return null;
    }
  }

  private async storeIndexConfiguration(config: any): Promise<void> {
    await db.insert(vector_index_configs).values(config);
  }

  private async analyzeIndex(
    client: PoolClient,
    indexName: string,
  ): Promise<void> {
    await client.query(`ANALYZE ${indexName}`);
  }

  private async analyzeTableStatistics(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('ANALYZE document_embeddings');
    } finally {
      client.release();
    }
  }

  private async updateIndexSizes(): Promise<void> {
    const client = await this.pool.connect();
    try {
      const indexes = await client.query(`
        SELECT
          schemaname,
          tablename,
          indexname,
          pg_size_pretty(pg_relation_size(indexname::regclass)) as size_pretty,
          pg_relation_size(indexname::regclass) as size_bytes
        FROM pg_indexes
        WHERE tablename = 'document_embeddings'
      `);

      for (const index of indexes.rows) {
        await db
          .update(vector_index_configs)
          .set({
            sizeEstimate: Math.round(index.size_bytes / (1024 * 1024)),
          })
          .where(eq(vector_index_configs.indexName, index.indexname));
      }
    } finally {
      client.release();
    }
  }

  private async cleanupOldIndexes(): Promise<void> {
    const client = await this.pool.connect();
    try {
      // Drop indexes that haven't been used in 30 days
      await client.query(`
        DELETE FROM vector_index_configs
        WHERE is_active = false
        AND updated_at < NOW() - INTERVAL '30 days'
      `);
    } finally {
      client.release();
    }
  }

  private async rebuildIndex(indexName: string): Promise<void> {
    const config = await this.getIndexConfiguration(indexName);
    if (!config) {
      throw new Error(`Index configuration not found: ${indexName}`);
    }

    await this.createOptimalIndex(config.tableName, config.columnName, {
      metric: config.metric,
      type: config.indexType,
      forceRecreate: true,
    });
  }

  private async getIndexHealthStatuses(): Promise<IndexHealthStatus[]> {
    const configs = await db.query.vector_index_configs.findMany();
    const healthStatuses: IndexHealthStatus[] = [];

    for (const config of configs) {
      // Calculate fragmentation and usage (simplified)
      const fragmentation = Math.random() * 0.3; // Mock calculation
      const usage = Math.random(); // Mock calculation

      healthStatuses.push({
        indexName: config.indexName,
        isActive: config.isActive,
        tableSize: config.sizeEstimate || 0,
        indexSize: config.sizeEstimate || 0,
        lastAnalyzed: config.updatedAt,
        fragmentation,
        usage,
        performance: config.performance || {
          queryCount: 0,
          avgQueryTime: 0,
          indexSize: 0,
          recallScore: 0,
          precisionScore: 0,
          lastUpdated: new Date(),
        },
      });
    }

    return healthStatuses;
  }
}

// Export singleton instance
export const vectorIndexManager = new VectorIndexManager();
