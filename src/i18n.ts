/**
 * workshopsAI CMS - Internationalization
 * Basic i18n configuration for the backend
 */

export type TranslationKey = string;

export interface I18nManager {
  translate(key: TranslationKey, params?: Record<string, any>): string;
  setLanguage(language: 'pl' | 'en'): void;
  getCurrentLanguage(): 'pl' | 'en';
}

// Simple translation dictionary
const translations: Record<'pl' | 'en', Record<string, string>> = {
  pl: {
    // Common messages
    'error.not_found': 'Nie znaleziono',
    'error.unauthorized': 'Nieautoryzowany dostęp',
    'error.server_error': 'Błąd serwera',
    'success.saved': 'Zapisano pomyślnie',
    'success.deleted': 'Usunięto pomyślnie',

    // Workshop messages
    'workshop.created': 'Warsztat utworzony',
    'workshop.updated': 'Warsztat zaktualizowany',
    'workshop.deleted': 'Warsztat usunięty',

    // User messages
    'user.created': 'Użytkownik utworzony',
    'user.updated': 'Użytkownik zaktualizowany',
    'user.deleted': 'Użytkownik usunięty',

    // Validation messages
    'validation.required': 'Pole jest wymagane',
    'validation.email': 'Nieprawidłowy format email',
    'validation.min_length': 'Minimalna długość: {{min}} znaków',
    'validation.max_length': 'Maksymalna długość: {{max}} znaków',
  },
  en: {
    // Common messages
    'error.not_found': 'Not found',
    'error.unauthorized': 'Unauthorized access',
    'error.server_error': 'Server error',
    'success.saved': 'Saved successfully',
    'success.deleted': 'Deleted successfully',

    // Workshop messages
    'workshop.created': 'Workshop created',
    'workshop.updated': 'Workshop updated',
    'workshop.deleted': 'Workshop deleted',

    // User messages
    'user.created': 'User created',
    'user.updated': 'User updated',
    'user.deleted': 'User deleted',

    // Validation messages
    'validation.required': 'Field is required',
    'validation.email': 'Invalid email format',
    'validation.min_length': 'Minimum length: {{min}} characters',
    'validation.max_length': 'Maximum length: {{max}} characters',
  },
};

class BasicI18nManager implements I18nManager {
  private currentLanguage: 'pl' | 'en' = 'pl';

  translate(key: TranslationKey, params?: Record<string, any>): string {
    const translation = translations[this.currentLanguage]?.[key] || key;

    if (!params) {
      return translation;
    }

    // Simple parameter replacement
    return translation.replace(/\{\{(\w+)\}\}/g, (match, paramKey) => {
      return params[paramKey]?.toString() || match;
    });
  }

  setLanguage(language: 'pl' | 'en'): void {
    this.currentLanguage = language;
  }

  getCurrentLanguage(): 'pl' | 'en' {
    return this.currentLanguage;
  }
}

// Export singleton instance
export const i18n = new BasicI18nManager();