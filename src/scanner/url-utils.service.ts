import { Injectable } from '@nestjs/common';
import { CookieInfo } from './dto/scan-result.dto';

/**
 * URL normalization and domain comparison utilities for the scanner.
 */
@Injectable()
export class UrlUtilsService {
  /**
   * Normalize a URL by adding https:// if no protocol is specified.
   */
  normalizeUrl(url: string): string {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    return url;
  }

  /**
   * Check if a request domain belongs to the same site as the base domain.
   * Handles www prefix and subdomains.
   *
   * Fixed: now checks dot boundary to prevent 'notexample.com' matching 'example.com'.
   */
  isSameDomain(baseDomain: string, requestDomain: string): boolean {
    const normalize = (d: string) => d.replace(/^www\./, '');
    const base = normalize(baseDomain);
    const request = normalize(requestDomain);

    // Exact match
    if (request === base) {
      return true;
    }

    // Subdomain match: request must end with '.base'
    return request.endsWith('.' + base);
  }

  /**
   * Merge cookies from before-consent and after-consent scans.
   * Keeps the before-consent version when a cookie exists in both.
   */
  mergeCookies(
    before: CookieInfo[],
    after: CookieInfo[],
  ): CookieInfo[] {
    const cookieMap = new Map<string, CookieInfo>();

    for (const cookie of before) {
      cookieMap.set(`${cookie.name}|${cookie.domain}`, cookie);
    }

    for (const cookie of after) {
      const key = `${cookie.name}|${cookie.domain}`;
      if (!cookieMap.has(key)) {
        cookieMap.set(key, cookie);
      }
    }

    return Array.from(cookieMap.values());
  }
}
