import { Request, Response, NextFunction } from 'express';
import { createHash, randomBytes } from 'crypto';
import { db, users, consents, auditLogs } from '../config/postgresql-database';
import { eq, and, desc } from 'drizzle-orm';

/**
 * GDPR Compliance Middleware
 * Implements data protection, consent management, and audit logging
 */

// Consent types for GDPR compliance
export const CONSENT_TYPES = {
  MARKETING: 'marketing',
  ANALYTICS: 'analytics',
  PERSONALIZATION: 'personalization',
  RESEARCH_ANALYSIS: 'research_analysis',
  DATA_SHARING: 'data_sharing',
  COMMUNICATIONS: 'communications',
} as const;

// Data processing purposes
export const PROCESSING_PURPOSES = {
  WORKSHOP_MANAGEMENT: 'workshop_management',
  USER_ACCOUNT: 'user_account',
  COMMUNICATIONS: 'communications',
  ANALYTICS: 'analytics',
  RESEARCH: 'research',
  LEGAL_COMPLIANCE: 'legal_compliance',
} as const;

/**
 * GDPR consent middleware
 */
export const gdprConsent = (requiredConsents: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          error: 'Authentication required',
          message: 'User must be authenticated for consent verification',
        });
      }

      // Check user's consents
      const userConsents = await db
        .select({
          consentType: consents.consentType,
          granted: consents.granted,
          updatedAt: consents.updatedAt,
        })
        .from(consents)
        .where(eq(consents.userId, req.user.id));

      const consentMap = new Map(
        userConsents.map(consent => [consent.consentType, consent.granted]),
      );

      // Verify all required consents are granted
      const missingConsents = requiredConsents.filter(
        consentType => !consentMap.get(consentType),
      );

      if (missingConsents.length > 0) {
        return res.status(403).json({
          error: 'Consent required',
          message: `Missing consent for: ${missingConsents.join(', ')}`,
          requiredConsents: missingConsents,
        });
      }

      // Log consent verification
      await logDataProcessing(req, 'CONSENT_VERIFICATION', {
        requiredConsents,
        verifiedConsents: Array.from(consentMap.entries()),
      });

      next();
    } catch (error) {
      console.error('GDPR consent verification error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Consent verification failed',
      });
    }
  };
};

/**
 * Data anonymization utilities
 */
export const anonymizeData = (data: any, fieldsToAnonymize: string[]): any => {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  const anonymized = { ...data };

  fieldsToAnonymize.forEach(field => {
    if (anonymized[field]) {
      anonymized[field] = hashField(anonymized[field]);
    }
  });

  return anonymized;
};

/**
 * Hash field for anonymization
 */
export const hashField = (value: string): string => {
  return createHash('sha256')
    .update(value + process.env.ANONYMIZATION_SALT!)
    .digest('hex');
};

/**
 * PII detection and masking
 */
export const maskPII = (data: any): any => {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  const piiPatterns = {
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    phone: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
    ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
    creditCard: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
    ipAddress: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
  };

  const masked = { ...data };

  const maskValue = (value: string, pattern: RegExp): string => {
    return value.replace(pattern, (match) => {
      if (match.length <= 4) return '****';
      return match.substring(0, 2) + '*'.repeat(match.length - 4) + match.substring(match.length - 2);
    });
  };

  // Recursively mask PII in object
  const maskObject = (obj: any): any => {
    if (typeof obj === 'string') {
      let masked = obj;
      Object.values(piiPatterns).forEach(pattern => {
        masked = maskValue(masked, pattern);
      });
      return masked;
    }

    if (Array.isArray(obj)) {
      return obj.map(maskObject);
    }

    if (typeof obj === 'object' && obj !== null) {
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = maskObject(value);
      }
      return result;
    }

    return obj;
  };

  return maskObject(masked);
};

/**
 * Data retention policy enforcement
 */
export const enforceDataRetention = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const retentionPeriods = {
      users: 365 * 7, // 7 years for user accounts
      responses: 365 * 5, // 5 years for questionnaire responses
      enrollments: 365 * 3, // 3 years for enrollments
      auditLogs: 365 * 10, // 10 years for audit logs
    };

    // This would be implemented as a background job
    // For now, we'll log the retention check
    await logDataProcessing(req, 'RETENTION_CHECK', { retentionPeriods });

    next();
  } catch (error) {
    console.error('Data retention enforcement error:', error);
    next(); // Don't block requests for retention issues
  }
};

