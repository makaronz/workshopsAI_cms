/**
 * API Performance Optimization Middleware
 *
 * Advanced optimization layer for tRPC and REST APIs including:
 * - Request batching and deduplication
 * - Smart response compression
 * - GraphQL-style query optimization
 * - Request caching strategies
 * - Response transformation optimization
 */

import { Request, Response, NextFunction } from 'express';
import compression from 'compression';
import { ZodSchema } from 'zod';
import { enhancedCachingService } from '../services/enhanced-caching-service';
import { logger } from '../utils/logger';

export interface ApiOptimizationConfig {
  enableBatching: boolean;
  batchSize: number;
  batchTimeout: number;
  enableCompression: boolean;
  compressionThreshold: number;
  enableDeduplication: boolean;
  deduplicationWindow: number;
  enableResponseCache: boolean;
  responseCacheTTL: number;
}

class ApiOptimizationMiddleware {
  private config: ApiOptimizationConfig;
  private pendingRequests = new Map<string, Promise<any>>();
  private batchedRequests = new Map<string, {
    requests: Array<{
      req: Request;
      res: Response;
      resolve: (data: any) => void;
      reject: (error: any) => void;
    }>;
    timeout: NodeJS.Timeout;
  }>();

  constructor(config: Partial<ApiOptimizationConfig> = {}) {
    this.config = {
      enableBatching: true,
      batchSize: 10,
      batchTimeout: 50, // ms
      enableCompression: true,
      compressionThreshold: 1024, // bytes
      enableDeduplication: true,
      deduplicationWindow: 1000, // ms
      enableResponseCache: true,
      responseCacheTTL: 300, // seconds
      ...config,
    };
  }

