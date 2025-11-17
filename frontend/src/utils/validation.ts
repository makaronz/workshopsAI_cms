/**
 * Input Validation Utilities
 * Comprehensive client-side validation with security enhancements
 * OWASP compliance and accessibility support
 */

export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: string) => string | null;
  sanitize?: boolean;
}

export interface ValidationSchema {
  [fieldName: string]: ValidationRule;
}

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  sanitizedData: Record<string, any>;
}

/**
 * Security-focused input sanitizer
 * Prevents XSS, injection attacks, and malicious content
 */
export class InputSanitizer {
  private static readonly XSS_PATTERNS = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
    /<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /expression\s*\(/gi,
    /data:text\/html/gi,
    /vbscript:/gi,
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
  ];

  private static readonly PATH_TRAVERSAL_PATTERNS = [
    /\.\.[\/\\]/,
    /%2e%2e[\/\\]/i,
    /\.\.%2f/,
    /\.\.%5c/,
    /%2e%2e%2f/,
    /%2e%2e%5c/,
  ];

  /**
   * Sanitize string input against various attack vectors
   */
  public static sanitizeString(input: string, options: {
    allowHTML?: boolean;
    maxLength?: number;
    preserveSpaces?: boolean;
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

    // Remove SQL injection patterns
    this.SQL_INJECTION_PATTERNS.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '');
    });

    // Remove path traversal patterns
    this.PATH_TRAVERSAL_PATTERNS.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '');
    });

    // Handle spaces
    if (!options.preserveSpaces) {
      sanitized = sanitized.replace(/\s+/g, ' ');
    }

    // Remove potentially dangerous characters
    sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');

    return sanitized;
  }

  /**
   * Sanitize email address
   */
  public static sanitizeEmail(email: string): string {
    const sanitized = this.sanitizeString(email, {
      maxLength: 254, // RFC 5321 limit
      preserveSpaces: false
    });

    // Additional email-specific validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(sanitized) ? sanitized.toLowerCase() : '';
  }

  /**
   * Sanitize name field (first name, last name, etc.)
   */
  public static sanitizeName(name: string): string {
    return this.sanitizeString(name, {
      allowHTML: false,
      maxLength: 100,
      preserveSpaces: true
    }).replace(/[^a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ\s'-]/g, '');
  }

  /**
   * Sanitize password (for validation only, never store password)
   */
  public static validatePassword(password: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!password) {
      errors.push('Password is required');
      return { isValid: false, errors };
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
      /^(123|password|qwerty|admin)/i, // Common passwords
      /^(.)(.)\2\1/, // Palindromes
    ];

    if (commonPatterns.some(pattern => pattern.test(password))) {
      errors.push('Password is too common or predictable');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Sanitize object recursively
   */
  public static sanitizeObject(obj: any, options: {
    deep?: boolean;
    excludeKeys?: string[];
  } = {}): any {
    const { deep = true, excludeKeys = [] } = options;

    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      return this.sanitizeString(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => deep ? this.sanitizeObject(item, options) : item);
    }

    if (typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        // Skip prototype pollution attempts
        if (['__proto__', 'constructor', 'prototype'].includes(key)) {
          continue;
        }

        // Skip excluded keys
        if (excludeKeys.includes(key)) {
          sanitized[key] = value;
          continue;
        }

        sanitized[key] = deep ? this.sanitizeObject(value, options) : value;
      }
      return sanitized;
    }

    return obj;
  }
}

/**
 * Form Validation Engine
 */
export class FormValidator {
  private schema: ValidationSchema;
  private sanitizer: InputSanitizer;

  constructor(schema: ValidationSchema) {
    this.schema = schema;
    this.sanitizer = InputSanitizer;
  }

