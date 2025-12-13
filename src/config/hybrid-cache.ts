import { HybridCacheConfig } from '../services/hybrid-cache/hybrid-cache';

/**
 * Default configuration for the hybrid cache system
 */
export const defaultHybridCacheConfig: HybridCacheConfig = {
  L1: {
    // In-memory cache configuration
    maxSize: 10000, // Maximum number of entries
    maxMemory: 200 * 1024 * 1024, // 200MB maximum memory usage
    ttl: 3600, // Default TTL of 1 hour
  },
  L2: {
    // PostgreSQL cache configuration
    defaultTTL: 7200, // Default TTL of 2 hours
    maxConnections: 5, // Maximum number of DB connections
    batchSize: 100, // Batch operation size
    schema: 'public',
    tableName: 'cache_entries',
    compressionThreshold: 1024, // Compress values larger than 1KB
  },
  L3: {
    // Database materialized views configuration
    refreshInterval: 1800, // Refresh every 30 minutes
    maxAge: 86400, // Maximum age of 24 hours
  },
  warming: {
    // Cache warming configuration
    enabled: true,
    interval: 5, // Warm every 5 minutes
    maxConcurrency: 3, // Maximum concurrent warming operations
    batchSize: 50, // Batch size for warming operations
    maxRetries: 3,
    retryDelay: 1000, // milliseconds
  },
  circuitBreaker: {
    // Circuit breaker configuration
    enabled: true,
    threshold: 5, // Failure threshold
    timeout: 30000, // Circuit open timeout (30 seconds)
    resetTimeout: 60000, // Reset attempt timeout (1 minute)
  },
};

/**
 * Environment-specific cache configurations
 */
export const getHybridCacheConfig = (): HybridCacheConfig => {
  const env = process.env.NODE_ENV || 'development';

  const baseConfig = { ...defaultHybridCacheConfig };

  // Override based on environment
  switch (env) {
    case 'production':
      return {
        ...baseConfig,
        L1: {
          ...baseConfig.L1,
          maxSize: 50000, // More entries in production
          maxMemory: 500 * 1024 * 1024, // 500MB memory
          ttl: 7200, // 2 hours TTL
        },
        L2: {
          ...baseConfig.L2,
          defaultTTL: 14400, // 4 hours TTL
          maxConnections: 10,
        },
        warming: {
          ...baseConfig.warming,
          enabled: true,
          interval: 3, // More frequent warming
          maxConcurrency: 5,
        },
      };

    case 'staging':
      return {
        ...baseConfig,
        L1: {
          ...baseConfig.L1,
          maxSize: 20000,
          maxMemory: 300 * 1024 * 1024, // 300MB
        },
        L2: {
          ...baseConfig.L2,
          maxConnections: 7,
        },
      };

    case 'test':
      return {
        ...baseConfig,
        L1: {
          ...baseConfig.L1,
          maxSize: 1000,
          maxMemory: 50 * 1024 * 1024, // 50MB
          ttl: 60, // 1 minute for tests
        },
        L2: {
          ...baseConfig.L2,
          defaultTTL: 120, // 2 minutes for tests
          maxConnections: 2,
        },
        warming: {
          ...baseConfig.warming,
          enabled: false, // Disable warming in tests
        },
        circuitBreaker: {
          ...baseConfig.circuitBreaker,
          enabled: false, // Disable circuit breaker in tests
        },
      };

    default: // development
      return {
        ...baseConfig,
        L1: {
          ...baseConfig.L1,
          maxSize: 5000,
          maxMemory: 100 * 1024 * 1024, // 100MB
          ttl: 1800, // 30 minutes
        },
        L2: {
          ...baseConfig.L2,
          defaultTTL: 3600, // 1 hour
          maxConnections: 3,
        },
      };
  }
};

/**
 * Cache key patterns for different data types
 */
