import { Request, Response, NextFunction } from 'express';
import { securityMonitor, SecurityEventType, SecuritySeverity } from '../services/security-monitoring';

/**
 * Enhanced Error Handling Middleware
 * Comprehensive error processing with security monitoring and user-friendly responses
 * OWASP compliance and proper error reporting
 */

// Custom error types
export class ValidationError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public details?: any;

  constructor(message: string, statusCode: number = 400, details?: any) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = statusCode;
    this.isOperational = true;
    this.details = details;
  }
}

export class AuthenticationError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string = 'Authentication failed') {
    super(message);
    this.name = 'AuthenticationError';
    this.statusCode = 401;
    this.isOperational = true;
  }
}

export class AuthorizationError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string = 'Access denied') {
    super(message);
    this.name = 'AuthorizationError';
    this.statusCode = 403;
    this.isOperational = true;
  }
}

export class NotFoundError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = 404;
    this.isOperational = true;
  }
}

export class ConflictError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string = 'Resource conflict') {
    super(message);
    this.name = 'ConflictError';
    this.statusCode = 409;
    this.isOperational = true;
  }
}

export class RateLimitError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public retryAfter?: number;

  constructor(message: string = 'Rate limit exceeded', retryAfter?: number) {
    super(message);
    this.name = 'RateLimitError';
    this.statusCode = 429;
    this.isOperational = true;
    this.retryAfter = retryAfter;
  }
}

export class DatabaseError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string = 'Database operation failed') {
    super(message);
    this.name = 'DatabaseError';
    this.statusCode = 500;
    this.isOperational = true;
  }
}

export class ExternalServiceError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public service: string;

  constructor(message: string, service: string) {
    super(message);
    this.name = 'ExternalServiceError';
    this.statusCode = 502;
    this.isOperational = true;
    this.service = service;
  }
}

// Error response interface
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
    requestId?: string;
    retryAfter?: number;
  };
}

/**
 * Enhanced error handler middleware
 */
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Generate request ID for tracking
  const requestId = req.headers['x-request-id'] as string ||
                   generateRequestId();

  // Log error for debugging
  logError(error, req, requestId);

  // Record security events for suspicious errors
  recordSecurityEvent(error, req);

  // Determine error response
  const errorResponse = createErrorResponse(error, requestId);

  // Set appropriate headers
  setErrorHeaders(res, errorResponse);

  // Send error response
  res.status(errorResponse.statusCode).json(errorResponse.body);

  // Don't send response if already sent
  if (!res.headersSent) {
    next(error);
  }
};

/**
 * 404 handler for undefined routes
 */
export const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
  const error = new NotFoundError(`Route ${req.method} ${req.path} not found`);
  next(error);
};

/**
 * Async error wrapper for route handlers
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return Math.random().toString(36).substring(2, 15) +
         Math.random().toString(36).substring(2, 15);
}

/**
 * Log error with context
 */
function logError(error: Error, req: Request, requestId: string): void {
  const logData = {
    requestId,
    timestamp: new Date().toISOString(),
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
      statusCode: (error as any).statusCode,
      isOperational: (error as any).isOperational
    },
    request: {
      method: req.method,
      url: req.url,
      path: req.path,
      query: req.query,
      params: req.params,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      userId: (req as any).user?.id,
      sessionId: (req as any).session?.id
    }
  };

  // Log based on error severity
  if ((error as any).statusCode >= 500) {
    console.error('[SERVER ERROR]', JSON.stringify(logData, null, 2));
  } else if ((error as any).statusCode >= 400) {
    console.warn('[CLIENT ERROR]', JSON.stringify(logData, null, 2));
  } else {
    console.log('[ERROR]', JSON.stringify(logData, null, 2));
  }
}

/**
 * Record security events for suspicious activities
 */
