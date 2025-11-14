import crypto from 'crypto';
import { Response } from '../models/llm-schema';

/**
 * PII patterns for detection and redaction
 */
const PII_PATTERNS = {
  email: {
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    replacement: '[EMAIL]',
    description: 'Email addresses',
  },
  phone: {
    pattern:
      /(?:\+?(\d{1,3}))?[-. (]*(\d{3})[-. )]*(\d{3})[-. ]*(\d{4})(?:\s*(?:ext\.?|extension|x)\s*(\d+))?/g,
    replacement: '[TELEFON]',
    description: 'Phone numbers (international format supported)',
  },
  polishPesel: {
    pattern: /\b\d{11}\b(?![^\d])/g,
    replacement: '[PESEL]',
    description: 'Polish PESEL numbers',
  },
  polishNip: {
    pattern: /\b\d{10}-\d{3}\b|\b\d{13}\b/g,
    replacement: '[NIP]',
    description: 'Polish NIP (VAT) numbers',
  },
  polishRegon: {
    pattern: /\b\d{9}\b|\b\d{14}\b/g,
    replacement: '[REGON]',
    description: 'Polish REGON numbers',
  },
  polishPostCode: {
    pattern: /\b\d{2}-\d{3}\b/g,
    replacement: '[KOD POCZTOWY]',
    description: 'Polish postal codes',
  },
  ipAddress: {
    pattern:
      /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b|\b(?:[A-Fa-f0-9]{1,4}:){7}[A-Fa-f0-9]{1,4}\b/g,
    replacement: '[IP]',
    description: 'IPv4 and IPv6 addresses',
  },
  creditCard: {
    pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b|\b\d{13,19}\b/g,
    replacement: '[KARTA KREDYTOWA]',
    description: 'Credit card numbers',
  },
  iban: {
    pattern: /\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}([A-Z0-9]?){0,16}\b/g,
    replacement: '[IBAN]',
    description: 'IBAN bank account numbers',
  },
  url: {
    pattern:
      /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&=]*)/g,
    replacement: '[URL]',
    description: 'URLs and links',
  },
  idNumber: {
    pattern:
      /\b(?:[A-Z]{2,3}\/)?\d{6,8}\/\d{4,6}\b|\b[A-Z]{1,3}\s*\/?\s*\d{6,8}\b/g,
    replacement: '[DOWÓD OSOBISTY]',
    description: 'Polish identity document numbers',
  },
};

/**
 * Named Entity Recognition (NER) patterns for Polish names and places
 */
const NER_PATTERNS = {
  polishNames: {
    pattern:
      /\b[A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]{2,20}\s+[A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]{2,20}\b/g,
    replacement: '[IMIE NAZWISKO]',
    description: 'Polish first and last names',
  },
  polishFirstNames: {
    pattern:
      /\b(?:Anna|Jan|Maria|Katarzyna|Piotr|Joanna|Andrzej|Małgorzata|Krzysztof|Agnieszka|Tomasz|Barbara|Michał|Ewa|Stanisław|Zofia|Jerzy|Beata|Marek|Danuta|Jacek|Elżbieta|Tadeusz|Aleksandra|Robert|Dorota|Rafał|Grażyna|Paweł|Iwona|Łukasz|Karolina|Marcin|Monika|Adrian|Marta|Szymon|Kamil|Wioletta|Jakub|Natalia|Patrycja|Wojciech|Oliwia|Gabriela|Dominika|Bartosz|Mikołaj|Wiktor)\b/g,
    replacement: '[IMIE]',
    description: 'Common Polish first names',
  },
  polishCities: {
    pattern:
      /\b(?:Warszawa|Kraków|Łódź|Wrocław|Poznań|Gdańsk|Szczecin|Bydgoszcz|Lublin|Katowice|Białystok|Gdynia|Częstochowa|Olsztyn|Rzeszów|Bielsko-Biała|Zielona Góra|Gorzów Wielkopolski|Opole|Włocławek|Elbląg|Płock|Wałbrzych|Kielce|Bytom|Tarnów|Chorzów|Ruda Śląska|Rybnik|Gliwice|Zabrze|Sosnowiec|Dąbrowa Górnicza|Kędzierzyn-Koźle|Opole|Piekary Śląskie|Jaworzno|Jastrzębie-Zdrój|Nowy Sącz|Jelenia Góra|Słupsk|Konin|Piotrków Trybunalski|Kalisz|Grudziądz|Legnica|Siemianowice Śląskie|Koszalin|Tomaszów Lubelski|Głogów|Ełk|Czechowice-Dziedzice|Pruszcz Gdański|Stargard|Zamość|Mysłowice|Piła|Gliwice|Bielsko-Biała|Ruda Śląska|Rybnik)\b/g,
    replacement: '[MIASTO]',
    description: 'Polish cities',
  },
  polishStreets: {
    pattern:
      /\bul\.?\s+[A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż\s]+\d+[a-z]?|\bul\.?\s+[A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż\s]+\d+[a-z]?|\bul\.?\s+[A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż\s]+(?:ul\.)?\s*\d+[a-z]?/g,
    replacement: '[ULICA]',
    description: 'Polish street addresses',
  },
  companies: {
    pattern:
      /\b(?:Sp\.?\s*z\s*o\.?\s*o\.?|S\.?\s*A\.?|s\.?\s*c\.?|Ltd\.?|Inc\.?|GmbH|AG|S\.?\s*r\.?\s*l\.?|d\.?\s*p\.?\s*u\.?|f\.?\s*u\.?|P\.?\s*H\.?\s*U\.?)\b/g,
    replacement: '[FIRMA]',
    description: 'Company legal forms',
  },
};

