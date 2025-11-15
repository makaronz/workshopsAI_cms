/**
 * Enhanced Database Indexes Configuration
 *
 * Comprehensive index management for the WorkshopsAI CMS PostgreSQL database
 * including composite indexes, partial indexes, JSONB indexes, and vector similarity indexes.
 *
 * Features:
 * - Composite indexes for common query patterns
 * - Partial indexes for filtered queries
 * - JSON field indexes for PostgreSQL JSONB operations
 * - Vector similarity indexes for embedding searches
 * - Index usage monitoring and recommendations
 * - Automatic index creation and maintenance
 */

import { db, client } from './postgresql-database';
import { databaseQueryOptimizationService } from '../services/database-optimization-service';

/**
 * Index definition interface
 */
export interface IndexDefinition {
  name: string;
  table: string;
  columns: string[];
  type: 'btree' | 'hash' | 'gin' | 'gist' | 'brin' | 'vector';
  unique?: boolean;
  partial?: string; // WHERE clause for partial index
  include?: string[]; // INCLUDE columns for covering indexes
  options?: string; // Additional index options
  description?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedSize?: number; // in MB
  maintenance?: {
    autoAnalyze?: boolean;
    fillFactor?: number;
    vacuumDelay?: number;
  };
}

/**
 * Index analysis result
 */
export interface IndexAnalysisResult {
  indexName: string;
  tableName: string;
  indexType: string;
  size: number; // in MB
  usage: {
    scans: number;
    tuplesReturned: number;
    tuplesFetched: number;
    lastUsed?: Date;
  };
  efficiency: {
    selectivity: number; // 0-1, lower is better
    duplicateRatio: number; // 0-1, lower is better
    cacheHitRatio: number; // 0-1, higher is better
  };
  recommendations: string[];
  status: 'optimal' | 'underutilized' | 'redundant' | 'missing';
}

/**
 * Vector index configuration
 */
export interface VectorIndexConfig {
  dimensions: number;
  distanceFunction: 'cosine' | 'l2' | 'inner_product';
  indexType: 'ivfflat' | 'hnsw';
  lists?: number; // for ivfflat
  m?: number; // for hnsw
  efConstruction?: number; // for hnsw
  efSearch?: number; // for hnsw
}

/**
 * Enhanced Database Indexes Manager
 */
export class EnhancedDatabaseIndexes {
  private indexes: Map<string, IndexDefinition> = new Map();
  private analysisCache: Map<string, IndexAnalysisResult> = new Map();
  private isMonitoring: boolean = false;
  private monitoringInterval?: NodeJS.Timeout;

  constructor() {
    this.initializeIndexes();
    this.startMonitoring();
  }

