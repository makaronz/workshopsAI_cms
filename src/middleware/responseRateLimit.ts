import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { redisService } from '../config/redis';

// Base rate limiting configuration for response endpoints
const createResponseRateLimit = (options: {
  windowMs?: number;
  max?: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
}) => {
  return rateLimit({
    windowMs: options.windowMs || 15 * 60 * 1000, // 15 minutes default
    max: options.max || 100, // 100 requests per window default
    message: {
      error: 'Too many requests',
      message:
        options.message ||
        'Too many response submissions, please try again later',
      retryAfter: Math.ceil((options.windowMs || 15 * 60 * 1000) / 1000),
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator:
      options.keyGenerator ||
      (req => {
        // Use user ID if authenticated, otherwise IP
        if (req.user?.id) {
          return `user:${req.user.id}`;
        }
        return `ip:${req.ip}`;
      }),
    skip: req => {
      // Skip rate limiting for admin users in development
      if (
        process.env.NODE_ENV === 'development' &&
        req.user?.role === 'admin'
      ) {
        return true;
      }
      return false;
    },
    handler: async (req: Request, res: Response) => {
      // Log rate limit violation
      const identifier = req.user?.id ? `user:${req.user.id}` : `ip:${req.ip}`;
      console.warn(`Rate limit exceeded for ${identifier} on ${req.path}`);

      // Store violation in Redis for monitoring
      try {
        await redisService.setex(
          `rate_limit_violation:${identifier}:${req.path}`,
          3600, // 1 hour
          JSON.stringify({
            timestamp: new Date().toISOString(),
            path: req.path,
            method: req.method,
            userAgent: req.get('User-Agent'),
            ip: req.ip,
            userId: req.user?.id,
          }),
        );
      } catch (error) {
        console.error('Failed to log rate limit violation:', error);
      }

      res.status(429).json({
        error: 'Too many requests',
        message:
          options.message ||
          'Too many response submissions, please try again later',
        retryAfter: Math.ceil((options.windowMs || 15 * 60 * 1000) / 1000),
      });
    },
  });
};

// Different rate limits for different response operations

// Strict rate limit for response submission (prevents spam)
export const responseSubmissionLimit = createResponseRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 responses per 15 minutes
  message:
    'Response submission limit reached. Please wait before submitting more responses.',
});

// Moderate rate limit for response updates (allows editing)
export const responseUpdateLimit = createResponseRateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 100, // 100 updates per 5 minutes
  message:
    'Response update limit reached. Please wait before making more changes.',
});

// Lenient rate limit for response retrieval (allows frequent polling)
export const responseRetrievalLimit = createResponseRateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 200, // 200 retrievals per 5 minutes
  message:
    'Response retrieval limit reached. Please reduce your request frequency.',
});

// Very strict rate limit for export operations (resource intensive)
export const responseExportLimit = createResponseRateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 exports per hour
  message:
    'Export limit reached. Please wait before requesting another export.',
});

// Questionnaire-specific rate limiting (per questionnaire)
export const createQuestionnaireRateLimit = (questionnaireId: string) => {
  return createResponseRateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 500, // 500 responses per questionnaire per hour
    keyGenerator: req => {
      const userKey = req.user?.id ? `user:${req.user.id}` : `ip:${req.ip}`;
      return `questionnaire:${questionnaireId}:${userKey}`;
    },
    message: `Too many responses for this questionnaire. Please wait before submitting more responses to questionnaire ${questionnaireId}.`,
  });
};

// User-specific response tracking (prevents duplicate submissions)
export class ResponseDuplicateTracker {
  private static instance: ResponseDuplicateTracker;

  public static getInstance(): ResponseDuplicateTracker {
    if (!ResponseDuplicateTracker.instance) {
      ResponseDuplicateTracker.instance = new ResponseDuplicateTracker();
    }
    return ResponseDuplicateTracker.instance;
  }

  // Check if user has already submitted a response for this question
  async hasUserSubmittedResponse(
    questionId: string,
    userId?: string,
    ipAddress?: string,
  ): Promise<boolean> {
    try {
      const key = userId
        ? `response_exists:${questionId}:user:${userId}`
        : `response_exists:${questionId}:ip:${ipAddress}`;

      const exists = await redisService.get(key);
      return exists === 'true';
    } catch (error) {
      console.error('Error checking response existence:', error);
      return false; // Allow submission if check fails
    }
  }

  // Mark that user has submitted a response for this question
  async markResponseSubmitted(
    questionId: string,
    userId?: string,
    ipAddress?: string,
  ): Promise<void> {
    try {
      const key = userId
        ? `response_exists:${questionId}:user:${userId}`
        : `response_exists:${questionId}:ip:${ipAddress}`;

      // Set with 24 hour expiration to allow for legitimate re-submissions
      await redisService.setex(key, 24 * 60 * 60, 'true');
    } catch (error) {
      console.error('Error marking response as submitted:', error);
    }
  }

