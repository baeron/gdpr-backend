import { Page, Cookie } from 'playwright';
import { CookieInfo } from '../dto/scan-result.dto';

const KNOWN_COOKIES: Record<string, { category: CookieInfo['category']; description: string }> = {
  // Analytics
  _ga: { category: 'analytics', description: 'Google Analytics' },
  _gid: { category: 'analytics', description: 'Google Analytics' },
  _gat: { category: 'analytics', description: 'Google Analytics' },
  _gtag: { category: 'analytics', description: 'Google Tag Manager' },
  
  // Marketing
  _fbp: { category: 'marketing', description: 'Facebook Pixel' },
  _fbc: { category: 'marketing', description: 'Facebook Click' },
  fr: { category: 'marketing', description: 'Facebook' },
  _gcl_au: { category: 'marketing', description: 'Google Ads' },
  _gcl_aw: { category: 'marketing', description: 'Google Ads' },
  IDE: { category: 'marketing', description: 'Google DoubleClick' },
  
  // Necessary (common)
  PHPSESSID: { category: 'necessary', description: 'PHP Session' },
  JSESSIONID: { category: 'necessary', description: 'Java Session' },
  csrftoken: { category: 'necessary', description: 'CSRF Protection' },
  _csrf: { category: 'necessary', description: 'CSRF Protection' },
};

export class CookieAnalyzer {
  async analyzeCookies(page: Page, beforeConsent: boolean): Promise<CookieInfo[]> {
    const cookies = await page.context().cookies();
    
    return cookies.map(cookie => this.mapCookie(cookie, beforeConsent));
  }

  private mapCookie(cookie: Cookie, setBeforeConsent: boolean): CookieInfo {
    const knownCookie = this.findKnownCookie(cookie.name);
    
    return {
      name: cookie.name,
      domain: cookie.domain,
      path: cookie.path,
      expires: cookie.expires > 0 ? new Date(cookie.expires * 1000).toISOString() : null,
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      sameSite: cookie.sameSite || 'None',
      category: knownCookie?.category || this.guessCategory(cookie.name),
      setBeforeConsent,
    };
  }

  private findKnownCookie(name: string): { category: CookieInfo['category']; description: string } | undefined {
    // Exact match
    if (KNOWN_COOKIES[name]) {
      return KNOWN_COOKIES[name];
    }
    
    // Prefix match (e.g., _ga_XXXXX)
    for (const [key, value] of Object.entries(KNOWN_COOKIES)) {
      if (name.startsWith(key)) {
        return value;
      }
    }
    
    return undefined;
  }

  private guessCategory(name: string): CookieInfo['category'] {
    const lowerName = name.toLowerCase();
    
    // Analytics patterns
    if (lowerName.includes('analytics') || lowerName.includes('_ga') || lowerName.includes('gtm')) {
      return 'analytics';
    }
    
    // Marketing patterns
    if (lowerName.includes('ad') || lowerName.includes('marketing') || lowerName.includes('pixel')) {
      return 'marketing';
    }
    
    // Necessary patterns
    if (lowerName.includes('session') || lowerName.includes('csrf') || lowerName.includes('auth')) {
      return 'necessary';
    }
    
    return 'unknown';
  }
}