  /**
   * Initialize predefined indexes
   */
  private initializeIndexes(): void {
    // Questionnaire indexes
    this.registerIndex({
      name: 'idx_questionnaires_workshop_status_created',
      table: 'questionnaires',
      columns: ['workshopId', 'status', 'createdAt'],
      type: 'btree',
      description: 'Composite index for questionnaire listings with workshop filtering',
      priority: 'high',
      estimatedSize: 2,
    });

    this.registerIndex({
      name: 'idx_questionnaires_status_created',
      table: 'questionnaires',
      columns: ['status', 'createdAt'],
      type: 'btree',
      partial: "status IN ('published', 'closed')",
      description: 'Index for published questionnaires with time-based ordering',
      priority: 'high',
      estimatedSize: 1,
    });

    // JSONB indexes for questionnaire titles and settings
    this.registerIndex({
      name: 'idx_questionnaires_title_gin',
      table: 'questionnaires',
      columns: ['title'],
      type: 'gin',
      options: 'jsonb_path_ops',
      description: 'GIN index for questionnaire title searches',
      priority: 'medium',
      estimatedSize: 3,
    });

    this.registerIndex({
      name: 'idx_questionnaires_settings_gin',
      table: 'questionnaires',
      columns: ['settings'],
      type: 'gin',
      options: 'jsonb_path_ops',
      description: 'GIN index for questionnaire settings queries',
      priority: 'medium',
      estimatedSize: 2,
    });

    // Response indexes
    this.registerIndex({
      name: 'idx_responses_questionnaire_user_status',
      table: 'responses',
      columns: ['questionId', 'userId', 'status'],
      type: 'btree',
      include: ['submittedAt', 'updatedAt'],
      description: 'Composite index for user response queries',
      priority: 'critical',
      estimatedSize: 5,
    });

    this.registerIndex({
      name: 'idx_responses_submitted_at',
      table: 'responses',
      columns: ['submittedAt'],
      type: 'btree',
      partial: "status = 'submitted'",
      description: 'Time-based index for submitted responses',
      priority: 'high',
      estimatedSize: 3,
    });

    // Enrollment-based response indexes
    this.registerIndex({
      name: 'idx_responses_enrollment_status',
      table: 'responses',
      columns: ['enrollmentId', 'status'],
      type: 'btree',
      partial: "enrollmentId IS NOT NULL",
      description: 'Index for enrollment-based response tracking',
      priority: 'medium',
      estimatedSize: 2,
    });

    // LLM Analysis indexes
    this.registerIndex({
      name: 'idx_llm_analyses_questionnaire_type_status',
      table: 'llmanalyses',
      columns: ['questionnaireId', 'analysisType', 'status'],
      type: 'btree',
      description: 'Composite index for analysis result queries',
      priority: 'high',
      estimatedSize: 2,
    });

    this.registerIndex({
      name: 'idx_llm_analyses_completed_at',
      table: 'llmanalyses',
      columns: ['completedAt'],
      type: 'btree',
      partial: "status = 'completed'",
      description: 'Time-based index for completed analyses',
      priority: 'medium',
      estimatedSize: 1,
    });

    // JSONB indexes for analysis results and metadata
    this.registerIndex({
      name: 'idx_llm_analyses_results_gin',
      table: 'llmanalyses',
      columns: ['results'],
      type: 'gin',
      options: 'jsonb_path_ops',
      description: 'GIN index for analysis result searches',
      priority: 'medium',
      estimatedSize: 4,
    });

    this.registerIndex({
      name: 'idx_llm_analyses_metadata_gin',
      table: 'llmanalyses',
      columns: ['metadata'],
      type: 'gin',
      options: 'jsonb_path_ops',
      description: 'GIN index for analysis metadata queries',
      priority: 'low',
      estimatedSize: 2,
    });

    // Analysis Job indexes
    this.registerIndex({
      name: 'idx_analysis_jobs_status_priority_created',
      table: 'analysisjobs',
      columns: ['status', 'priority', 'createdAt'],
      type: 'btree',
      description: 'Composite index for job queue management',
      priority: 'critical',
      estimatedSize: 1,
    });

    this.registerIndex({
      name: 'idx_analysis_jobs_questionnaire_status',
      table: 'analysisjobs',
      columns: ['questionnaireId', 'status'],
      type: 'btree',
      description: 'Index for job status tracking by questionnaire',
      priority: 'high',
      estimatedSize: 1,
    });

    // Consent indexes
    this.registerIndex({
      name: 'idx_consents_user_questionnaire_granted',
      table: 'consents',
      columns: ['userId', 'questionnaireId', 'granted'],
      type: 'btree',
      partial: "granted = true AND revokedAt IS NULL",
      description: 'Index for active consent lookups',
      priority: 'high',
      estimatedSize: 2,
    });

    this.registerIndex({
      name: 'idx_consents_type_granted_given_at',
      table: 'consents',
      columns: ['consentType', 'granted', 'givenAt'],
      type: 'btree',
      description: 'Index for consent reporting and auditing',
      priority: 'medium',
      estimatedSize: 1,
    });

    // Embedding indexes
    this.registerIndex({
      name: 'idx_embeddings_response_model',
      table: 'embeddings',
      columns: ['responseId', 'model'],
      type: 'btree',
      description: 'Index for embedding lookups by response and model',
      priority: 'medium',
      estimatedSize: 3,
    });

    this.registerIndex({
      name: 'idx_embeddings_checksum',
      table: 'embeddings',
      columns: ['checksum'],
      type: 'btree',
      description: 'Index for embedding deduplication',
      priority: 'low',
      estimatedSize: 2,
    });

    // Question indexes
    this.registerIndex({
      name: 'idx_questions_group_order',
      table: 'questions',
      columns: ['groupId', 'orderIndex'],
      type: 'btree',
      description: 'Index for ordered question retrieval',
      priority: 'high',
      estimatedSize: 1,
    });

    this.registerIndex({
      name: 'idx_questions_type',
      table: 'questions',
      columns: ['type'],
      type: 'btree',
      description: 'Index for question type filtering',
      priority: 'medium',
      estimatedSize: 1,
    });

    // Question Group indexes
    this.registerIndex({
      name: 'idx_question_groups_questionnaire_order',
      table: 'questiongroups',
      columns: ['questionnaireId', 'orderIndex'],
      type: 'btree',
      description: 'Index for ordered group retrieval',
      priority: 'high',
      estimatedSize: 1,
    });
  }

