import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { createHash, randomBytes } from 'crypto';
import { securityMonitor, SecurityEventType, SecuritySeverity } from '../services/security-monitoring';

/**
 * Enhanced Security Middleware
 * Comprehensive security implementation with CSRF protection, secure headers, and advanced rate limiting
 * OWASP Top 10 compliance and modern security best practices
 */

// CSRF Token Store (in production, use Redis or database)
interface CSRFToken {
  token: string;
  expires: number;
  sessionId: string;
  userId?: string;
}

const csrfTokens = new Map<string, CSRFToken>();

// Blocked IPs store
const blockedIPs = new Map<string, {
  expires: number;
  reason: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}>();

/**
 * Generate secure CSRF token
 */
export const generateCSRFToken = (sessionId: string, userId?: string): string => {
  const token = randomBytes(32).toString('hex');
  const expires = Date.now() + (60 * 60 * 1000); // 1 hour

  csrfTokens.set(token, {
    token,
    expires,
    sessionId,
    userId
  });

  return token;
};

/**
 * Validate CSRF token
 */
export const validateCSRFToken = (token: string, sessionId: string, userId?: string): boolean => {
  const storedToken = csrfTokens.get(token);

  if (!storedToken) {
    return false;
  }

  // Check expiration
  if (Date.now() > storedToken.expires) {
    csrfTokens.delete(token);
    return false;
  }

  // Check session match
  if (storedToken.sessionId !== sessionId) {
    securityMonitor.recordEvent({
      type: SecurityEventType.CSRF_ATTEMPT,
      severity: SecuritySeverity.HIGH,
      ip: '', // Will be set by middleware
      details: {
        reason: 'Session mismatch',
        providedSessionId: sessionId,
        storedSessionId: storedToken.sessionId
      }
    });
    return false;
  }

  // Check user match if provided
  if (userId && storedToken.userId && storedToken.userId !== userId) {
    securityMonitor.recordEvent({
      type: SecurityEventType.CSRF_ATTEMPT,
      severity: SecuritySeverity.HIGH,
      ip: '', // Will be set by middleware
      details: {
        reason: 'User mismatch',
        providedUserId: userId,
        storedUserId: storedToken.userId
      }
    });
    return false;
  }

  return true;
};

/**
 * Clean up expired CSRF tokens
 */
const cleanupCSRFTokens = (): void => {
  const now = Date.now();
  for (const [token, data] of csrfTokens.entries()) {
    if (now > data.expires) {
      csrfTokens.delete(token);
    }
  }
};

// Run cleanup every 15 minutes
setInterval(cleanupCSRFTokens, 15 * 60 * 1000);

/**
 * Enhanced Content Security Policy
 */
export const getCSP = (nonce?: string) => ({
  directives: {
    defaultSrc: ['\'self\''],
    styleSrc: [
      '\'self\'',
      '\'unsafe-inline\'', // Required for LitElement and component styles
      'https://fonts.googleapis.com',
      'https://fonts.gstatic.com'
    ],
    fontSrc: [
      '\'self\'',
      'https://fonts.gstatic.com',
      'data:'
    ],
    imgSrc: [
      '\'self\'',
      'data:',
      'https:',
      'blob:'
    ],
    scriptSrc: [
      '\'self\'',
      nonce ? `'nonce-${nonce}'` : '\'unsafe-inline\'', // Use nonce when available
      'https://www.googletagmanager.com' // If using analytics
    ].filter(Boolean),
    connectSrc: [
      '\'self\'',
      'ws:',
      'wss:',
      process.env.API_BASE_URL // Allow API calls
    ].filter(Boolean),
    frameSrc: ['\'none\''],
    objectSrc: ['\'none\''],
    mediaSrc: ['\'self\''],
    manifestSrc: ['\'self\''],
    workerSrc: ['\'self\''],
    baseUri: ['\'self\''],
    formAction: ['\'self\''],
    frameAncestors: ['\'none\''],
    upgradeInsecureRequests: []
  }
});

/**
 * Enhanced security headers configuration
 */
export const enhancedSecurityHeaders = helmet({
  contentSecurityPolicy: getCSP(),
  crossOriginEmbedderPolicy: process.env.NODE_ENV === 'production',
  crossOriginOpenerPolicy: process.env.NODE_ENV === 'production',
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true
});

/**
 * CSRF protection middleware
 */
