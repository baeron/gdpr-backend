import { Injectable, Logger } from '@nestjs/common';
import { CookieInfo } from './dto/scan-result.dto';
import * as dns from 'dns/promises';
import { parse } from 'tldts';

const DOMAIN_BLACKLIST = [
  'google.com',
  'facebook.com',
  'apple.com',
  'microsoft.com',
  'amazon.com',
  'netflix.com',
  'instagram.com',
  'twitter.com',
  'linkedin.com',
  'tiktok.com',
  'youtube.com',
  'yahoo.com',
  'wikipedia.org',
  'reddit.com',
  'pornhub.com',
  'xvideos.com',
  'onlyfans.com',
  'xnxx.com',
  'chaturbate.com',
  'bongacams.com',
  'spankbang.com',
  'stripchat.com',
  'vk.com',
];

const BANNED_TLDS = [
  'gov',
  'mil',
  'edu',
  'xxx',
  'porn',
  'sex',
  'adult',
];

/**
 * Utility service for URL and domain operations.
 */
@Injectable()
export class UrlUtilsService {
  private readonly logger = new Logger(UrlUtilsService.name);

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
   * Validates a URL and checks if it's safe to scan.
   * Throws an error if the URL is invalid, blacklisted, or unreachable.
   */
  async validateAndCheckUrl(url: string): Promise<{ isValid: boolean; normalizedUrl: string; error?: string }> {
    try {
      const normalizedUrl = this.normalizeUrl(url);
      const parsedUrl = new URL(normalizedUrl);
      const hostname = parsedUrl.hostname;

      // 1. Check if domain or TLD is blacklisted
      const tldInfo = parse(hostname);
      const isBannedTld = tldInfo.publicSuffix && BANNED_TLDS.some(tld => tldInfo.publicSuffix?.endsWith(tld));
      const isBlacklistedDomain = tldInfo.domain && DOMAIN_BLACKLIST.includes(tldInfo.domain.toLowerCase());

      if (isBannedTld || isBlacklistedDomain) {
        this.logger.warn(`Scan rejected: Domain ${hostname} is blacklisted or uses a banned TLD`);
        return { isValid: false, normalizedUrl, error: 'Scanning this domain is not allowed according to our policy.' };
      }

      // 2. Check if domain resolves (DNS check)
      try {
        await dns.resolve(hostname);
      } catch (dnsError) {
        this.logger.warn(`Scan rejected: Domain ${hostname} could not be resolved (DNS error)`);
        return { isValid: false, normalizedUrl, error: 'Domain could not be resolved. Please check the URL and try again.' };
      }

      return { isValid: true, normalizedUrl };
    } catch (e) {
      this.logger.warn(`Scan rejected: Invalid URL format - ${url}`);
      return { isValid: false, normalizedUrl: url, error: 'Invalid URL format.' };
    }
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