  /**
   * Register a new index definition
   */
  registerIndex(definition: IndexDefinition): void {
    this.indexes.set(definition.name, definition);
  }

  /**
   * Create all registered indexes
   */
  async createAllIndexes(): Promise<void> {
    console.log('Creating database indexes...');

    const sortedIndexes = Array.from(this.indexes.values())
      .sort((a, b) => {
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });

    for (const index of sortedIndexes) {
      try {
        await this.createIndex(index);
        console.log(`✓ Created index: ${index.name}`);
      } catch (error) {
        console.error(`✗ Failed to create index ${index.name}:`, error);
      }
    }

    console.log('Database index creation completed');
  }

  /**
   * Create a single index
   */
  async createIndex(index: IndexDefinition): Promise<void> {
    const sql = this.buildCreateIndexSQL(index);
    await client.query(sql);
  }

  /**
   * Build CREATE INDEX SQL statement
   */
  private buildCreateIndexSQL(index: IndexDefinition): string {
    let sql = 'CREATE';

    if (index.unique) {
      sql += ' UNIQUE';
    }

    sql += ` INDEX CONCURRENTLY IF NOT EXISTS ${index.name}`;
    sql += ` ON ${index.table}`;

    if (index.type !== 'btree') {
      sql += ` USING ${index.type}`;
    }

    // Column list
    if (index.type === 'vector') {
      // Vector indexes need special handling
      sql += ` (${index.columns.join(', ')})`;
    } else {
      sql += ` (${index.columns.join(', ')})`;
    }

    // INCLUDE clause for covering indexes
    if (index.include && index.include.length > 0) {
      sql += ` INCLUDE (${index.include.join(', ')})`;
    }

    // WHERE clause for partial indexes
    if (index.partial) {
      sql += ` WHERE ${index.partial}`;
    }

    // Additional options
    if (index.options) {
      sql += ` WITH (${index.options})`;
    }

    return sql;
  }

  /**
   * Create vector similarity index for embeddings
   */
  async createVectorIndex(
    tableName: string,
    columnName: string,
    config: VectorIndexConfig
  ): Promise<void> {
    const indexName = `idx_${tableName}_${columnName}_vector`;

    let sql = `CREATE INDEX CONCURRENTLY IF NOT EXISTS ${indexName}`;
    sql += ` ON ${tableName} USING ivfflat`;
    sql += ` (${columnName} vector_${config.distanceFunction})`;
    sql += ` WITH (lists = ${config.lists || 100})`;

    try {
      await client.query(sql);
      console.log(`✓ Created vector index: ${indexName}`);
    } catch (error) {
      console.error(`✗ Failed to create vector index ${indexName}:`, error);
      throw error;
    }
  }

