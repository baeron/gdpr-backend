import { isValidLocale, DEFAULT_LOCALE } from '../email/i18n';

const DEFAULT_FRONTEND_URL = 'https://policytracker.eu';

/**
 * Absolute link into the public frontend. The site is built per locale
 * and served under /<locale>/ (see the frontend's nginx config), so every
 * link sent outside the app (e-mails, PDFs) carries a locale prefix.
 *
 * FRONTEND_URL is also the CORS origin of the pricing websocket; anything
 * that is not an absolute http(s) URL falls back to the production site
 * rather than producing broken links in an e-mail.
 */
export function frontendUrl(locale: string | null | undefined, path: string) {
  const configured = (process.env.FRONTEND_URL ?? '').trim();
  const base = /^https?:\/\//.test(configured)
    ? configured.replace(/\/+$/, '')
    : DEFAULT_FRONTEND_URL;

  const short = (locale ?? '').toLowerCase().split('-')[0];
  const lang = isValidLocale(short) ? short : DEFAULT_LOCALE;

  return `${base}/${lang}/${path.replace(/^\/+/, '')}`;
}
