import { CookieAnalyzer } from './cookie.analyzer';
import { CookieInfo, RiskLevel } from '../dto/scan-result.dto';

describe('CookieAnalyzer', () => {
  let analyzer: CookieAnalyzer;

  beforeEach(() => {
    analyzer = new CookieAnalyzer();
  });

  describe('generateIssues', () => {
    const makeCookie = (overrides: Partial<CookieInfo> = {}): CookieInfo => ({
      name: 'test',
      domain: '.example.com',
      path: '/',
      expires: null,
      httpOnly: false,
      secure: false,
      sameSite: 'None',
      category: 'unknown',
      setBeforeConsent: false,
      ...overrides,
    });

    it('should flag non-essential cookies before consent', () => {
      const cookies = [makeCookie({ category: 'analytics', setBeforeConsent: true })];
      const issues = CookieAnalyzer.generateIssues(cookies);
      expect(issues).toHaveLength(1);
      expect(issues[0].code).toBe('COOKIES_BEFORE_CONSENT');
      expect(issues[0].riskLevel).toBe(RiskLevel.HIGH);
    });

    it('should NOT flag necessary cookies before consent', () => {
      const cookies = [makeCookie({ category: 'necessary', setBeforeConsent: true })];
      expect(CookieAnalyzer.generateIssues(cookies)).toHaveLength(0);
    });

    it('should NOT flag non-essential cookies after consent', () => {
      const cookies = [makeCookie({ category: 'marketing', setBeforeConsent: false })];
      expect(CookieAnalyzer.generateIssues(cookies)).toHaveLength(0);
    });

    it('should return empty for no cookies', () => {
      expect(CookieAnalyzer.generateIssues([])).toHaveLength(0);
    });

    it('should count multiple non-essential cookies', () => {
      const cookies = [
        makeCookie({ name: '_ga', category: 'analytics', setBeforeConsent: true }),
        makeCookie({ name: '_fbp', category: 'marketing', setBeforeConsent: true }),
      ];
      const issues = CookieAnalyzer.generateIssues(cookies);
      expect(issues[0].description).toContain('2 non-essential');
    });
  });
});