  /**
   * Analyze existing indexes
   */
  async analyzeIndexes(): Promise<IndexAnalysisResult[]> {
    const results: IndexAnalysisResult[] = [];

    try {
      // Get index statistics
      const indexStats = await client`
        SELECT
          schemaname,
          tablename,
          indexname,
          indexdef,
          idx_scan,
          idx_tup_read,
          idx_tup_fetch,
          pg_size_pretty(pg_relation_size(indexrelid)) as size,
          pg_relation_size(indexrelid) as size_bytes
        FROM pg_stat_user_indexes
        JOIN pg_indexes USING (schemaname, tablename, indexname)
        ORDER BY idx_scan DESC
      `;

      for (const stat of indexStats) {
        const analysis = await this.analyzeIndividualIndex(stat);
        results.push(analysis);
      }

      // Cache results
      this.analysisCache.clear();
      results.forEach(result => {
        this.analysisCache.set(result.indexName, result);
      });

      return results;
    } catch (error) {
      console.error('Failed to analyze indexes:', error);
      throw error;
    }
  }

  /**
   * Analyze individual index
   */
  private async analyzeIndividualIndex(stat: any): Promise<IndexAnalysisResult> {
    const recommendations: string[] = [];
    let status: IndexAnalysisResult['status'] = 'optimal';

    // Determine status based on usage
    if (stat.idx_scan === 0) {
      status = 'underutilized';
      recommendations.push('Consider dropping this unused index to save space and improve write performance');
    } else if (stat.idx_scan < 10) {
      status = 'underutilized';
      recommendations.push('Low usage index. Consider if still needed');
    }

    // Calculate efficiency metrics
    const cacheHitRatio = stat.idx_tup_read > 0
      ? stat.idx_tup_fetch / stat.idx_tup_read
      : 1;

    if (cacheHitRatio < 0.8) {
      status = 'underutilized';
      recommendations.push('Low cache hit ratio. Consider query optimization');
    }

    // Check for redundant indexes
    const redundantCheck = await this.checkRedundantIndex(stat.indexname, stat.tablename);
    if (redundantCheck.isRedundant) {
      status = 'redundant';
      recommendations.push(`Redundant with index: ${redundantCheck.redundantWith}`);
    }

    return {
      indexName: stat.indexname,
      tableName: stat.tablename,
      indexType: this.extractIndexType(stat.indexdef),
      size: Math.round(stat.size_bytes / (1024 * 1024) * 100) / 100, // Convert to MB
      usage: {
        scans: stat.idx_scan,
        tuplesReturned: stat.idx_tup_read,
        tuplesFetched: stat.idx_tup_fetch,
        lastUsed: await this.getLastUsedDate(stat.indexname),
      },
      efficiency: {
        selectivity: this.calculateSelectivity(stat.indexname, stat.tablename),
        duplicateRatio: await this.calculateDuplicateRatio(stat.indexname, stat.tablename),
        cacheHitRatio,
      },
      recommendations,
      status,
    };
  }

  /**
   * Extract index type from index definition
   */
  private extractIndexType(indexDef: string): string {
    if (indexDef.includes('USING')) {
      const match = indexDef.match(/USING (\w+)/);
      return match ? match[1] : 'btree';
    }
    return 'btree';
  }