export const cacheKeyPatterns = {
  // User-related
  user: {
    profile: (userId: string) => `user:${userId}:profile`,
    preferences: (userId: string) => `user:${userId}:preferences`,
    permissions: (userId: string) => `user:${userId}:permissions`,
    sessions: (userId: string) => `user:${userId}:sessions`,
  },

  // Session-related
  session: {
    data: (sessionId: string) => `session:${sessionId}`,
    user: (userId: string) => `sessions:user:${userId}`,
    active: 'sessions:active',
  },

  // Authentication
  auth: {
    attempts: (identifier: string, ip: string) => `auth:attempts:${identifier}:${ip}`,
    locks: (identifier: string) => `auth:locks:${identifier}`,
    tokens: (tokenId: string) => `auth:token:${tokenId}`,
  },

  // Workshop-related
  workshop: {
    byId: (id: string) => `workshop:${id}`,
    bySlug: (slug: string) => `workshop:slug:${slug}`,
    list: (filters: any) => `workshops:list:${JSON.stringify(filters)}`,
    popular: 'workshops:popular',
    recent: 'workshops:recent',
  },

  // Questionnaire-related
  questionnaire: {
    byId: (id: string) => `questionnaire:${id}`,
    responses: (questionnaireId: string) => `questionnaire:${questionnaireId}:responses`,
    analytics: (questionnaireId: string) => `questionnaire:${questionnaireId}:analytics`,
  },

  // Enrollment-related
  enrollment: {
    byId: (id: string) => `enrollment:${id}`,
    byUser: (userId: string) => `enrollments:user:${userId}`,
    byWorkshop: (workshopId: string) => `enrollments:workshop:${workshopId}`,
    stats: (workshopId: string) => `enrollments:stats:${workshopId}`,
  },

  // Content-related
  content: {
    byId: (id: string) => `content:${id}`,
    byType: (type: string) => `content:type:${type}`,
    byWorkshop: (workshopId: string) => `content:workshop:${workshopId}`,
  },

  // Analytics
  analytics: {
    dashboard: 'analytics:dashboard',
    reports: (type: string, period: string) => `analytics:reports:${type}:${period}`,
    metrics: (metric: string) => `analytics:metrics:${metric}`,
  },

  // System configuration
  config: {
    system: 'config:system',
    features: 'config:features',
    settings: (key: string) => `config:settings:${key}`,
  },

  // Rate limiting
  rateLimit: {
    global: (window: string) => `ratelimit:global:${window}`,
    user: (userId: string, window: string) => `ratelimit:user:${userId}:${window}`,
    ip: (ip: string, window: string) => `ratelimit:ip:${ip}:${window}`,
  },

  // API responses
  api: {
    response: (method: string, path: string, params?: any) => {
      const key = `api:${method}:${path}`;
      return params ? `${key}:${JSON.stringify(params)}` : key;
    },
   Paginated: (endpoint: string, page: number) => `api:paginated:${endpoint}:${page}`,
  },

  // Search results
  search: {
    results: (query: string, filters: any) => `search:results:${query}:${JSON.stringify(filters)}`,
    suggestions: 'search:suggestions',
    popular: 'search:popular',
  },

  // Notifications
  notification: {
    user: (userId: string) => `notifications:user:${userId}`,
    unread: (userId: string) => `notifications:unread:${userId}`,
    settings: (userId: string) => `notifications:settings:${userId}`,
  },
};

/**
 * Cache tags for batch invalidation
 */
export const cacheTags = {
  user: (userId: string) => `user:${userId}`,
  workshop: (workshopId: string) => `workshop:${workshopId}`,
  questionnaire: (questionnaireId: string) => `questionnaire:${questionnaireId}`,
  enrollment: (enrollmentId: string) => `enrollment:${enrollmentId}`,

  // Generic tags
  sessions: 'sessions',
  authentication: 'authentication',
  permissions: 'permissions',
  analytics: 'analytics',
  configuration: 'configuration',
  content: 'content',
  notifications: 'notifications',

  // Functional tags
  api: 'api',
  search: 'search',
  reports: 'reports',
  dashboard: 'dashboard',
  public: 'public',
  private: 'private',

  // Temporal tags
  hourly: 'hourly',
  daily: 'daily',
  weekly: 'weekly',
  monthly: 'monthly',
};

