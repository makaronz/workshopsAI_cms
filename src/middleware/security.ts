import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { Request, Response, NextFunction } from 'express';
import { createHash, randomBytes } from 'crypto';

/**
 * Advanced security middleware implementation
 * OWASP Top 10 protection and GDPR compliance
 */

// Enhanced security headers configuration
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ['\'self\''],
      styleSrc: ['\'self\'', '\'unsafe-inline\'', 'https://fonts.googleapis.com'],
      fontSrc: ['\'self\'', 'https://fonts.gstatic.com', 'data:'],
      imgSrc: ['\'self\'', 'data:', 'https:', 'blob:'],
      scriptSrc: ['\'self\''],
      connectSrc: ['\'self\'', 'ws:', 'wss:'],
      frameSrc: ['\'none\''],
      objectSrc: ['\'none\''],
      mediaSrc: ['\'self\''],
      manifestSrc: ['\'self\''],
      workerSrc: ['\'self\''],
      baseUri: ['\'self\''],
      formAction: ['\'self\''],
      frameAncestors: ['\'none\''],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  dnsPrefetchControl: true,
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true,
});

// Rate limiting configurations
export const rateLimiters = {
  // General API rate limiting
  general: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'production' ? 100 : 1000,
    message: {
      error: 'Too many requests from this IP',
      retryAfter: '15 minutes',
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      // Skip rate limiting for health checks
      return req.path === '/health';
    },
  }),

  // Authentication rate limiting
  auth: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per 15 minutes
    message: {
      error: 'Too many authentication attempts',
      retryAfter: '15 minutes',
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
  }),

  // Password reset rate limiting
  passwordReset: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 attempts per hour
    message: {
      error: 'Too many password reset attempts',
      retryAfter: '1 hour',
    },
    standardHeaders: true,
    legacyHeaders: false,
  }),

  // File upload rate limiting
  fileUpload: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 50, // 50 uploads per hour
    message: {
      error: 'Too many file uploads',
      retryAfter: '1 hour',
    },
    standardHeaders: true,
    legacyHeaders: false,
  }),

  // API endpoint specific rate limiting
  api: rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 60, // 60 requests per minute
    message: {
      error: 'API rate limit exceeded',
      retryAfter: '1 minute',
    },
    standardHeaders: true,
    legacyHeaders: false,
  }),
};

// Enhanced input validation and sanitization
export const inputSanitization = (req: Request, res: Response, next: NextFunction) => {
  const sanitizeString = (str: string): string => {
    if (typeof str !== 'string') return str;

    // Remove potentially dangerous characters
    return str
      .replace(/[<>]/g, '') // Remove HTML brackets
      .replace(/javascript:/gi, '') // Remove javascript protocol
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .replace(/expression\s*\(/gi, '') // Remove CSS expressions
      .trim();
  };

  const sanitizeObject = (obj: any): any => {
    if (obj === null || obj === undefined) return obj;

    if (typeof obj === 'string') {
      return sanitizeString(obj);
    }

    if (typeof obj === 'object') {
      if (Array.isArray(obj)) {
        return obj.map(sanitizeObject);
      }

      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        // Skip prototype pollution attempts
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
          continue;
        }

        sanitized[sanitizeString(key)] = sanitizeObject(value);
      }
      return sanitized;
    }

    return obj;
  };

  try {
    // Sanitize request body
    if (req.body) {
      req.body = sanitizeObject(req.body);
    }

    // Sanitize query parameters
    if (req.query) {
      req.query = sanitizeObject(req.query);
    }

    // Sanitize URL parameters
    if (req.params) {
      req.params = sanitizeObject(req.params);
    }

    next();
  } catch (error) {
    console.error('Input sanitization error:', error);
    res.status(400).json({
      error: 'Invalid request data',
      message: 'Request contains invalid characters',
    });
  }
};

// CSRF protection middleware
export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
  // Skip CSRF protection for GET, HEAD, OPTIONS requests
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Check for CSRF token in headers
  const csrfToken = req.headers['x-csrf-token'] as string;
  const sessionToken = req.session?.csrfToken;

  if (!csrfToken || !sessionToken || csrfToken !== sessionToken) {
    return res.status(403).json({
      error: 'CSRF validation failed',
      message: 'Invalid or missing CSRF token',
    });
  }

  next();
};