/**
 * Right to be forgotten (GDPR Article 17)
 */
export const rightToBeForgotten = async (userId: string) => {
  try {
    // Start transaction
    await db.transaction(async (tx) => {
      // Anonymize user data instead of deleting (for data integrity)
      const anonymizedEmail = `deleted-${randomBytes(16).toString('hex')}@deleted.com`;
      const anonymizedName = 'Deleted User';

      await tx
        .update(users)
        .set({
          email: anonymizedEmail,
          name: anonymizedName,
          bio: null,
          avatar: null,
          isActive: false,
          deletedAt: new Date(),
        })
        .where(eq(users.id, userId));

      // Log the erasure request
      await tx.insert(auditLogs).values({
        userId,
        tableName: 'users',
        recordId: userId,
        operation: 'DELETE',
        oldValues: null, // Don't log the original data for privacy
        newValues: { status: 'anonymized' },
        ipAddress: null,
        userAgent: null,
        timestamp: new Date(),
      });
    });

    return { success: true, message: 'User data anonymized successfully' };
  } catch (error) {
    console.error('Right to be forgotten error:', error);
    return { success: false, error: 'Failed to anonymize user data' };
  }
};

/**
 * Data subject access request (GDPR Article 15)
 */
export const dataSubjectAccessRequest = async (userId: string) => {
  try {
    // Get all user data
    const userData = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        createdAt: users.createdAt,
        lastLoginAt: users.lastLoginAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const userConsents = await db
      .select({
        consentType: consents.consentType,
        granted: consents.granted,
        createdAt: consents.createdAt,
        updatedAt: consents.updatedAt,
        ipAddress: consents.ipAddress,
        userAgent: consents.userAgent,
      })
      .from(consents)
      .where(eq(consents.userId, userId));

    const userAuditLogs = await db
      .select({
        tableName: auditLogs.tableName,
        operation: auditLogs.operation,
        timestamp: auditLogs.timestamp,
        ipAddress: auditLogs.ipAddress,
        userAgent: auditLogs.userAgent,
      })
      .from(auditLogs)
      .where(eq(auditLogs.userId, userId))
      .orderBy(desc(auditLogs.timestamp))
      .limit(100);

    // Compile data package
    const dataPackage = {
      personalData: userData,
      consents: userConsents,
      activityLogs: userAuditLogs,
      exportDate: new Date().toISOString(),
      format: 'JSON',
    };

    return {
      success: true,
      data: dataPackage,
      message: 'Data exported successfully',
    };
  } catch (error) {
    console.error('Data subject access request error:', error);
    return {
      success: false,
      error: 'Failed to export user data',
    };
  }
};

/**
 * Consent management
 */
export const updateConsent = async (
  userId: string,
  consentType: string,
  granted: boolean,
  ipAddress?: string,
  userAgent?: string,
) => {
  try {
    const result = await db
      .insert(consents)
      .values({
        userId,
        consentType,
        granted,
        ipAddress,
        userAgent,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [consents.userId, consents.consentType],
        set: {
          granted,
          ipAddress,
          userAgent,
          updatedAt: new Date(),
        },
      })
      .returning();

    return {
      success: true,
      data: result[0],
      message: `Consent updated successfully for ${consentType}`,
    };
  } catch (error) {
    console.error('Consent update error:', error);
    return {
      success: false,
      error: 'Failed to update consent',
    };
  }
};

/**
 * Get user consents
 */
export const getUserConsents = async (userId: string) => {
  try {
    const userConsents = await db
      .select({
        consentType: consents.consentType,
        granted: consents.granted,
        createdAt: consents.createdAt,
        updatedAt: consents.updatedAt,
        ipAddress: consents.ipAddress,
        userAgent: consents.userAgent,
      })
      .from(consents)
      .where(eq(consents.userId, userId));

    return {
      success: true,
      data: userConsents,
    };
  } catch (error) {
    console.error('Get user consents error:', error);
    return {
      success: false,
      error: 'Failed to retrieve user consents',
    };
  }
};

/**
 * Data processing audit logging
 */
