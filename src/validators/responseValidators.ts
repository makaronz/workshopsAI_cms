import { z } from 'zod';
import { Question } from '../models/postgresql-schema';

// Base response validation schema
const baseResponseSchema = z.object({
  questionId: z.string().uuid('Invalid question ID format'),
  enrollmentId: z.string().uuid('Invalid enrollment ID format').optional(),
  timeSpentMs: z.number().int().min(0).optional(),
  isAutosave: z.boolean().default(false),
});

// Text response validation
const textResponseSchema = baseResponseSchema.extend({
  answer: z
    .string()
    .min(1, 'Response cannot be empty')
    .max(1000, 'Response too long'),
});

// Textarea response validation
const textareaResponseSchema = baseResponseSchema.extend({
  answer: z
    .string()
    .min(1, 'Response cannot be empty')
    .max(5000, 'Response too long'),
});

// Number response validation
const numberResponseSchema = baseResponseSchema.extend({
  answer: z.number({ required_error: 'Answer must be a number' }),
});

// Scale response validation
const scaleResponseSchema = baseResponseSchema.extend({
  answer: z
    .number()
    .int()
    .min(1)
    .max(10, 'Scale value must be between 1 and 10'),
});

// Single choice response validation
const singleChoiceResponseSchema = baseResponseSchema.extend({
  answer: z.string().min(1, 'Please select an option'),
});

// Multiple choice response validation
const multipleChoiceResponseSchema = baseResponseSchema.extend({
  answer: z.array(z.string()).min(1, 'Please select at least one option'),
});

// Consent validation schema
const consentSchema = z.object({
  questionnaireId: z.string().uuid('Invalid questionnaire ID format'),
  aiProcessing: z.boolean(),
  dataProcessing: z.boolean(),
  anonymousSharing: z.boolean(),
  consentText: z.object({
    pl: z.string().min(1, 'Polish consent text required'),
    en: z.string().min(1, 'English consent text required'),
  }),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
});

// Response update schema (for PATCH operations)
const updateResponseSchema = z.object({
  answer: z.any(),
  status: z.enum(['draft', 'submitted']).optional(),
  timeSpentMs: z.number().int().min(0).optional(),
});

// Export options schema
const exportOptionsSchema = z.object({
  format: z.enum(['ods', 'csv', 'json']).default('ods'),
  includePersonalData: z.boolean().default(false),
  includeMetadata: z.boolean().default(true),
  anonymizeLevel: z.enum(['partial', 'full']).default('full'),
  consentFilter: z
    .enum(['all', 'consenting_only', 'non_consenting_only'])
    .default('consenting_only'),
  dateRange: z
    .object({
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
    })
    .optional(),
});

// Bulk response submission schema (for questionnaire completion)
const bulkResponseSchema = z.object({
  questionnaireId: z.string().uuid('Invalid questionnaire ID format'),
  responses: z
    .array(
      z.object({
        questionId: z.string().uuid('Invalid question ID format'),
        answer: z.any(),
      }),
    )
    .min(1, 'At least one response required'),
  status: z.enum(['draft', 'submitted']).default('submitted'),
  consent: consentSchema.optional(),
});

// Types derived from schemas
export type CreateResponseRequest = z.infer<typeof baseResponseSchema> & {
  answer: any;
};
export type UpdateResponseRequest = z.infer<typeof updateResponseSchema>;
export type ConsentRequest = z.infer<typeof consentSchema>;
export type ExportOptionsRequest = z.infer<typeof exportOptionsSchema>;
export type BulkResponseRequest = z.infer<typeof bulkResponseSchema>;

// Dynamic response validation based on question type
export function createResponseValidator(question: Question) {
  const baseSchema = baseResponseSchema.extend({
    answer: getAnswerSchemaForQuestionType(question.type, question.validation),
  });

  // Add conditional validation based on question requirements
  if (question.validation?.required) {
    return baseSchema.refine(
      data => {
        if (
          data.answer === null ||
          data.answer === undefined ||
          data.answer === ''
        ) {
          return false;
        }
        return true;
      },
      {
        message: 'This field is required',
        path: ['answer'],
      },
    );
  }

  return baseSchema;
}

