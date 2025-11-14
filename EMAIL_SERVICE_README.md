# Email Service Integration for Workshop Management System

This document provides a comprehensive overview of the email service integration implemented for the WorkshopsAI CMS system.

## 🚀 Overview

The email service provides a robust, scalable email notification system that supports workshop management workflows, user communication, and GDPR-compliant email marketing. It includes multi-provider support (SendGrid, Mailgun, Nodemailer), queue-based processing, comprehensive tracking, and analytics.

## 📁 Project Structure

```
src/
├── config/
│   └── email.ts                    # Email provider configuration
├── services/
│   ├── emailService.ts             # Core email service
│   ├── emailQueue.ts               # BullMQ queue management
│   ├── emailValidationService.ts   # Email validation & blacklist
│   ├── emailAnalyticsService.ts    # Analytics & reporting
│   ├── emailRateLimitService.ts    # Rate limiting & throttling
│   └── workshopEmailService.ts    # Workshop workflow integration
├── templates/
│   └── emails/
│       ├── base.html               # Base HTML template
│       ├── base.txt                # Base text template
│       ├── workshop_invitation.html # Workshop invitation template
│       ├── session_reminder.html   # Session reminder template
│       └── questionnaire_reminder.html # Questionnaire reminder template
├── routes/api/
│   ├── notifications.ts           # Main email API routes
│   └── email-integration.ts       # Workshop integration endpoints
└── models/
    └── schema.ts                   # Email tracking database schema
```

## 🔧 Configuration

### Environment Variables

Add the following variables to your `.env` file:

```bash
# Email Provider Configuration
EMAIL_PROVIDER=sendgrid  # Options: sendgrid, mailgun, nodemailer

# SendGrid Configuration
SENDGRID_API_KEY=your_sendgrid_api_key_here
SENDGRID_FROM_EMAIL=noreply@workshopsai.com
SENDGRID_FROM_NAME=WorkshopsAI
SENDGRID_REPLY_TO=support@workshopsai.com
SENDGRID_WEBHOOK_SECRET=your_webhook_secret_here

# Mailgun Configuration
MAILGUN_API_KEY=your_mailgun_api_key_here
MAILGUN_DOMAIN=mg.yourdomain.com
MAILGUN_FROM_EMAIL=noreply@mg.yourdomain.com
MAILGUN_FROM_NAME=WorkshopsAI
MAILGUN_REPLY_TO=support@workshopsai.com
MAILGUN_WEBHOOK_SECRET=your_webhook_secret_here

# Email Settings
EMAIL_BASE_URL=https://workshopsai.com
EMAIL_LOGO_URL=https://workshopsai.com/logo.png
EMAIL_PRIMARY_COLOR=#4F46E5
EMAIL_SECONDARY_COLOR=#6B7280

# Email Tracking
EMAIL_TRACKING_ENABLED=true
EMAIL_OPEN_TRACKING=true
EMAIL_CLICK_TRACKING=true
EMAIL_UNSUBSCRIBE_TRACKING=true

# Email Rate Limiting
EMAIL_RATE_LIMIT_MAX=100
EMAIL_RATE_LIMIT_WINDOW=900000

# Email Queue Settings
EMAIL_QUEUE_CONCURRENCY=10
EMAIL_QUEUE_MAX_RETRIES=3
EMAIL_QUEUE_RETRY_DELAY=5000
EMAIL_QUEUE_BACKOFF_MULTIPLIER=2

# GDPR Compliance
EMAIL_GDPR_COMPLIANT=true
EMAIL_CONSENT_REQUIRED=true
EMAIL_UNSUBSCRIBE_REQUIRED=true
EMAIL_RETENTION_DAYS=365
```

## 📊 Database Schema

The email service extends the existing database schema with the following tables:

### Email Tables

- **`emailTemplates`** - Email template definitions
- **`emailLogs`** - Comprehensive email tracking and delivery logs
- **`emailConsents`** - GDPR consent management
- **`emailQueueJobs`** - BullMQ job tracking
- **`emailBlacklist`** - Email suppression list

## 🚀 Key Features

### 1. Multi-Provider Support
- **SendGrid**: Full-featured email delivery with analytics
- **Mailgun**: Reliable email delivery with webhook support
- **Nodemailer**: SMTP support for custom email servers

