import { Injectable } from '@nestjs/common';
import { Page, Cookie } from 'playwright';
import { CookieInfo, RiskLevel, ScanIssue } from '../dto/scan-result.dto';
import {
  KNOWN_COOKIES,
  COOKIE_CATEGORY_PATTERNS,
  KnownCookieEntry,
} from '../data/known-cookies';

@Injectable()
export class CookieAnalyzer {
  async analyzeCookies(
    page: Page,
    beforeConsent: boolean,
  ): Promise<CookieInfo[]> {
    const cookies = await page.context().cookies();

    return cookies.map((cookie) => this.mapCookie(cookie, beforeConsent));
  }

  private mapCookie(cookie: Cookie, setBeforeConsent: boolean): CookieInfo {
    const knownCookie = this.findKnownCookie(cookie.name);

    return {
      name: cookie.name,
      domain: cookie.domain,
      path: cookie.path,
      expires:
        cookie.expires > 0
          ? new Date(cookie.expires * 1000).toISOString()
          : null,
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      sameSite: cookie.sameSite || 'None',
      category: knownCookie?.category || this.guessCategory(cookie.name),
      setBeforeConsent,
    };
  }

  private findKnownCookie(
    name: string,
  ): KnownCookieEntry | undefined {
    // Exact match
    if (KNOWN_COOKIES[name]) {
      return KNOWN_COOKIES[name];
    }

    // Prefix match (e.g., _ga_XXXXX, mp_xxxxx, amp_xxxxx)
    for (const [key, value] of Object.entries(KNOWN_COOKIES)) {
      if (name.startsWith(key)) {
        return value;
      }
    }

    return undefined;
  }

  private guessCategory(name: string): CookieInfo['category'] {
    for (const { category, patterns } of COOKIE_CATEGORY_PATTERNS) {
      if (patterns.some((pattern) => pattern.test(name))) {
        return category;
      }
    }

    return 'unknown';
  }

  static generateIssues(cookies: CookieInfo[]): ScanIssue[] {
    const issues: ScanIssue[] = [];
    const nonEssentialBeforeConsent = cookies.filter(
      (c) => c.setBeforeConsent && c.category !== 'necessary',
    );
    if (nonEssentialBeforeConsent.length > 0) {
      issues.push({
        code: 'COOKIES_BEFORE_CONSENT',
        title: 'Non-essential cookies set before consent',
        description: `${nonEssentialBeforeConsent.length} non-essential cookie(s) were set before user consent was obtained.`,
        riskLevel: RiskLevel.HIGH,
        recommendation:
          'Ensure all non-essential cookies are only set after obtaining explicit user consent.',
      });
    }
    return issues;
  }
}
