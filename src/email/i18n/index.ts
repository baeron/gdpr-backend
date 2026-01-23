/**
 * Email i18n service
 * Provides translations for all 24 EU languages with fallback to English
 */

import {
  EmailTranslations,
  EULocale,
  EU_LOCALES,
  DEFAULT_LOCALE,
} from './types';
import * as translations from './translations';

// Type-safe translation map
const translationMap: Record<EULocale, EmailTranslations> = {
  en: translations.en,
  de: translations.de,
  fr: translations.fr,
  it: translations.it,
  es: translations.es,
  pt: translations.pt,
  nl: translations.nl,
  pl: translations.pl,
  cs: translations.cs,
  sk: translations.sk,
  hu: translations.hu,
  ro: translations.ro,
  bg: translations.bg,
  el: translations.el,
  da: translations.da,
  sv: translations.sv,
  fi: translations.fi,
  et: translations.et,
  lv: translations.lv,
  lt: translations.lt,
  sl: translations.sl,
  hr: translations.hr,
  mt: translations.mt,
  ga: translations.ga,
};

/**
 * Check if a locale is supported
 */
export function isValidLocale(locale: string): locale is EULocale {
  return EU_LOCALES.includes(locale as EULocale);
}

/**
 * Get translations for a locale with fallback to English
 */
export function getTranslations(locale: string): EmailTranslations {
  const validLocale = isValidLocale(locale) ? locale : DEFAULT_LOCALE;
  return translationMap[validLocale];
}

/**
 * Get a specific translation key with type safety
 */
export function t<
  Section extends keyof EmailTranslations,
  Key extends keyof EmailTranslations[Section],
>(locale: string, section: Section, key: Key): string {
  const trans = getTranslations(locale);
  return trans[section][key] as string;
}

/**
 * Interpolate variables in a translation string
 * Example: interpolate("Hello {{name}}", { name: "John" }) => "Hello John"
 */
export function interpolate(
  template: string,
  variables: Record<string, string | number>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    return String(variables[key] ?? `{{${key}}}`);
  });
}

/**
 * Get translation with variable interpolation
 */
export function tWithVars<
  Section extends keyof EmailTranslations,
  Key extends keyof EmailTranslations[Section],
>(
  locale: string,
  section: Section,
  key: Key,
  variables: Record<string, string | number>,
): string {
  const translation = t(locale, section, key);
  return interpolate(translation, variables);
}

/**
 * Get the display name of a locale in its own language
 */
export function getLocaleDisplayName(locale: string): string {
  const names: Record<EULocale, string> = {
    en: 'English',
    de: 'Deutsch',
    fr: 'Français',
    it: 'Italiano',
    es: 'Español',
    pt: 'Português',
    nl: 'Nederlands',
    pl: 'Polski',
    cs: 'Čeština',
    sk: 'Slovenčina',
    hu: 'Magyar',
    ro: 'Română',
    bg: 'Български',
    el: 'Ελληνικά',
    da: 'Dansk',
    sv: 'Svenska',
    fi: 'Suomi',
    et: 'Eesti',
    lv: 'Latviešu',
    lt: 'Lietuvių',
    sl: 'Slovenščina',
    hr: 'Hrvatski',
    mt: 'Malti',
    ga: 'Gaeilge',
  };

  return isValidLocale(locale) ? names[locale] : names[DEFAULT_LOCALE];
}

// Re-export types
export type { EmailTranslations, EULocale } from './types';
export { EU_LOCALES, DEFAULT_LOCALE } from './types';