/**
 * Default TTL values for different data types (in seconds)
 */
export const defaultTTL = {
  // Very short term (minutes)
  rateLimit: 900, // 15 minutes
  authAttempts: 900,

  // Short term (hour)
  session: 3600,
  apiResponse: 1800,
  searchResults: 1800,

  // Medium term (hours)
  userProfile: 7200,
  userPreferences: 14400,
  workshopList: 3600,
  analytics: 3600,

  // Long term (days)
  systemConfig: 86400,
  featureFlags: 43200,
  popularContent: 86400,

  // Very long term (week)
  staticContent: 604800,
  archivalData: 604800,
};

/**
 * Cache warming strategies
 */
export const warmingStrategies = {
  // User-specific warming
  activeUsers: {
    name: 'active_users',
    description: 'Warm cache for currently active users',
    priority: 1,
    patterns: [
      cacheKeyPatterns.user.profile(':active'),
      cacheKeyPatterns.user.preferences(':active'),
      cacheKeyPatterns.user.permissions(':active'),
    ],
  },

  // Popular content
  popularWorkshops: {
    name: 'popular_workshops',
    description: 'Warm cache for popular workshops',
    priority: 2,
    patterns: [
      cacheKeyPatterns.workshop.popular,
      cacheKeyPatterns.workshop.list({ featured: true }),
    ],
  },

  // System configuration
  systemConfig: {
    name: 'system_config',
    description: 'Warm system configuration cache',
    priority: 3,
    patterns: [
      cacheKeyPatterns.config.system,
      cacheKeyPatterns.config.features,
    ],
  },

  // Analytics dashboard
  analyticsDashboard: {
    name: 'analytics_dashboard',
    description: 'Warm analytics dashboard data',
    priority: 4,
    patterns: [
      cacheKeyPatterns.analytics.dashboard,
      cacheKeyPatterns.analytics.metrics('overview'),
    ],
  },
};

/**
 * Cache invalidation rules
 */
export const invalidationRules = {
  // User-related invalidations
  userUpdate: [
    (userId: string) => ({ key: cacheKeyPatterns.user.profile(userId), tags: [cacheTags.user(userId)] }),
    (userId: string) => ({ key: cacheKeyPatterns.user.permissions(userId), tags: [cacheTags.user(userId)] }),
  ],

  // Workshop-related invalidations
  workshopUpdate: [
    (workshopId: string) => ({ key: cacheKeyPatterns.workshop.byId(workshopId), tags: [cacheTags.workshop(workshopId)] }),
    () => ({ key: cacheKeyPatterns.workshop.popular, tags: ['workshops'] }),
    () => ({ key: cacheKeyPatterns.workshop.list({}), tags: ['workshops'] }),
  ],

  // Enrollment-related invalidations
  enrollmentUpdate: [
    (enrollmentId: string) => ({ key: cacheKeyPatterns.enrollment.byId(enrollmentId), tags: [cacheTags.enrollment(enrollmentId)] }),
    (userId: string) => ({ key: cacheKeyPatterns.enrollment.byUser(userId), tags: [cacheTags.user(userId)] }),
    (workshopId: string) => ({ key: cacheKeyPatterns.enrollment.byWorkshop(workshopId), tags: [cacheTags.workshop(workshopId)] }),
    (workshopId: string) => ({ key: cacheKeyPatterns.enrollment.stats(workshopId), tags: [cacheTags.workshop(workshopId)] }),
  ],

  // System configuration invalidations
  configUpdate: [
    () => ({ key: cacheKeyPatterns.config.system, tags: [cacheTags.configuration] }),
    () => ({ key: cacheKeyPatterns.config.features, tags: [cacheTags.configuration] }),
    () => ({ key: 'feature:*', tags: [cacheTags.configuration] }),
  ],
};