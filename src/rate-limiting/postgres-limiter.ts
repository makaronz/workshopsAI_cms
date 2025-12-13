/**
 * PostgreSQL-Based Distributed Rate Limiter
 *
 * Implements distributed rate limiting using PostgreSQL for multi-node deployments
 * Optimized for high throughput with connection pooling and batch operations
 */

import { RateLimitConfig, RateLimitResult, RateLimitStorage, PenaltyBox, DistributedRateLimitEntry } from './types';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { pgTable, text, integer, bigint, boolean, timestamp, index, primaryKey } from 'drizzle-orm';

// Database schema for rate limiting
const rateLimits = pgTable('rate_limits', {
  id: text('id').primaryKey(),
  clientId: text('client_id').notNull(),
  routeId: text('route_id').notNull(),
  count: integer('count').notNull().default(1),
  windowStart: bigint('window_start', { mode: 'number' }).notNull(),
  windowEnd: bigint('window_end', { mode: 'number' }).notNull(),
  burstCount: integer('burst_count').notNull().default(0),
  lastUpdated: timestamp('last_updated').notNull().defaultNow(),
  nodeId: text('node_id').notNull(),
}, (table) => ({
  clientIdIdx: index('rate_limits_client_id_idx').on(table.clientId),
  routeIdIdx: index('rate_limits_route_id_idx').on(table.routeId),
  windowIdx: index('rate_limits_window_idx').on(table.windowEnd),
  clientRouteIdx: index('rate_limits_client_route_idx').on(table.clientId, table.routeId)
}));

const penaltyBoxes = pgTable('penalty_boxes', {
  id: text('id').primaryKey(),
  clientId: text('client_id').notNull(),
  routeId: text('route_id').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  reason: text('reason').notNull(),
  violations: integer('violations').notNull().default(1),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  clientIdIdx: index('penalty_boxes_client_id_idx').on(table.clientId),
  expiresAtIdx: index('penalty_boxes_expires_at_idx').on(table.expiresAt),
  clientRouteKey: primaryKey({ columns: [table.clientId, table.routeId] })
}));

const rateLimitAnalytics = pgTable('rate_limit_analytics', {
  id: text('id').primaryKey(),
  routeId: text('route_id').notNull(),
  totalRequests: integer('total_requests').notNull().default(0),
  blockedRequests: integer('blocked_requests').notNull().default(0),
  penaltyHits: integer('penalty_hits').notNull().default(0),
  avgRequestsPerWindow: integer('avg_requests_per_window').notNull().default(0),
  peakRequestsPerWindow: integer('peak_requests_per_window').notNull().default(0),
  activeWindows: integer('active_windows').notNull().default(0),
  lastReset: timestamp('last_reset').notNull().defaultNow(),
  date: text('date').notNull(), // YYYY-MM-DD format for partitioning
}, (table) => ({
  routeIdIdx: index('rate_limit_analytics_route_id_idx').on(table.routeId),
  dateIdx: index('rate_limit_analytics_date_idx').on(table.date)
}));

export class PostgresRateLimiter implements RateLimitStorage {
  private db: ReturnType<typeof drizzle>;
  private sql: ReturnType<typeof postgres>;
  private nodeId: string;
  private cleanupTimer: NodeJS.Timeout;

