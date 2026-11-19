import { Injectable, Logger } from '@nestjs/common';
import { CookieInfo } from './dto/scan-result.dto';
import { checkPublicHost } from '../common/net/public-address';
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

const ALLOWED_PORTS = new Set(['80', '443']);
const MAX_URL_LENGTH = 2048;

const BANNED_TLDS = ['gov', 'mil', 'edu', 'xxx', 'porn', 'sex', 'adult'];

/**
 * Utility service for URL and domain operations.
 */
@Injectable()
export class UrlUtilsService {
  private readonly logger = new Logger(UrlUtilsService.name);

  /**
   * DNS resolver used for the SSRF check. `undefined` = system resolver
   * (dns.lookup, same as the browser). Overridable in tests.
   */
  resolver?: (host: string) => Promise<string[]>;

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
   *
   * Rejects: non-http(s) schemes, embedded credentials, non-standard ports,
   * raw IP addresses, blacklisted domains/TLDs, and any hostname that
   * resolves (even partially) to a loopback/private/link-local/reserved
   * address — the scanner runs inside our network, so this is the first
   * SSRF barrier. The second one is the egress proxy the browser is forced
   * through (see egress-proxy.ts), which also covers redirects.
   */
  async validateAndCheckUrl(
    url: string,
  ): Promise<{ isValid: boolean; normalizedUrl: string; error?: string }> {
    let normalizedUrl = url;
    let parsedUrl: URL;
    try {
      normalizedUrl = this.normalizeUrl(url.trim());
      parsedUrl = new URL(normalizedUrl);
    } catch {
      this.logger.warn(`Scan rejected: Invalid URL format - ${url}`);
      return { isValid: false, normalizedUrl, error: 'Invalid URL format.' };
    }

    const reject = (error: string, reason: string) => {
      this.logger.warn(`Scan rejected (${reason}): ${parsedUrl.hostname}`);
      return { isValid: false, normalizedUrl, error };
    };

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return reject('Only http:// and https:// URLs are allowed.', 'scheme');
    }
    if (parsedUrl.username || parsedUrl.password) {
      return reject(
        'URLs with embedded credentials are not allowed.',
        'credentials',
      );
    }
    if (parsedUrl.port && !ALLOWED_PORTS.has(parsedUrl.port)) {
      return reject(
        'Only standard web ports (80, 443) can be scanned.',
        'port',
      );
    }
    if (normalizedUrl.length > MAX_URL_LENGTH) {
      return reject('URL is too long.', 'length');
    }

    const hostname = parsedUrl.hostname.toLowerCase();

    // 1. Check if domain or TLD is blacklisted
    const tldInfo = parse(hostname);
    const isBannedTld =
      tldInfo.publicSuffix &&
      BANNED_TLDS.some((tld) => tldInfo.publicSuffix?.endsWith(tld));
    const isBlacklistedDomain =
      tldInfo.domain && DOMAIN_BLACKLIST.includes(tldInfo.domain.toLowerCase());
    if (isBannedTld || isBlacklistedDomain) {
      return reject(
        'Scanning this domain is not allowed according to our policy.',
        'blacklist',
      );
    }

    // 2. Resolve and require every address to be public
    const hostCheck = await checkPublicHost(hostname, {
      allowIpLiteral: false,
      resolver: this.resolver,
    });
    if (!hostCheck.ok) {
      switch (hostCheck.reason) {
        case 'ip-literal':
          return reject(
            'Please enter a domain name, not an IP address.',
            'ip-literal',
          );
        case 'unresolvable':
          return reject(
            'Domain could not be resolved. Please check the URL and try again.',
            'dns',
          );
        default:
          return reject(
            'Scanning internal or private network addresses is not allowed.',
            'non-public',
          );
      }
    }

    return { isValid: true, normalizedUrl };
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
  mergeCookies(before: CookieInfo[], after: CookieInfo[]): CookieInfo[] {
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