// Get appropriate schema for question type
function getAnswerSchemaForQuestionType(
  questionType: string,
  validation?: any,
) {
  switch (questionType) {
  case 'text':
    return z
      .string()
      .min(
        validation?.minLength || 0,
        `Minimum ${validation?.minLength || 0} characters required`,
      )
      .max(
        validation?.maxLength || 1000,
        `Maximum ${validation?.maxLength || 1000} characters allowed`,
      )
      .regex(
        validation?.pattern ? new RegExp(validation.pattern) : /.*/,
        'Invalid format',
      );

  case 'textarea':
    return z
      .string()
      .min(
        validation?.minLength || 0,
        `Minimum ${validation?.minLength || 0} characters required`,
      )
      .max(
        validation?.maxLength || 5000,
        `Maximum ${validation?.maxLength || 5000} characters allowed`,
      );

  case 'number':
    return z
      .number()
      .min(
        validation?.minValue ?? -Infinity,
        `Value must be at least ${validation?.minValue}`,
      )
      .max(
        validation?.maxValue ?? Infinity,
        `Value must be at most ${validation?.maxValue}`,
      );

  case 'scale':
    return z
      .number()
      .int('Scale must be an integer')
      .min(validation?.minValue ?? 1, 'Scale minimum value')
      .max(validation?.maxValue ?? 10, 'Scale maximum value');

  case 'single_choice':
    return z.string().min(1, 'Please select an option');

  case 'multiple_choice':
    return z
      .array(z.string())
      .min(
        validation?.minOptions || 0,
        `Select at least ${validation?.minOptions || 0} option(s)`,
      )
      .max(
        validation?.maxOptions || 10,
        `Select at most ${validation?.maxOptions || 10} option(s)`,
      );

  default:
    return z.any();
  }
}

// Validation error formatter
export function formatValidationErrors(error: z.ZodError): {
  field: string;
  message: string;
  code: string;
}[] {
  return error.errors.map(err => ({
    field: err.path.join('.'),
    message: err.message,
    code: err.code,
  }));
}

// Sanitization utilities
export function sanitizeResponse(answer: any): any {
  if (typeof answer === 'string') {
    return answer
      .trim()
      .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
      .substring(0, 50000); // Limit length
  }

  if (Array.isArray(answer)) {
    return answer.map(sanitizeResponse);
  }

  if (typeof answer === 'object' && answer !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(answer)) {
      sanitized[key] = sanitizeResponse(value);
    }
    return sanitized;
  }

  return answer;
}

// PII Detection patterns
const PII_PATTERNS = [
  {
    name: 'email',
    pattern: /\b[\w._%+-]+@[\w.-]+\.[A-Za-z]{2,}\b/gi,
    severity: 'high',
  },
  {
    name: 'phone',
    pattern: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
    severity: 'medium',
  },
  {
    name: 'pesel', // Polish national ID
    pattern: /\b\d{11}\b/g,
    severity: 'high',
  },
  {
    name: 'nip', // Polish tax ID
    pattern: /\b\d{10}\b/g,
    severity: 'high',
  },
  {
    name: 'credit_card',
    pattern: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
    severity: 'critical',
  },
  {
    name: 'ip_address',
    pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
    severity: 'low',
  },
];

// PII Detection function
export function detectPII(text: string): {
  detected: boolean;
  findings: Array<{
    type: string;
    severity: string;
    count: number;
    sample: string;
  }>;
} {
  const findings = [];

  for (const pii of PII_PATTERNS) {
    const matches = text.match(pii.pattern);
    if (matches && matches.length > 0) {
      findings.push({
        type: pii.name,
        severity: pii.severity,
        count: matches.length,
        sample: matches[0].replace(/(\d{2})\d{2}(\d{2})/, '$1**$2'), // Partially mask sample
      });
    }
  }

  return {
    detected: findings.length > 0,
    findings,
  };
}

// GDPR compliance validator
export function validateGDPRCompliance(
  answer: any,
  consentGiven: boolean,
  anonymizationLevel: 'partial' | 'full' = 'full',
): {
  compliant: boolean;
  warnings: string[];
  sanitizedAnswer: any;
} {
  const warnings: string[] = [];
  let sanitizedAnswer = sanitizeResponse(answer);

  if (typeof sanitizedAnswer === 'string') {
    const piiDetection = detectPII(sanitizedAnswer);

    if (piiDetection.detected) {
      if (!consentGiven) {
        warnings.push(
          'PII detected but no consent given - data will be anonymized',
        );
      }

      if (anonymizationLevel === 'full') {
        // Redact PII for full anonymization
        for (const finding of piiDetection.findings) {
          sanitizedAnswer = sanitizedAnswer.replace(
            finding.sample,
            '[REDACTED]',
          );
        }
        warnings.push(
          `Redacted ${piiDetection.findings.length} types of PII for privacy`,
        );
      }
    }
  }

  return {
    compliant: warnings.length === 0 || consentGiven,
    warnings,
    sanitizedAnswer,
  };
}

// Export all validation schemas
export {
  baseResponseSchema,
  textResponseSchema,
  textareaResponseSchema,
  numberResponseSchema,
  scaleResponseSchema,
  singleChoiceResponseSchema,
  multipleChoiceResponseSchema,
  consentSchema,
  updateResponseSchema,
  exportOptionsSchema,
  bulkResponseSchema,
};
