/**
 * Rate Limiting System - Core Types and Interfaces
 *
 * Provides high-performance rate limiting without Redis dependency
 * Supports in-memory and PostgreSQL-based distributed rate limiting
 */

export interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  limit: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Burst capacity (temporary allowance for traffic spikes) */
  burstCapacity?: number;
  /** Penalty duration in milliseconds for violators */
  penaltyMs?: number;
  /** Whether to track this endpoint in analytics */
  trackAnalytics?: boolean;
  /** Custom key generator function */
  keyGenerator?: (req: any) => string;
  /** Skip successful requests from counting */
  skipSuccessfulRequests?: boolean;
  /** Skip failed requests from counting */
  skipFailedRequests?: boolean;
}

export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Total limit for the window */
  limit: number;
  /** Current request count */
  current: number;
  /** Remaining requests allowed */
  remaining: number;
  /** Time until window resets in milliseconds */
  resetTime: number;
  /** Time until penalty expires in milliseconds (if applicable) */
  penaltyTime?: number;
  /** Whether this is a penalty box hit */
  isPenalty?: boolean;
}

export interface RateLimitWindow {
  /** Window start timestamp */
  start: number;
  /** Window end timestamp */
  end: number;
  /** Request count in this window */
  count: number;
  /** Burst requests count */
  burstCount: number;
}

export interface PenaltyBox {
  /** Penalty expiry timestamp */
  expiresAt: number;
  /** Penalty reason */
  reason: string;
  /** Number of violations */
  violations: number;
  /** Original rate limit config */
  originalConfig?: RateLimitConfig;
}

export interface SystemLoadMetrics {
  /** CPU usage percentage (0-100) */
  cpuUsage: number;
  /** Memory usage percentage (0-100) */
  memoryUsage: number;
  /** Active connections count */
  activeConnections: number;
  /** Request queue length */
  queueLength: number;
  /** Average response time in milliseconds */
  avgResponseTime: number;
  /** Error rate percentage (0-100) */
  errorRate: number;
}

export interface RateLimitAnalytics {
  /** Total requests processed */
  totalRequests: number;
  /** Blocked requests count */
  blockedRequests: number;
  /** Penalty box hits count */
  penaltyHits: number;
  /** Average requests per window */
  avgRequestsPerWindow: number;
  /** Peak requests per window */
  peakRequestsPerWindow: number;
  /** Current active windows count */
  activeWindows: number;
  /** Memory usage in bytes */
  memoryUsage: number;
  /** Last reset timestamp */
  lastReset: number;
}

export interface RateLimitRule {
  /** Rule identifier */
  id: string;
  /** Route pattern (regex or string) */
  pattern: string | RegExp;
  /** Rate limit configuration */
  config: RateLimitConfig;
  /** Priority (higher = more specific) */
  priority: number;
  /** Whether this rule is enabled */
  enabled: boolean;
  /** User roles this rule applies to */
  roles?: string[];
  /** IP ranges this rule applies to */
  ipRanges?: string[];
  /** Custom matching function */
  matcher?: (req: any) => boolean;
}

export interface AdaptiveRateLimitConfig extends RateLimitConfig {
  /** Base configuration */
  baseConfig: RateLimitConfig;
  /** Load threshold for adaptation (0-1) */
  loadThreshold: number;
  /** Reduction factor when under load (0-1) */
  reductionFactor: number;
  /** Expansion factor when load is low (1-2) */
  expansionFactor: number;
  /** Minimum allowed requests */
  minRequests: number;
  /** Maximum allowed requests */
  maxRequests: number;
  /** Adaptation window in milliseconds */
  adaptationWindowMs: number;
}

export interface DistributedRateLimitEntry {
  /** Unique identifier */
  id: string;
  /** Client identifier */
  clientId: string;
  /** Route identifier */
  routeId: string;
  /** Current request count */
  count: number;
  /** Window start timestamp */
  windowStart: number;
  /** Window end timestamp */
  windowEnd: number;
  /** Burst count */
  burstCount: number;
  /** Last updated timestamp */
  lastUpdated: number;
  /** Node identifier for clustering */
  nodeId: string;
  /** Penalty box information */
  penaltyBox?: PenaltyBox;
}

export interface RateLimitStorage {
  /** Get rate limit entry */
  get(key: string): Promise<DistributedRateLimitEntry | null>;
  /** Set rate limit entry */
  set(key: string, entry: DistributedRateLimitEntry, ttlMs?: number): Promise<void>;
  /** Increment request count */
  increment(key: string, windowMs: number, amount?: number): Promise<number>;
  /** Reset rate limit */
  reset(key: string): Promise<void>;
  /** Get penalty box entry */
  getPenalty(key: string): Promise<PenaltyBox | null>;
  /** Set penalty box entry */
  setPenalty(key: string, penalty: PenaltyBox): Promise<void>;
  /** Clear expired entries */
  cleanup(): Promise<number>;
  /** Get analytics data */
  getAnalytics(routeId?: string): Promise<RateLimitAnalytics>;
  /** Close storage connection */
  close(): Promise<void>;
}

export interface RateLimitMiddleware {
  /** Express middleware function */
  (req: any, res: any, next: any): void;
  /** Get current rate limit status */
  getStatus(req: any): Promise<RateLimitResult>;
  /** Reset rate limit for a client */
  resetClient(clientId: string): Promise<void>;
  /** Add client to penalty box */
  addPenalty(clientId: string, reason: string, durationMs: number): Promise<void>;
  /** Remove client from penalty box */
  removePenalty(clientId: string): Promise<void>;
  /** Get analytics */
  getAnalytics(routeId?: string): Promise<RateLimitAnalytics>;
  /** Close middleware */
  close(): Promise<void>;
}

export interface RateLimitStrategy {
  /** Strategy name */
  name: string;
  /** Check rate limit */
  checkLimit(
    key: string,
    config: RateLimitConfig,
    storage: RateLimitStorage
  ): Promise<RateLimitResult>;
  /** Update limit */
  updateLimit(
    key: string,
    config: RateLimitConfig,
    storage: RateLimitStorage,
    success: boolean
  ): Promise<void>;
  /** Reset limit */
  resetLimit(key: string, storage: RateLimitStorage): Promise<void>;
}

export enum RateLimitErrorCode {
  EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  PENALTY_BOX = 'RATE_LIMIT_PENALTY_BOX',
  SYSTEM_OVERLOAD = 'RATE_LIMIT_SYSTEM_OVERLOAD',
  INVALID_CONFIG = 'RATE_LIMIT_INVALID_CONFIG',
  STORAGE_ERROR = 'RATE_LIMIT_STORAGE_ERROR'
}

export interface RateLimitError extends Error {
  code: RateLimitErrorCode;
  retryAfter?: number;
  details?: any;
}