  /**
   * Get last used date for index
   */
  private async getLastUsedDate(indexName: string): Promise<Date | undefined> {
    try {
      const result = await client.query(`
        SELECT last_use
        FROM pg_stat_user_indexes
        WHERE indexrelid = (
          SELECT oid FROM pg_class WHERE relname = $1
        )
      `, [indexName]);

      return result[0]?.last_use ? new Date(result[0].last_use) : undefined;
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Calculate index selectivity
   */
  private async calculateSelectivity(indexName: string, tableName: string): Promise<number> {
    try {
      // Get total rows in table
      const tableResult = await client.query(`
        SELECT n_tup_ins + n_tup_upd + n_tup_del as total_rows
        FROM pg_stat_user_tables
        WHERE relname = $1
      `, [tableName]);

      const totalRows = tableResult[0]?.total_rows || 1;

      // Get distinct values for first indexed column
      const indexColumns = await this.getIndexColumns(indexName);
      if (indexColumns.length === 0) return 1;

      const distinctResult = await client.query(`
        SELECT COUNT(DISTINCT ${indexColumns[0]}) as distinct_count
        FROM ${tableName}
      `);

      const distinctCount = distinctResult[0]?.distinct_count || 1;

      return distinctCount / totalRows;
    } catch (error) {
      return 1;
    }
  }

  /**
   * Calculate duplicate ratio for index
   */
  private async calculateDuplicateRatio(indexName: string, tableName: string): Promise<number> {
    try {
      const indexColumns = await this.getIndexColumns(indexName);
      if (indexColumns.length === 0) return 0;

      const result = await client.query(`
        SELECT
          COUNT(*) as total_rows,
          COUNT(DISTINCT (${indexColumns.join(', ')})) as distinct_rows
        FROM ${tableName}
      `);

      const { total_rows, distinct_rows } = result[0];

      return total_rows > 0 ? (total_rows - distinct_rows) / total_rows : 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get indexed columns for an index
   */
  private async getIndexColumns(indexName: string): Promise<string[]> {
    try {
      const result = await client.query(`
        SELECT a.attname
        FROM pg_attribute a
        JOIN pg_index i ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        JOIN pg_class c ON c.oid = i.indexrelid
        WHERE c.relname = $1
        ORDER BY a.attnum
      `, [indexName]);

      return result.map(row => row.attname);
    } catch (error) {
      return [];
    }
  }

  /**
   * Check if index is redundant with another index
   */
  private async checkRedundantIndex(
    indexName: string,
    tableName: string
  ): Promise<{ isRedundant: boolean; redundantWith?: string }> {
    try {
      const indexColumns = await this.getIndexColumns(indexName);

      // Get other indexes on the same table
      const otherIndexes = await client.query(`
        SELECT c.relname as index_name
        FROM pg_class c
        JOIN pg_index i ON c.oid = i.indexrelid
        JOIN pg_class t ON i.indrelid = t.oid
        WHERE t.relname = $1 AND c.relname != $2
      `, [tableName, indexName]);

      for (const otherIndex of otherIndexes) {
        const otherColumns = await this.getIndexColumns(otherIndex.index_name);

        // Check if current index is a prefix of the other index
        if (this.isPrefixOf(indexColumns, otherColumns)) {
          return { isRedundant: true, redundantWith: otherIndex.index_name };
        }
      }

      return { isRedundant: false };
    } catch (error) {
      return { isRedundant: false };
    }
  }

  /**
   * Check if array1 is a prefix of array2
   */
  private isPrefixOf(array1: string[], array2: string[]): boolean {
    if (array1.length >= array2.length) return false;

    for (let i = 0; i < array1.length; i++) {
      if (array1[i] !== array2[i]) return false;
    }

    return true;
  }

  /**
   * Get index recommendations based on query patterns
   */
  async getIndexRecommendations(): Promise<string[]> {
    const recommendations: string[] = [];

    try {
      // Get slow queries from optimization service
      const slowQueries = await databaseQueryOptimizationService.getTopSlowQueries(10);

      // Analyze slow queries for missing indexes
      for (const query of slowQueries) {
        const missingIndexes = await this.analyzeQueryForIndexes(query.query);
        recommendations.push(...missingIndexes);
      }

      // Get frequently used table patterns
      const tablePatterns = await this.analyzeTableUsagePatterns();
      recommendations.push(...tablePatterns);

      // Remove duplicates
      return [...new Set(recommendations)];
    } catch (error) {
      console.error('Failed to generate index recommendations:', error);
      return [];
    }
  }

  /**
   * Analyze query for potential indexes
   */
  private async analyzeQueryForIndexes(query: string): Promise<string[]> {
    const recommendations: string[] = [];

    // Simple heuristic analysis (could be enhanced with actual query parsing)
    const whereMatch = query.match(/where\s+(.+?)(?:\s+order\s+by|\s+group\s+by|\s+limit|$)/is);
    if (whereMatch) {
      const whereClause = whereMatch[1];
      const columns = this.extractColumnsFromWhereClause(whereClause);

      if (columns.length > 0) {
        recommendations.push(
          `Consider creating index on table for WHERE clause: ${columns.join(', ')}`
        );
      }
    }

    // Check for ORDER BY without index
    const orderByMatch = query.match(/order\s+by\s+(.+?)(?:\s+limit|$)/is);
    if (orderByMatch) {
      const orderByClause = orderByMatch[1];
      const columns = orderByClause.split(',').map(col => col.trim().split(' ')[0]);

      if (columns.length > 0) {
        recommendations.push(
          `Consider creating index for ORDER BY clause: ${columns.join(', ')}`
        );
      }
    }

    return recommendations;
  }

  /**
   * Extract columns from WHERE clause
   */
  private extractColumnsFromWhereClause(whereClause: string): string[] {
    const columns: string[] = [];

    // Simple regex to extract column references
    const columnMatches = whereClause.match(/\b(\w+)\s*(?:=|!=|>|<|>=|<=|like|in)/gi);

    if (columnMatches) {
      columnMatches.forEach(match => {
        const column = match.replace(/\s*(?:=|!=|>|<|>=|<=|like|in).*$/gi, '').trim();
        if (!columns.includes(column) &&
            !['and', 'or', 'not', 'null', 'true', 'false'].includes(column.toLowerCase())) {
          columns.push(column);
        }
      });
    }

    return columns;
  }

  /**
   * Analyze table usage patterns for index recommendations
   */
  private async analyzeTableUsagePatterns(): Promise<string[]> {
    const recommendations: string[] = [];

    try {
      // Get table statistics
      const tableStats = await client.query(`
        SELECT
          schemaname,
          tablename,
          n_tup_ins,
          n_tup_upd,
          n_tup_del,
          n_tup_hot_upd,
          seq_scan,
          idx_scan,
          n_live_tup,
          n_dead_tup
        FROM pg_stat_user_tables
        ORDER BY seq_scan DESC
      `);

      for (const table of tableStats) {
        // High sequential scans with low index scans suggests missing indexes
        if (table.seq_scan > 1000 && table.idx_scan < table.seq_scan * 0.1) {
          recommendations.push(
            `Table ${table.tablename} has high sequential scans (${table.seq_scan}) but low index usage. Consider adding indexes.`
          );
        }

        // High dead tuples suggest need for vacuum or better indexes
        if (table.n_dead_tup > table.n_live_tup * 0.2) {
          recommendations.push(
            `Table ${table.tablename} has high dead tuple ratio. Consider running VACUUM or optimizing indexes.`
          );
        }
      }
    } catch (error) {
      console.warn('Failed to analyze table usage patterns:', error);
    }

    return recommendations;
  }

  /**
   * Start index monitoring
   */
  startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.analyzeIndexes();
      } catch (error) {
        console.error('Index monitoring error:', error);
      }
    }, 5 * 60 * 1000); // Every 5 minutes

    console.log('Index monitoring started');
  }

