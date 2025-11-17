/**
 * Central API Configuration for WorkshopsAI CMS
 *
 * This module provides unified configuration for all API clients,
 * ensuring consistent behavior across the application.
 */

export interface ApiConfig {
  baseURL: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  enableCache: boolean;
  enableLogging: boolean;
}

export const DEFAULT_API_CONFIG: ApiConfig = {
  // Use Vite proxy in development, direct URL in production
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30000, // 30 seconds - increased from 10s for large operations
  retryAttempts: 3,
  retryDelay: 1000, // 1 second base delay
  enableCache: true,
  enableLogging: import.meta.env.DEV
};

export const API_ENDPOINTS = {
  // Authentication endpoints
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh',
    ME: '/auth/me',
    FORGOT_PASSWORD: '/auth/forgot-password',
    RESET_PASSWORD: '/auth/reset-password'
  },

  // Workshop endpoints
  WORKSHOPS: {
    BASE: '/workshops',
    LIST: '/workshops',
    CREATE: '/workshops',
    UPDATE: (id: string) => `/workshops/${id}`,
    DELETE: (id: string) => `/workshops/${id}`,
    PUBLISH: (id: string) => `/workshops/${id}/publish`,
    CHECKLIST: (id: string) => `/workshops/${id}/publish-checklist`,
    DUPLICATE: (id: string) => `/workshops/${id}/duplicate`,
    EXPORT: (id: string) => `/workshops/${id}/export`,
    IMPORT: '/workshops/import',
    GENERATE_SLUG: '/workshops/utils/generate-slug',
    VALIDATE: '/workshops/utils/validate',
    UPLOAD_IMAGE: '/workshops/upload/image'
  },

  // Session endpoints
  SESSIONS: {
    BASE: (workshopId: string) => `/workshops/${workshopId}/sessions`,
    CREATE: (workshopId: string) => `/workshops/${workshopId}/sessions`,
    UPDATE: (workshopId: string, sessionId: string) => `/workshops/${workshopId}/sessions/${sessionId}`,
    DELETE: (workshopId: string, sessionId: string) => `/workshops/${workshopId}/sessions/${sessionId}`,
    REORDER: (workshopId: string) => `/workshops/${workshopId}/sessions/reorder`
  },

  // Module endpoints
  MODULES: {
    BASE: (workshopId: string, sessionId: string) => `/workshops/${workshopId}/sessions/${sessionId}/modules`,
    CREATE: (workshopId: string, sessionId: string) => `/workshops/${workshopId}/sessions/${sessionId}/modules`,
    UPDATE: (workshopId: string, sessionId: string, moduleId: string) => `/workshops/${workshopId}/sessions/${sessionId}/modules/${moduleId}`,
    DELETE: (workshopId: string, sessionId: string, moduleId: string) => `/workshops/${workshopId}/sessions/${sessionId}/modules/${moduleId}`,
    REORDER: (workshopId: string, sessionId: string) => `/workshops/${workshopId}/sessions/${sessionId}/modules/reorder`
  },

  // Dashboard endpoints
  DASHBOARD: {
    METRICS: '/dashboard/metrics',
    ANALYTICS: '/dashboard/analytics',
    ACTIVITY: '/dashboard/activity'
  },

  // Questionnaire endpoints
  QUESTIONNAIRES: {
    BASE: '/questionnaires',
    LIST: '/questionnaires',
    CREATE: '/questionnaires',
    UPDATE: (id: string) => `/questionnaires/${id}`,
    DELETE: (id: string) => `/questionnaires/${id}`,
    PUBLISH: (id: string) => `/questionnaires/${id}/publish`,
    RESPONSES: (id: string) => `/questionnaires/${id}/responses`
  }
} as const;

export const HTTP_STATUS_CODES = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
} as const;

export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your connection.',
  SERVER_ERROR: 'Server error occurred. Please try again later.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  FORBIDDEN: 'You do not have permission to access this resource.',
  NOT_FOUND: 'The requested resource was not found.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  RATE_LIMITED: 'Too many requests. Please wait and try again.',
  SERVICE_UNAVAILABLE: 'Service temporarily unavailable. Please try again later.'
} as const;

/**
 * Configuration for different service types
 */
export const SERVICE_CONFIGS = {
  auth: {
    timeout: 15000, // Auth operations typically faster
    retryAttempts: 2, // Less retry for auth
    enableCache: false // Never cache auth requests
  },
  workshops: {
    timeout: 30000, // Longer timeout for large workshop data
    retryAttempts: 3,
    enableCache: true
  },
  dashboard: {
    timeout: 20000,
    retryAttempts: 2,
    enableCache: true // Dashboard data can be cached briefly
  },
  upload: {
    timeout: 60000, // Long timeout for file uploads
    retryAttempts: 1, // Minimal retry for uploads
    enableCache: false
  }
} as const;

/**
 * Validate API configuration
 */
export function validateApiConfig(config: Partial<ApiConfig>): ApiConfig {
  const finalConfig = { ...DEFAULT_API_CONFIG, ...config };

  if (!finalConfig.baseURL) {
    throw new Error('API baseURL is required');
  }

  if (finalConfig.timeout < 1000) {
    console.warn('API timeout too low, setting minimum 1000ms');
    finalConfig.timeout = 1000;
  }

  if (finalConfig.retryAttempts < 0 || finalConfig.retryAttempts > 5) {
    console.warn('Retry attempts should be between 0 and 5');
    finalConfig.retryAttempts = Math.max(0, Math.min(5, finalConfig.retryAttempts));
  }

  return finalConfig;
}