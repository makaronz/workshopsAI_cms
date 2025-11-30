/**
 * Anonymization Service
 * Removes PII (Personally Identifiable Information) from participant data
 * GDPR Compliance for Workshop Intelligence
 */

export interface AnonymizedContribution {
  participantId: string; // Anonymous ID like "Participant_1"
  answers: Array<{
    questionId: string;
    questionText: string;
    answerData: any;
  }>;
}

export interface AnonymizationConfig {
  removeEmails: boolean;
  removeNames: boolean;
  removePhoneNumbers: boolean;
  removeURLs: boolean;
  removeIPAddresses: boolean;
  customPatterns?: RegExp[];
}

export class AnonymizationService {
  private readonly defaultConfig: AnonymizationConfig = {
    removeEmails: true,
    removeNames: true,
    removePhoneNumbers: true,
    removeURLs: false, // Keep URLs as they might be relevant
    removeIPAddresses: true,
    customPatterns: [],
  };

  // PII Detection Patterns
  private readonly patterns = {
    // Email addresses
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,

    // Names (First Last pattern, capitalized)
    name: /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g,

    // Phone numbers (various formats)
    phone: /(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,

    // URLs
    url: /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g,

    // IP Addresses
    ipAddress: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,

    // Social Security Numbers (US format)
    ssn: /\b\d{3}-\d{2}-\d{4}\b/g,

    // Credit Card Numbers (basic pattern)
    creditCard: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,

    // Postal Codes (various formats)
    postalCode: /\b\d{5}(?:-\d{4})?\b|\b[A-Z]\d[A-Z] \d[A-Z]\d\b/g,
  };

  /**
   * Anonymize participant contributions for LLM processing
   */
  anonymizeContributions(
    contributions: Array<{
      userId: string;
      answers: Array<{
        questionId: string;
        questionText: string;
        answerData: any;
      }>;
    }>,
    config: Partial<AnonymizationConfig> = {},
  ): AnonymizedContribution[] {
    const finalConfig = { ...this.defaultConfig, ...config };

    return contributions.map((contribution, index) => {
      const anonymizedAnswers = contribution.answers.map((answer) => ({
        questionId: answer.questionId,
        questionText: this.anonymizeText(answer.questionText, finalConfig),
        answerData: this.anonymizeAnswerData(answer.answerData, finalConfig),
      }));

      return {
        participantId: `Participant_${index + 1}`,
        answers: anonymizedAnswers,
      };
    });
  }

  /**
   * Anonymize answer data (handles various data types)
   */
  private anonymizeAnswerData(
    data: any,
    config: AnonymizationConfig,
  ): any {
    if (typeof data === 'string') {
      return this.anonymizeText(data, config);
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.anonymizeAnswerData(item, config));
    }

    if (typeof data === 'object' && data !== null) {
      const anonymized: any = {};
      for (const key in data) {
        if (data.hasOwnProperty(key)) {
          anonymized[key] = this.anonymizeAnswerData(data[key], config);
        }
      }
      return anonymized;
    }

    return data;
  }

  /**
   * Anonymize text by removing PII
   */
  private anonymizeText(text: string, config: AnonymizationConfig): string {
    if (!text || typeof text !== 'string') return text;

    let anonymized = text;

    // Remove emails
    if (config.removeEmails) {
      anonymized = anonymized.replace(this.patterns.email, '[EMAIL_REDACTED]');
    }

    // Remove names
    if (config.removeNames) {
      anonymized = anonymized.replace(this.patterns.name, '[NAME_REDACTED]');
    }

    // Remove phone numbers
    if (config.removePhoneNumbers) {
      anonymized = anonymized.replace(this.patterns.phone, '[PHONE_REDACTED]');
    }

    // Remove URLs
    if (config.removeURLs) {
      anonymized = anonymized.replace(this.patterns.url, '[URL_REDACTED]');
    }

    // Remove IP addresses
    if (config.removeIPAddresses) {
      anonymized = anonymized.replace(
        this.patterns.ipAddress,
        '[IP_REDACTED]',
      );
    }

    // Remove SSNs
    anonymized = anonymized.replace(this.patterns.ssn, '[SSN_REDACTED]');

    // Remove credit card numbers
    anonymized = anonymized.replace(
      this.patterns.creditCard,
      '[CC_REDACTED]',
    );

    // Remove postal codes
    anonymized = anonymized.replace(
      this.patterns.postalCode,
      '[POSTAL_REDACTED]',
    );

    // Apply custom patterns
    if (config.customPatterns && config.customPatterns.length > 0) {
      config.customPatterns.forEach((pattern) => {
        anonymized = anonymized.replace(pattern, '[REDACTED]');
      });
    }

    return anonymized;
  }

  /**
   * Format anonymized data for LLM prompt
   */
  formatForLLM(anonymizedContributions: AnonymizedContribution[]): string {
    return anonymizedContributions
      .map((contribution) => {
        const answersText = contribution.answers
          .map(
            (answer) =>
              `Q: ${answer.questionText}\nA: ${this.formatAnswerForDisplay(answer.answerData)}`,
          )
          .join('\n\n');

        return `${contribution.participantId}:\n${answersText}`;
      })
      .join('\n\n---\n\n');
  }

  /**
   * Format answer data for display
   */
  private formatAnswerForDisplay(data: any): string {
    if (typeof data === 'string') return data;
    if (typeof data === 'number') return data.toString();
    if (typeof data === 'boolean') return data ? 'Yes' : 'No';
    if (Array.isArray(data)) return data.join(', ');
    if (typeof data === 'object' && data !== null) {
      return JSON.stringify(data, null, 2);
    }
    return String(data);
  }

  /**
   * Validate anonymization (check if PII was removed)
   */
  validateAnonymization(text: string): {
    isValid: boolean;
    detectedPII: string[];
  } {
    const detectedPII: string[] = [];

    if (this.patterns.email.test(text)) {
      detectedPII.push('Email addresses found');
    }
    if (this.patterns.phone.test(text)) {
      detectedPII.push('Phone numbers found');
    }
    if (this.patterns.ssn.test(text)) {
      detectedPII.push('SSN found');
    }
    if (this.patterns.creditCard.test(text)) {
      detectedPII.push('Credit card numbers found');
    }

    return {
      isValid: detectedPII.length === 0,
      detectedPII,
    };
  }

  /**
   * Get anonymization statistics
   */
  getAnonymizationStats(
    original: string,
    anonymized: string,
  ): {
    originalLength: number;
    anonymizedLength: number;
    redactionsCount: number;
    reductionPercentage: number;
  } {
    const redactionsCount = (anonymized.match(/\[.*?_REDACTED\]/g) || [])
      .length;

    return {
      originalLength: original.length,
      anonymizedLength: anonymized.length,
      redactionsCount,
      reductionPercentage:
        ((original.length - anonymized.length) / original.length) * 100,
    };
  }
}

export const anonymizationService = new AnonymizationService();
