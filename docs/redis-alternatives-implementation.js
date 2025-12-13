/**
 * Redis Alternatives Implementation Examples
 * 
 * This file provides concrete implementations for the most viable
 * Redis alternatives identified in the analysis.
 */

// 1. Enhanced In-Memory Cache with Persistence
class HybridCache {
  constructor(options = {}) {
    this.memoryCache = new Map();
    this.maxSize = options.maxSize || 1000;
    this.persistPath = options.persistPath || './cache.json';
    this.ttlDefault = options.ttlDefault || 3600000; // 1 hour
    
    // Load persisted cache on startup
    this.loadPersisted();
    
    // Persist periodically
    setInterval(() => this.persist(), 60000); // Every minute
  }
  
  set(key, value, ttl = this.ttlDefault) {
    // Enforce size limit
    if (this.memoryCache.size >= this.maxSize) {
      const firstKey = this.memoryCache.keys().next().value;
      this.memoryCache.delete(firstKey);
    }
    
    this.memoryCache.set(key, {
      value,
      expires: Date.now() + ttl,
      accessed: Date.now()
    });
  }
  
  get(key) {
    const item = this.memoryCache.get(key);
    if (!item) return null;
    
    // Check expiration
    if (Date.now() > item.expires) {
      this.memoryCache.delete(key);
      return null;
    }
    
    // Update access time
    item.accessed = Date.now();
    return item.value;
  }
  
  invalidate(key) {
    this.memoryCache.delete(key);
  }
  
  clear() {
    this.memoryCache.clear();
  }
  
  persist() {
    const toPersist = {};
    for (const [key, item] of this.memoryCache) {
      if (Date.now() <= item.expires) {
        toPersist[key] = item;
      }
    }
    
    require('fs').writeFileSync(
      this.persistPath,
      JSON.stringify(toPersist),
      'utf8'
    );
  }
  
  loadPersisted() {
    try {
      const data = require('fs').readFileSync(this.persistPath, 'utf8');
      const parsed = JSON.parse(data);
      
      for (const [key, item] of Object.entries(parsed)) {
        if (Date.now() <= item.expires) {
          this.memoryCache.set(key, item);
        }
      }
    } catch (e) {
      // File doesn't exist or is corrupt
      console.log('No cache file to load');
    }
  }
}

// 2. PostgreSQL-Based Cache Service
class PostgreSQLCache {
  constructor(pool) {
    this.pool = pool;
  }
  
  async init() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS cache_entries (
        key VARCHAR(255) PRIMARY KEY,
        value JSONB NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        tags TEXT[] DEFAULT '{}'
      );
      
