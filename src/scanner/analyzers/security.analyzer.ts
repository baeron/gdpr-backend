import { Page, Request } from 'playwright';
import { CookieInfo } from '../dto/scan-result.dto';

export interface SecurityInfo {
  https: {
    enabled: boolean;
    redirectsToHttps: boolean;
  };
  mixedContent: {
    found: boolean;
    resources: string[];
  };
  cookieSecurity: {
    withoutSecure: number;
    withoutHttpOnly: number;
    withoutSameSite: number;
    excessiveExpiration: number; // > 13 months
    issues: CookieSecurityIssue[];
  };
}

export interface CookieSecurityIssue {
  cookieName: string;
  issue: 'no_secure' | 'no_httponly' | 'no_samesite' | 'excessive_expiration';
  description: string;
  recommendation: string;
}

const THIRTEEN_MONTHS_MS = 13 * 30 * 24 * 60 * 60 * 1000; // ~13 months in milliseconds

export class SecurityAnalyzer {
  private mixedContentResources: string[] = [];

  async analyzeHttps(
    page: Page,
    originalUrl: string,
  ): Promise<SecurityInfo['https']> {
    const currentUrl = page.url();
    const isHttps = currentUrl.startsWith('https://');

    // Check if HTTP redirects to HTTPS
    let redirectsToHttps = false;
    if (originalUrl.startsWith('http://')) {
      redirectsToHttps = isHttps;
    }

    return {
      enabled: isHttps,
      redirectsToHttps,
    };
  }

  trackMixedContent(request: Request, pageIsHttps: boolean): void {
    if (!pageIsHttps) return;

    const url = request.url();
    if (url.startsWith('http://') && !url.includes('localhost')) {
      // Exclude certain resource types that browsers might handle differently
      const resourceType = request.resourceType();
      if (
        [
          'document',
          'script',
          'stylesheet',
          'image',
          'font',
          'xhr',
          'fetch',
        ].includes(resourceType)
      ) {
        this.mixedContentResources.push(url);
      }
    }
  }

  getMixedContentInfo(): SecurityInfo['mixedContent'] {
    const uniqueResources = [...new Set(this.mixedContentResources)];
    return {
      found: uniqueResources.length > 0,
      resources: uniqueResources.slice(0, 20), // Limit to 20
    };
  }

  resetMixedContent(): void {
    this.mixedContentResources = [];
  }

  analyzeCookieSecurity(cookies: CookieInfo[]): SecurityInfo['cookieSecurity'] {
    const issues: CookieSecurityIssue[] = [];
    let withoutSecure = 0;
    let withoutHttpOnly = 0;
    let withoutSameSite = 0;
    let excessiveExpiration = 0;

    const now = Date.now();

    for (const cookie of cookies) {
      // Skip necessary cookies for some checks (they're often session cookies)
      const isNecessary = cookie.category === 'necessary';

      // Check Secure flag (important for all non-localhost cookies)
      if (!cookie.secure) {
        withoutSecure++;
        if (!isNecessary) {
          issues.push({
            cookieName: cookie.name,
            issue: 'no_secure',
            description: `Cookie "${cookie.name}" is missing the Secure flag`,
            recommendation:
              'Add the Secure flag to ensure the cookie is only sent over HTTPS',
          });
        }
      }

      // Check HttpOnly flag (important for session/auth cookies)
      if (!cookie.httpOnly) {
        withoutHttpOnly++;
        // Only flag as issue for sensitive-looking cookies
        if (this.looksLikeSensitiveCookie(cookie.name)) {
          issues.push({
            cookieName: cookie.name,
            issue: 'no_httponly',
            description: `Cookie "${cookie.name}" is missing the HttpOnly flag`,
            recommendation:
              'Add the HttpOnly flag to prevent JavaScript access to this cookie',
          });
        }
      }

      // Check SameSite flag
      if (!cookie.sameSite || cookie.sameSite === 'None') {
        withoutSameSite++;
        if (cookie.sameSite === 'None' && !cookie.secure) {
          issues.push({
            cookieName: cookie.name,
            issue: 'no_samesite',
            description: `Cookie "${cookie.name}" has SameSite=None without Secure flag`,
            recommendation:
              'Cookies with SameSite=None must also have the Secure flag',
          });
        }
      }

      // Check expiration (CNIL: max 13 months)
      if (cookie.expires) {
        const expiresAt = new Date(cookie.expires).getTime();
        const lifetime = expiresAt - now;

        if (lifetime > THIRTEEN_MONTHS_MS) {
          excessiveExpiration++;
          const monthsRemaining = Math.round(
            lifetime / (30 * 24 * 60 * 60 * 1000),
          );
          issues.push({
            cookieName: cookie.name,
            issue: 'excessive_expiration',
            description: `Cookie "${cookie.name}" expires in ${monthsRemaining} months (max recommended: 13)`,
            recommendation:
              'Reduce cookie lifetime to maximum 13 months as per CNIL guidelines',
          });
        }
      }
    }

    return {
      withoutSecure,
      withoutHttpOnly,
      withoutSameSite,
      excessiveExpiration,
      issues: issues.slice(0, 20), // Limit issues to avoid huge responses
    };
  }

  private looksLikeSensitiveCookie(name: string): boolean {
    const sensitivePatterns = [
      /session/i,
      /auth/i,
      /token/i,
      /csrf/i,
      /xsrf/i,
      /login/i,
      /user/i,
      /account/i,
    ];
    return sensitivePatterns.some((pattern) => pattern.test(name));
  }
}
