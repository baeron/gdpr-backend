/**
 * Email translation types
 * Supports all 24 official EU languages
 */

export type EULocale =
  | 'en' // English
  | 'de' // German
  | 'fr' // French
  | 'it' // Italian
  | 'es' // Spanish
  | 'pt' // Portuguese
  | 'nl' // Dutch
  | 'pl' // Polish
  | 'cs' // Czech
  | 'sk' // Slovak
  | 'hu' // Hungarian
  | 'ro' // Romanian
  | 'bg' // Bulgarian
  | 'el' // Greek
  | 'da' // Danish
  | 'sv' // Swedish
  | 'fi' // Finnish
  | 'et' // Estonian
  | 'lv' // Latvian
  | 'lt' // Lithuanian
  | 'sl' // Slovenian
  | 'hr' // Croatian
  | 'mt' // Maltese
  | 'ga'; // Irish

export const EU_LOCALES: EULocale[] = [
  'en',
  'de',
  'fr',
  'it',
  'es',
  'pt',
  'nl',
  'pl',
  'cs',
  'sk',
  'hu',
  'ro',
  'bg',
  'el',
  'da',
  'sv',
  'fi',
  'et',
  'lv',
  'lt',
  'sl',
  'hr',
  'mt',
  'ga',
];

export const LOCALE_NAMES: Record<EULocale, string> = {
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

/**
 * Email translation keys
 */
export interface EmailTranslations {
  // Common
  common: {
    greeting: string;
    thankYou: string;
    bestRegards: string;
    team: string;
    questionsContact: string;
    automatedMessage: string;
    viewOnline: string;
    unsubscribe: string;
  };

  // Audit Confirmation Email
  auditConfirmation: {
    subject: string;
    preheader: string;
    title: string;
    intro: string;
    websiteLabel: string;
    auditIdLabel: string;
    whatHappensNext: string;
    step1: string;
    step2: string;
    step3: string;
    estimatedTime: string;
    tipTitle: string;
    tipContent: string;
  };

  // Audit Results Email
  auditResults: {
    subject: string;
    preheader: string;
    title: string;
    intro: string;
    scoreLabel: string;
    scoreExcellent: string;
    scoreGood: string;
    scoreNeedsImprovement: string;
    scoreCritical: string;
    summaryTitle: string;
    issuesFound: string;
    passedChecks: string;
    viewFullReport: string;
    topIssuesTitle: string;
    upgradeTitle: string;
    upgradeDescription: string;
    upgradeButton: string;
    freeReportNote: string;
  };

  // Payment Confirmation Email
  paymentConfirmation: {
    subject: string;
    preheader: string;
    title: string;
    intro: string;
    orderDetails: string;
    productLabel: string;
    productName: string;
    amountLabel: string;
    dateLabel: string;
    invoiceNote: string;
    accessReport: string;
    supportNote: string;
  };

  // Admin Notification
  adminNotification: {
    subject: string;
    newRequest: string;
    details: string;
    marketingOptIn: string;
    yes: string;
    no: string;
  };
}

export const DEFAULT_LOCALE: EULocale = 'en';
