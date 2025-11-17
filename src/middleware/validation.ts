import { Request, Response, NextFunction } from 'express';
import { createHash, randomBytes } from 'crypto';
import rateLimit from 'express-rate-limit';

/**
 * Server-Side Validation Middleware
 * Comprehensive input validation and sanitization for security
 * OWASP Top 10 compliance
 */

// Validation rule types
export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  sanitize?: boolean;
  custom?: (value: any) => string | null;
  type?: 'string' | 'number' | 'boolean' | 'email' | 'password' | 'object' | 'array';
  allowedValues?: any[];
  forbiddenValues?: any[];
}

export interface ValidationSchema {
  [fieldName: string]: ValidationRule;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  sanitizedData: Record<string, any>;
}

/**
 * Security-focused input sanitizer for server-side
 */
export class ServerSanitizer {
  private static readonly XSS_PATTERNS = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
    /<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /data:text\/html/gi,
    /on\w+\s*=/gi,
    /expression\s*\(/gi,
  ];

  private static readonly SQL_INJECTION_PATTERNS = [
    /('|(\\')|(;)|(\-\-)|(\s+(or|and)\s+.*?=.*?)/gi,
    /(union\s+select)/gi,
    /(insert\s+into)/gi,
    /(delete\s+from)/gi,
    /(update\s+.*\s+set)/gi,
    /(drop\s+table)/gi,
    /(create\s+table)/gi,
    /(alter\s+table)/gi,
    /(exec\s*\()/gi,
    /(execute\s*\()/gi,
    /(xp_cmdshell)/gi,
    /(sp_executesql)/gi,
  ];

  private static readonly PATH_TRAVERSAL_PATTERNS = [
    /\.\.[\/\\]/,
    /%2e%2e[\/\\]/i,
    /\.\.%2f/,
    /\.\.%5c/,
    /%2e%2e%2f/,
    /%2e%2e%5c/,
  ];

  private static readonly NO_SQL_INJECTION_PATTERNS = [
    /\{?\s*\$.*?\}/,
    /\[\?\]/,
    /\$where/,
    /\$ne/,
    /\$gt/,
    /\$lt/,
    /\$in/,
    /\$nin/,
    /\$exists/,
    /\$regex/,
  ];

  private static readonly COMMAND_INJECTION_PATTERNS = [
    /[;&|`$(){}[\]]/,
    /\b(cat|ls|dir|pwd|whoami|uname|id)\b/i,
    /\b(rm|del|format|fdisk)\b/i,
    /\b(nc|netcat|telnet|ssh)\b/i,
    /\b(curl|wget|fetch)\b/i,
    /\b(perl|python|ruby|node)\b/i,
  ];

  /**
   * Sanitize string input against various attack vectors
   */
  public static sanitizeString(input: string, options: {
    allowHTML?: boolean;
    maxLength?: number;
    preserveSpaces?: boolean;
    field?: string;
  } = {}): string {
    if (typeof input !== 'string') {
      return '';
    }

    let sanitized = input.trim();

    // Apply length limit
    if (options.maxLength && sanitized.length > options.maxLength) {
      sanitized = sanitized.substring(0, options.maxLength);
    }

    if (!options.allowHTML) {
      // Remove HTML tags
      sanitized = sanitized.replace(/<[^>]*>/g, '');

      // Remove XSS patterns
      this.XSS_PATTERNS.forEach(pattern => {
        sanitized = sanitized.replace(pattern, '');
      });
    }

    // Remove various injection patterns
    this.SQL_INJECTION_PATTERNS.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '');
    });

    this.PATH_TRAVERSAL_PATTERNS.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '');
    });

    this.NO_SQL_INJECTION_PATTERNS.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '');
    });

    this.COMMAND_INJECTION_PATTERNS.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '');
    });

    // Handle spaces
    if (!options.preserveSpaces) {
      sanitized = sanitized.replace(/\s+/g, ' ');
    }

    // Remove potentially dangerous characters
    sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');

    // Log suspicious content
    if (sanitized !== input && process.env.NODE_ENV === 'production') {
      console.warn(`Sanitized suspicious input in field ${options.field}:`, {
        original: input.substring(0, 100),
        sanitized: sanitized.substring(0, 100),
        timestamp: new Date().toISOString()
      });
    }

    return sanitized;
  }

  /**
   * Sanitize email address
   */
  public static sanitizeEmail(email: string): string {
    const sanitized = this.sanitizeString(email, {
      maxLength: 254,
      preserveSpaces: false,
      field: 'email'
    }).toLowerCase();

    // Additional email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(sanitized) ? sanitized : '';
  }

  /**
   * Sanitize name field
   */
  public static sanitizeName(name: string): string {
    return this.sanitizeString(name, {
      allowHTML: false,
      maxLength: 100,
      preserveSpaces: true,
      field: 'name'
    }).replace(/[^a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ\s'-]/g, '');
  }

  /**
   * Validate password strength (for validation only, never store password)
   */
  public static validatePassword(password: string): {
    isValid: boolean;
    errors: string[];
    strength: 'weak' | 'fair' | 'good' | 'strong';
  } {
    const errors: string[] = [];

    if (!password) {
      errors.push('Password is required');
      return { isValid: false, errors, strength: 'weak' };
    }

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (password.length > 128) {
      errors.push('Password must be less than 128 characters');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    // Check for common weak patterns
    const commonPatterns = [
      /^(.)\1+$/, // Repeated characters
      /^(123|password|qwerty|admin|letmein|welcome)/i, // Common passwords
      /^(.)(.)\2\1/, // Palindromes
    ];

    if (commonPatterns.some(pattern => pattern.test(password))) {
      errors.push('Password is too common or predictable');
    }

    // Calculate strength
    let strength: 'weak' | 'fair' | 'good' | 'strong' = 'weak';
    const metRequirements = 5 - errors.filter(e => e.includes('must contain')).length;

    if (metRequirements >= 5) strength = 'strong';
    else if (metRequirements >= 4) strength = 'good';
    else if (metRequirements >= 3) strength = 'fair';

    return {
      isValid: errors.length === 0,
      errors,
      strength
    };
  }

  /**
   * Sanitize object recursively
   */
  public static sanitizeObject(obj: any, options: {
    deep?: boolean;
    excludeKeys?: string[];
    schema?: ValidationSchema;
  } = {}): any {
    const { deep = true, excludeKeys = [], schema } = options;

    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      return this.sanitizeString(obj, { field: 'unknown' });
    }

    if (Array.isArray(obj)) {
      return obj.map(item => deep ? this.sanitizeObject(item, options) : item);
    }

    if (typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        // Skip prototype pollution attempts
        if (['__proto__', 'constructor', 'prototype'].includes(key)) {
          console.warn('Prototype pollution attempt detected:', key);
          continue;
        }

        // Skip excluded keys
        if (excludeKeys.includes(key)) {
          sanitized[key] = value;
          continue;
        }

        // Apply field-specific sanitization if schema is provided
        const fieldRule = schema?.[key];
        if (fieldRule && typeof value === 'string' && fieldRule.sanitize) {
          sanitized[key] = this.sanitizeString(value, { field: key });
        } else {
          sanitized[key] = deep ? this.sanitizeObject(value, options) : value;
        }
      }
      return sanitized;
    }

    return obj;
  }

  /**
   * Generate content security policy nonce
   */
  public static generateCSPNonce(): string {
    return randomBytes(16).toString('base64');
  }
}

/**
 * Server-side validation engine
 */
export class ServerValidator {
  private schema: ValidationSchema;
  private sanitizer: typeof ServerSanitizer;

  constructor(schema: ValidationSchema) {
    this.schema = schema;
    this.sanitizer = ServerSanitizer;
  }

  /**
   * Validate request data against schema
   */
  public validate(data: Record<string, any>): ValidationResult {
    const errors: ValidationError[] = [];
    const sanitizedData: Record<string, any> = {};

    for (const [fieldName, rule] of Object.entries(this.schema)) {
      const value = data[fieldName];
      let sanitizedValue = value;

      // Type validation
      if (rule.type && value !== undefined && value !== null) {
        const typeError = this.validateType(fieldName, value, rule.type);
        if (typeError) {
          errors.push(typeError);
          continue;
        }
      }

      // Sanitize value if required
      if (rule.sanitize && typeof value === 'string') {
        sanitizedValue = this.sanitizer.sanitizeString(value, { field: fieldName });
        sanitizedData[fieldName] = sanitizedValue;
      } else if (rule.type === 'email' && typeof value === 'string') {
        sanitizedValue = this.sanitizer.sanitizeEmail(value);
        sanitizedData[fieldName] = sanitizedValue;
      } else if (rule.type === 'name' && typeof value === 'string') {
        sanitizedValue = this.sanitizer.sanitizeName(value);
        sanitizedData[fieldName] = sanitizedValue;
      } else {
        sanitizedData[fieldName] = value;
      }

      // Required validation
      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push({
          field: fieldName,
          message: `${fieldName} is required`,
          value
        });
        continue;
      }

      // Skip further validation if field is empty and not required
      if (value === undefined || value === null || value === '') {
        continue;
      }

      // Length validations
      if (typeof sanitizedValue === 'string') {
        if (rule.minLength && sanitizedValue.length < rule.minLength) {
          errors.push({
            field: fieldName,
            message: `${fieldName} must be at least ${rule.minLength} characters long`,
            value: sanitizedValue
          });
        }

        if (rule.maxLength && sanitizedValue.length > rule.maxLength) {
          errors.push({
            field: fieldName,
            message: `${fieldName} must be less than ${rule.maxLength} characters`,
            value: sanitizedValue
          });
        }
      }

      // Pattern validation
      if (rule.pattern && typeof sanitizedValue === 'string') {
        if (!rule.pattern.test(sanitizedValue)) {
          errors.push({
            field: fieldName,
            message: `${fieldName} format is invalid`,
            value: sanitizedValue
          });
        }
      }

      // Allowed values validation
      if (rule.allowedValues && !rule.allowedValues.includes(sanitizedValue)) {
        errors.push({
          field: fieldName,
          message: `${fieldName} must be one of: ${rule.allowedValues.join(', ')}`,
          value: sanitizedValue
        });
      }

      // Forbidden values validation
      if (rule.forbiddenValues && rule.forbiddenValues.includes(sanitizedValue)) {
        errors.push({
          field: fieldName,
          message: `${fieldName} contains forbidden value`,
          value: sanitizedValue
        });
      }

      // Password validation
      if (rule.type === 'password' && typeof sanitizedValue === 'string') {
        const passwordValidation = this.sanitizer.validatePassword(sanitizedValue);
        if (!passwordValidation.isValid) {
          errors.push({
            field: fieldName,
            message: passwordValidation.errors[0],
            value: '[REDACTED]'
          });
        }
      }

      // Custom validation
      if (rule.custom) {
        const customError = rule.custom(sanitizedValue);
        if (customError) {
          errors.push({
            field: fieldName,
            message: customError,
            value: rule.type === 'password' ? '[REDACTED]' : sanitizedValue
          });
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData
    };
  }

  /**
   * Validate data type
   */
  private validateType(fieldName: string, value: any, expectedType: string): ValidationError | null {
    let isValid = false;

    switch (expectedType) {
      case 'string':
        isValid = typeof value === 'string';
        break;
      case 'number':
        isValid = typeof value === 'number' && !isNaN(value);
        break;
      case 'boolean':
        isValid = typeof value === 'boolean';
        break;
      case 'email':
        isValid = typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
        break;
      case 'object':
        isValid = typeof value === 'object' && !Array.isArray(value) && value !== null;
        break;
      case 'array':
        isValid = Array.isArray(value);
        break;
      default:
        isValid = true;
    }

    if (!isValid) {
      return {
        field: fieldName,
        message: `${fieldName} must be of type ${expectedType}`,
        value
      };
    }

    return null;
  }
}

/**
 * Predefined validation schemas
 */
export const ValidationSchemas = {
  login: {
    email: {
      required: true,
      type: 'email',
      sanitize: true,
      maxLength: 254
    },
    password: {
      required: true,
      type: 'string',
      minLength: 1,
      maxLength: 128
    },
    rememberMe: {
      required: false,
      type: 'boolean'
    }
  } as ValidationSchema,

  register: {
    name: {
      required: true,
      type: 'name',
      sanitize: true,
      minLength: 2,
      maxLength: 100,
      pattern: /^[a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ\s'-]+$/
    },
    email: {
      required: true,
      type: 'email',
      sanitize: true,
      maxLength: 254
    },
    password: {
      required: true,
      type: 'password',
      minLength: 8,
      maxLength: 128
    },
    confirmPassword: {
      required: true,
      type: 'string',
      custom: (value: string, data: any) => {
        if (value !== data.password) {
          return 'Passwords do not match';
        }
        return null;
      }
    },
    role: {
      required: true,
      type: 'string',
      allowedValues: ['participant', 'facilitator']
    },
    agreeToTerms: {
      required: true,
      type: 'boolean',
      custom: (value: boolean) => {
        if (!value) {
          return 'You must agree to the terms and conditions';
        }
        return null;
      }
    }
  } as ValidationSchema,

  passwordReset: {
    email: {
      required: true,
      type: 'email',
      sanitize: true,
      maxLength: 254
    }
  } as ValidationSchema,

  newPassword: {
    token: {
      required: true,
      type: 'string',
      minLength: 32,
      maxLength: 64,
      pattern: /^[a-f0-9]+$/i
    },
    password: {
      required: true,
      type: 'password',
      minLength: 8,
      maxLength: 128
    },
    confirmPassword: {
      required: true,
      type: 'string',
      custom: (value: string, data: any) => {
        if (value !== data.password) {
          return 'Passwords do not match';
        }
        return null;
      }
    }
  } as ValidationSchema
};

/**
 * Validation middleware factory
 */
export const createValidationMiddleware = (schema: ValidationSchema, target: 'body' | 'query' | 'params' = 'body') => {
  const validator = new ServerValidator(schema);

  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const data = req[target];
      const result = validator.validate(data);

      if (!result.isValid) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: result.errors.map(error => ({
            field: error.field,
            message: error.message
          }))
        });
        return;
      }

      // Replace request data with sanitized data
      req[target] = result.sanitizedData;

      // Add validation result to request for potential use in controllers
      req.validationResult = result;

      next();
    } catch (error) {
      console.error('Validation middleware error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during validation'
      });
    }
  };
};

/**
 * CSRF protection middleware with token generation and validation
 */
export const csrfProtection = () => {
  const tokens = new Map<string, { token: string; expires: number }>();

  const generateToken = (): string => {
    return randomBytes(32).toString('hex');
  };

  const validateToken = (token: string, sessionToken: string): boolean => {
    const storedToken = tokens.get(sessionToken);
    if (!storedToken) return false;

    if (Date.now() > storedToken.expires) {
      tokens.delete(sessionToken);
      return false;
    }

    return storedToken.token === token;
  };

  // Cleanup expired tokens
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of tokens.entries()) {
      if (now > value.expires) {
        tokens.delete(key);
      }
    }
  }, 60 * 60 * 1000); // Clean up every hour

  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip CSRF protection for GET, HEAD, OPTIONS requests
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }

    const csrfToken = req.headers['x-csrf-token'] as string;
    const sessionToken = req.session?.id || req.ip;

    if (!csrfToken || !validateToken(csrfToken, sessionToken)) {
      res.status(403).json({
        success: false,
        message: 'CSRF validation failed',
        error: 'Invalid or missing CSRF token'
      });
      return;
    }

    next();
  };
};

/**
 * Enhanced rate limiting for authentication endpoints
 */
export const createAuthRateLimit = (windowMs: number, max: number, message: string) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      message,
      retryAfter: Math.ceil(windowMs / 1000 / 60) // Convert to minutes
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    keyGenerator: (req) => req.ip + ':' + (req.body?.email || ''), // Rate limit per IP + email combination
    handler: (req, res) => {
      // Log rate limit violations for security monitoring
      console.warn('Rate limit exceeded:', {
        ip: req.ip,
        email: req.body?.email,
        endpoint: req.path,
        userAgent: req.headers['user-agent'],
        timestamp: new Date().toISOString()
      });

      res.status(429).json({
        success: false,
        message,
        retryAfter: Math.ceil(windowMs / 1000 / 60)
      });
    }
  });
};

// Extend Express Request interface to include validation result
declare global {
  namespace Express {
    interface Request {
      validationResult?: ValidationResult;
    }
  }
}

export default {
  ServerSanitizer,
  ServerValidator,
  ValidationSchemas,
  createValidationMiddleware,
  csrfProtection,
  createAuthRateLimit
};