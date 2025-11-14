/**
 * workshopsAI CMS - Internationalization System
 * Main i18n implementation with language management
 */

import translations, {
  Language,
  TranslationKey,
  BilingualText,
  BilingualContent,
} from './translations';

class I18nManager {
  private currentLanguage: Language = 'pl';
  private fallbackLanguage: Language = 'en';
  private listeners: Array<(lang: Language) => void> = [];
  private storageKey = 'workshopsai-language';

  constructor() {
    this.initializeLanguage();
  }

  /**
   * Initialize language from localStorage or browser settings
   */
  private initializeLanguage() {
    // Try to get from localStorage first
    const storedLanguage = localStorage.getItem(this.storageKey) as Language;
    if (storedLanguage && this.isValidLanguage(storedLanguage)) {
      this.currentLanguage = storedLanguage;
      return;
    }

    // Fall back to browser language
    const browserLanguage = navigator.language.split('-')[0] as Language;
    if (this.isValidLanguage(browserLanguage)) {
      this.currentLanguage = browserLanguage;
    }

    // Default to Polish for Polish market
    this.currentLanguage = 'pl';
  }

  /**
   * Check if language is supported
   */
  private isValidLanguage(lang: string): lang is Language {
    return ['pl', 'en'].includes(lang);
  }

  /**
   * Get current language
   */
  getCurrentLanguage(): Language {
    return this.currentLanguage;
  }

  /**
   * Set current language
   */
  setLanguage(lang: Language) {
    if (!this.isValidLanguage(lang)) {
      console.warn(`Unsupported language: ${lang}`);
      return;
    }

    this.currentLanguage = lang;
    localStorage.setItem(this.storageKey, lang);
    this.notifyListeners();

    // Update HTML lang attribute
    document.documentElement.lang = lang;

    // Update document direction if needed (not for pl/en, but good practice)
    document.documentElement.dir = this.getLanguageDirection(lang);
  }

  /**
   * Get text direction for language
   */
  private getLanguageDirection(lang: Language): 'ltr' | 'rtl' {
    return ['pl', 'en'].includes(lang) ? 'ltr' : 'ltr';
  }

  /**
   * Toggle between Polish and English
   */
  toggleLanguage() {
    this.setLanguage(this.currentLanguage === 'pl' ? 'en' : 'pl');
  }

  /**
   * Subscribe to language changes
   */
  subscribe(listener: (lang: Language) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Notify all listeners of language change
   */
  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.currentLanguage));
  }

  /**
   * Translate a key to current language
   */
  translate(
    key: TranslationKey,
    params?: Record<string, string | number>,
  ): string {
    let translation = translations[this.currentLanguage][key];

    if (!translation) {
      // Try fallback language
      translation = translations[this.fallbackLanguage][key];

      if (!translation) {
        console.warn(`Translation missing for key: ${key}`);
        return key;
      }
    }

    // Replace parameters in translation
    if (params) {
      Object.entries(params).forEach(([param, value]) => {
        translation = translation.replace(
          new RegExp(`{{${param}}}`, 'g'),
          String(value),
        );
      });
    }

    return translation;
  }

  /**
   * Get bilingual text for current language
   */
  getBilingualText(bilingual: BilingualText): string {
    return (
      bilingual[this.currentLanguage] || bilingual[this.fallbackLanguage] || ''
    );
  }

  /**
   * Format bilingual content
   */
  formatBilingual(content: BilingualContent): string {
    return (
      content[this.currentLanguage] || content[this.fallbackLanguage] || ''
    );
  }

  /**
   * Create bilingual text object
   */
  createBilingualText(pl: string, en: string): BilingualText {
    return { pl, en };
  }

  /**
   * Format date according to current language
   */
  formatDate(
    date: Date | string,
    options?: Intl.DateTimeFormatOptions,
  ): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;

    const defaultOptions: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      ...(options || {}),
    };

    return dateObj.toLocaleDateString(this.getLocale(), defaultOptions);
  }

  /**
   * Format time according to current language
   */
  formatTime(
    date: Date | string,
    options?: Intl.DateTimeFormatOptions,
  ): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;

    const defaultOptions: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
      ...(options || {}),
    };

    return dateObj.toLocaleTimeString(this.getLocale(), defaultOptions);
  }

  /**
   * Format currency according to current language
   */
  formatCurrency(amount: number, currency: string = 'PLN'): string {
    return new Intl.NumberFormat(this.getLocale(), {
      style: 'currency',
      currency: currency,
    }).format(amount);
  }

  /**
   * Format number according to current language
   */
  formatNumber(number: number, options?: Intl.NumberFormatOptions): string {
    return new Intl.NumberFormat(this.getLocale(), options).format(number);
  }

  /**
   * Get locale string for current language
   */
  getLocale(): string {
    return this.currentLanguage === 'pl' ? 'pl-PL' : 'en-US';
  }

  /**
   * Check if current language is RTL
   */
  isRTL(): boolean {
    return this.getLanguageDirection(this.currentLanguage) === 'rtl';
  }

  /**
   * Get all available languages
   */
  getAvailableLanguages(): {
    code: Language;
    name: string;
    nativeName: string;
  }[] {
    return [
      { code: 'pl', name: 'Polish', nativeName: 'Polski' },
      { code: 'en', name: 'English', nativeName: 'English' },
    ];
  }

  /**
   * Get language name in current language
   */
  getLanguageName(code: Language): string {
    const languages = {
      pl: { pl: 'Polski', en: 'Polish' },
      en: { pl: 'Angielski', en: 'English' },
    };
    return languages[code][this.currentLanguage];
  }

  /**
   * Validate bilingual text object
   */
  validateBilingualText(bilingual: BilingualText): boolean {
    return (
      typeof bilingual === 'object' &&
      typeof bilingual.pl === 'string' &&
      typeof bilingual.en === 'string' &&
      bilingual.pl.trim().length > 0 &&
      bilingual.en.trim().length > 0
    );
  }

  /**
   * Sanitize bilingual text (trim and validate)
   */
  sanitizeBilingualText(bilingual: BilingualText): BilingualText {
    return {
      pl: (bilingual.pl || '').trim(),
      en: (bilingual.en || '').trim(),
    };
  }

  /**
   * Merge bilingual text objects (with priority to first)
   */
  mergeBilingualText(
    primary: BilingualText,
    fallback: BilingualText,
  ): BilingualText {
    return {
      pl: primary.pl || fallback.pl || '',
      en: primary.en || fallback.en || '',
    };
  }

  /**
   * Check if any text exists in bilingual object
   */
  hasText(bilingual: BilingualText): boolean {
    return !!(bilingual.pl || bilingual.en);
  }

  /**
   * Get validation errors for bilingual text
   */
  getBilingualTextErrors(bilingual: BilingualText, required = false): string[] {
    const errors: string[] = [];

    if (required && !this.hasText(bilingual)) {
      errors.push(this.translate('validation.required'));
    }

    if (bilingual.pl && bilingual.pl.length > 1000) {
      errors.push('Polski tekst jest zbyt długi (maks. 1000 znaków)');
    }

    if (bilingual.en && bilingual.en.length > 1000) {
      errors.push('English text is too long (max. 1000 characters)');
    }

    return errors;
  }
}

// Create singleton instance
export const i18n = new I18nManager();

// Export shorthand function for common usage
export const t = (
  key: TranslationKey,
  params?: Record<string, string | number>,
) => i18n.translate(key, params);

export const bt = (bilingual: BilingualText) =>
  i18n.getBilingualText(bilingual);

export default i18n;