export const csrfProtection = (req: Request, res: Response, next: NextFunction): void => {
  // Skip CSRF protection for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const csrfToken = req.headers['x-csrf-token'] as string;
  const sessionId = req.session?.id || req.ip;
  const userId = (req as any).user?.id;

  if (!csrfToken) {
    securityMonitor.recordEvent({
      type: SecurityEventType.CSRF_ATTEMPT,
      severity: SecuritySeverity.MEDIUM,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      userId,
      sessionId,
      details: {
        reason: 'Missing CSRF token',
        method: req.method,
        path: req.path
      }
    });

    res.status(403).json({
      success: false,
      message: 'CSRF token required',
      error: 'MISSING_CSRF_TOKEN'
    });
    return;
  }

  if (!validateCSRFToken(csrfToken, sessionId, userId)) {
    securityMonitor.recordEvent({
      type: SecurityEventType.CSRF_ATTEMPT,
      severity: SecuritySeverity.HIGH,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      userId,
      sessionId,
      details: {
        reason: 'Invalid CSRF token',
        method: req.method,
        path: req.path
      }
    });

    res.status(403).json({
      success: false,
      message: 'Invalid CSRF token',
      error: 'INVALID_CSRF_TOKEN'
    });
    return;
  }

  // Remove used token (one-time use)
  csrfTokens.delete(csrfToken);

  next();
};

/**
 * Generate and set CSRF token in response
 */
export const setCSRFToken = (req: Request, res: Response, next: NextFunction): void => {
  const sessionId = req.session?.id || req.ip;
  const userId = (req as any).user?.id;
  const token = generateCSRFToken(sessionId, userId);

  res.setHeader('X-CSRF-Token', token);
  res.locals.csrfToken = token;

  next();
};

/**
 * Advanced rate limiting with multiple strategies
 */
export const createAdvancedRateLimit = (options: {
  windowMs: number;
  max: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  onLimitReached?: (req: Request, res: Response) => void;
}) => {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    message: {
      success: false,
      message: options.message || 'Rate limit exceeded',
      retryAfter: Math.ceil(options.windowMs / 1000 / 60)
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: options.keyGenerator || ((req) => req.ip),
    skipSuccessfulRequests: options.skipSuccessfulRequests || false,
    skipFailedRequests: options.skipFailedRequests || false,
    handler: (req, res) => {
      // Log rate limit violation
      securityMonitor.recordEvent({
        type: SecurityEventType.RATE_LIMIT_EXCEEDED,
        severity: SecuritySeverity.MEDIUM,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        userId: (req as any).user?.id,
        sessionId: req.session?.id,
        details: {
          endpoint: req.path,
          method: req.method,
          userAgent: req.headers['user-agent']
        }
      });

      // Call custom handler if provided
      if (options.onLimitReached) {
        options.onLimitReached(req, res);
      }

      res.status(429).json({
        success: false,
        message: options.message || 'Rate limit exceeded',
        retryAfter: Math.ceil(options.windowMs / 1000 / 60)
      });
    }
  });
};

/**
 * Predefined rate limiters for different use cases
 */
export const rateLimiters = {
  // General API rate limiting
  general: createAdvancedRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'production' ? 100 : 1000,
    message: 'Too many requests from this IP'
  }),

  // Authentication rate limiting (strict)
  auth: createAdvancedRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per 15 minutes
    message: 'Too many authentication attempts. Please try again later.',
    keyGenerator: (req) => `${req.ip}:${req.body?.email || ''}`,
    skipSuccessfulRequests: true,
    onLimitReached: (req, res) => {
      // Block IP temporarily after rate limit is hit
      const blockDuration = 30 * 60 * 1000; // 30 minutes
      blockedIPs.set(req.ip, {
        expires: Date.now() + blockDuration,
        reason: 'Authentication rate limit exceeded',
        severity: 'high'
      });

      securityMonitor.recordEvent({
        type: SecurityEventType.BRUTE_FORCE_ATTACK,
        severity: SecuritySeverity.HIGH,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        details: {
          reason: 'Authentication rate limit exceeded',
          endpoint: req.path,
          email: req.body?.email
        }
      });
    }
  }),

  // Password reset rate limiting
  passwordReset: createAdvancedRateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 attempts per hour
    message: 'Too many password reset attempts. Please try again later.',
    keyGenerator: (req) => `${req.ip}:${req.body?.email || ''}`,
    skipSuccessfulRequests: true
  }),

  // File upload rate limiting
  fileUpload: createAdvancedRateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 50, // 50 uploads per hour
    message: 'Too many file uploads. Please try again later.',
    keyGenerator: (req) => (req as any).user?.id || req.ip
  }),

  // API endpoint rate limiting
  api: createAdvancedRateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 60, // 60 requests per minute
    message: 'API rate limit exceeded',
    keyGenerator: (req) => (req as any).user?.id || req.ip
  })
};

/**
 * IP blocking middleware
 */
export const ipBlocking = (req: Request, res: Response, next: NextFunction): void => {
  const clientIP = req.ip;
  const blockedIP = blockedIPs.get(clientIP);

  if (blockedIP && Date.now() < blockedIP.expires) {
    securityMonitor.recordEvent({
      type: SecurityEventType.UNAUTHORIZED_ACCESS,
      severity: SecuritySeverity.HIGH,
      ip: clientIP,
      userAgent: req.headers['user-agent'],
      details: {
        reason: blockedIP.reason,
        severity: blockedIP.severity,
        blockedUntil: new Date(blockedIP.expires).toISOString()
      }
    });

    res.status(403).json({
      success: false,
      message: 'Access denied. Your IP address has been blocked.',
      error: 'IP_BLOCKED',
      retryAfter: Math.ceil((blockedIP.expires - Date.now()) / 1000 / 60)
    });
    return;
  }

  // Clean up expired blocks
  if (blockedIP && Date.now() > blockedIP.expires) {
    blockedIPs.delete(clientIP);
  }

  next();
};