function recordSecurityEvent(error: Error, req: Request): void {
  const isSuspicious =
    error.name === 'ValidationError' && (error as any).details?.securityIssue ||
    error.name === 'AuthenticationError' && req.path.includes('/auth') ||
    error.name === 'RateLimitError' ||
    (error as any).statusCode === 403;

  if (isSuspicious) {
    securityMonitor.recordEvent({
      type: SecurityEventType.SUSPICIOUS_REQUEST,
      severity: SecuritySeverity.MEDIUM,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      userId: (req as any).user?.id,
      sessionId: (req as any).session?.id,
      details: {
        errorName: error.name,
        errorMessage: error.message,
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString()
      }
    });
  }
}

/**
 * Create standardized error response
 */
function createErrorResponse(error: Error, requestId: string): {
  statusCode: number;
  body: ErrorResponse;
} {
  let statusCode = 500;
  let code = 'INTERNAL_SERVER_ERROR';
  let message = 'An unexpected error occurred';
  let details: any = undefined;
  let retryAfter: number | undefined = undefined;

  // Handle known error types
  if (error instanceof ValidationError) {
    statusCode = error.statusCode;
    code = 'VALIDATION_ERROR';
    message = error.message;
    details = error.details;
  } else if (error instanceof AuthenticationError) {
    statusCode = error.statusCode;
    code = 'AUTHENTICATION_ERROR';
    message = 'Authentication failed';
  } else if (error instanceof AuthorizationError) {
    statusCode = error.statusCode;
    code = 'AUTHORIZATION_ERROR';
    message = 'Access denied';
  } else if (error instanceof NotFoundError) {
    statusCode = error.statusCode;
    code = 'NOT_FOUND';
    message = error.message;
  } else if (error instanceof ConflictError) {
    statusCode = error.statusCode;
    code = 'CONFLICT';
    message = error.message;
  } else if (error instanceof RateLimitError) {
    statusCode = error.statusCode;
    code = 'RATE_LIMIT_EXCEEDED';
    message = error.message;
    retryAfter = error.retryAfter;
  } else if (error instanceof DatabaseError) {
    statusCode = error.statusCode;
    code = 'DATABASE_ERROR';
    message = 'A database error occurred';
  } else if (error instanceof ExternalServiceError) {
    statusCode = error.statusCode;
    code = 'EXTERNAL_SERVICE_ERROR';
    message = `External service (${error.service}) is temporarily unavailable`;
  }

  // Handle specific status codes
  if (error.name === 'CastError') {
    statusCode = 400;
    code = 'INVALID_ID';
    message = 'Invalid ID format';
  } else if (error.name === 'ValidationError') { // Mongoose validation error
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Validation failed';
    details = Object.values((error as any).errors).map((err: any) => ({
      field: err.path,
      message: err.message
    }));
  } else if (error.name === 'MongoError' || error.name === 'MongoServerError') {
    statusCode = 500;
    code = 'DATABASE_ERROR';
    message = 'Database operation failed';
  } else if (error.message.includes('E11000')) {
    statusCode = 409;
    code = 'DUPLICATE_KEY';
    message = 'Resource already exists';
  } else if ((error as any).code === 11000) {
    statusCode = 409;
    code = 'DUPLICATE_KEY';
    message = 'Resource already exists';
  }

  // Check for explicit status code
  if ((error as any).statusCode) {
    statusCode = (error as any).statusCode;
  }

  // Don't expose internal errors in production
  if (process.env.NODE_ENV === 'production' && statusCode >= 500) {
    message = 'An internal error occurred';
    details = undefined;
  }

  return {
    statusCode,
    body: {
      success: false,
      error: {
        code,
        message,
        details: statusCode >= 500 ? undefined : details, // Hide details for server errors
        timestamp: new Date().toISOString(),
        requestId,
        retryAfter
      }
    }
  };
}

/**
 * Set error response headers
 */
function setErrorHeaders(res: Response, errorResponse: {
  statusCode: number;
  body: ErrorResponse;
}): void {
  // Set request ID header
  res.setHeader('X-Request-ID', errorResponse.body.error.requestId);

  // Set retry-after header for rate limit errors
  if (errorResponse.body.error.retryAfter) {
    res.setHeader('Retry-After', errorResponse.body.error.retryAfter);
  }

  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
}

/**
 * Client-safe error messages
 */