/**
 * Anonymization levels and their corresponding rules
 */
export type AnonymizationLevel = 'partial' | 'full';

export interface AnonymizationResult {
  originalText: string;
  anonymizedText: string;
  detectedPII: Array<{
    type: string;
    pattern: string;
    matches: string[];
    count: number;
  }>;
  anonymizationLevel: AnonymizationLevel;
  checksum: string;
}

/**
 * Advanced anonymization service with PII detection and redaction
 */
export class AnonymizationService {
  private readonly salt: string;
  private readonly userHashes = new Map<number, string>();

  constructor(salt?: string) {
    this.salt = salt || crypto.randomBytes(32).toString('hex');
  }

  /**
   * Anonymize a response object completely
   */
  public async anonymizeResponse(
    response: Response,
    level: AnonymizationLevel = 'full',
  ): Promise<{
    id: string; // New anonymous ID
    questionId: string;
    answer: any;
    metadata: any;
    anonymizationResult: AnonymizationResult;
  }> {
    // Generate anonymous ID
    const anonymousId = this.generateAnonymousId(response.id);

    // Create copy of answer data
    let answerData = response.answer;

    // If answer is a string, anonymize it
    if (typeof answerData === 'string') {
      const anonymizationResult = await this.anonymizeText(answerData, level);
      answerData = anonymizationResult.anonymizedText;
    }

    // If answer is an object, recursively anonymize string fields
    if (typeof answerData === 'object' && answerData !== null) {
      answerData = this.anonymizeObject(answerData, level);
    }

    // Anonymize metadata
    const anonymizedMetadata = {
      ...response.metadata,
      ipHash: this.hashPII(response.metadata?.ipHash || ''),
      userAgentHash: this.hashPII(response.metadata?.userAgentHash || ''),
      // Keep non-PII metadata
      timeSpentMs: response.metadata?.timeSpentMs,
      editCount: response.metadata?.editCount,
    };

    return {
      id: anonymousId,
      questionId: response.questionId,
      answer: answerData,
      metadata: anonymizedMetadata,
      anonymizationResult: {
        originalText:
          typeof response.answer === 'string'
            ? response.answer
            : JSON.stringify(response.answer),
        anonymizedText:
          typeof answerData === 'string'
            ? answerData
            : JSON.stringify(answerData),
        detectedPII: [], // Will be populated during text anonymization
        anonymizationLevel: level,
        checksum: this.calculateChecksum(answerData),
      },
    };
  }

  /**
   * Anonymize text content with PII detection and redaction
   */
  public async anonymizeText(
    text: string,
    level: AnonymizationLevel = 'full',
  ): Promise<AnonymizationResult> {
    if (!text || typeof text !== 'string') {
      return {
        originalText: text || '',
        anonymizedText: text || '',
        detectedPII: [],
        anonymizationLevel: level,
        checksum: this.calculateChecksum(text || ''),
      };
    }

    let anonymizedText = text;
    const detectedPII: Array<{
      type: string;
      pattern: string;
      matches: string[];
      count: number;
    }> = [];

    // Apply PII patterns based on anonymization level
    const patternsToApply =
      level === 'full' ? { ...PII_PATTERNS, ...NER_PATTERNS } : PII_PATTERNS;

    // Apply each pattern
    for (const [type, config] of Object.entries(patternsToApply)) {
      const matches = anonymizedText.match(config.pattern);
      if (matches) {
        detectedPII.push({
          type,
          pattern: config.pattern.source,
          matches: [...new Set(matches)], // Unique matches
          count: matches.length,
        });

        anonymizedText = anonymizedText.replace(
          config.pattern,
          config.replacement,
        );
      }
    }

    // Additional custom sanitization for sensitive terms
    anonymizedText = this.customSanitization(anonymizedText);

    return {
      originalText: text,
      anonymizedText,
      detectedPII,
      anonymizationLevel: level,
      checksum: this.calculateChecksum(anonymizedText),
    };
  }