  /**
   * Stop index monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    console.log('Index monitoring stopped');
  }

  /**
   * Get index analysis results
   */
  getIndexAnalysis(indexName: string): IndexAnalysisResult | null {
    return this.analysisCache.get(indexName) || null;
  }

  /**
   * Get all index analysis results
   */
  getAllIndexAnalysis(): Map<string, IndexAnalysisResult> {
    return new Map(this.analysisCache);
  }

  /**
   * Drop unused indexes
   */
  async dropUnusedIndexes(thresholdScans: number = 10): Promise<string[]> {
    const droppedIndexes: string[] = [];

    try {
      const analysisResults = await this.analyzeIndexes();

      for (const result of analysisResults) {
        if (result.usage.scans < thresholdScans &&
            !result.indexName.includes('pkey') &&
            !result.indexName.includes('unique')) {

          await client.query(`DROP INDEX CONCURRENTLY IF EXISTS ${result.indexName}`);
          droppedIndexes.push(result.indexName);
          console.log(`Dropped unused index: ${result.indexName}`);
        }
      }
    } catch (error) {
      console.error('Failed to drop unused indexes:', error);
    }

    return droppedIndexes;
  }

  /**
   * Rebuild indexes if needed
   */
  async rebuildIndexes(): Promise<string[]> {
    const rebuiltIndexes: string[] = [];

    try {
      const analysisResults = await this.analyzeIndexes();

      for (const result of analysisResults) {
        // Rebuild indexes with high bloat or poor efficiency
        const bloat = await this.getIndexBloat(result.indexName);

        if (bloat > 0.3 || result.efficiency.cacheHitRatio < 0.5) {
          await client.query(`REINDEX INDEX CONCURRENTLY ${result.indexName}`);
          rebuiltIndexes.push(result.indexName);
          console.log(`Rebuilt index: ${result.indexName}`);
        }
      }
    } catch (error) {
      console.error('Failed to rebuild indexes:', error);
    }

    return rebuiltIndexes;
  }