  // Remove the mark (for admin operations or testing)
  async removeResponseMark(
    questionId: string,
    userId?: string,
    ipAddress?: string,
  ): Promise<void> {
    try {
      const key = userId
        ? `response_exists:${questionId}:user:${userId}`
        : `response_exists:${questionId}:ip:${ipAddress}`;

      await redisService.del(key);
    } catch (error) {
      console.error('Error removing response mark:', error);
    }
  }
}

// Autosave-specific rate limiting (more lenient for drafts)
export const autosaveRateLimit = createResponseRateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 300, // 300 autosaves per minute (5 per second)
  message: 'Autosave limit reached. Changes are being saved less frequently.',
});

// Bulk submission rate limiting (stricter due to potential impact)
export const bulkSubmissionRateLimit = createResponseRateLimit({
  windowMs: 30 * 60 * 1000, // 30 minutes
  max: 10, // 10 bulk submissions per 30 minutes
  message:
    'Bulk submission limit reached. Please wait before submitting more responses in bulk.',
});

// Smart rate limiting that adjusts based on user behavior
export class AdaptiveRateLimit {
  private static instance: AdaptiveRateLimit;

  public static getInstance(): AdaptiveRateLimit {
    if (!AdaptiveRateLimit.instance) {
      AdaptiveRateLimit.instance = new AdaptiveRateLimit();
    }
    return AdaptiveRateLimit.instance;
  }

  // Track user response patterns and adjust limits accordingly
  async getUserRiskScore(userId: string): Promise<number> {
    try {
      // Check for suspicious patterns
      const recentResponses = await redisService.get(
        `user_responses:${userId}:recent`,
      );
      const violationCount = await redisService.get(
        `user_violations:${userId}:count`,
      );

      let riskScore = 0;

      // High frequency submissions increase risk
      if (recentResponses && parseInt(recentResponses) > 100) {
        riskScore += 30;
      }

      // Previous violations increase risk
      if (violationCount && parseInt(violationCount) > 0) {
        riskScore += parseInt(violationCount) * 20;
      }

      // New users get slightly higher risk score
      const userAge = await redisService.get(`user_age:${userId}`);
      if (!userAge || parseInt(userAge) < 3600) {
        // Less than 1 hour
        riskScore += 10;
      }

      return Math.min(riskScore, 100);
    } catch (error) {
      console.error('Error calculating user risk score:', error);
      return 0;
    }
  }

  // Adjust rate limit based on risk score
  getAdjustedLimit(baseLimit: number, riskScore: number): number {
    if (riskScore > 70) {
      return Math.floor(baseLimit * 0.3); // 70% reduction
    } else if (riskScore > 50) {
      return Math.floor(baseLimit * 0.5); // 50% reduction
    } else if (riskScore > 30) {
      return Math.floor(baseLimit * 0.7); // 30% reduction
    }
    return baseLimit;
  }

  // Track user behavior
  async trackUserResponse(
    userId: string,
    questionnaireId: string,
  ): Promise<void> {
    try {
      const now = Date.now();

      // Track recent responses (sliding window)
      await redisService.lpush(
        `user_responses:${userId}:recent`,
        now.toString(),
      );
      await redisService.ltrim(`user_responses:${userId}:recent`, 0, 99); // Keep last 100
      await redisService.expire(`user_responses:${userId}:recent`, 3600); // 1 hour expiration

      // Track questionnaire-specific activity
      await redisService.incr(
        `user_questionnaire:${userId}:${questionnaireId}`,
      );
      await redisService.expire(
        `user_questionnaire:${userId}:${questionnaireId}`,
        3600,
      );

      // Update user age if this is their first activity
      const userAge = await redisService.get(`user_age:${userId}`);
      if (!userAge) {
        await redisService.set(`user_age:${userId}`, Math.floor(now / 1000));
        await redisService.expire(`user_age:${userId}`, 30 * 24 * 3600); // 30 days
      }
    } catch (error) {
      console.error('Error tracking user response:', error);
    }
  }

  // Log rate limit violations for this user
  async logViolation(userId: string, reason: string): Promise<void> {
    try {
      await redisService.incr(`user_violations:${userId}:count`);
      await redisService.expire(`user_violations:${userId}:count`, 24 * 3600); // 24 hours

      await redisService.lpush(
        `user_violations:${userId}:log`,
        JSON.stringify({
          timestamp: new Date().toISOString(),
          reason,
        }),
      );
      await redisService.ltrim(`user_violations:${userId}:log`, 0, 9); // Keep last 10
    } catch (error) {
      console.error('Error logging user violation:', error);
    }
  }
}

export default {
  responseSubmissionLimit,
  responseUpdateLimit,
  responseRetrievalLimit,
  responseExportLimit,
  autosaveRateLimit,
  bulkSubmissionRateLimit,
  createQuestionnaireRateLimit,
  ResponseDuplicateTracker,
  AdaptiveRateLimit,
};