  constructor(connectionString: string, options: {
    nodeId?: string;
    cleanupIntervalMs?: number;
    maxConnections?: number;
  } = {}) {
    this.nodeId = options.nodeId || `node-${process.pid}-${Date.now()}`;

    // Configure PostgreSQL connection with pooling
    this.sql = postgres(connectionString, {
      max: options.maxConnections || 20,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false, // Disable prepared statements for better performance
    });

    this.db = drizzle(this.sql);

    // Start cleanup timer
    const cleanupIntervalMs = options.cleanupIntervalMs || 300000; // 5 minutes
    this.cleanupTimer = setInterval(() => {
      this.cleanup().catch(console.error);
    }, cleanupIntervalMs);

    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Initialize database tables
   */
  async initialize(): Promise<void> {
    try {
      // Create tables if they don't exist
      await this.sql`
        CREATE TABLE IF NOT EXISTS rate_limits (
          id TEXT PRIMARY KEY,
          client_id TEXT NOT NULL,
          route_id TEXT NOT NULL,
          count INTEGER NOT NULL DEFAULT 1,
          window_start BIGINT NOT NULL,
          window_end BIGINT NOT NULL,
          burst_count INTEGER NOT NULL DEFAULT 0,
          last_updated TIMESTAMP NOT NULL DEFAULT NOW(),
          node_id TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS rate_limits_client_id_idx ON rate_limits(client_id);
        CREATE INDEX IF NOT EXISTS rate_limits_route_id_idx ON rate_limits(route_id);
        CREATE INDEX IF NOT EXISTS rate_limits_window_idx ON rate_limits(window_end);
        CREATE INDEX IF NOT EXISTS rate_limits_client_route_idx ON rate_limits(client_id, route_id);
      `;

      await this.sql`
        CREATE TABLE IF NOT EXISTS penalty_boxes (
          id TEXT PRIMARY KEY,
          client_id TEXT NOT NULL,
          route_id TEXT NOT NULL,
          expires_at TIMESTAMP NOT NULL,
          reason TEXT NOT NULL,
          violations INTEGER NOT NULL DEFAULT 1,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
          PRIMARY KEY (client_id, route_id)
        );

        CREATE INDEX IF NOT EXISTS penalty_boxes_client_id_idx ON penalty_boxes(client_id);
        CREATE INDEX IF NOT EXISTS penalty_boxes_expires_at_idx ON penalty_boxes(expires_at);
      `;

      await this.sql`
        CREATE TABLE IF NOT EXISTS rate_limit_analytics (
          id TEXT PRIMARY KEY,
          route_id TEXT NOT NULL,
          total_requests INTEGER NOT NULL DEFAULT 0,
          blocked_requests INTEGER NOT NULL DEFAULT 0,
          penalty_hits INTEGER NOT NULL DEFAULT 0,
          avg_requests_per_window INTEGER NOT NULL DEFAULT 0,
          peak_requests_per_window INTEGER NOT NULL DEFAULT 0,
          active_windows INTEGER NOT NULL DEFAULT 0,
          last_reset TIMESTAMP NOT NULL DEFAULT NOW(),
          date TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS rate_limit_analytics_route_id_idx ON rate_limit_analytics(route_id);
        CREATE INDEX IF NOT EXISTS rate_limit_analytics_date_idx ON rate_limit_analytics(date);
      `;

      console.log('✅ PostgreSQL rate limiter initialized');
    } catch (error) {
      console.error('❌ Failed to initialize PostgreSQL rate limiter:', error);
      throw error;
    }
  }

  /**
   * Get rate limit entry
   */
  async get(key: string): Promise<DistributedRateLimitEntry | null> {
    const [clientId, routeId] = key.split(':');

    const result = await this.sql`
      SELECT * FROM rate_limits
      WHERE client_id = ${clientId} AND route_id = ${routeId}
      ORDER BY window_end DESC
      LIMIT 1
    `;

    if (result.length === 0) {
      return null;
    }

    const row = result[0];
    return {
      id: row.id,
      clientId: row.client_id,
      routeId: row.route_id,
      count: row.count,
      windowStart: Number(row.window_start),
      windowEnd: Number(row.window_end),
      burstCount: row.burst_count,
      lastUpdated: new Date(row.last_updated).getTime(),
      nodeId: row.node_id
    };
  }

  /**
   * Set rate limit entry
   */
  async set(key: string, entry: DistributedRateLimitEntry, ttlMs?: number): Promise<void> {
    const expiresAt = ttlMs ? Date.now() + ttlMs : entry.windowEnd;

    await this.sql`
      INSERT INTO rate_limits (
        id, client_id, route_id, count, window_start, window_end,
        burst_count, last_updated, node_id
      ) VALUES (
        ${entry.id}, ${entry.clientId}, ${entry.routeId}, ${entry.count},
        ${entry.windowStart}, ${entry.windowEnd}, ${entry.burstCount},
        ${new Date(entry.lastUpdated).toISOString()}, ${entry.nodeId}
      )
      ON CONFLICT (id) DO UPDATE SET
        count = EXCLUDED.count,
        burst_count = EXCLUDED.burst_count,
        last_updated = EXCLUDED.last_updated
    `;
  }

  /**
   * Increment request count atomically
   */
  async increment(key: string, windowMs: number, amount: number = 1): Promise<number> {
    const [clientId, routeId] = key.split(':');
    const now = Date.now();
    const windowEnd = now + windowMs;
    const windowStart = windowEnd - windowMs;
    const id = `${key}:${Math.floor(windowStart / 1000)}`; // Per-second bucket

    // Atomic increment using PostgreSQL's UPSERT
    const result = await this.sql`
      INSERT INTO rate_limits (
        id, client_id, route_id, count, window_start, window_end,
        burst_count, last_updated, node_id
      ) VALUES (
        ${id}, ${clientId}, ${routeId}, ${amount},
        ${windowStart}, ${windowEnd}, 0,
        ${new Date(now).toISOString()}, ${this.nodeId}
      )
      ON CONFLICT (id) DO UPDATE SET
        count = rate_limits.count + EXCLUDED.count,
        last_updated = EXCLUDED.last_updated,
        node_id = EXCLUDED.node_id
      RETURNING count
    `;

    const count = result[0]?.count || amount;

    // Update analytics
    await this.updateAnalytics(routeId, false, false);

    return count;
  }

  /**
   * Reset rate limit for a client
   */
  async reset(key: string): Promise<void> {
    const [clientId, routeId] = key.split(':');

    await this.sql`
      DELETE FROM rate_limits
      WHERE client_id = ${clientId} AND route_id = ${routeId}
    `;
  }

  /**
   * Get penalty box entry
   */
  async getPenalty(key: string): Promise<PenaltyBox | null> {
    const [clientId, routeId] = key.split(':');

    const result = await this.sql`
      SELECT * FROM penalty_boxes
      WHERE client_id = ${clientId} AND route_id = ${routeId}
        AND expires_at > NOW()
    `;

    if (result.length === 0) {
      return null;
    }

    const row = result[0];
    return {
      expiresAt: new Date(row.expires_at).getTime(),
      reason: row.reason,
      violations: row.violations
    };
  }

  /**
   * Set penalty box entry
   */
  async setPenalty(key: string, penalty: PenaltyBox): Promise<void> {
    const [clientId, routeId] = key.split(':');
    const id = `${key}:penalty`;

    await this.sql`
      INSERT INTO penalty_boxes (
        id, client_id, route_id, expires_at, reason, violations
      ) VALUES (
        ${id}, ${clientId}, ${routeId}, ${new Date(penalty.expiresAt).toISOString()},
        ${penalty.reason}, ${penalty.violations}
      )
      ON CONFLICT (client_id, route_id) DO UPDATE SET
        expires_at = EXCLUDED.expires_at,
        reason = EXCLUDED.reason,
        violations = EXCLUDED.violations,
        updated_at = NOW()
    `;

    // Update analytics
    await this.updateAnalytics(routeId, false, true);
  }

  /**
   * Cleanup expired entries
   */
  async cleanup(): Promise<number> {
    const now = new Date().toISOString();

    // Clean expired rate limits
    const rateLimitsResult = await this.sql`
      DELETE FROM rate_limits
      WHERE window_end < ${now}
      RETURNING id
    `;

    // Clean expired penalty boxes
    const penaltiesResult = await this.sql`
      DELETE FROM penalty_boxes
      WHERE expires_at < ${now}
      RETURNING id
    `;

    const totalCleaned = rateLimitsResult.length + penaltiesResult.length;

    if (totalCleaned > 0) {
      console.log(`🧹 Cleaned up ${totalCleaned} expired rate limit entries`);
    }

    return totalCleaned;
  }

  /**
   * Update analytics data
   */
  private async updateAnalytics(
    routeId: string,
    blocked: boolean = false,
    penaltyHit: boolean = false
  ): Promise<void> {
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const id = `${routeId}:${date}`;

    await this.sql`
      INSERT INTO rate_limit_analytics (
        id, route_id, total_requests, blocked_requests,
        penalty_hits, date
      ) VALUES (
        ${id}, ${routeId}, 1, ${blocked ? 1 : 0},
        ${penaltyHit ? 1 : 0}, ${date}
      )
      ON CONFLICT (id) DO UPDATE SET
        total_requests = rate_limit_analytics.total_requests + 1,
        blocked_requests = rate_limit_analytics.blocked_requests + EXCLUDED.blocked_requests,
        penalty_hits = rate_limit_analytics.penalty_hits + EXCLUDED.penalty_hits
    `;
  }

  /**
   * Get analytics data
   */
  async getAnalytics(routeId?: string): Promise<any> {
    const date = new Date().toISOString().split('T')[0];

    let query = this.sql`
      SELECT
        route_id,
        SUM(total_requests) as total_requests,
        SUM(blocked_requests) as blocked_requests,
        SUM(penalty_hits) as penalty_hits,
        AVG(avg_requests_per_window) as avg_requests_per_window,
        MAX(peak_requests_per_window) as peak_requests_per_window,
        SUM(active_windows) as active_windows
      FROM rate_limit_analytics
      WHERE date = ${date}
    `;

    if (routeId) {
      query = query.append(this.sql` AND route_id = ${routeId}`);
    }

    const results = await query;

    if (results.length === 0) {
      return {
        totalRequests: 0,
        blockedRequests: 0,
        penaltyHits: 0,
        avgRequestsPerWindow: 0,
        peakRequestsPerWindow: 0,
        activeWindows: 0,
        lastReset: Date.now(),
        memoryUsage: 0
      };
    }

    const row = results[0];

    return {
      totalRequests: Number(row.total_requests || 0),
      blockedRequests: Number(row.blocked_requests || 0),
      penaltyHits: Number(row.penalty_hits || 0),
      avgRequestsPerWindow: Number(row.avg_requests_per_window || 0),
      peakRequestsPerWindow: Number(row.peak_requests_per_window || 0),
      activeWindows: Number(row.active_windows || 0),
      lastReset: Date.now(),
      memoryUsage: this.getMemoryUsage()
    };
  }

  /**
   * Estimate memory usage
   */
  private getMemoryUsage(): number {
    // Rough estimation based on connection pool
    const connectionSize = 1024 * 1024; // 1MB per connection
    return connectionSize * (this.sql as any).options.max || 20 * 1024 * 1024;
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(): Promise<any> {
    // Get database performance metrics
    const dbStats = await this.sql`
      SELECT
        schemaname,
        tablename,
        seq_scan,
        seq_tup_read,
        idx_scan,
        idx_tup_fetch
      FROM pg_stat_user_tables
      WHERE tablename IN ('rate_limits', 'penalty_boxes', 'rate_limit_analytics')
    `;

    // Get connection pool status
    const poolStats = await this.sql`SHOW max_connections;`;

    return {
      databaseStats: dbStats,
      maxConnections: poolStats[0]?.max_connections || 'unknown',
      nodeId: this.nodeId
    };
  }

  /**
   * Close storage connection
   */
  async close(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    if (this.sql) {
      await this.sql.end();
    }
  }
}