  /**
   * Validate form data against schema
   */
  public validate(data: Record<string, any>): ValidationResult {
    const errors: Record<string, string> = {};
    const sanitizedData: Record<string, any> = {};

    for (const [fieldName, rule] of Object.entries(this.schema)) {
      const value = data[fieldName];
      let sanitizedValue = value;

      // Sanitize value if required
      if (rule.sanitize && typeof value === 'string') {
        sanitizedValue = this.sanitizer.sanitizeString(value);
        sanitizedData[fieldName] = sanitizedValue;
      } else {
        sanitizedData[fieldName] = value;
      }

      // Required validation
      if (rule.required && (!value || (typeof value === 'string' && !value.trim()))) {
        errors[fieldName] = this.getErrorMessage(fieldName, 'required');
        continue;
      }

      // Skip further validation if field is empty and not required
      if (!value || (typeof value === 'string' && !value.trim())) {
        continue;
      }

      // Length validations
      if (typeof sanitizedValue === 'string') {
        if (rule.minLength && sanitizedValue.length < rule.minLength) {
          errors[fieldName] = this.getErrorMessage(fieldName, 'minLength', { min: rule.minLength });
        }

        if (rule.maxLength && sanitizedValue.length > rule.maxLength) {
          errors[fieldName] = this.getErrorMessage(fieldName, 'maxLength', { max: rule.maxLength });
        }
      }

      // Pattern validation
      if (rule.pattern && typeof sanitizedValue === 'string') {
        if (!rule.pattern.test(sanitizedValue)) {
          errors[fieldName] = this.getErrorMessage(fieldName, 'pattern');
        }
      }

      // Custom validation
      if (rule.custom && typeof sanitizedValue === 'string') {
        const customError = rule.custom(sanitizedValue);
        if (customError) {
          errors[fieldName] = customError;
        }
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
      sanitizedData
    };
  }

  /**
   * Get user-friendly error message
   */
  private getErrorMessage(fieldName: string, errorType: string, options?: any): string {
    const fieldLabels: Record<string, string> = {
      email: 'Email address',
      password: 'Password',
      confirmPassword: 'Confirm password',
      firstName: 'First name',
      lastName: 'Last name',
      name: 'Name',
      agreeToTerms: 'Terms agreement'
    };

    const fieldLabel = fieldLabels[fieldName] || fieldName;

    switch (errorType) {
      case 'required':
        return `${fieldLabel} is required`;
      case 'minLength':
        return `${fieldLabel} must be at least ${options?.min} characters long`;
      case 'maxLength':
        return `${fieldLabel} must be less than ${options?.max} characters`;
      case 'pattern':
        if (fieldName === 'email') {
          return 'Please enter a valid email address';
        }
        return `${fieldLabel} format is invalid`;
      default:
        return `${fieldLabel} is invalid`;
    }
  }
}

/**
 * Predefined validation schemas
 */
export const ValidationSchemas = {
  login: {
    email: {
      required: true,
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      sanitize: true,
      maxLength: 254
    },
    password: {
      required: true,
      minLength: 1,
      maxLength: 128
    }
  } as ValidationSchema,

  register: {
    name: {
      required: true,
      minLength: 2,
      maxLength: 100,
      sanitize: true,
      custom: (value: string) => {
        if (!/^[a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ\s'-]+$/.test(value)) {
          return 'Name can only contain letters, spaces, hyphens, and apostrophes';
        }
        return null;
      }
    },
    email: {
      required: true,
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      sanitize: true,
      maxLength: 254
    },
    password: {
      required: true,
      minLength: 8,
      maxLength: 128,
      custom: (value: string) => {
        const validation = InputSanitizer.validatePassword(value);
        return validation.isValid ? null : validation.errors[0];
      }
    },
    confirmPassword: {
      required: true,
      custom: (value: string, data: any) => {
        if (value !== data.password) {
          return 'Passwords do not match';
        }
        return null;
      }
    },
    agreeToTerms: {
      required: true,
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
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      sanitize: true,
      maxLength: 254
    }
  } as ValidationSchema,

  newPassword: {
    password: {
      required: true,
      minLength: 8,
      maxLength: 128,
      custom: (value: string) => {
        const validation = InputSanitizer.validatePassword(value);
        return validation.isValid ? null : validation.errors[0];
      }
    },
    confirmPassword: {
      required: true,
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
 * Real-time validation with debouncing
 */
export class RealTimeValidator {
  private validators: Map<string, FormValidator> = new Map();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Register a validator for a form
   */
  public registerValidator(formId: string, schema: ValidationSchema): void {
    this.validators.set(formId, new FormValidator(schema));
  }

  /**
   * Validate field with debouncing
   */
  public validateField(
    formId: string,
    fieldName: string,
    value: any,
    formData: Record<string, any>,
    debounceMs: number = 300,
    callback?: (result: { isValid: boolean; error?: string }) => void
  ): void {
    // Clear existing timer
    const existingTimer = this.debounceTimers.get(`${formId}-${fieldName}`);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(() => {
      const validator = this.validators.get(formId);
      if (!validator) return;

      const result = validator.validate({ [fieldName]: value, ...formData });

      const fieldResult = {
        isValid: !result.errors[fieldName],
        error: result.errors[fieldName]
      };

      callback?.(fieldResult);
    }, debounceMs);

    this.debounceTimers.set(`${formId}-${fieldName}`, timer);
  }

  /**
   * Validate entire form immediately
   */
  public validateForm(formId: string, formData: Record<string, any>): ValidationResult {
    const validator = this.validators.get(formId);
    if (!validator) {
      return { isValid: false, errors: {}, sanitizedData: formData };
    }

    return validator.validate(formData);
  }

  /**
   * Cleanup
   */
  public destroy(): void {
    this.debounceTimers.forEach(timer => clearTimeout(timer));
    this.debounceTimers.clear();
    this.validators.clear();
  }
}

// Global instance
export const realTimeValidator = new RealTimeValidator();

export default {
  InputSanitizer,
  FormValidator,
  ValidationSchemas,
  RealTimeValidator,
  realTimeValidator
};