      CREATE INDEX IF NOT EXISTS idx_cache_expires ON cache_entries(expires_at);
      CREATE INDEX IF NOT EXISTS idx_cache_tags ON cache_entries USING GIN(tags);
    `);
    
    // Cleanup expired entries periodically
    setInterval(() => this.cleanup(), 300000); // Every 5 minutes
  }
  
  async set(key, value, ttlSeconds = 3600, tags = []) {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    
    await this.pool.query(
      `INSERT INTO cache_entries (key, value, expires_at, tags)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (key) DO UPDATE SET
         value = EXCLUDED.value,
         expires_at = EXCLUDED.expires_at,
         tags = EXCLUDED.tags`,
      [key, JSON.stringify(value), expiresAt, tags]
    );
  }
  
  async get(key) {
    const result = await this.pool.query(
      `SELECT value FROM cache_entries 
       WHERE key = $1 AND expires_at > NOW()`,
      [key]
    );
    
    if (result.rows.length === 0) return null;
    return JSON.parse(result.rows[0].value);
  }
  
  async invalidateByTag(tag) {
    await this.pool.query(
      `DELETE FROM cache_entries WHERE $1 = ANY(tags)`,
      [tag]
    );
  }
  
  async cleanup() {
    await this.pool.query(
      `DELETE FROM cache_entries WHERE expires_at <= NOW()`
    );
  }
}

// 3. Database-Backed Job Queue
class DatabaseJobQueue {
  constructor(pool, name) {
    this.pool = pool;
    this.name = name;
    this.pollInterval = 5000; // 5 seconds
    this.running = false;
  }
  
  async init() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS job_queues (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        queue_name VARCHAR(255) NOT NULL,
        payload JSONB NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        priority INTEGER DEFAULT 0,
        attempts INTEGER DEFAULT 0,
        max_attempts INTEGER DEFAULT 3,
        scheduled_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW(),
        processed_at TIMESTAMP,
        completed_at TIMESTAMP,
        error_message TEXT,
        UNIQUE(queue_name, id)
      );
      
      CREATE INDEX IF NOT EXISTS idx_jobs_queue_status ON job_queues(queue_name, status);
      CREATE INDEX IF NOT EXISTS idx_jobs_scheduled ON job_queues(scheduled_at);
      CREATE INDEX IF NOT EXISTS idx_jobs_priority ON job_queues(priority DESC, scheduled_at);
    `);
  }
  
  async add(jobData, options = {}) {
    const result = await this.pool.query(
      `INSERT INTO job_queues (queue_name, payload, priority, scheduled_at, max_attempts)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        this.name,
        JSON.stringify(jobData),
        options.priority || 0,
        options.delay ? new Date(Date.now() + options.delay) : new Date(),
        options.maxAttempts || 3
      ]
    );
    
    return result.rows[0].id;
  }
  
  async process(handler) {
    this.running = true;
    
    while (this.running) {
      try {
        // Get next job
        const result = await this.pool.query(
          `UPDATE job_queues
           SET status = 'processing', processed_at = NOW()
           WHERE id = (
             SELECT id FROM job_queues
             WHERE queue_name = $1 
               AND status = 'pending'
               AND scheduled_at <= NOW()
             ORDER BY priority DESC, created_at ASC
             LIMIT 1
             FOR UPDATE SKIP LOCKED
           )
           RETURNING *`,
          [this.name]
        );
        
        if (result.rows.length > 0) {
          const job = result.rows[0];
          
          try {
            // Process the job
            await handler(JSON.parse(job.payload));
            
            // Mark as completed
            await this.pool.query(
              `UPDATE job_queues
               SET status = 'completed', completed_at = NOW()
               WHERE id = $1`,
              [job.id]
            );
          } catch (error) {
            // Handle failure
            const attempts = job.attempts + 1;
            
            if (attempts >= job.max_attempts) {
              // Max attempts reached, mark as failed
              await this.pool.query(
                `UPDATE job_queues
                 SET status = 'failed', 
                     attempts = $2,
                     error_message = $3
                 WHERE id = $1`,
                [job.id, attempts, error.message]
              );
            } else {
              // Retry with exponential backoff
              const backoff = Math.pow(2, attempts) * 1000; // 1s, 2s, 4s, etc.
              const retryAt = new Date(Date.now() + backoff);
              
              await this.pool.query(
                `UPDATE job_queues
                 SET status = 'pending',
                     attempts = $2,
                     scheduled_at = $3,
                     error_message = $4
                 WHERE id = $1`,
                [job.id, attempts, retryAt, error.message]
              );
            }
          }
        } else {
          // No jobs, wait
          await new Promise(resolve => setTimeout(resolve, this.pollInterval));
        }
      } catch (error) {
        console.error('Queue processing error:', error);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
  
  stop() {
    this.running = false;
  }
}

// 4. JWT-Based Session Management
class JWTSessionManager {
  constructor(secretKey, options = {}) {
    this.secretKey = secretKey;
    this.options = {
      expiresIn: options.expiresIn || '24h',
      issuer: options.issuer || 'workshopsai',
      audience: options.audience || 'workshopsai-users',
      ...options
    };
  }
  
  generateToken(payload) {
    const jwt = require('jsonwebtoken');
    
    return jwt.sign(
      {
        data: payload,
        iat: Math.floor(Date.now() / 1000)
      },
      this.secretKey,
      {
        expiresIn: this.options.expiresIn,
        issuer: this.options.issuer,
        audience: this.options.audience,
        algorithm: 'HS256'
      }
    );
  }
  
  verifyToken(token) {
    const jwt = require('jsonwebtoken');
    
    try {
      const decoded = jwt.verify(
        token,
        this.secretKey,
        {
          issuer: this.options.issuer,
          audience: this.options.audience,
          algorithms: ['HS256']
        }
      );
      
      return decoded.data;
    } catch (error) {
      throw new Error('Invalid token: ' + error.message);
    }
  }
  
  refreshToken(oldToken) {
    const payload = this.verifyToken(oldToken);
    
    // Generate new token with same payload
    return this.generateToken(payload);
  }
}

// 5. In-Memory Rate Limiter with Sliding Window
class SlidingWindowRateLimiter {
  constructor(windowMs = 900000) { // 15 minutes default
    this.windowMs = windowMs;
    this.clients = new Map();
  }
  
  isAllowed(identifier, limit) {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    if (!this.clients.has(identifier)) {
      this.clients.set(identifier, []);
    }
    
    const requests = this.clients.get(identifier);
    
    // Remove old requests outside the window
    while (requests.length > 0 && requests[0] < windowStart) {
      requests.shift();
    }
    
    // Add current request
    requests.push(now);
    
    // Check if under limit
    return requests.length <= limit;
  }
  
  getRemainingRequests(identifier, limit) {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    if (!this.clients.has(identifier)) {
      return limit;
    }
    
    const requests = this.clients.get(identifier);
    const validRequests = requests.filter(time => time >= windowStart);
    
    return Math.max(0, limit - validRequests.length);
  }
  
  getResetTime(identifier) {
    if (!this.clients.has(identifier)) {
      return 0;
    }
    
    const requests = this.clients.get(identifier);
    if (requests.length === 0) {
      return 0;
    }
    
    const oldestRequest = Math.min(...requests);
    return Math.ceil((oldestRequest + this.windowMs) / 1000);
  }
}

// 6. Usage Example: Putting It All Together
async function initializeAlternativeSystems(dbPool) {
  // Initialize cache
  const cache = new HybridCache({
    maxSize: 2000,
    persistPath: './data/cache.json'
  });
  
  // Initialize database cache for persistence
  const dbCache = new PostgreSQLCache(dbPool);
  await dbCache.init();
  
  // Initialize job queues
  const emailQueue = new DatabaseJobQueue(dbPool, 'email');
  const analysisQueue = new DatabaseJobQueue(dbPool, 'analysis');
  await Promise.all([emailQueue.init(), analysisQueue.init()]);
  
  // Initialize session manager
  const sessionManager = new JWTSessionManager(
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
  
  // Initialize rate limiter
  const rateLimiter = new SlidingWindowRateLimiter(900000); // 15 min
  
  return {
    cache,
    dbCache,
    emailQueue,
    analysisQueue,
    sessionManager,
    rateLimiter
  };
}

// Export for use in application
module.exports = {
  HybridCache,
  PostgreSQLCache,
  DatabaseJobQueue,
  JWTSessionManager,
  SlidingWindowRateLimiter,
  initializeAlternativeSystems
};