// Generate CSRF token
export const generateCsrfToken = (): string => {
  return randomBytes(32).toString('hex');
};

// Content Type validation
export const validateContentType = (allowedTypes: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentType = req.headers['content-type'];

    if (!contentType || !allowedTypes.some(type => contentType.includes(type))) {
      return res.status(415).json({
        error: 'Unsupported Media Type',
        message: `Content-Type must be one of: ${allowedTypes.join(', ')}`,
      });
    }

    next();
  };
};

// Request size validation
export const validateRequestSize = (maxSize: number) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.headers['content-length'] || '0');

    if (contentLength > maxSize) {
      return res.status(413).json({
        error: 'Payload Too Large',
        message: `Request size exceeds maximum allowed size of ${maxSize} bytes`,
      });
    }

    next();
  };
};

// IP-based blocking middleware
export const ipBlocking = (blockedIPs: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;

    if (blockedIPs.includes(clientIP as string)) {
      return res.status(403).json({
        error: 'Access Denied',
        message: 'Your IP address has been blocked',
      });
    }

    next();
  };
};

// Security logging middleware
export const securityLogging = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();

  // Log request details
  console.log(`SECURITY_LOG: ${new Date().toISOString()} - ${req.method} ${req.path} - IP: ${req.ip} - User-Agent: ${req.headers['user-agent']}`);

  // Log suspicious activities
  const suspiciousPatterns = [
    /\.\./,  // Path traversal
    /<script/i,  // XSS attempt
    /union.*select/i,  // SQL injection attempt
    /javascript:/i,  // JavaScript protocol
    /data:text\/html/i,  // Data URI HTML
  ];

  const requestString = JSON.stringify({
    query: req.query,
    params: req.params,
    body: req.body,
  });

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(requestString)) {
      console.warn(`SECURITY_WARNING: Suspicious request detected - ${req.method} ${req.path} - IP: ${req.ip} - Pattern: ${pattern}`);

      // You could implement additional actions here like:
      // - Blocking the IP
      // - Sending alerts
      // - Increasing monitoring
    }
  }

  // Log response
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    console.log(`SECURITY_LOG: ${new Date().toISOString()} - ${req.method} ${req.path} - Status: ${res.statusCode} - Duration: ${duration}ms`);

    // Log failed authentication attempts
    if (req.path.includes('/auth') && res.statusCode === 401) {
      console.warn(`SECURITY_WARNING: Failed authentication attempt - IP: ${req.ip} - Email: ${req.body?.email}`);
    }
  });

  next();
};

// GDPR compliance middleware
export const gdprCompliance = (req: Request, res: Response, next: NextFunction) => {
  // Add GDPR compliance headers
  res.setHeader('X-GDPR-Compliant', 'true');
  res.setHeader('X-Data-Protection', 'GDPR-Compliant');

  // Log data processing activities
  if (req.body && Object.keys(req.body).length > 0) {
    console.log(`GDPR_LOG: Data processing activity - ${req.method} ${req.path} - IP: ${req.ip} - Timestamp: ${new Date().toISOString()}`);
  }

  next();
};

// Content Security Policy nonce generation
export const generateCSPNonce = (): string => {
  return randomBytes(16).toString('base64');
};

// CSP nonce middleware
export const cspNonce = (req: Request, res: Response, next: NextFunction) => {
  res.locals.cspNonce = generateCSPNonce();
  next();
};

// Security headers for API responses
export const apiSecurityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Remove server information
  res.removeHeader('X-Powered-By');

  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  next();
};

export {
  securityHeaders as default,
  rateLimiters,
  inputSanitization,
  csrfProtection,
  generateCsrfToken,
  validateContentType,
  validateRequestSize,
  ipBlocking,
  securityLogging,
  gdprCompliance,
  generateCSPNonce,
  cspNonce,
  apiSecurityHeaders,
};
