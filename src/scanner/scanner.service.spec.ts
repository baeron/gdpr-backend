/* eslint-disable prettier/prettier */
import { ScannerService } from './scanner.service';
import { RiskLevel, ScanIssue, CookieInfo, ConsentBannerInfo, PrivacyPolicyInfo, ThirdPartyRequest, FormsAnalysisResult, DataTransferInfo } from './dto/scan-result.dto';
import { SecurityInfo } from './analyzers/security.analyzer';

/**
 * Unit tests for ScannerService
 *
 * These tests cover the pure logic methods of ScannerService:
 * - normalizeUrl
 * - isSameDomain
 * - mergeCookies
 * - generateIssues
 * - calculateOverallRisk
 * - calculateScore
 *
 * The scanWebsite() method requires Playwright and is tested
 * separately in integration/e2e tests.
 */
describe('ScannerService', () => {
  let service: ScannerService;

  beforeEach(() => {
    service = new ScannerService();
  });

  afterEach(async () => {
    // Ensure browser is closed after each test
    await service.onModuleDestroy();
  });

  // ============================================================
  // normalizeUrl
  // ============================================================
  describe('normalizeUrl', () => {
    it('should add https:// prefix when no protocol is provided', () => {
      const result = (service as any).normalizeUrl('example.com');
      expect(result).toBe('https://example.com');
    });

    it('should keep https:// prefix when already present', () => {
      const result = (service as any).normalizeUrl('https://example.com');
      expect(result).toBe('https://example.com');
    });

    it('should keep http:// prefix when already present', () => {
      const result = (service as any).normalizeUrl('http://example.com');
      expect(result).toBe('http://example.com');
    });

    it('should handle URLs with paths', () => {
      const result = (service as any).normalizeUrl('example.com/page');
      expect(result).toBe('https://example.com/page');
    });
  });

  // ============================================================
  // isSameDomain
  // ============================================================
  describe('isSameDomain', () => {
    it('should return true for exact domain match', () => {
      const result = (service as any).isSameDomain('example.com', 'example.com');
      expect(result).toBe(true);
    });

    it('should return true for www subdomain', () => {
      const result = (service as any).isSameDomain('example.com', 'www.example.com');
      expect(result).toBe(true);
    });

    it('should return true for subdomain of base domain', () => {
      const result = (service as any).isSameDomain('example.com', 'api.example.com');
      expect(result).toBe(true);
    });

    it('should return false for different domain', () => {
      const result = (service as any).isSameDomain('example.com', 'google.com');
      expect(result).toBe(false);
    });

    // Fixed in task #54: now correctly checks dot boundary
    it('should return false for partial domain match', () => {
      const result = (service as any).isSameDomain('example.com', 'notexample.com');
      expect(result).toBe(false);
    });

    it('should handle www prefix on base domain', () => {
      const result = (service as any).isSameDomain('www.example.com', 'example.com');
      expect(result).toBe(true);
    });
  });

  // ============================================================
  // mergeCookies
  // ============================================================
  describe('mergeCookies', () => {
    const makeCookie = (name: string, domain: string, beforeConsent: boolean): CookieInfo => ({
      name,
      domain,
      path: '/',
      expires: null,
      httpOnly: false,
      secure: false,
      sameSite: 'None',
      category: 'unknown',
      setBeforeConsent: beforeConsent,
    });

    it('should merge cookies from before and after consent', () => {
      const before = [makeCookie('_ga', '.example.com', true)];
      const after = [
        makeCookie('_ga', '.example.com', false),
        makeCookie('_fbp', '.example.com', false),
      ];

      const result = (service as any).mergeCookies(before, after);
      expect(result).toHaveLength(2);
    });

    it('should keep the before-consent version when cookie exists in both', () => {
      const before = [makeCookie('_ga', '.example.com', true)];
      const after = [makeCookie('_ga', '.example.com', false)];

      const result = (service as any).mergeCookies(before, after);
      expect(result).toHaveLength(1);
      expect(result[0].setBeforeConsent).toBe(true);
    });

    it('should return empty array when no cookies', () => {
      const result = (service as any).mergeCookies([], []);
      expect(result).toHaveLength(0);
    });

    it('should handle cookies with same name but different domains', () => {
      const before = [makeCookie('_ga', '.example.com', true)];
      const after = [makeCookie('_ga', '.other.com', false)];

      const result = (service as any).mergeCookies(before, after);
      expect(result).toHaveLength(2);
    });
  });

  // ============================================================
  // calculateOverallRisk
  // ============================================================
  describe('calculateOverallRisk', () => {
    const makeIssue = (riskLevel: RiskLevel): ScanIssue => ({
      code: 'TEST',
      title: 'Test issue',
      description: 'Test',
      riskLevel,
      recommendation: 'Fix it',
    });

    it('should return CRITICAL when any critical issue exists', () => {
      const issues = [makeIssue(RiskLevel.LOW), makeIssue(RiskLevel.CRITICAL)];
      const result = (service as any).calculateOverallRisk(issues);
      expect(result).toBe(RiskLevel.CRITICAL);
    });

    it('should return HIGH when highest is HIGH', () => {
      const issues = [makeIssue(RiskLevel.LOW), makeIssue(RiskLevel.HIGH)];
      const result = (service as any).calculateOverallRisk(issues);
      expect(result).toBe(RiskLevel.HIGH);
    });

    it('should return MEDIUM when highest is MEDIUM', () => {
      const issues = [makeIssue(RiskLevel.LOW), makeIssue(RiskLevel.MEDIUM)];
      const result = (service as any).calculateOverallRisk(issues);
      expect(result).toBe(RiskLevel.MEDIUM);
    });

    it('should return LOW when all issues are LOW', () => {
      const issues = [makeIssue(RiskLevel.LOW)];
      const result = (service as any).calculateOverallRisk(issues);
      expect(result).toBe(RiskLevel.LOW);
    });

    it('should return LOW when no issues', () => {
      const result = (service as any).calculateOverallRisk([]);
      expect(result).toBe(RiskLevel.LOW);
    });
  });

  // ============================================================
  // calculateScore
  // ============================================================
  describe('calculateScore', () => {
    const makeIssue = (riskLevel: RiskLevel): ScanIssue => ({
      code: 'TEST',
      title: 'Test',
      description: 'Test',
      riskLevel,
      recommendation: 'Fix',
    });

    it('should return 100 when no issues', () => {
      const result = (service as any).calculateScore([]);
      expect(result).toBe(100);
    });

    it('should deduct 30 for CRITICAL', () => {
      const result = (service as any).calculateScore([makeIssue(RiskLevel.CRITICAL)]);
      expect(result).toBe(70);
    });

    it('should deduct 20 for HIGH', () => {
      const result = (service as any).calculateScore([makeIssue(RiskLevel.HIGH)]);
      expect(result).toBe(80);
    });

    it('should deduct 10 for MEDIUM', () => {
      const result = (service as any).calculateScore([makeIssue(RiskLevel.MEDIUM)]);
      expect(result).toBe(90);
    });

    it('should deduct 5 for LOW', () => {
      const result = (service as any).calculateScore([makeIssue(RiskLevel.LOW)]);
      expect(result).toBe(95);
    });

    it('should not go below 0', () => {
      const issues = Array(10).fill(makeIssue(RiskLevel.CRITICAL));
      const result = (service as any).calculateScore(issues);
      expect(result).toBe(0);
    });

    it('should accumulate deductions from multiple issues', () => {
      const issues = [
        makeIssue(RiskLevel.CRITICAL), // -30
        makeIssue(RiskLevel.HIGH),     // -20
        makeIssue(RiskLevel.MEDIUM),   // -10
        makeIssue(RiskLevel.LOW),      // -5
      ];
      const result = (service as any).calculateScore(issues);
      expect(result).toBe(35); // 100 - 30 - 20 - 10 - 5
    });
  });

  // ============================================================
  // generateIssues
  // ============================================================
  describe('generateIssues', () => {
    const defaultCookies: CookieInfo[] = [];
    const defaultTrackers: { loadedBeforeConsent: boolean; name: string; type: string }[] = [];
    const defaultThirdParty: ThirdPartyRequest[] = [];
    const defaultConsent: ConsentBannerInfo = {
      found: true,
      hasRejectButton: true,
      hasAcceptButton: true,
      hasSettingsOption: true,
      isBlocking: false,
      quality: {
        hasPreCheckedBoxes: false,
        preCheckedCategories: [],
        hasEqualProminence: true,
        acceptButtonSize: null,
        rejectButtonSize: null,
        isCookieWall: false,
        hasGranularConsent: true,
        categoryCount: 3,
        closeButtonRejects: null,
      },
    };
    const defaultPrivacy: PrivacyPolicyInfo = {
      found: true,
      url: 'https://example.com/privacy',
      content: {
        analyzed: false,
        hasDataController: false,
        hasDPOContact: false,
        hasPurposeOfProcessing: false,
        hasLegalBasis: false,
        hasDataRetention: false,
        hasUserRights: false,
        hasRightToComplain: false,
        hasThirdPartySharing: false,
        hasInternationalTransfers: false,
        detectedElements: [],
        missingElements: [],
      },
    };
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
    const defaultForms: FormsAnalysisResult = {
      totalForms: 0,
      dataCollectionForms: 0,
      formsWithConsent: 0,
      formsWithoutConsent: 0,
      formsWithPreCheckedMarketing: 0,
      formsWithPrivacyLink: 0,
      forms: [],
      pagesScanned: [],
    };
    const defaultDataTransfers: DataTransferInfo = {
      usServicesDetected: [],
      totalUSServices: 0,
      highRiskTransfers: [],
    };

    const callGenerateIssues = (overrides: {
      cookies?: CookieInfo[];
      trackers?: typeof defaultTrackers;
      thirdParty?: ThirdPartyRequest[];
      consent?: ConsentBannerInfo;
      privacy?: PrivacyPolicyInfo;
      security?: SecurityInfo;
      forms?: FormsAnalysisResult;
      dataTransfers?: DataTransferInfo;
    } = {}) => {
      return (service as any).generateIssues(
        overrides.cookies ?? defaultCookies,
        overrides.trackers ?? defaultTrackers,
        overrides.thirdParty ?? defaultThirdParty,
        overrides.consent ?? defaultConsent,
        overrides.privacy ?? defaultPrivacy,
        overrides.security ?? defaultSecurity,
        overrides.forms ?? defaultForms,
        overrides.dataTransfers ?? defaultDataTransfers,
      );
    };

    it('should return no issues for a fully compliant site', () => {
      const issues = callGenerateIssues();
      expect(issues).toHaveLength(0);
    });

    // --- Cookie issues ---
    it('should flag non-essential cookies before consent', () => {
      const cookies: CookieInfo[] = [{
        name: '_ga',
        domain: '.example.com',
        path: '/',
        expires: null,
        httpOnly: false,
        secure: false,
        sameSite: 'None',
        category: 'analytics',
        setBeforeConsent: true,
      }];
      const issues = callGenerateIssues({ cookies });
      expect(issues.some((i: ScanIssue) => i.code === 'COOKIES_BEFORE_CONSENT')).toBe(true);
    });

    it('should NOT flag necessary cookies before consent', () => {
      const cookies: CookieInfo[] = [{
        name: 'session',
        domain: '.example.com',
        path: '/',
        expires: null,
        httpOnly: true,
        secure: true,
        sameSite: 'Strict',
        category: 'necessary',
        setBeforeConsent: true,
      }];
      const issues = callGenerateIssues({ cookies });
      expect(issues.some((i: ScanIssue) => i.code === 'COOKIES_BEFORE_CONSENT')).toBe(false);
    });

    // --- Tracker issues ---
    it('should flag trackers loaded before consent', () => {
      const trackers = [{ loadedBeforeConsent: true, name: 'Google Analytics', type: 'analytics' }];
      const issues = callGenerateIssues({ trackers });
      expect(issues.some((i: ScanIssue) => i.code === 'TRACKERS_BEFORE_CONSENT')).toBe(true);
    });

    // --- Consent banner issues ---
    it('should flag missing consent banner as CRITICAL', () => {
      const consent = { ...defaultConsent, found: false };
      const issues = callGenerateIssues({ consent });
      const issue = issues.find((i: ScanIssue) => i.code === 'NO_CONSENT_BANNER');
      expect(issue).toBeDefined();
      expect(issue.riskLevel).toBe(RiskLevel.CRITICAL);
    });

    it('should flag missing reject button', () => {
      const consent = { ...defaultConsent, hasRejectButton: false };
      const issues = callGenerateIssues({ consent });
      expect(issues.some((i: ScanIssue) => i.code === 'NO_REJECT_OPTION')).toBe(true);
    });

    it('should flag pre-checked boxes', () => {
      const consent = {
        ...defaultConsent,
        quality: { ...defaultConsent.quality, hasPreCheckedBoxes: true, preCheckedCategories: ['marketing'] },
      };
      const issues = callGenerateIssues({ consent });
      expect(issues.some((i: ScanIssue) => i.code === 'PRE_CHECKED_BOXES')).toBe(true);
    });

    it('should flag unequal button prominence', () => {
      const consent = {
        ...defaultConsent,
        quality: { ...defaultConsent.quality, hasEqualProminence: false },
      };
      const issues = callGenerateIssues({ consent });
      expect(issues.some((i: ScanIssue) => i.code === 'UNEQUAL_BUTTON_PROMINENCE')).toBe(true);
    });

    it('should flag cookie wall as CRITICAL', () => {
      const consent = {
        ...defaultConsent,
        quality: { ...defaultConsent.quality, isCookieWall: true },
      };
      const issues = callGenerateIssues({ consent });
      const issue = issues.find((i: ScanIssue) => i.code === 'COOKIE_WALL');
      expect(issue).toBeDefined();
      expect(issue.riskLevel).toBe(RiskLevel.CRITICAL);
    });

    it('should flag no granular consent', () => {
      const consent = {
        ...defaultConsent,
        quality: { ...defaultConsent.quality, hasGranularConsent: false },
      };
      const issues = callGenerateIssues({ consent });
      expect(issues.some((i: ScanIssue) => i.code === 'NO_GRANULAR_CONSENT')).toBe(true);
    });

    // --- Privacy policy issues ---
    it('should flag missing privacy policy', () => {
      const privacy = { ...defaultPrivacy, found: false };
      const issues = callGenerateIssues({ privacy });
      expect(issues.some((i: ScanIssue) => i.code === 'NO_PRIVACY_POLICY')).toBe(true);
    });

    it('should flag incomplete privacy policy', () => {
      const privacy: PrivacyPolicyInfo = {
        ...defaultPrivacy,
        content: {
          ...defaultPrivacy.content,
          analyzed: true,
          missingElements: ['Data Controller', 'DPO Contact'],
        },
      };
      const issues = callGenerateIssues({ privacy });
      expect(issues.some((i: ScanIssue) => i.code === 'PRIVACY_POLICY_INCOMPLETE')).toBe(true);
    });

    it('should flag missing data retention info', () => {
      const privacy: PrivacyPolicyInfo = {
        ...defaultPrivacy,
        content: { ...defaultPrivacy.content, analyzed: true, hasDataRetention: false },
      };
      const issues = callGenerateIssues({ privacy });
      expect(issues.some((i: ScanIssue) => i.code === 'NO_DATA_RETENTION_INFO')).toBe(true);
    });

    it('should flag missing right to complain', () => {
      const privacy: PrivacyPolicyInfo = {
        ...defaultPrivacy,
        content: { ...defaultPrivacy.content, analyzed: true, hasRightToComplain: false },
      };
      const issues = callGenerateIssues({ privacy });
      expect(issues.some((i: ScanIssue) => i.code === 'NO_COMPLAINT_RIGHT_INFO')).toBe(true);
    });

    // --- Security issues ---
    it('should flag no HTTPS', () => {
      const security: SecurityInfo = {
        ...defaultSecurity,
        https: { enabled: false, redirectsToHttps: false },
      };
      const issues = callGenerateIssues({ security });
      expect(issues.some((i: ScanIssue) => i.code === 'NO_HTTPS')).toBe(true);
    });

    it('should flag mixed content', () => {
      const security: SecurityInfo = {
        ...defaultSecurity,
        mixedContent: { found: true, resources: ['http://cdn.example.com/script.js'] },
      };
      const issues = callGenerateIssues({ security });
      expect(issues.some((i: ScanIssue) => i.code === 'MIXED_CONTENT')).toBe(true);
    });

    it('should flag excessive cookie expiration', () => {
      const security: SecurityInfo = {
        ...defaultSecurity,
        cookieSecurity: { ...defaultSecurity.cookieSecurity, excessiveExpiration: 3 },
      };
      const issues = callGenerateIssues({ security });
      expect(issues.some((i: ScanIssue) => i.code === 'COOKIE_EXCESSIVE_EXPIRATION')).toBe(true);
    });

    it('should flag cookies without Secure flag on HTTPS site', () => {
      const security: SecurityInfo = {
        ...defaultSecurity,
        cookieSecurity: { ...defaultSecurity.cookieSecurity, withoutSecure: 5 },
      };
      const issues = callGenerateIssues({ security });
      expect(issues.some((i: ScanIssue) => i.code === 'COOKIES_WITHOUT_SECURE')).toBe(true);
    });

    it('should flag cookies without SameSite when > 3', () => {
      const security: SecurityInfo = {
        ...defaultSecurity,
        cookieSecurity: { ...defaultSecurity.cookieSecurity, withoutSameSite: 5 },
      };
      const issues = callGenerateIssues({ security });
      expect(issues.some((i: ScanIssue) => i.code === 'COOKIES_WITHOUT_SAMESITE')).toBe(true);
    });

    it('should NOT flag cookies without SameSite when <= 3', () => {
      const security: SecurityInfo = {
        ...defaultSecurity,
        cookieSecurity: { ...defaultSecurity.cookieSecurity, withoutSameSite: 2 },
      };
      const issues = callGenerateIssues({ security });
      expect(issues.some((i: ScanIssue) => i.code === 'COOKIES_WITHOUT_SAMESITE')).toBe(false);
    });

    // --- Third-party issues ---
    it('should flag excessive third-party requests before consent', () => {
      const thirdParty: ThirdPartyRequest[] = Array(15).fill({
        url: 'https://tracker.com/pixel',
        domain: 'tracker.com',
        type: 'script',
        beforeConsent: true,
      });
      const issues = callGenerateIssues({ thirdParty });
      expect(issues.some((i: ScanIssue) => i.code === 'EXCESSIVE_THIRD_PARTY')).toBe(true);
    });

    it('should NOT flag when <= 10 third-party requests before consent', () => {
      const thirdParty: ThirdPartyRequest[] = Array(8).fill({
        url: 'https://tracker.com/pixel',
        domain: 'tracker.com',
        type: 'script',
        beforeConsent: true,
      });
      const issues = callGenerateIssues({ thirdParty });
      expect(issues.some((i: ScanIssue) => i.code === 'EXCESSIVE_THIRD_PARTY')).toBe(false);
    });

    // --- Form issues ---
    it('should flag forms without consent', () => {
      const forms: FormsAnalysisResult = {
        ...defaultForms,
        formsWithoutConsent: 2,
      };
      const issues = callGenerateIssues({ forms });
      expect(issues.some((i: ScanIssue) => i.code === 'FORMS_WITHOUT_CONSENT')).toBe(true);
    });

    it('should flag pre-checked marketing in forms', () => {
      const forms: FormsAnalysisResult = {
        ...defaultForms,
        formsWithPreCheckedMarketing: 1,
      };
      const issues = callGenerateIssues({ forms });
      expect(issues.some((i: ScanIssue) => i.code === 'FORMS_PRECHECKED_MARKETING')).toBe(true);
    });

    it('should flag forms without privacy link', () => {
      const forms: FormsAnalysisResult = {
        ...defaultForms,
        dataCollectionForms: 3,
        formsWithPrivacyLink: 1,
      };
      const issues = callGenerateIssues({ forms });
      expect(issues.some((i: ScanIssue) => i.code === 'FORMS_NO_PRIVACY_LINK')).toBe(true);
    });

    // --- Data transfer issues ---
    it('should flag high-risk US data transfers', () => {
      const dataTransfers: DataTransferInfo = {
        ...defaultDataTransfers,
        highRiskTransfers: ['Google Analytics', 'Facebook Pixel'],
      };
      const issues = callGenerateIssues({ dataTransfers });
      expect(issues.some((i: ScanIssue) => i.code === 'US_DATA_TRANSFERS')).toBe(true);
    });

    it('should flag excessive US services', () => {
      const dataTransfers: DataTransferInfo = {
        ...defaultDataTransfers,
        totalUSServices: 15,
      };
      const issues = callGenerateIssues({ dataTransfers });
      expect(issues.some((i: ScanIssue) => i.code === 'EXCESSIVE_US_SERVICES')).toBe(true);
    });
  });
});
