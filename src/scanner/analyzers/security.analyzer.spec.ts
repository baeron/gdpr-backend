import { SecurityAnalyzer, SecurityInfo } from './security.analyzer';
import { CookieInfo, RiskLevel } from '../dto/scan-result.dto';

const makeCookie = (overrides: Partial<CookieInfo> = {}): CookieInfo => ({
  name: '_ga', domain: '.example.com', path: '/', expires: '',
  httpOnly: false, secure: true, sameSite: 'Lax',
  category: 'analytics', setBeforeConsent: false,
  ...overrides,
});

describe('SecurityAnalyzer', () => {
  let analyzer: SecurityAnalyzer;

  beforeEach(() => {
    analyzer = new SecurityAnalyzer();
  });

  const defaultSecurity: SecurityInfo = {
    https: { enabled: true, redirectsToHttps: true },
    mixedContent: { found: false, resources: [] },
    cookieSecurity: {
      withoutSecure: 0,
      withoutHttpOnly: 0,
      withoutSameSite: 0,
      excessiveExpiration: 0,
      issues: [],
    },
  };

  describe('generateIssues', () => {
    it('should return empty for secure site', () => {
      expect(SecurityAnalyzer.generateIssues(defaultSecurity)).toHaveLength(0);
    });

    it('NO_HTTPS', () => {
      const security = { ...defaultSecurity, https: { enabled: false, redirectsToHttps: false } };
      const issues = SecurityAnalyzer.generateIssues(security);
      expect(issues.some((i) => i.code === 'NO_HTTPS')).toBe(true);
      expect(issues[0].riskLevel).toBe(RiskLevel.HIGH);
    });

    it('MIXED_CONTENT', () => {
      const security = { ...defaultSecurity, mixedContent: { found: true, resources: ['http://cdn.com/s.js'] } };
      expect(SecurityAnalyzer.generateIssues(security).some((i) => i.code === 'MIXED_CONTENT')).toBe(true);
    });

    it('COOKIE_EXCESSIVE_EXPIRATION', () => {
      const security = {
        ...defaultSecurity,
        cookieSecurity: { ...defaultSecurity.cookieSecurity, excessiveExpiration: 3 },
      };
      expect(SecurityAnalyzer.generateIssues(security).some((i) => i.code === 'COOKIE_EXCESSIVE_EXPIRATION')).toBe(true);
    });

    it('COOKIES_WITHOUT_SECURE on HTTPS', () => {
      const security = {
        ...defaultSecurity,
        cookieSecurity: { ...defaultSecurity.cookieSecurity, withoutSecure: 5 },
      };
      expect(SecurityAnalyzer.generateIssues(security).some((i) => i.code === 'COOKIES_WITHOUT_SECURE')).toBe(true);
    });

    it('should NOT flag COOKIES_WITHOUT_SECURE on HTTP', () => {
      const security = {
        ...defaultSecurity,
        https: { enabled: false, redirectsToHttps: false },
        cookieSecurity: { ...defaultSecurity.cookieSecurity, withoutSecure: 5 },
      };
      expect(SecurityAnalyzer.generateIssues(security).some((i) => i.code === 'COOKIES_WITHOUT_SECURE')).toBe(false);
    });

    it('COOKIES_WITHOUT_SAMESITE when > 3', () => {
      const security = {
        ...defaultSecurity,
        cookieSecurity: { ...defaultSecurity.cookieSecurity, withoutSameSite: 5 },
      };
      expect(SecurityAnalyzer.generateIssues(security).some((i) => i.code === 'COOKIES_WITHOUT_SAMESITE')).toBe(true);
    });

    it('should NOT flag COOKIES_WITHOUT_SAMESITE when <= 3', () => {
      const security = {
        ...defaultSecurity,
        cookieSecurity: { ...defaultSecurity.cookieSecurity, withoutSameSite: 2 },
      };
      expect(SecurityAnalyzer.generateIssues(security).some((i) => i.code === 'COOKIES_WITHOUT_SAMESITE')).toBe(false);
    });
  });

  describe('analyzeCookieSecurity', () => {
    it('should return zeros for empty cookie list', () => {
      const result = analyzer.analyzeCookieSecurity([]);
      expect(result.withoutSecure).toBe(0);
      expect(result.withoutHttpOnly).toBe(0);
      expect(result.withoutSameSite).toBe(0);
      expect(result.excessiveExpiration).toBe(0);
      expect(result.issues).toHaveLength(0);
    });

    it('should detect cookies without Secure flag', () => {
      const result = analyzer.analyzeCookieSecurity([makeCookie({ secure: false })]);
      expect(result.withoutSecure).toBe(1);
    });

    it('should create issue for non-necessary cookie without Secure', () => {
      const result = analyzer.analyzeCookieSecurity([makeCookie({ secure: false, category: 'analytics' })]);
      expect(result.issues.some((i) => i.issue === 'no_secure')).toBe(true);
    });

    it('should NOT create issue for necessary cookie without Secure', () => {
      const result = analyzer.analyzeCookieSecurity([makeCookie({ name: 'session', secure: false, httpOnly: true, category: 'necessary' })]);
      expect(result.withoutSecure).toBe(1);
      expect(result.issues.some((i) => i.issue === 'no_secure')).toBe(false);
    });

    it('should detect sensitive cookies without HttpOnly', () => {
      const result = analyzer.analyzeCookieSecurity([makeCookie({ name: 'session_id', httpOnly: false, category: 'necessary' })]);
      expect(result.withoutHttpOnly).toBe(1);
      expect(result.issues.some((i) => i.issue === 'no_httponly')).toBe(true);
    });

    it('should NOT flag non-sensitive cookies without HttpOnly as issue', () => {
      const result = analyzer.analyzeCookieSecurity([makeCookie({ name: '_ga', httpOnly: false })]);
      expect(result.withoutHttpOnly).toBe(1);
      expect(result.issues.some((i) => i.issue === 'no_httponly')).toBe(false);
    });

    it('should detect SameSite=None without Secure', () => {
      const result = analyzer.analyzeCookieSecurity([makeCookie({ name: 'tracker', secure: false, sameSite: 'None', category: 'marketing' })]);
      expect(result.withoutSameSite).toBe(1);
      expect(result.issues.some((i) => i.issue === 'no_samesite')).toBe(true);
    });

    it('should count cookies without SameSite', () => {
      const result = analyzer.analyzeCookieSecurity([
        makeCookie({ name: 'c1', sameSite: '' }),
        makeCookie({ name: 'c2', sameSite: 'None' }),
      ]);
      expect(result.withoutSameSite).toBe(2);
    });

    it('should detect excessive expiration (> 13 months)', () => {
      const farFuture = new Date(Date.now() + 14 * 30 * 24 * 60 * 60 * 1000).toISOString();
      const result = analyzer.analyzeCookieSecurity([makeCookie({ expires: farFuture })]);
      expect(result.excessiveExpiration).toBe(1);
      expect(result.issues.some((i) => i.issue === 'excessive_expiration')).toBe(true);
    });

    it('should NOT flag cookies with normal expiration', () => {
      const normalFuture = new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000).toISOString();
      const result = analyzer.analyzeCookieSecurity([makeCookie({ expires: normalFuture })]);
      expect(result.excessiveExpiration).toBe(0);
    });

    it('should limit issues to 20', () => {
      const cookies = Array.from({ length: 25 }, (_, i) =>
        makeCookie({ name: `cookie_${i}`, secure: false, category: 'marketing' }),
      );
      const result = analyzer.analyzeCookieSecurity(cookies);
      expect(result.issues.length).toBeLessThanOrEqual(20);
    });

    it('should detect auth/token cookies as sensitive', () => {
      const sensitiveNames = ['auth_token', 'csrf_token', 'xsrf-key', 'login_session', 'user_id', 'account_data'];
      const cookies = sensitiveNames.map((name) =>
        makeCookie({ name, httpOnly: false, category: 'necessary' }),
      );
      const result = analyzer.analyzeCookieSecurity(cookies);
      expect(result.issues.filter((i) => i.issue === 'no_httponly').length).toBe(sensitiveNames.length);
    });
  });

  describe('resetMixedContent', () => {
    it('should clear mixed content state', () => {
      analyzer.resetMixedContent();
      const info = analyzer.getMixedContentInfo();
      expect(info.found).toBe(false);
      expect(info.resources).toHaveLength(0);
    });
  });
});