export const ClientSafeMessages = {
  DEFAULT: 'Something went wrong. Please try again later.',
  VALIDATION: 'Please check your input and try again.',
  AUTHENTICATION: 'Please sign in to continue.',
  AUTHORIZATION: 'You don\'t have permission to perform this action.',
  NOT_FOUND: 'The requested resource was not found.',
  CONFLICT: 'The resource already exists.',
  RATE_LIMIT: 'Too many requests. Please try again later.',
  DATABASE: 'A database error occurred. Please try again later.',
  EXTERNAL_SERVICE: 'External service is temporarily unavailable. Please try again later.',
  NETWORK: 'Network error. Please check your connection and try again.',
  TIMEOUT: 'Request timed out. Please try again.',
  FILE_TOO_LARGE: 'File is too large. Please choose a smaller file.',
  INVALID_FILE_TYPE: 'Invalid file type. Please choose a valid file.',
  QUOTA_EXCEEDED: 'Storage quota exceeded. Please free up space and try again.'
};

/**
 * Error localization helper
 */
export const localizeError = (error: Error, language: string = 'en'): string => {
  // This would integrate with your i18n system
  const errorKey = error.name.toUpperCase().replace('ERROR', '');

  const messages: Record<string, Record<string, string>> = {
    en: {
      VALIDATION: ClientSafeMessages.VALIDATION,
      AUTHENTICATION: ClientSafeMessages.AUTHENTICATION,
      AUTHORIZATION: ClientSafeMessages.AUTHORIZATION,
      NOT_FOUND: ClientSafeMessages.NOT_FOUND,
      CONFLICT: ClientSafeMessages.CONFLICT,
      RATE_LIMIT: ClientSafeMessages.RATE_LIMIT,
      DATABASE: ClientSafeMessages.DATABASE,
      EXTERNAL_SERVICE: ClientSafeMessages.EXTERNAL_SERVICE
    },
    pl: {
      VALIDATION: 'Proszę sprawdzić wprowadzone dane i spróbować ponownie.',
      AUTHENTICATION: 'Proszę się zalogować, aby kontynuować.',
      AUTHORIZATION: 'Nie masz uprawnień do wykonania tej czynności.',
      NOT_FOUND: 'Żądany zasób nie został znaleziony.',
      CONFLICT: 'Zasób już istnieje.',
      RATE_LIMIT: 'Zbyt wiele żądań. Proszę spróbować ponownie później.',
      DATABASE: 'Wystąpił błąd bazy danych. Proszę spróbować ponownie później.',
      EXTERNAL_SERVICE: 'Usługa zewnętrzna jest tymczasowo niedostępna. Proszę spróbować ponownie później.'
    }
  };

  return messages[language]?.[errorKey] || ClientSafeMessages.DEFAULT;
};

/**
 * Error monitoring integration
 */
export const setupErrorMonitoring = () => {
  // This would integrate with your monitoring service
  // e.g., Sentry, DataDog, etc.

  // Example for Sentry
  if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
    // Sentry.init({
    //   dsn: process.env.SENTRY_DSN,
    //   environment: process.env.NODE_ENV,
    //   release: process.env.APP_VERSION || '1.0.0'
    // });
  }

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    securityMonitor.recordEvent({
      type: SecurityEventType.ANOMALOUS_BEHAVIOR,
      severity: SecuritySeverity.CRITICAL,
      ip: 'system',
      details: {
        error: error.message,
        stack: error.stack,
        type: 'uncaughtException'
      }
    });

    // Graceful shutdown
    setTimeout(() => {
      process.exit(1);
    }, 5000);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    securityMonitor.recordEvent({
      type: SecurityEventType.ANOMALOUS_BEHAVIOR,
      severity: SecuritySeverity.HIGH,
      ip: 'system',
      details: {
        reason: reason?.toString(),
        promise: promise.toString(),
        type: 'unhandledRejection'
      }
    });
  });
};

export default {
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  DatabaseError,
  ExternalServiceError,
  errorHandler,
  notFoundHandler,
  asyncHandler,
  ClientSafeMessages,
  localizeError,
  setupErrorMonitoring
};