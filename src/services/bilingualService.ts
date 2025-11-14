/**
 * workshopsAI CMS - Bilingual Content Service
 * Service for managing Polish/English bilingual content
 */

import {
  BilingualText,
  BilingualContent,
  validateBilingualText,
  getBilingualText,
} from '../models/bilingualSchema';
import i18n from '../i18n';

export class BilingualService {
  /**
   * Create a bilingual text object with validation
   */
  static createBilingualText(pl: string, en: string): BilingualText {
    const bilingual = {
      pl: pl.trim(),
      en: en.trim(),
    };

    if (!validateBilingualText(bilingual)) {
      throw new Error(
        'Invalid bilingual text: both Polish and English versions required',
      );
    }

    return bilingual;
  }

  /**
   * Get text for current language with fallback
   */
  static getText(
    bilingual: BilingualText | null | undefined,
    fallbackLanguage?: 'pl' | 'en',
  ): string {
    if (!bilingual) return '';
    return getBilingualText(
      bilingual,
      i18n.getCurrentLanguage(),
      fallbackLanguage || 'en',
    );
  }

  /**
   * Get text for specific language
   */
  static getTextForLanguage(
    bilingual: BilingualText | null | undefined,
    language: 'pl' | 'en',
  ): string {
    if (!bilingual) return '';
    return getBilingualText(
      bilingual,
      language,
      language === 'pl' ? 'en' : 'pl',
    );
  }

  /**
   * Check if bilingual text has content in any language
   */
  static hasContent(bilingual: BilingualText | null | undefined): boolean {
    return !!(bilingual && (bilingual.pl.trim() || bilingual.en.trim()));
  }

  /**
   * Get validation errors for bilingual text
   */
  static getValidationErrors(
    bilingual: BilingualText,
    required = false,
  ): string[] {
    const errors: string[] = [];

    if (required && !this.hasContent(bilingual)) {
      errors.push(i18n.t('validation.required'));
    }

    if (bilingual.pl && bilingual.pl.length > 1000) {
      errors.push('Polski tekst jest zbyt długi (maks. 1000 znaków)');
    }

    if (bilingual.en && bilingual.en.length > 1000) {
      errors.push('English text is too long (max. 1000 characters)');
    }

    return errors;
  }

  /**
   * Sanitize and normalize bilingual text
   */
  static sanitize(bilingual: Partial<BilingualText>): BilingualText {
    return {
      pl: (bilingual.pl || '').trim(),
      en: (bilingual.en || '').trim(),
    };
  }

  /**
   * Merge bilingual text objects with priority to first
   */
  static merge(primary: BilingualText, fallback: BilingualText): BilingualText {
    return {
      pl: primary.pl || fallback.pl || '',
      en: primary.en || fallback.en || '',
    };
  }

  /**
   * Format bilingual content for display in forms
   */
  static formatForForm(bilingual: BilingualText): { pl: string; en: string } {
    return {
      pl: bilingual.pl || '',
      en: bilingual.en || '',
    };
  }

  /**
   * Create bilingual content from form data
   */
  static createFromForm(plText: string, enText: string): BilingualText {
    return this.createBilingualText(plText || '', enText || '');
  }

  /**
   * Search bilingual text (search in both languages)
   */
  static search(bilingual: BilingualText, query: string): boolean {
    if (!query || !this.hasContent(bilingual)) return false;

    const searchTerm = query.toLowerCase().trim();

    return (
      bilingual.pl.toLowerCase().includes(searchTerm) ||
      bilingual.en.toLowerCase().includes(searchTerm)
    );
  }

  /**
   * Generate slug from bilingual text
   */
  static generateSlug(bilingual: BilingualText): string {
    const text = this.getText(bilingual);
    return text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Get excerpt from bilingual text
   */
  static getExcerpt(bilingual: BilingualText, maxLength: number = 200): string {
    const text = this.getText(bilingual);
    if (text.length <= maxLength) return text;

    return text.substring(0, maxLength).trim() + '...';
  }

  /**
   * Compare bilingual text for sorting
   */
  static compare(a: BilingualText, b: BilingualText): number {
    const textA = this.getText(a).toLowerCase();
    const textB = this.getText(b).toLowerCase();

    return textA.localeCompare(textB);
  }

  /**
   * Create GDPR consent text for current language
   */
  static getGDPRConsentText(): BilingualText {
    return {
      pl: 'Wypełniając ten kwestionariusz, wyrażam zgodę na przetwarzanie moich danych osobowych zgodnie z RODO.',
      en: 'By completing this questionnaire, I consent to the processing of my personal data in accordance with GDPR.',
    };
  }

  /**
   * Create AI processing consent text for current language
   */
  static getAIConsentText(): BilingualText {
    return {
      pl: 'Wyrażam zgodę na analizę moich odpowiedzi za pomocą sztucznej inteligencji w celach badawczych. Wszystkie dane zostaną zanonimizowane.',
      en: 'I consent to the analysis of my responses using artificial intelligence for research purposes. All data will be anonymized.',
    };
  }

  /**
   * Create data retention consent text for current language
   */
  static getDataRetentionText(): BilingualText {
    return {
      pl: 'Moje dane będą przechowywane przez 5 lat i następnie usunięte zgodnie z polityką prywatności.',
      en: 'My data will be stored for 5 years and then deleted in accordance with the privacy policy.',
    };
  }

  /**
   * Format bilingual content for API responses
   */
  static formatForAPI(bilingual: BilingualText): BilingualText {
    return {
      pl: bilingual.pl,
      en: bilingual.en,
    };
  }

  /**
   * Parse bilingual content from API responses
   */
  static parseFromAPI(data: any): BilingualText {
    if (typeof data === 'string') {
      // Legacy support - assume Polish
      return { pl: data, en: '' };
    }

    if (validateBilingualText(data)) {
      return data;
    }

    // Fallback to empty bilingual object
    return { pl: '', en: '' };
  }

  /**
   * Validate that at least one language is provided
   */
  static validatePartial(bilingual: Partial<BilingualText>): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    const hasPl = !!(bilingual.pl && bilingual.pl.trim());
    const hasEn = !!(bilingual.en && bilingual.en.trim());

    if (!hasPl && !hasEn) {
      errors.push(
        'Co najmniej jedna wersja językowa jest wymagana (polska lub angielska)',
      );
    }

    if (bilingual.pl && bilingual.pl.length > 1000) {
      errors.push('Polski tekst jest zbyt długi (maks. 1000 znaków)');
    }

    if (bilingual.en && bilingual.en.length > 1000) {
      errors.push('English text is too long (max. 1000 characters)');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get language preference for user content
   */
  static getUserLanguagePreference(): 'pl' | 'en' {
    return i18n.getCurrentLanguage();
  }

  /**
   * Set content language preference for user
   */
  static setUserLanguagePreference(language: 'pl' | 'en'): void {
    i18n.setLanguage(language);
  }

  /**
   * Create validation rules for bilingual forms
   */
  static getValidationRules(required: boolean) {
    return {
      pl: {
        required: required ? 'Wymagany tekst po polsku' : false,
        maxLength: {
          value: 1000,
          message: 'Maksymalnie 1000 znaków',
        },
      },
      en: {
        required: required ? 'English text is required' : false,
        maxLength: {
          value: 1000,
          message: 'Maximum 1000 characters',
        },
      },
      atLeastOne: {
        validator: (value: any) => {
          return !!(value?.pl?.trim() || value?.en?.trim());
        },
        message: 'Co najmniej jedna wersja językowa jest wymagana',
      },
    };
  }
}

export default BilingualService;
