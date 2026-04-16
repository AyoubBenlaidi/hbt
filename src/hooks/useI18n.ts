'use client';

import { useEffect, useState, useCallback } from 'react';

type Locale = 'en' | 'fr';

interface Messages {
  [key: string]: any;
}

const cachedMessages: Record<Locale, Messages> = {
  en: {},
  fr: {},
};

const loadedLocales = new Set<Locale>();
const loadingPromises: Partial<Record<Locale, Promise<Messages>>> = {};

async function loadMessages(locale: Locale): Promise<Messages> {
  if (loadedLocales.has(locale)) {
    return cachedMessages[locale];
  }

  if (loadingPromises[locale]) {
    return loadingPromises[locale]!;
  }

  const promise = (async () => {
    try {
      const mod = await import(`../../messages/${locale}.json`);
      cachedMessages[locale] = mod.default;
      loadedLocales.add(locale);
      return mod.default;
    } catch (error) {
      console.error(`Failed to load messages for locale: ${locale}`);
      return {};
    } finally {
      delete loadingPromises[locale];
    }
  })();

  loadingPromises[locale] = promise;
  return promise;
}

// Pre-load both locales immediately
loadMessages('en');
loadMessages('fr');

export function useTranslations() {
  const [locale, setLocaleState] = useState<Locale>('en');
  const [isReady, setIsReady] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    const savedLocale = localStorage.getItem('NEXT_LOCALE') as Locale | null;
    const browserLocale = navigator.language.startsWith('fr') ? 'fr' : 'en';
    const detectedLocale = savedLocale || browserLocale;

    setLocaleState(detectedLocale);

    // Ensure messages for detected locale are loaded
    loadMessages(detectedLocale).then(() => {
      setIsReady(true);
      setTick((n) => n + 1); // force re-render with loaded messages
    });
  }, []);

  const t = useCallback((key: string, defaultValue?: string): string => {
    const keys = key.split('.');
    let value: any = cachedMessages[locale];

    for (const k of keys) {
      value = value?.[k];
      if (value === undefined || value === null) break;
    }

    if (typeof value === 'string') return value;

    // Fallback to English
    if (locale !== 'en') {
      let fallback: any = cachedMessages['en'];
      for (const k of keys) {
        fallback = fallback?.[k];
        if (fallback === undefined || fallback === null) break;
      }
      if (typeof fallback === 'string') return fallback;
    }

    return defaultValue || key;
  }, [locale]);

  const setLocale = useCallback((newLocale: Locale) => {
    localStorage.setItem('NEXT_LOCALE', newLocale);
    setLocaleState(newLocale);
    loadMessages(newLocale).then(() => {
      setTick((n) => n + 1);
    });
  }, []);

  return { t, locale, setLocale, isReady };
}
