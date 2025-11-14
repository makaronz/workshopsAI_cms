/**
 * workshopsAI CMS - Internationalization Middleware
 * Express middleware for handling language detection and content localization
 */

import { Request, Response, NextFunction } from 'express';
import i18n from '../i18n';

export interface I18nRequest extends Request {
  language: 'pl' | 'en';
  locale: string;
  t: (key: string, params?: Record<string, any>) => string;
}

/**
 * Language detection and setting middleware
 */
export const i18nMiddleware = (
  req: I18nRequest,
  res: Response,
  next: NextFunction,
) => {
  // Detect language from various sources (in order of priority):

  // 1. URL parameter (/api/v1/workshops?lang=en)
  const urlLang = req.query.lang as string;

  // 2. Accept-Language header
  const acceptLanguage = req.headers['accept-language'];
  const headerLang = acceptLanguage
    ? acceptLanguage.split(',')[0].split('-')[0]
    : null;

  // 3. Cookie
  const cookieLang = req.cookies?.['workshopsai-language'];

  // 4. Default to Polish for Polish market
  const detectedLanguage = urlLang || cookieLang || headerLang || 'pl';

  // Validate language
  const language = ['pl', 'en'].includes(detectedLanguage)
    ? (detectedLanguage as 'pl' | 'en')
    : 'pl';

  // Set request language
  req.language = language;
  req.locale = language === 'pl' ? 'pl-PL' : 'en-US';

  // Attach translation function to request
  req.t = (key: string, params?: Record<string, any>) => {
    return i18n.translate(key as any, params);
  };

  // Set i18n manager language for this request
  i18n.setLanguage(language);

  // Set language cookie for future requests
  if (req.cookies?.['workshopsai-language'] !== language) {
    res.cookie('workshopsai-language', language, {
      maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
      httpOnly: false,
      sameSite: 'lax',
    });
  }

  // Set response headers
  res.setHeader('Content-Language', language);
  res.setHeader('X-Language', language);

  next();
};

/**
 * Middleware for API responses with bilingual content
 */
export const bilingualResponseMiddleware = (
  req: I18nRequest,
  res: Response,
  next: NextFunction,
) => {
  const originalJson = res.json;

  res.json = function (data: any) {
    // If response contains bilingual content, localize it for current language
    if (data && typeof data === 'object') {
      const localizedData = localizeObject(data, req.language);
      return originalJson.call(this, localizedData);
    }

    return originalJson.call(this, data);
  };

  next();
};

/**
 * Helper function to localize objects containing bilingual content
 */
function localizeObject(obj: any, language: 'pl' | 'en'): any {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => localizeObject(item, language));
  }

  const localized = { ...obj };

  // Handle bilingual text objects
  Object.keys(localized).forEach(key => {
    const value = localized[key];

    if (
      value &&
      typeof value === 'object' &&
      value.pl !== undefined &&
      value.en !== undefined
    ) {
      // This is a bilingual text object
      const bilingualText = value as { pl: string; en: string };
      localized[key] =
        bilingualText[language] ||
        bilingualText[language === 'pl' ? 'en' : 'pl'] ||
        '';
    } else if (value && typeof value === 'object') {
      // Recursively localize nested objects
      localized[key] = localizeObject(value, language);
    }
  });

  return localized;
}

/**
 * Middleware for handling bilingual form submissions
 */
export const bilingualFormMiddleware = (
  req: I18nRequest,
  res: Response,
  next: NextFunction,
) => {
  if (req.body && typeof req.body === 'object') {
    req.body = processBilingualFormData(req.body, req.language);
  }

  next();
};

/**
 * Process form data with bilingual fields
 */
function processBilingualFormData(
  data: any,
  primaryLanguage: 'pl' | 'en',
): any {
  const processed = { ...data };

  // Look for bilingual field patterns (fieldName_pl, fieldName_en)
  Object.keys(processed).forEach(key => {
    if (key.endsWith('_pl') || key.endsWith('_en')) {
      const baseKey = key.replace(/_(pl|en)$/, '');
      const lang = key.endsWith('_pl') ? 'pl' : 'en';

      if (!processed[baseKey]) {
        processed[baseKey] = { pl: '', en: '' };
      }

      processed[baseKey][lang] = processed[key];

      // Remove the original field
      delete processed[key];
    }
  });

  return processed;
}

/**
 * Language validation middleware for API endpoints
 */
export const languageValidationMiddleware = (
  req: I18nRequest,
  res: Response,
  next: NextFunction,
) => {
  const language = req.query.lang as string;

  if (language && !['pl', 'en'].includes(language)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid language',
      message: 'Supported languages: pl, en',
    });
  }

  next();
};

/**
 * Content negotiation middleware for API responses
 */
export const contentNegotiationMiddleware = (
  req: I18nRequest,
  res: Response,
  next: NextFunction,
) => {
  const acceptLanguage = req.headers['accept-language'];

  if (acceptLanguage) {
    // Parse Accept-Language header
    const languages = acceptLanguage
      .split(',')
      .map(lang => {
        const [code, quality] = lang.trim().split(';q=');
        return {
          code: code.split('-')[0],
          quality: quality ? parseFloat(quality) : 1,
        };
      })
      .sort((a, b) => b.quality - a.quality);

    // Find best matching language
    const supportedLanguages = ['pl', 'en'];
    const bestLanguage = languages.find(lang =>
      supportedLanguages.includes(lang.code),
    );

    if (bestLanguage) {
      req.language = bestLanguage.code as 'pl' | 'en';
      req.locale = bestLanguage.code === 'pl' ? 'pl-PL' : 'en-US';
    }
  }

  next();
};

/**
 * Cache middleware for bilingual content
 */
export const bilingualCacheMiddleware = (ttl: number = 300) => {
  const cache = new Map();

  return (req: I18nRequest, res: Response, next: NextFunction) => {
    const cacheKey = `${req.path}:${req.language}:${JSON.stringify(req.query)}`;
    const cached = cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < ttl * 1000) {
      return res.json(cached.data);
    }

    // Override res.json to cache the response
    const originalJson = res.json;
    res.json = function (data: any) {
      cache.set(cacheKey, {
        data,
        timestamp: Date.now(),
      });
      return originalJson.call(this, data);
    };

    next();
  };
};

// Export all middlewares
export {
  i18nMiddleware as default,
  bilingualResponseMiddleware,
  bilingualFormMiddleware,
  languageValidationMiddleware,
  contentNegotiationMiddleware,
  bilingualCacheMiddleware,
};
