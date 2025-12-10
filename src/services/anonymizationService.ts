/**
 * Anonymization Service
 * Removes Personally Identifiable Information (PII) from participant data
 * before sending to LLM for analysis (GDPR compliance)
 */

export interface AnonymizedContribution {
  participantId: string; // Anonymous ID like "Participant_1"
  answers: Array<{
    questionId: string;
    questionText: string;
    answerData: any;
  }>;
}

export class AnonymizationService {
  // Common PII patterns to detect and remove
  private readonly piiPatterns = [
    // Email addresses
    { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, replacement: '[EMAIL]' },
    
    // Phone numbers (various formats)
    { pattern: /\b(\+?[0-9]{1,3}[-.\s]?)?(\()?[0-9]{3}(\))?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g, replacement: '[PHONE]' },
    
    // Names (capitalized words, common pattern: FirstName LastName)
    { pattern: /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, replacement: '[NAME]' },
    
    // URLs
    { pattern: /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g, replacement: '[URL]' },
    
    // IP addresses
    { pattern: /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g, replacement: '[IP]' },
    
    // Credit card numbers (basic pattern)
    { pattern: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, replacement: '[CARD]' },
    
    // Social security numbers (US format)
    { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[SSN]' },
    
    // Addresses (basic pattern: number + street name)
    { pattern: /\b\d{1,5}\s+([A-Z][a-z]+\s+){1,3}(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr)\b/gi, replacement: '[ADDRESS]' },
  ];

  /**
   * Anonymize participant contributions before sending to LLM
   * @param contributions - Array of participant contributions with answers
   * @param questions - Array of questions to include question text
   * @returns Anonymized data ready for LLM processing
   */
  anonymize(
    contributions: Array<{
      userId: string;
      answers: Array<{
        questionId: string;
        answerData: any;
      }>;
    }>,
    questions: Array<{
      id: string;
      questionText: string;
    }>,
  ): AnonymizedContribution[] {
    return contributions.map((contribution, index) => {
      const anonymizedAnswers = contribution.answers.map(answer => {
        // Find the question text
        const question = questions.find(q => q.id === answer.questionId);
        const questionText = question?.questionText || 'Unknown Question';

        // Anonymize the answer data
        const anonymizedAnswerData = this.removePII(answer.answerData);

        return {
          questionId: answer.questionId,
          questionText,
          answerData: anonymizedAnswerData,
        };
      });

      return {
        participantId: `Participant_${index + 1}`,
        answers: anonymizedAnswers,
      };
    });
  }

  /**
   * Remove PII from a single data object
   * @param data - Any data structure (string, object, array)
   * @returns Data with PII removed
   */
  private removePII(data: any): any {
    if (typeof data === 'string') {
      return this.sanitizeText(data);
    }

    if (Array.isArray(data)) {
      return data.map(item => this.removePII(item));
    }

    if (typeof data === 'object' && data !== null) {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(data)) {
        sanitized[key] = this.removePII(value);
      }
      return sanitized;
    }

    return data;
  }

  /**
   * Sanitize text by replacing PII patterns
   * @param text - Text to sanitize
   * @returns Sanitized text
   */
  private sanitizeText(text: string): string {
    let sanitized = text;

    for (const { pattern, replacement } of this.piiPatterns) {
      sanitized = sanitized.replace(pattern, replacement);
    }

    return sanitized;
  }

  /**
   * Format anonymized data for LLM prompt
   * @param anonymizedData - Anonymized contributions
   * @returns Formatted string ready for LLM
   */
  formatForLLM(anonymizedData: AnonymizedContribution[]): string {
    let formatted = '';

    for (const contribution of anonymizedData) {
      formatted += `\n## ${contribution.participantId}\n\n`;

      for (const answer of contribution.answers) {
        formatted += `**Q: ${answer.questionText}**\n`;
        
        // Format answer based on type
        if (typeof answer.answerData === 'object') {
          if (answer.answerData.value !== undefined) {
            formatted += `A: ${answer.answerData.value}\n\n`;
          } else if (answer.answerData.selected !== undefined) {
            formatted += `A: ${Array.isArray(answer.answerData.selected) ? answer.answerData.selected.join(', ') : answer.answerData.selected}\n\n`;
          } else {
            formatted += `A: ${JSON.stringify(answer.answerData)}\n\n`;
          }
        } else {
          formatted += `A: ${answer.answerData}\n\n`;
        }
      }
    }

    return formatted;
  }

  /**
   * Validate that PII has been properly removed
   * @param text - Text to validate
   * @returns true if no obvious PII detected, false otherwise
   */
  validateAnonymization(text: string): boolean {
    // Check for common PII patterns
    const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const phonePattern = /\b(\+?[0-9]{1,3}[-.\s]?)?(\()?[0-9]{3}(\))?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g;

    if (emailPattern.test(text) || phonePattern.test(text)) {
      console.warn('⚠️ Potential PII detected in anonymized text!');
      return false;
    }

    return true;
  }
}