  /**
   * Request deduplication middleware
   * Prevents duplicate requests from being processed
   */
  requestDeduplication() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!this.config.enableDeduplication || req.method !== 'GET') {
        return next();
      }

      const deduplicationKey = this.generateDeduplicationKey(req);
      const existingRequest = this.pendingRequests.get(deduplicationKey);

      if (existingRequest) {
        logger.debug('Request deduplicated', { key: deduplicationKey, url: req.url });

        existingRequest
          .then((data) => res.json(data))
          .catch((error) => next(error));

        return;
      }

      // Create new request promise
      const requestPromise = new Promise((resolve, reject) => {
        // Override res.json to capture response
        const originalJson = res.json;
        res.json = function(data: any) {
          resolve(data);
          return originalJson.call(this, data);
        };

        // Handle errors
        res.on('error', reject);

        // Set timeout for deduplication window
        setTimeout(() => {
          this.pendingRequests.delete(deduplicationKey);
        }, this.config.deduplicationWindow);
      });

      this.pendingRequests.set(deduplicationKey, requestPromise);
      next();
    };
  }

  /**
   * Request batching middleware
   * Combines similar requests into single operations
   */
  requestBatching() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!this.config.enableBatching || !this.canBatchRequest(req)) {
        return next();
      }

      const batchKey = this.generateBatchKey(req);
      const existingBatch = this.batchedRequests.get(batchKey);

      if (existingBatch) {
        // Add to existing batch
        const batchPromise = new Promise((resolve, reject) => {
          existingBatch.requests.push({ req, res, resolve, reject });
        });

        // Check if batch should be processed
        if (existingBatch.requests.length >= this.config.batchSize) {
          this.processBatch(batchKey);
        }

        return batchPromise;
      }

      // Create new batch
      const newBatch = {
        requests: [{ req, res, resolve: null!, reject: null! }],
        timeout: setTimeout(() => {
          this.processBatch(batchKey);
        }, this.config.batchTimeout),
      };

      this.batchedRequests.set(batchKey, newBatch);

      return new Promise((resolve, reject) => {
        newBatch.requests[0].resolve = resolve;
        newBatch.requests[0].reject = reject;
      });
    };
  }

  /**
   * Smart response compression
   */
  smartCompression() {
    return compression({
      threshold: this.config.compressionThreshold,
      filter: (req, res) => {
        // Skip compression for already compressed content
        const contentType = res.getHeader('content-type');
        if (contentType && (contentType as string).includes('gzip')) {
          return false;
        }

        // Skip compression for small responses
        const contentLength = res.getHeader('content-length');
        if (contentLength && parseInt(contentLength as string) < this.config.compressionThreshold) {
          return false;
        }

        return true;
      },
    });
  }

  /**
   * Response caching middleware
   */
  responseCache(options: {
    keyGenerator?: (req: Request) => string;
    condition?: (req: Request, res: Response) => boolean;
    ttl?: number;
  } = {}) {
    const {
      keyGenerator = (req) => `response:${req.method}:${req.originalUrl}`,
      condition = (req, res) => req.method === 'GET' && res.statusCode === 200,
      ttl = this.config.responseCacheTTL,
    } = options;

    return async (req: Request, res: Response, next: NextFunction) => {
      if (!this.config.enableResponseCache || req.method !== 'GET') {
        return next();
      }

      const cacheKey = keyGenerator(req);

      try {
        // Check cache first
        const cached = await enhancedCachingService.get(cacheKey, {
          tier: 'L2',
          ttl,
        });

        if (cached) {
          res.setHeader('X-Cache-Hit', 'true');
          res.setHeader('X-Cache-Key', cacheKey);
          return res.json(cached);
        }

        // Intercept response to cache it
        const originalJson = res.json;
        res.json = function(data: any) {
          if (condition(req, res)) {
            enhancedCachingService.set(cacheKey, data, {
              ttl,
              tier: 'L2',
              priority: 'medium',
            });
          }

          res.setHeader('X-Cache-Hit', 'false');
          return originalJson.call(this, data);
        };

        next();
      } catch (error) {
        logger.error('Response cache error:', error);
        next();
      }
    };
  }

  /**
   * Query optimization middleware for complex queries
   */
  queryOptimization() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Optimize query parameters
      if (req.query && typeof req.query === 'object') {
        req.query = this.optimizeQueryParameters(req.query);
      }

      // Add query hints to response headers
      res.setHeader('X-Query-Optimized', 'true');

      next();
    };
  }

  /**
   * Response transformation optimization
   */
  responseTransformation() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Add response size optimization hints
      res.setHeader('X-Response-Optimization', 'enabled');

      // Intercept and optimize response data
      const originalJson = res.json;
      res.json = function(data: any) {
        if (data && typeof data === 'object') {
          data = this.optimizeResponseData(data);
        }

        return originalJson.call(this, data);
      }.bind(this);

      next();
    };
  }

  private generateDeduplicationKey(req: Request): string {
    const key = `${req.method}:${req.originalUrl}:${JSON.stringify(req.query)}`;
    return Buffer.from(key).toString('base64');
  }

  private generateBatchKey(req: Request): string {
    // Extract batch-able endpoint pattern
    const urlPattern = req.originalUrl.replace(/\/[a-f0-9-]{36}/g, '/:id');
    return `${req.method}:${urlPattern}`;
  }

  private canBatchRequest(req: Request): boolean {
    // Only batch GET requests to specific endpoints
    if (req.method !== 'GET') return false;

    const batchableEndpoints = [
      '/api/v1/workshops',
      '/api/v1/questionnaires',
      '/api/v1/responses',
    ];

    return batchableEndpoints.some(endpoint => req.originalUrl.startsWith(endpoint));
  }

  private async processBatch(batchKey: string): Promise<void> {
    const batch = this.batchedRequests.get(batchKey);
    if (!batch) return;

    clearTimeout(batch.timeout);
    this.batchedRequests.delete(batchKey);

    try {
      // Process all requests in batch
      const results = await Promise.allSettled(
        batch.requests.map(({ req }) => this.processBatchedRequest(req))
      );

      // Resolve individual requests
      results.forEach((result, index) => {
        const { resolve, reject, res } = batch.requests[index];

        if (result.status === 'fulfilled') {
          resolve(result.value);
          res.json(result.value);
        } else {
          reject(result.reason);
          res.status(500).json({ error: 'Batch processing failed' });
        }
      });

      logger.debug(`Processed batch of ${batch.requests.length} requests`);
    } catch (error) {
      logger.error('Batch processing failed:', error);

      // Reject all requests in batch
      batch.requests.forEach(({ reject, res }) => {
        reject(error);
        res.status(500).json({ error: 'Batch processing failed' });
      });
    }
  }

  private async processBatchedRequest(req: Request): Promise<any> {
    // This would integrate with your actual data fetching logic
    // For now, simulate a batched database query
    return new Promise(resolve => {
      setTimeout(() => resolve({ batched: true, data: 'mock' }), 10);
    });
  }

  private optimizeQueryParameters(query: any): any {
    const optimized: any = {};

    for (const [key, value] of Object.entries(query)) {
      // Skip empty parameters
      if (value === '' || value === null || value === undefined) {
        continue;
      }

      // Optimize array parameters
      if (Array.isArray(value)) {
        if (value.length > 100) {
          // Limit array size to prevent performance issues
          optimized[key] = value.slice(0, 100);
        } else {
          optimized[key] = value;
        }
        continue;
      }

      // Optimize string parameters
      if (typeof value === 'string') {
        if (value.length > 1000) {
          // Truncate long strings
          optimized[key] = value.substring(0, 1000);
        } else {
          optimized[key] = value;
        }
        continue;
      }

      optimized[key] = value;
    }

    return optimized;
  }

  private optimizeResponseData(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    // Remove null/undefined values to reduce payload size
    if (Array.isArray(data)) {
      return data
        .filter(item => item !== null && item !== undefined)
        .map(item => this.optimizeResponseData(item));
    }

    const optimized: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== null && value !== undefined) {
        optimized[key] = typeof value === 'object' ? this.optimizeResponseData(value) : value;
      }
    }

    return optimized;
  }
}

// Create and export singleton instance
export const apiOptimizationMiddleware = new ApiOptimizationMiddleware();

// Export individual middleware functions
export const requestDeduplication = apiOptimizationMiddleware.requestDeduplication.bind(apiOptimizationMiddleware);
export const requestBatching = apiOptimizationMiddleware.requestBatching.bind(apiOptimizationMiddleware);
export const smartCompression = apiOptimizationMiddleware.smartCompression.bind(apiOptimizationMiddleware);
export const responseCache = apiOptimizationMiddleware.responseCache.bind(apiOptimizationMiddleware);
export const queryOptimization = apiOptimizationMiddleware.queryOptimization.bind(apiOptimizationMiddleware);
export const responseTransformation = apiOptimizationMiddleware.responseTransformation.bind(apiOptimizationMiddleware);