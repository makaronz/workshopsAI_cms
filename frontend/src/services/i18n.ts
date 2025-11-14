import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpApi from 'i18next-http-backend';

// Import translation files
import enTranslations from '../locales/en.json';
import plTranslations from '../locales/pl.json';

export type Language = 'en' | 'pl';

export interface I18nConfig {
  fallbackLng: Language;
  debug: boolean;
  interpolation: {
    escapeValue: boolean;
  };
  detection: {
    order: string[];
    caches: string[];
    lookupLocalStorage: string;
  };
  resources: Record<Language, Record<string, string>>;
}

class I18nService {
  private static instance: I18nService;
  private currentLanguage: Language = 'en';

  private constructor() {
    this.init();
  }

  public static getInstance(): I18nService {
    if (!I18nService.instance) {
      I18nService.instance = new I18nService();
    }
    return I18nService.instance;
  }

  private async init(): Promise<void> {
    const config: I18nConfig = {
      fallbackLng: 'en',
      debug: process.env.NODE_ENV === 'development',
      interpolation: {
        escapeValue: false, // React already escapes by default
      },
      detection: {
        order: ['localStorage', 'navigator', 'htmlTag'],
        caches: ['localStorage'],
        lookupLocalStorage: 'workshopsai-language',
      },
      resources: {
        en: {
          translation: enTranslations,
        },
        pl: {
          translation: plTranslations,
        },
      },
    };

    try {
      await i18n
        .use(HttpApi)
        .use(LanguageDetector)
        .init(config);

      this.currentLanguage = i18n.language as Language;

      // Set HTML lang attribute
      document.documentElement.lang = this.currentLanguage;

      // Set text direction based on language
      document.documentElement.dir = this.getDirection(this.currentLanguage);

    } catch (error) {
      console.error('Failed to initialize i18n:', error);
      // Fallback to basic translations
      this.setupFallback();
    }
  }

  private setupFallback(): void {
    // Minimal fallback translations in case i18n fails
    const fallback = {
      en: {
        'app.title': 'WorkshopsAI CMS',
        'auth.login': 'Login',
        'auth.register': 'Register',
        'auth.email': 'Email',
        'auth.password': 'Password',
        'common.loading': 'Loading...',
        'common.error': 'Error',
        'common.save': 'Save',
        'common.cancel': 'Cancel',
      },
      pl: {
        'app.title': 'WorkshopsAI CMS',
        'auth.login': 'Zaloguj',
        'auth.register': 'Zarejestruj',
        'auth.email': 'Email',
        'auth.password': 'Hasło',
        'common.loading': 'Ładowanie...',
        'common.error': 'Błąd',
        'common.save': 'Zapisz',
        'common.cancel': 'Anuluj',
      }
    };

    // Basic translation function
    (window as any).t = (key: string, options?: any) => {
      const lang = navigator.language.startsWith('pl') ? 'pl' : 'en';
      return fallback[lang as Language][key] || key;
    };
  }

  public getDirection(language: Language): 'ltr' | 'rtl' {
    // Currently we only support LTR languages, but this prepares for RTL
    const rtlLanguages: string[] = ['ar', 'he', 'fa'];
    return rtlLanguages.includes(language) ? 'rtl' : 'ltr';
  }

  public async changeLanguage(language: Language): Promise<void> {
    try {
      await i18n.changeLanguage(language);
      this.currentLanguage = language;

      // Update HTML attributes
      document.documentElement.lang = language;
      document.documentElement.dir = this.getDirection(language);

      // Store preference
      localStorage.setItem('workshopsai-language', language);

      // Emit custom event for components to listen
      window.dispatchEvent(new CustomEvent('language-changed', {
        detail: { language }
      }));

    } catch (error) {
      console.error('Failed to change language:', error);
    }
  }

  public getCurrentLanguage(): Language {
    return this.currentLanguage;
  }

  public translate(key: string, options?: Record<string, any>): string {
    return i18n.t(key, options);
  }

  public formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat(this.currentLanguage, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      ...options,
    }).format(dateObj);
  }

  public formatNumber(number: number, options?: Intl.NumberFormatOptions): string {
    return new Intl.NumberFormat(this.currentLanguage, options).format(number);
  }

  public formatCurrency(amount: number, currency: string = 'PLN'): string {
    return new Intl.NumberFormat(this.currentLanguage, {
      style: 'currency',
      currency,
    }).format(amount);
  }

  public getRelativeTime(date: Date | string): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const rtf = new Intl.RelativeTimeFormat(this.currentLanguage, { numeric: 'auto' });

    const diff = dateObj.getTime() - Date.now();
    const absDiff = Math.abs(diff);
    const days = Math.round(absDiff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return this.translate('common.today');
    }

    if (days === 1) {
      return diff > 0 ? this.translate('common.tomorrow') : this.translate('common.yesterday');
    }

    return rtf.format(days > 0 ? days : -days, 'day');
  }
}

// Create singleton instance
const i18nService = I18nService.getInstance();

// Export the translation function for easy access
export const t = i18nService.translate.bind(i18nService);

export default i18nService;