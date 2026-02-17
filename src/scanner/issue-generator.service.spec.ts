import { IssueGeneratorService } from './issue-generator.service';
import {
  RiskLevel,
  ScanIssue,
  CookieInfo,
  ConsentBannerInfo,
  PrivacyPolicyInfo,
  ThirdPartyRequest,
  FormsAnalysisResult,
  DataTransferInfo,
} from './dto/scan-result.dto';
import { SecurityInfo } from './analyzers/security.analyzer';

describe('IssueGeneratorService', () => {
  let service: IssueGeneratorService;

  beforeEach(() => {
    service = new IssueGeneratorService();
  });

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
    tcf: {
      detected: false,
      version: null,
      cmpId: null,
      cmpVersion: null,
      gdprApplies: null,
      purposeConsents: [],
      vendorConsents: [],
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

  const generate = (overrides: Partial<{
    cookies: CookieInfo[];
    trackers: typeof defaultTrackers;
    thirdParty: ThirdPartyRequest[];
    consent: ConsentBannerInfo;
    privacy: PrivacyPolicyInfo;
    security: SecurityInfo;
    forms: FormsAnalysisResult;
    dataTransfers: DataTransferInfo;
  }> = {}) => {
    return service.generateIssues(
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

  it('should return empty for compliant site', () => {
    expect(generate()).toHaveLength(0);
  });

  // --- Cookies ---
  it('COOKIES_BEFORE_CONSENT: analytics cookie before consent', () => {
    const cookies: CookieInfo[] = [{
      name: '_ga', domain: '.example.com', path: '/', expires: null,
      httpOnly: false, secure: false, sameSite: 'None',
      category: 'analytics', setBeforeConsent: true,
    }];
    const issues = generate({ cookies });
    expect(issues.find((i: ScanIssue) => i.code === 'COOKIES_BEFORE_CONSENT')).toBeDefined();
  });

  it('should NOT flag necessary cookies before consent', () => {
    const cookies: CookieInfo[] = [{
      name: 'sess', domain: '.example.com', path: '/', expires: null,
      httpOnly: true, secure: true, sameSite: 'Strict',
      category: 'necessary', setBeforeConsent: true,
    }];
    expect(generate({ cookies }).some((i: ScanIssue) => i.code === 'COOKIES_BEFORE_CONSENT')).toBe(false);
  });

  // --- Trackers ---
  it('TRACKERS_BEFORE_CONSENT', () => {
    const trackers = [{ loadedBeforeConsent: true, name: 'GA', type: 'analytics' }];
    expect(generate({ trackers }).find((i: ScanIssue) => i.code === 'TRACKERS_BEFORE_CONSENT')).toBeDefined();
  });

  // --- Consent ---
  it('NO_CONSENT_BANNER (CRITICAL)', () => {
    const issue = generate({ consent: { ...defaultConsent, found: false } })
      .find((i: ScanIssue) => i.code === 'NO_CONSENT_BANNER');
    expect(issue).toBeDefined();
    expect(issue!.riskLevel).toBe(RiskLevel.CRITICAL);
  });

  it('NO_REJECT_OPTION', () => {
    expect(generate({ consent: { ...defaultConsent, hasRejectButton: false } })
      .some((i: ScanIssue) => i.code === 'NO_REJECT_OPTION')).toBe(true);
  });

  it('PRE_CHECKED_BOXES', () => {
    const consent = {
      ...defaultConsent,
      quality: { ...defaultConsent.quality, hasPreCheckedBoxes: true, preCheckedCategories: ['marketing'] },
    };
    expect(generate({ consent }).some((i: ScanIssue) => i.code === 'PRE_CHECKED_BOXES')).toBe(true);
  });

  it('UNEQUAL_BUTTON_PROMINENCE', () => {
    const consent = {
      ...defaultConsent,
      quality: { ...defaultConsent.quality, hasEqualProminence: false },
    };
    expect(generate({ consent }).some((i: ScanIssue) => i.code === 'UNEQUAL_BUTTON_PROMINENCE')).toBe(true);
  });

  it('COOKIE_WALL (CRITICAL)', () => {
    const consent = {
      ...defaultConsent,
      quality: { ...defaultConsent.quality, isCookieWall: true },
    };
    const issue = generate({ consent }).find((i: ScanIssue) => i.code === 'COOKIE_WALL');
    expect(issue).toBeDefined();
    expect(issue!.riskLevel).toBe(RiskLevel.CRITICAL);
  });

  it('NO_GRANULAR_CONSENT', () => {
    const consent = {
      ...defaultConsent,
      quality: { ...defaultConsent.quality, hasGranularConsent: false },
    };
    expect(generate({ consent }).some((i: ScanIssue) => i.code === 'NO_GRANULAR_CONSENT')).toBe(true);
  });

  // --- Privacy ---
  it('NO_PRIVACY_POLICY', () => {
    expect(generate({ privacy: { ...defaultPrivacy, found: false } })
      .some((i: ScanIssue) => i.code === 'NO_PRIVACY_POLICY')).toBe(true);
  });

  it('PRIVACY_POLICY_INCOMPLETE', () => {
    const privacy: PrivacyPolicyInfo = {
      ...defaultPrivacy,
      content: { ...defaultPrivacy.content, analyzed: true, missingElements: ['DPO'] },
    };
    expect(generate({ privacy }).some((i: ScanIssue) => i.code === 'PRIVACY_POLICY_INCOMPLETE')).toBe(true);
  });

  it('NO_DATA_RETENTION_INFO', () => {
    const privacy: PrivacyPolicyInfo = {
      ...defaultPrivacy,
      content: { ...defaultPrivacy.content, analyzed: true, hasDataRetention: false },
    };
    expect(generate({ privacy }).some((i: ScanIssue) => i.code === 'NO_DATA_RETENTION_INFO')).toBe(true);
  });

  it('NO_COMPLAINT_RIGHT_INFO', () => {
    const privacy: PrivacyPolicyInfo = {
      ...defaultPrivacy,
      content: { ...defaultPrivacy.content, analyzed: true, hasRightToComplain: false },
    };
    expect(generate({ privacy }).some((i: ScanIssue) => i.code === 'NO_COMPLAINT_RIGHT_INFO')).toBe(true);
  });

  // --- Third-party ---
  it('EXCESSIVE_THIRD_PARTY when > 10', () => {
    const thirdParty = Array(15).fill({
      url: 'https://t.com/p', domain: 't.com', type: 'script', beforeConsent: true,
    });
    expect(generate({ thirdParty }).some((i: ScanIssue) => i.code === 'EXCESSIVE_THIRD_PARTY')).toBe(true);
  });

  it('no EXCESSIVE_THIRD_PARTY when <= 10', () => {
    const thirdParty = Array(8).fill({
      url: 'https://t.com/p', domain: 't.com', type: 'script', beforeConsent: true,
    });
    expect(generate({ thirdParty }).some((i: ScanIssue) => i.code === 'EXCESSIVE_THIRD_PARTY')).toBe(false);
  });

  // --- Security ---
  it('NO_HTTPS', () => {
    const security: SecurityInfo = {
      ...defaultSecurity,
      https: { enabled: false, redirectsToHttps: false },
    };
    expect(generate({ security }).some((i: ScanIssue) => i.code === 'NO_HTTPS')).toBe(true);
  });

  it('MIXED_CONTENT', () => {
    const security: SecurityInfo = {
      ...defaultSecurity,
      mixedContent: { found: true, resources: ['http://cdn.com/s.js'] },
    };
    expect(generate({ security }).some((i: ScanIssue) => i.code === 'MIXED_CONTENT')).toBe(true);
  });

  it('COOKIE_EXCESSIVE_EXPIRATION', () => {
    const security: SecurityInfo = {
      ...defaultSecurity,
      cookieSecurity: { ...defaultSecurity.cookieSecurity, excessiveExpiration: 3 },
    };
    expect(generate({ security }).some((i: ScanIssue) => i.code === 'COOKIE_EXCESSIVE_EXPIRATION')).toBe(true);
  });

  it('COOKIES_WITHOUT_SECURE on HTTPS', () => {
    const security: SecurityInfo = {
      ...defaultSecurity,
      cookieSecurity: { ...defaultSecurity.cookieSecurity, withoutSecure: 5 },
    };
    expect(generate({ security }).some((i: ScanIssue) => i.code === 'COOKIES_WITHOUT_SECURE')).toBe(true);
  });

  it('COOKIES_WITHOUT_SAMESITE when > 3', () => {
    const security: SecurityInfo = {
      ...defaultSecurity,
      cookieSecurity: { ...defaultSecurity.cookieSecurity, withoutSameSite: 5 },
    };
    expect(generate({ security }).some((i: ScanIssue) => i.code === 'COOKIES_WITHOUT_SAMESITE')).toBe(true);
  });

  it('no COOKIES_WITHOUT_SAMESITE when <= 3', () => {
    const security: SecurityInfo = {
      ...defaultSecurity,
      cookieSecurity: { ...defaultSecurity.cookieSecurity, withoutSameSite: 2 },
    };
    expect(generate({ security }).some((i: ScanIssue) => i.code === 'COOKIES_WITHOUT_SAMESITE')).toBe(false);
  });

  // --- Forms ---
  it('FORMS_WITHOUT_CONSENT', () => {
    expect(generate({ forms: { ...defaultForms, formsWithoutConsent: 2 } })
      .some((i: ScanIssue) => i.code === 'FORMS_WITHOUT_CONSENT')).toBe(true);
  });

  it('FORMS_PRECHECKED_MARKETING', () => {
    expect(generate({ forms: { ...defaultForms, formsWithPreCheckedMarketing: 1 } })
      .some((i: ScanIssue) => i.code === 'FORMS_PRECHECKED_MARKETING')).toBe(true);
  });

  it('FORMS_NO_PRIVACY_LINK', () => {
    expect(generate({ forms: { ...defaultForms, dataCollectionForms: 3, formsWithPrivacyLink: 1 } })
      .some((i: ScanIssue) => i.code === 'FORMS_NO_PRIVACY_LINK')).toBe(true);
  });

  // --- Data transfers ---
  it('US_DATA_TRANSFERS', () => {
    const dataTransfers: DataTransferInfo = {
      ...defaultDataTransfers,
      highRiskTransfers: ['GA', 'FB'],
    };
    expect(generate({ dataTransfers }).some((i: ScanIssue) => i.code === 'US_DATA_TRANSFERS')).toBe(true);
  });

  it('EXCESSIVE_US_SERVICES', () => {
    expect(generate({ dataTransfers: { ...defaultDataTransfers, totalUSServices: 15 } })
      .some((i: ScanIssue) => i.code === 'EXCESSIVE_US_SERVICES')).toBe(true);
  });
});