  /**
   * Get index bloat percentage
   */
  private async getIndexBloat(indexName: string): Promise<number> {
    try {
      const result = await client.query(`
        SELECT
          pg_relation_size(indexrelid) as actual_size,
          pg_total_relation_size(indexrelid) as total_size
        FROM pg_stat_user_indexes
        WHERE indexrelid = (
          SELECT oid FROM pg_class WHERE relname = $1
        )
      `, [indexName]);

      if (result.length === 0) return 0;

      const { actual_size, total_size } = result[0];

      return total_size > 0 ? (total_size - actual_size) / total_size : 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Generate index optimization report
   */
  async generateOptimizationReport(): Promise<string> {
    const analysisResults = await this.analyzeIndexes();
    const recommendations = await this.getIndexRecommendations();

    const optimalIndexes = analysisResults.filter(r => r.status === 'optimal');
    const underutilizedIndexes = analysisResults.filter(r => r.status === 'underutilized');
    const redundantIndexes = analysisResults.filter(r => r.status === 'redundant');

    const totalSize = analysisResults.reduce((sum, r) => sum + r.size, 0);
    const unusedSize = underutilizedIndexes.reduce((sum, r) => sum + r.size, 0);

    const report = `
Database Index Optimization Report
Generated: ${new Date().toISOString()}

=== INDEX OVERVIEW ===
Total Indexes: ${analysisResults.length}
Optimal Indexes: ${optimalIndexes.length}
Underutilized Indexes: ${underutilizedIndexes.length}
Redundant Indexes: ${redundantIndexes.length}
Total Size: ${totalSize.toFixed(2)} MB
Unused Space: ${unusedSize.toFixed(2)} MB (${((unusedSize / totalSize) * 100).toFixed(1)}%)

=== RECOMMENDATIONS ===
${recommendations.map(rec => `• ${rec}`).join('\n')}

=== UNDERUTILIZED INDEXES ===
${underutilizedIndexes.map(index => `
• ${index.indexName} (${index.tableName})
  Size: ${index.size.toFixed(2)} MB
  Scans: ${index.usage.scans}
  Cache Hit Ratio: ${(index.efficiency.cacheHitRatio * 100).toFixed(1)}%
  Recommendations: ${index.recommendations.join(', ')}
`).join('')}

=== REDUNDANT INDEXES ===
${redundantIndexes.map(index => `
• ${index.indexName} (${index.tableName})
  Size: ${index.size.toFixed(2)} MB
  ${index.recommendations.join(', ')}
`).join('')}
`;

    return report;
  }
}

// Export singleton instance
export const enhancedDatabaseIndexes = new EnhancedDatabaseIndexes();