### 2. Queue-Based Processing
- **BullMQ**: Reliable job queue with retry logic
- **Priority Queuing**: High-priority emails processed first
- **Retry Logic**: Exponential backoff with configurable retries
- **Scheduled Emails**: Send emails at specific times

### 3. Email Validation & Security
- **Email Validation**: Comprehensive email address validation
- **Blacklist Management**: Automatic and manual blacklist support
- **Bounce Handling**: Process bounce events from providers
- **Spam Complaints**: Handle spam complaints automatically

### 4. Multi-Language Support
- **Polish (PL)**: Full Polish language support
- **English (EN)**: Full English language support
- **Dynamic Templates**: Language-specific content rendering

### 5. Advanced Tracking & Analytics
- **Delivery Tracking**: Real-time delivery status updates
- **Open Tracking**: Email open rates and engagement
- **Click Tracking**: Link click-through rates
- **Comprehensive Reports**: Detailed analytics and insights

### 6. Rate Limiting & Throttling
- **Global Limits**: Overall system rate limits
- **User Limits**: Per-user rate limiting
- **Email Type Limits**: Type-specific rate limits
- **Throttling**: Smooth delivery rate control

### 7. GDPR Compliance
- **Consent Management**: Explicit consent tracking
- **Unsubscribe**: Easy unsubscribe functionality
- **Data Retention**: Configurable data retention policies
- **Privacy**: User privacy protection

## 🔌 API Endpoints

### Core Email Operations

#### Send Email
```typescript
POST /api/notifications/send
```

#### Send Workshop Invitation
```typescript
POST /api/notifications/workshop-invitation
```

#### Send Session Reminder
```typescript
POST /api/notifications/session-reminder
```

#### Send Questionnaire Reminder
```typescript
POST /api/notifications/questionnaire-reminder
```

### Analytics & Monitoring

#### Get Email Statistics
```typescript
GET /api/notifications/stats
```

#### Get Email Logs
```typescript
GET /api/notifications/logs
```

#### Get Queue Status
```typescript
GET /api/notifications/queue/status
```

### Management & Control

#### Pause/Resume Queue
```typescript
POST /api/notifications/queue/pause
POST /api/notifications/queue/resume
```

#### Manage Email Consent
```typescript
POST /api/notifications/consent
```

#### Blacklist Management
```typescript
POST /api/notifications/blacklist
POST /api/notifications/unblacklist
```

### Workshop Integration

#### Batch Workshop Invitations
```typescript
POST /api/email-integration/workshop/:workshopId/invite
```

#### Session Reminders
```typescript
POST /api/email-integration/workshop/:workshopId/session/:sessionId/remind
```

#### Automated Reminders
```typescript
POST /api/email-integration/workshop/:workshopId/schedule-reminders
```

## 📧 Email Templates

### Available Templates

1. **Workshop Invitation** (`workshop_invitation`)
   - Professional workshop invitation emails
   - Dynamic workshop details
   - Call-to-action buttons

2. **Session Reminder** (`session_reminder`)
   - Session timing reminders
   - Location and materials information
   - Participation status

3. **Questionnaire Reminder** (`questionnaire_reminder`)
   - Questionnaire completion reminders
   - Importance messaging
   - Progress tracking

4. **Base Templates**
   - Responsive HTML base template
   - Plain text fallback
   - Consistent branding

### Template Customization

Templates use Handlebars for dynamic content:

```handlebars
<h1>{{#if language 'pl'}}Tytuł warsztatu{{else}}Workshop Title{{/if}}</h1>
<p>{{workshop.description}}</p>
<div class="btn">
  <a href="{{baseUrl}}/workshops/{{workshop.slug}}/enroll">
    {{#if language 'pl'}}Zapisz się{{else}}Enroll Now{{/if}}
  </a>
</div>
```

## 🔧 Usage Examples

### Sending a Workshop Invitation

```typescript
import { workshopEmailService } from './services/workshopEmailService';

const result = await workshopEmailService.sendWorkshopInvitation(
  'workshop-id',
  'participant@example.com',
  {
    priority: 'high',
    scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // Tomorrow
  }
);

if (result.success) {
  console.log('Invitation sent successfully');
} else {
  console.error('Failed to send invitation:', result.error);
}
```

### Sending Session Reminders

