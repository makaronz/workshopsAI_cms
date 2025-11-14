import dotenv from 'dotenv';

dotenv.config();

export interface EmailProviderConfig {
  name: 'sendgrid' | 'mailgun' | 'nodemailer';
  apiKey?: string;
  domain?: string;
  fromEmail: string;
  fromName: string;
  replyTo?: string;
  webhookSecret?: string;
}

export interface EmailConfig {
  provider: EmailProviderConfig;
  rateLimit: {
    maxRequests: number;
    windowMs: number;
  };
  queue: {
    concurrency: number;
    maxRetries: number;
    retryDelay: number;
    backoffMultiplier: number;
  };
  tracking: {
    enabled: boolean;
    openTracking: boolean;
    clickTracking: boolean;
    unsubscribeTracking: boolean;
  };
  templates: {
    baseUrl: string;
    logoUrl: string;
    primaryColor: string;
    secondaryColor: string;
    socialLinks: {
      facebook?: string;
      twitter?: string;
      linkedin?: string;
      instagram?: string;
    };
  };
  compliance: {
    gdprCompliant: boolean;
    consentRequired: boolean;
    unsubscribeRequired: boolean;
    retentionDays: number;
  };
}

const getProviderConfig = (): EmailProviderConfig => {
  const provider = process.env.EMAIL_PROVIDER?.toLowerCase() || 'sendgrid';

  switch (provider) {
  case 'sendgrid':
    return {
      name: 'sendgrid',
      apiKey: process.env.SENDGRID_API_KEY,
      fromEmail: process.env.SENDGRID_FROM_EMAIL || 'noreply@workshopsai.com',
      fromName: process.env.SENDGRID_FROM_NAME || 'WorkshopsAI',
      replyTo: process.env.SENDGRID_REPLY_TO,
      webhookSecret: process.env.SENDGRID_WEBHOOK_SECRET,
    };

  case 'mailgun':
    return {
      name: 'mailgun',
      apiKey: process.env.MAILGUN_API_KEY,
      domain: process.env.MAILGUN_DOMAIN,
      fromEmail:
          process.env.MAILGUN_FROM_EMAIL ||
          `noreply@${process.env.MAILGUN_DOMAIN || 'workshopsai.com'}`,
      fromName: process.env.MAILGUN_FROM_NAME || 'WorkshopsAI',
      replyTo: process.env.MAILGUN_REPLY_TO,
      webhookSecret: process.env.MAILGUN_WEBHOOK_SECRET,
    };

  case 'nodemailer':
  default:
    return {
      name: 'nodemailer',
      fromEmail: process.env.SMTP_FROM_EMAIL || 'noreply@workshopsai.com',
      fromName: process.env.SMTP_FROM_NAME || 'WorkshopsAI',
      replyTo: process.env.SMTP_REPLY_TO,
    };
  }
};

export const emailConfig: EmailConfig = {
  provider: getProviderConfig(),
  rateLimit: {
    maxRequests: parseInt(process.env.EMAIL_RATE_LIMIT_MAX || '100'),
    windowMs: parseInt(process.env.EMAIL_RATE_LIMIT_WINDOW || '900000'), // 15 minutes
  },
  queue: {
    concurrency: parseInt(process.env.EMAIL_QUEUE_CONCURRENCY || '10'),
    maxRetries: parseInt(process.env.EMAIL_QUEUE_MAX_RETRIES || '3'),
    retryDelay: parseInt(process.env.EMAIL_QUEUE_RETRY_DELAY || '5000'), // 5 seconds
    backoffMultiplier: parseFloat(
      process.env.EMAIL_QUEUE_BACKOFF_MULTIPLIER || '2',
    ),
  },
  tracking: {
    enabled: process.env.EMAIL_TRACKING_ENABLED !== 'false',
    openTracking: process.env.EMAIL_OPEN_TRACKING !== 'false',
    clickTracking: process.env.EMAIL_CLICK_TRACKING !== 'false',
    unsubscribeTracking: process.env.EMAIL_UNSUBSCRIBE_TRACKING !== 'false',
  },
  templates: {
    baseUrl: process.env.EMAIL_BASE_URL || 'https://workshopsai.com',
    logoUrl: process.env.EMAIL_LOGO_URL || 'https://workshopsai.com/logo.png',
    primaryColor: process.env.EMAIL_PRIMARY_COLOR || '#4F46E5',
    secondaryColor: process.env.EMAIL_SECONDARY_COLOR || '#6B7280',
    socialLinks: {
      facebook: process.env.EMAIL_FACEBOOK_URL,
      twitter: process.env.EMAIL_TWITTER_URL,
      linkedin: process.env.EMAIL_LINKEDIN_URL,
      instagram: process.env.EMAIL_INSTAGRAM_URL,
    },
  },
  compliance: {
    gdprCompliant: process.env.EMAIL_GDPR_COMPLIANT !== 'false',
    consentRequired: process.env.EMAIL_CONSENT_REQUIRED !== 'false',
    unsubscribeRequired: process.env.EMAIL_UNSUBSCRIBE_REQUIRED !== 'false',
    retentionDays: parseInt(process.env.EMAIL_RETENTION_DAYS || '365'),
  },
};

export const validateEmailConfig = (): boolean => {
  try {
    const config = emailConfig;

    // Validate provider config
    if (!config.provider.fromEmail || !config.provider.fromName) {
      console.error('Missing required email provider configuration');
      return false;
    }

    // Validate specific provider requirements
    if (config.provider.name === 'sendgrid' && !config.provider.apiKey) {
      console.error('SendGrid API key is required');
      return false;
    }

    if (
      config.provider.name === 'mailgun' &&
      (!config.provider.apiKey || !config.provider.domain)
    ) {
      console.error('Mailgun API key and domain are required');
      return false;
    }

    return true;
  } catch (error) {
    console.error('Email configuration validation failed:', error);
    return false;
  }
};

export default emailConfig;