export const logDataProcessing = async (
  req: Request,
  operation: string,
  details: any = {},
) => {
  try {
    await db.insert(auditLogs).values({
      userId: req.user?.id || null,
      tableName: 'data_processing',
      recordId: randomBytes(16).toString('hex'),
      operation,
      oldValues: null,
      newValues: {
        operation,
        details,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        timestamp: new Date().toISOString(),
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Data processing log error:', error);
    // Don't throw - logging failures shouldn't block operations
  }
};

/**
 * GDPR compliance headers middleware
 */
export const gdprHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Add GDPR compliance headers
  res.setHeader('X-GDPR-Compliant', 'true');
  res.setHeader('X-Data-Protection-Officer', 'dpo@workshopsai.com');
  res.setHeader('X-Privacy-Policy', '/privacy-policy');
  res.setHeader('X-Cookie-Policy', '/cookie-policy');

  // Add contact information for data subject requests
  res.setHeader('X-Data-Subject-Requests', 'mailto:privacy@workshopsai.com');

  next();
};

/**
 * Cookie consent middleware
 */
export const cookieConsent = (req: Request, res: Response, next: NextFunction) => {
  const cookieConsent = req.headers['x-cookie-consent'];

  if (!cookieConsent) {
    res.setHeader('X-Cookie-Consent-Required', 'true');
  }

  next();
};

/**
 * Data breach notification middleware
 */
export const dataBreachDetection = (req: Request, res: Response, next: NextFunction) => {
  // Monitor for potential data breaches
  const suspiciousPatterns = [
    /(?=.*\bselect\b)(?=.*\bfrom\b)(?=.*\bwhere\b)/i, // SQL injection
    /(?=.*\bunion\b)(?=.*\bselect\b)/i, // SQL injection
    /<script[^>]*>.*?<\/script>/gi, // XSS
    /javascript:/i, // JavaScript protocol
    /data:text\/html/i, // Data URI
  ];

  const requestData = JSON.stringify({
    query: req.query,
    params: req.params,
    body: req.body,
  });

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(requestData)) {
      // Log potential breach
      logDataProcessing(req, 'POTENTIAL_BREACH', {
        pattern: pattern.source,
        requestData: requestData.substring(0, 1000), // Limit log size
      });

      // You might want to send alerts here
      console.warn(`POTENTIAL DATA BREACH DETECTED: ${req.method} ${req.path} from ${req.ip}`);
    }
  }

  next();
};

/**
 * DPIA (Data Protection Impact Assessment) requirements
 */
export const dpiaRequirements = {
  highRiskProcessing: [
    'systematic monitoring',
    'large scale processing of special categories',
    'processing using new technologies',
    'data matching across databases',
  ],
  requiredMeasures: [
    'description of processing',
    'assessment of necessity and proportionality',
    'risks to rights and freedoms',
    'mitigation measures',
  ],
};

/**
 * DPIA validation middleware
 */
export const dpiaValidation = (processingType: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const requiresDPIA = dpiaRequirements.highRiskProcessing.includes(processingType);

    if (requiresDPIA) {
      // Check if DPIA has been completed for this processing type
      // This would typically involve checking a database or configuration
      const dpiaCompleted = false; // This should be checked against your DPIA records

      if (!dpiaCompleted) {
        return res.status(403).json({
          error: 'DPIA Required',
          message: `Data Protection Impact Assessment required for ${processingType}`,
          requirements: dpiaRequirements.requiredMeasures,
        });
      }
    }

    next();
  };
};

/**
 * Data minimization middleware
 */
export const dataMinimization = (allowedFields: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.body && typeof req.body === 'object') {
      const minimizedBody: any = {};

      allowedFields.forEach(field => {
        if (req.body[field] !== undefined) {
          minimizedBody[field] = req.body[field];
        }
      });

      req.body = minimizedBody;
    }

    next();
  };
};

/**
 * Purpose limitation middleware
 */
export const purposeLimitation = (allowedPurpose: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Check if the request has a valid purpose header
    const purpose = req.headers['x-processing-purpose'] as string;

    if (!purpose || purpose !== allowedPurpose) {
      return res.status(403).json({
        error: 'Purpose Limitation Violation',
        message: `Processing not allowed for purpose: ${purpose}`,
        allowedPurpose,
      });
    }

    next();
  };
};

export {
  gdprConsent as default,
  anonymizeData,
  maskPII,
  enforceDataRetention,
  rightToBeForgotten,
  dataSubjectAccessRequest,
  updateConsent,
  getUserConsents,
  logDataProcessing,
  gdprHeaders,
  cookieConsent,
  dataBreachDetection,
  dpiaValidation,
  dataMinimization,
  purposeLimitation,
  CONSENT_TYPES,
  PROCESSING_PURPOSES,
};