```typescript
const result = await workshopEmailService.sendSessionReminders(
  'workshop-id',
  'session-id',
  {
    priority: 'high',
    immediate: false // Queue for later processing
  }
);

console.log(`Sent: ${result.sent}, Failed: ${result.failed}`);
```

### Getting Email Analytics

```typescript
import { emailAnalyticsService } from './services/emailAnalyticsService';

const analytics = await emailAnalyticsService.generateReport(
  new Date('2024-01-01'),
  new Date('2024-01-31')
);

console.log('Email Statistics:', analytics.summary);
console.log('Top Templates:', analytics.topTemplates);
console.log('Bounce Analysis:', analytics.bounceAnalysis);
```

## 🔄 Email Provider Setup

### SendGrid Setup

1. Create a SendGrid account
2. Generate an API key
3. Set up sender authentication
4. Configure webhooks for delivery events
5. Add API key to environment variables

### Mailgun Setup

1. Create a Mailgun account
2. Configure your domain (add MX records)
3. Generate API key
4. Set up webhooks
5. Add configuration to environment variables

### SMTP (Nodemailer) Setup

1. Configure your SMTP server
2. Set up authentication
3. Configure security (TLS/SSL)
4. Add SMTP settings to environment variables

## 🔍 Webhook Configuration

### SendGrid Webhooks

Configure webhooks to receive:
- Delivered events
- Open events
- Click events
- Bounce events
- Spam complaints

### Mailgun Webhooks

Configure webhooks to receive:
- Delivered
- Opened
- Clicked
- Bounced
- Complained

## 📈 Monitoring & Maintenance

### Queue Monitoring

Monitor the email queue status:
- Check pending jobs
- Monitor failed jobs
- Track processing rates
- Alert on queue issues

### Analytics Reports

Regular reports should include:
- Delivery rates
- Open rates
- Click-through rates
- Bounce rates
- Provider performance

### Maintenance Tasks

- Clean up old email logs (based on retention policy)
- Monitor blacklist effectiveness
- Update email templates
- Review rate limit settings
- Clean up queue jobs

## 🛡️ Security Considerations

### Email Security

- Validate all email addresses before sending
- Implement proper rate limiting
- Use HTTPS for all webhook endpoints
- Validate webhook signatures
- Monitor for spam complaints

### Data Privacy

- Follow GDPR consent requirements
- Implement proper data retention
- Secure unsubscribe functionality
- Anonymize sensitive data where possible

## 🧪 Testing

### Email Validation Testing

```typescript
import { emailValidationService } from './services/emailValidationService';

const validation = await emailValidationService.validateEmail('test@example.com');
console.log('Validation Result:', validation);
```

### Rate Limit Testing

```typescript
import { emailRateLimitService } from './services/emailRateLimitService';

const rateLimit = await emailRateLimitService.checkRateLimit(
  'user',
  'user@example.com'
);

console.log('Rate Limit Status:', rateLimit);
```

## 🚀 Deployment

### Environment Configuration

1. Set up appropriate environment variables
2. Configure Redis for queue processing
3. Set up database for email logs
4. Configure email provider webhooks
5. Set up monitoring and logging

### Queue Processing

1. Ensure Redis is running and configured
2. Start BullMQ worker processes
3. Monitor queue health
4. Set up proper error handling
5. Configure restart policies

## 📚 Additional Documentation

- [BullMQ Documentation](https://docs.bullmq.dev/)
- [SendGrid API Documentation](https://docs.sendgrid.com/api-reference/)
- [Mailgun Documentation](https://documentation.mailgun.com/)
- [Handlebars Documentation](https://handlebarsjs.com/)

## 🐛 Troubleshooting

### Common Issues

1. **Emails not sending**: Check provider API keys and configuration
2. **Queue not processing**: Verify Redis connection and BullMQ setup
3. **High bounce rates**: Review email validation and blacklist settings
4. **Rate limit errors**: Check rate limit configuration and provider limits
5. **Template rendering errors**: Validate Handlebars syntax and data structure

### Debug Mode

Enable debug logging by setting `LOG_LEVEL=debug` in your environment variables.

## 📞 Support

For email service related issues, check:
1. Application logs for error messages
2. Queue status and job details
3. Email provider dashboards
4. Database email logs
5. Rate limit status

---

This email service provides a comprehensive solution for workshop management notifications with enterprise-grade features including multi-provider support, queue-based processing, advanced analytics, and GDPR compliance.