/**
 * Block an IP address
 */
export const blockIP = (ip: string, duration: number, reason: string, severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'): void => {
  blockedIPs.set(ip, {
    expires: Date.now() + duration,
    reason,
    severity
  });

  securityMonitor.recordEvent({
    type: SecurityEventType.UNAUTHORIZED_ACCESS,
    severity: severity === 'critical' ? SecuritySeverity.CRITICAL :
                severity === 'high' ? SecuritySeverity.HIGH :
                severity === 'medium' ? SecuritySeverity.MEDIUM : SecuritySeverity.LOW,
    ip,
    details: {
      action: 'manual_block',
      reason,
      duration,
      severity
    }
  });
};

/**
 * Check if IP is blocked
 */
export const isIPBlocked = (ip: string): boolean => {
  const blockedIP = blockedIPs.get(ip);
  return blockedIP ? Date.now() < blockedIP.expires : false;
};

/**
 * Clean up expired IP blocks
 */
const cleanupIPBlocks = (): void => {
  const now = Date.now();
  for (const [ip, block] of blockedIPs.entries()) {
    if (now > block.expires) {
      blockedIPs.delete(ip);
    }
  }
};

// Run cleanup every hour
setInterval(cleanupIPBlocks, 60 * 60 * 1000);

/**
 * Security monitoring middleware
 */
export const securityMonitoring = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();

  // Analyze request for security threats
  const events = securityMonitor.analyzeRequest(
    req,
    (req as any).user?.id,
    req.session?.id
  );

  // Block request if critical threats are detected
  const criticalEvents = events.filter(e => e.severity === SecuritySeverity.CRITICAL);
  if (criticalEvents.length > 0) {
    // Block the IP temporarily
    blockIP(req.ip, 60 * 60 * 1000, 'Critical security threat detected', 'critical');

    res.status(403).json({
      success: false,
      message: 'Request blocked due to security concerns',
      error: 'SECURITY_THREAT',
      eventId: criticalEvents[0].id
    });
    return;
  }

  // Log high severity events
  const highEvents = events.filter(e => e.severity === SecuritySeverity.HIGH);
  if (highEvents.length > 0) {
    console.warn('Security threat detected:', {
      ip: req.ip,
      events: highEvents.map(e => e.type),
      path: req.path,
      method: req.method
    });
  }

  // Log request completion for monitoring
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const success = res.statusCode < 400;

    if (!success) {
      securityMonitor.recordEvent({
        type: SecurityEventType.AUTHENTICATION_FAILURE,
        severity: res.statusCode >= 500 ? SecuritySeverity.MEDIUM : SecuritySeverity.LOW,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        userId: (req as any).user?.id,
        sessionId: req.session?.id,
        details: {
          statusCode: res.statusCode,
          path: req.path,
          method: req.method,
          duration
        }
      });
    }
  });

  next();
};

/**
 * CORS configuration with security considerations
 */
export const secureCORS = {
  origin: (origin: string | undefined, callback: Function) => {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];

    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      securityMonitor.recordEvent({
        type: SecurityEventType.SUSPICIOUS_REQUEST,
        severity: SecuritySeverity.MEDIUM,
        ip: '', // Will be set by middleware
        details: {
          reason: 'CORS violation',
          origin,
          allowedOrigins
        }
      });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-CSRF-Token'
  ],
  exposedHeaders: ['X-CSRF-Token'],
  maxAge: 86400 // 24 hours
};

/**
 * Apply all security middleware
 */
export const applySecurityMiddleware = (app: any): void => {
  // Security headers
  app.use(enhancedSecurityHeaders);

  // Security monitoring
  app.use(securityMonitoring);

  // IP blocking
  app.use(ipBlocking);

  // CORS
  app.use(require('cors')(secureCORS));

  // General rate limiting
  app.use(rateLimiters.general);

  // CSRF token generation (for safe routes)
  app.use('/api', setCSRFToken);

  // Body parsing limits
  app.use(require('express').json({ limit: '10mb' }));
  app.use(require('express').urlencoded({ extended: true, limit: '10mb' }));
};

export default {
  generateCSRFToken,
  validateCSRFToken,
  csrfProtection,
  setCSRFToken,
  enhancedSecurityHeaders,
  rateLimiters,
  createAdvancedRateLimit,
  ipBlocking,
  blockIP,
  isIPBlocked,
  securityMonitoring,
  secureCORS,
  applySecurityMiddleware,
  getCSP
};