  /**
   * Recursively anonymize objects
   */
  private anonymizeObject(obj: any, level: AnonymizationLevel): any {
    if (Array.isArray(obj)) {
      return obj.map(item => this.anonymizeObject(item, level));
    }

    if (typeof obj === 'object' && obj !== null) {
      const anonymized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
          const result = this.anonymizeText(value, level);
          anonymized[key] = result.anonymizedText;
        } else if (typeof value === 'object') {
          anonymized[key] = this.anonymizeObject(value, level);
        } else {
          anonymized[key] = value;
        }
      }
      return anonymized;
    }

    return obj;
  }

  /**
   * Generate anonymous ID for responses
   */
  private generateAnonymousId(originalId: string): string {
    const hash = crypto.createHash('sha256');
    hash.update(`${originalId}${this.salt}`);
    return `anon_${hash.digest('hex').substring(0, 16)}`;
  }

  /**
   * Generate consistent anonymous ID for users
   */
  public getAnonymousUserId(userId: number): string {
    if (!this.userHashes.has(userId)) {
      const hash = crypto.createHash('sha256');
      hash.update(`user_${userId}${this.salt}`);
      this.userHashes.set(
        userId,
        `anon_user_${hash.digest('hex').substring(0, 12)}`,
      );
    }
    return this.userHashes.get(userId)!;
  }

  /**
   * Hash PII data
   */
  private hashPII(data: string): string {
    return crypto
      .createHash('sha256')
      .update(`${data}${this.salt}`)
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Calculate checksum for data integrity verification
   */
  private calculateChecksum(data: any): string {
    const str = typeof data === 'string' ? data : JSON.stringify(data);
    return crypto.createHash('sha256').update(str).digest('hex');
  }

  /**
   * Custom sanitization rules for sensitive content
   */
  private customSanitization(text: string): string {
    let sanitized = text;

    // Remove or replace common sensitive patterns that might not be caught by regex
    sanitized = sanitized.replace(
      /\b\d{2}\/\d{2}\/\d{4}\b/g,
      '[DATA URODZENIA]',
    ); // Birth dates
    sanitized = sanitized.replace(
      /\b(?:90|91|50|51|52|53|54|55|56|57|58|59)\d{8}\b/g,
      '[NUMER DOWODU]',
    ); // More Polish ID patterns
    sanitized = sanitized.replace(/\b(?:M|F)\s*\d{6}\b/g, '[NUMER PASZPORTU]'); // Passport numbers
    sanitized = sanitized.replace(/\b[A-Z]{2}\d{7}\b/g, '[NUMER PRAWA JAZDY]'); // Driving license numbers

    // Remove context that could reveal identity when combined
    sanitized = sanitized.replace(
      /(?:moje|mój|moja|moi)\s+[a-ząćęłńóśźż]+\s+[a-ząćęłńóśźż]+/gi,
      '[MOJA INFORMACJA]',
    );
    sanitized = sanitized.replace(
      /(?:mieszkam|pracuję|uczę się)\s+w\s+[A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]+/gi,
      '[LOKALIZACJA]',
    );

    // Sanitize social media handles and usernames
    sanitized = sanitized.replace(/@[A-Za-z0-9_]+/g, '[@UŻYTKOWNIK]');
    sanitized = sanitized.replace(
      /(?:facebook|instagram|linkedin|twitter|tiktok)\.com\/[A-Za-z0-9_\/-]+/gi,
      '[PROFIL SPOŁECZNOŚCIOWY]',
    );

    return sanitized;
  }

  /**
   * Verify k-anonymity compliance
   */
  public verifyKAnonymity(
    anonymizedResponses: string[],
    k: number = 5,
  ): boolean {
    // Group identical responses
    const responseGroups = new Map<string, number>();

    for (const response of anonymizedResponses) {
      const count = responseGroups.get(response) || 0;
      responseGroups.set(response, count + 1);
    }

    // Check if any group has fewer than k identical responses
    for (const count of responseGroups.values()) {
      if (count < k) {
        return false;
      }
    }

    return true;
  }

  /**
   * Apply additional anonymization if k-anonymity is not met
   */
  public ensureKAnonymity(responses: string[], k: number = 5): string[] {
    let currentResponses = [...responses];
    let iterations = 0;
    const maxIterations = 5;

    while (
      !this.verifyKAnonymity(currentResponses, k) &&
      iterations < maxIterations
    ) {
      // Apply additional generalization
      currentResponses = currentResponses.map(response => {
        // Replace specific details with more general categories
        return response
          .replace(/\d+/g, '[LICZBA]') // Replace all numbers
          .replace(/\b[A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]{4,}\b/g, '[SŁOWO]') // Replace words longer than 4 chars
          .replace(/\b[A-ZĄĆĘŁŃÓŚŹŻ]{2,}\b/g, '[SKRÓT]'); // Replace abbreviations
      });

      iterations++;
    }

    return currentResponses;
  }

  /**
   * Get PII detection report
   */
  public getPIIDetectionReport(text: string): Array<{
    type: string;
    description: string;
    matches: string[];
    severity: 'low' | 'medium' | 'high';
    recommendations: string[];
  }> {
    const report: Array<{
      type: string;
      description: string;
      matches: string[];
      severity: 'low' | 'medium' | 'high';
      recommendations: string[];
    }> = [];

    const allPatterns = { ...PII_PATTERNS, ...NER_PATTERNS };

    for (const [type, config] of Object.entries(allPatterns)) {
      const matches = text.match(config.pattern);
      if (matches) {
        const uniqueMatches = [...new Set(matches)];
        const severity = this.getSeverityLevel(type);

        report.push({
          type,
          description: config.description,
          matches: uniqueMatches,
          severity,
          recommendations: this.getRecommendations(type, severity),
        });
      }
    }

    return report;
  }

  /**
   * Determine severity level for PII type
   */
  private getSeverityLevel(type: string): 'low' | 'medium' | 'high' {
    const highSeverityTypes = [
      'polishPesel',
      'creditCard',
      'iban',
      'idNumber',
      'polishNames',
    ];
    const mediumSeverityTypes = [
      'email',
      'phone',
      'ipAddress',
      'polishFirstNames',
    ];

    if (highSeverityTypes.includes(type)) return 'high';
    if (mediumSeverityTypes.includes(type)) return 'medium';
    return 'low';
  }

  /**
   * Get recommendations for PII type
   */
  private getRecommendations(
    type: string,
    severity: 'low' | 'medium' | 'high',
  ): string[] {
    const baseRecommendations = [
      'Consider removing this information before analysis',
      'Verify if this PII is necessary for the research purpose',
    ];

    const specificRecommendations: Record<string, string[]> = {
      polishPesel: [
        'PESEL is sensitive personal data - always remove',
        'Consider if age range information would suffice instead',
      ],
      email: [
        'Use domain-only information (e.g., \'@gmail.com\') if email trends are needed',
        'Consider hashing emails for user deduplication',
      ],
      phone: ['Consider keeping only area code for geographic analysis'],
      polishNames: ['For gender analysis, use only first names or pronouns'],
      ipAddress: [
        'Keep only country/region information for geographic analysis',
      ],
    };

    return [...baseRecommendations, ...(specificRecommendations[type] || [])];
  }

  /**
   * Validate anonymization quality
   */
  public validateAnonymization(
    original: string,
    anonymized: string,
  ): {
    score: number; // 0-100
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check if PII patterns still exist
    for (const [type, config] of Object.entries(PII_PATTERNS)) {
      const remainingMatches = anonymized.match(config.pattern);
      if (remainingMatches) {
        issues.push(
          `Still contains ${type}: ${remainingMatches.length} occurrences`,
        );
        recommendations.push(`Review ${config.description} patterns`);
      }
    }

    // Check if anonymization is too aggressive
    const anonymizationRatio = anonymized.length / original.length;
    if (anonymizationRatio < 0.3) {
      issues.push('Anonymization may be too aggressive');
      recommendations.push('Consider using partial anonymization level');
    }

    // Check for information preservation
    if (anonymized.replace(/\[[^\]]+\]/g, '').trim().length < 20) {
      issues.push('Very little non-PII content remaining');
      recommendations.push('Consider collecting more generic responses');
    }

    // Calculate score (100 - issues * 20)
    const score = Math.max(0, 100 - issues.length * 20);

    return {
      score,
      issues,
      recommendations,
    };
  }
}

// Export singleton instance
export const anonymizationService = new AnonymizationService(
  process.env.ANONYMIZATION_SALT,
);
