import { SecurityAnalyzer, SecurityInfo } from './security.analyzer';
import { RiskLevel } from '../dto/scan-result.dto';

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

  describe('resetMixedContent', () => {
    it('should clear mixed content state', () => {
      analyzer.resetMixedContent();
      const info = analyzer.getMixedContentInfo();
      expect(info.found).toBe(false);
      expect(info.resources).toHaveLength(0);
    });
  });
});
