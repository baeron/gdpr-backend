import { HeadersAnalyzer, SecurityHeadersInfo } from './headers.analyzer';
import { RiskLevel } from '../dto/scan-result.dto';

describe('HeadersAnalyzer', () => {
  const makeHeadersInfo = (overrides: Partial<SecurityHeadersInfo> = {}): SecurityHeadersInfo => ({
    headers: {},
    csp: { present: true, value: "default-src 'self'; script-src 'self'", hasDefaultSrc: true, hasScriptSrc: true, hasUnsafeInline: false, hasUnsafeEval: false },
    hsts: { present: true, value: 'max-age=31536000; includeSubDomains; preload', maxAge: 31536000, includesSubDomains: true, preload: true },
    xFrameOptions: { present: true, value: 'DENY' },
    xContentTypeOptions: { present: true, value: 'nosniff' },
    referrerPolicy: { present: true, value: 'strict-origin-when-cross-origin' },
    permissionsPolicy: { present: true, value: 'camera=(), microphone=(), geolocation=()' },
    missingHeaders: [],
    score: 100,
    ...overrides,
  });

  describe('generateIssues', () => {
    it('should return empty for fully secured site', () => {
      const info = makeHeadersInfo();
      expect(HeadersAnalyzer.generateIssues(info)).toHaveLength(0);
    });

    it('NO_SECURITY_HEADERS when >= 5 headers missing', () => {
      const info = makeHeadersInfo({
        csp: { present: false, value: null, hasDefaultSrc: false, hasScriptSrc: false, hasUnsafeInline: false, hasUnsafeEval: false },
        hsts: { present: false, value: null, maxAge: null, includesSubDomains: false, preload: false },
        xFrameOptions: { present: false, value: null },
        xContentTypeOptions: { present: false, value: null },
        referrerPolicy: { present: false, value: null },
        permissionsPolicy: { present: false, value: null },
        missingHeaders: ['Content-Security-Policy', 'Strict-Transport-Security', 'X-Frame-Options', 'X-Content-Type-Options', 'Referrer-Policy', 'Permissions-Policy'],
      });
      const issues = HeadersAnalyzer.generateIssues(info);
      expect(issues).toHaveLength(1);
      expect(issues[0].code).toBe('NO_SECURITY_HEADERS');
      expect(issues[0].riskLevel).toBe(RiskLevel.HIGH);
    });

    it('should NOT return NO_SECURITY_HEADERS when < 5 headers missing', () => {
      const info = makeHeadersInfo({
        csp: { present: false, value: null, hasDefaultSrc: false, hasScriptSrc: false, hasUnsafeInline: false, hasUnsafeEval: false },
        hsts: { present: false, value: null, maxAge: null, includesSubDomains: false, preload: false },
        xFrameOptions: { present: false, value: null },
        xContentTypeOptions: { present: false, value: null },
        missingHeaders: ['Content-Security-Policy', 'Strict-Transport-Security', 'X-Frame-Options', 'X-Content-Type-Options'],
      });
      const issues = HeadersAnalyzer.generateIssues(info);
      expect(issues.some((i) => i.code === 'NO_SECURITY_HEADERS')).toBe(false);
    });

    it('MISSING_CSP when CSP is absent', () => {
      const info = makeHeadersInfo({
        csp: { present: false, value: null, hasDefaultSrc: false, hasScriptSrc: false, hasUnsafeInline: false, hasUnsafeEval: false },
        missingHeaders: ['Content-Security-Policy'],
      });
      const issues = HeadersAnalyzer.generateIssues(info);
      expect(issues.some((i) => i.code === 'MISSING_CSP')).toBe(true);
      expect(issues.find((i) => i.code === 'MISSING_CSP')!.riskLevel).toBe(RiskLevel.MEDIUM);
    });

    it('WEAK_CSP when CSP has unsafe-inline and unsafe-eval', () => {
      const info = makeHeadersInfo({
        csp: { present: true, value: "default-src 'self' 'unsafe-inline' 'unsafe-eval'", hasDefaultSrc: true, hasScriptSrc: false, hasUnsafeInline: true, hasUnsafeEval: true },
      });
      const issues = HeadersAnalyzer.generateIssues(info);
      expect(issues.some((i) => i.code === 'WEAK_CSP')).toBe(true);
      expect(issues.find((i) => i.code === 'WEAK_CSP')!.riskLevel).toBe(RiskLevel.LOW);
    });

    it('should NOT flag WEAK_CSP when only unsafe-inline', () => {
      const info = makeHeadersInfo({
        csp: { present: true, value: "default-src 'self' 'unsafe-inline'", hasDefaultSrc: true, hasScriptSrc: false, hasUnsafeInline: true, hasUnsafeEval: false },
      });
      expect(HeadersAnalyzer.generateIssues(info).some((i) => i.code === 'WEAK_CSP')).toBe(false);
    });

    it('MISSING_HSTS when HSTS is absent', () => {
      const info = makeHeadersInfo({
        hsts: { present: false, value: null, maxAge: null, includesSubDomains: false, preload: false },
        missingHeaders: ['Strict-Transport-Security'],
      });
      const issues = HeadersAnalyzer.generateIssues(info);
      expect(issues.some((i) => i.code === 'MISSING_HSTS')).toBe(true);
      expect(issues.find((i) => i.code === 'MISSING_HSTS')!.riskLevel).toBe(RiskLevel.MEDIUM);
    });

    it('WEAK_HSTS when max-age < 1 year', () => {
      const info = makeHeadersInfo({
        hsts: { present: true, value: 'max-age=86400', maxAge: 86400, includesSubDomains: false, preload: false },
      });
      const issues = HeadersAnalyzer.generateIssues(info);
      expect(issues.some((i) => i.code === 'WEAK_HSTS')).toBe(true);
      expect(issues.find((i) => i.code === 'WEAK_HSTS')!.riskLevel).toBe(RiskLevel.LOW);
    });

    it('should NOT flag WEAK_HSTS when max-age >= 1 year', () => {
      const info = makeHeadersInfo({
        hsts: { present: true, value: 'max-age=31536000', maxAge: 31536000, includesSubDomains: false, preload: false },
      });
      expect(HeadersAnalyzer.generateIssues(info).some((i) => i.code === 'WEAK_HSTS')).toBe(false);
    });

    it('MISSING_X_FRAME_OPTIONS when absent', () => {
      const info = makeHeadersInfo({
        xFrameOptions: { present: false, value: null },
        missingHeaders: ['X-Frame-Options'],
      });
      expect(HeadersAnalyzer.generateIssues(info).some((i) => i.code === 'MISSING_X_FRAME_OPTIONS')).toBe(true);
    });

    it('MISSING_X_CONTENT_TYPE_OPTIONS when absent', () => {
      const info = makeHeadersInfo({
        xContentTypeOptions: { present: false, value: null },
        missingHeaders: ['X-Content-Type-Options'],
      });
      expect(HeadersAnalyzer.generateIssues(info).some((i) => i.code === 'MISSING_X_CONTENT_TYPE_OPTIONS')).toBe(true);
    });

    it('MISSING_REFERRER_POLICY when absent', () => {
      const info = makeHeadersInfo({
        referrerPolicy: { present: false, value: null },
        missingHeaders: ['Referrer-Policy'],
      });
      const issues = HeadersAnalyzer.generateIssues(info);
      expect(issues.some((i) => i.code === 'MISSING_REFERRER_POLICY')).toBe(true);
    });

    it('MISSING_PERMISSIONS_POLICY when absent', () => {
      const info = makeHeadersInfo({
        permissionsPolicy: { present: false, value: null },
        missingHeaders: ['Permissions-Policy'],
      });
      expect(HeadersAnalyzer.generateIssues(info).some((i) => i.code === 'MISSING_PERMISSIONS_POLICY')).toBe(true);
    });

    it('should return multiple issues for partially missing headers', () => {
      const info = makeHeadersInfo({
        csp: { present: false, value: null, hasDefaultSrc: false, hasScriptSrc: false, hasUnsafeInline: false, hasUnsafeEval: false },
        hsts: { present: false, value: null, maxAge: null, includesSubDomains: false, preload: false },
        referrerPolicy: { present: false, value: null },
        missingHeaders: ['Content-Security-Policy', 'Strict-Transport-Security', 'Referrer-Policy'],
      });
      const issues = HeadersAnalyzer.generateIssues(info);
      expect(issues.some((i) => i.code === 'MISSING_CSP')).toBe(true);
      expect(issues.some((i) => i.code === 'MISSING_HSTS')).toBe(true);
      expect(issues.some((i) => i.code === 'MISSING_REFERRER_POLICY')).toBe(true);
      expect(issues.some((i) => i.code === 'NO_SECURITY_HEADERS')).toBe(false);
    });

    it('all individual missing header issues should have LOW risk except CSP and HSTS (MEDIUM)', () => {
      const info = makeHeadersInfo({
        csp: { present: false, value: null, hasDefaultSrc: false, hasScriptSrc: false, hasUnsafeInline: false, hasUnsafeEval: false },
        hsts: { present: false, value: null, maxAge: null, includesSubDomains: false, preload: false },
        xFrameOptions: { present: false, value: null },
        xContentTypeOptions: { present: false, value: null },
        missingHeaders: ['Content-Security-Policy', 'Strict-Transport-Security', 'X-Frame-Options', 'X-Content-Type-Options'],
      });
      const issues = HeadersAnalyzer.generateIssues(info);
      expect(issues.find((i) => i.code === 'MISSING_CSP')!.riskLevel).toBe(RiskLevel.MEDIUM);
      expect(issues.find((i) => i.code === 'MISSING_HSTS')!.riskLevel).toBe(RiskLevel.MEDIUM);
      expect(issues.find((i) => i.code === 'MISSING_X_FRAME_OPTIONS')!.riskLevel).toBe(RiskLevel.LOW);
      expect(issues.find((i) => i.code === 'MISSING_X_CONTENT_TYPE_OPTIONS')!.riskLevel).toBe(RiskLevel.LOW);
    });
  });
});
