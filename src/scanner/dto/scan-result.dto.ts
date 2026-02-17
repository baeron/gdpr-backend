export enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export interface CookieInfo {
  name: string;
  domain: string;
  path: string;
  expires: string | null;
  httpOnly: boolean;
  secure: boolean;
  sameSite: string;
  category: 'necessary' | 'analytics' | 'marketing' | 'unknown';
  setBeforeConsent: boolean;
}

export interface TrackerInfo {
  name: string;
  type: 'analytics' | 'advertising' | 'social' | 'other';
  domain: string;
  loadedBeforeConsent: boolean;
}

export interface ThirdPartyRequest {
  url: string;
  domain: string;
  type: string;
  beforeConsent: boolean;
}

export interface ConsentBannerInfo {
  found: boolean;
  hasRejectButton: boolean;
  hasAcceptButton: boolean;
  hasSettingsOption: boolean;
  isBlocking: boolean;
  // Consent Quality (Phase 3)
  quality: {
    hasPreCheckedBoxes: boolean;
    preCheckedCategories: string[];
    hasEqualProminence: boolean;
    acceptButtonSize: { width: number; height: number } | null;
    rejectButtonSize: { width: number; height: number } | null;
    isCookieWall: boolean;
    hasGranularConsent: boolean;
    categoryCount: number;
    closeButtonRejects: boolean | null;
  };
  // TCF 2.0 (Phase 1.4)
  tcf: {
    detected: boolean;
    version: string | null;
    cmpId: number | null;
    cmpVersion: number | null;
    gdprApplies: boolean | null;
    purposeConsents: number[];
    vendorConsents: number[];
  };
}

export interface PrivacyPolicyInfo {
  found: boolean;
  url: string | null;
  // Content analysis (Phase 5)
  content: {
    analyzed: boolean;
    hasDataController: boolean;
    hasDPOContact: boolean;
    hasPurposeOfProcessing: boolean;
    hasLegalBasis: boolean;
    hasDataRetention: boolean;
    hasUserRights: boolean;
    hasRightToComplain: boolean;
    hasThirdPartySharing: boolean;
    hasInternationalTransfers: boolean;
    detectedElements: string[];
    missingElements: string[];
  };
}

export interface FormInfo {
  type:
    | 'contact'
    | 'newsletter'
    | 'login'
    | 'registration'
    | 'search'
    | 'other';
  hasEmailField: boolean;
  hasConsentCheckbox: boolean;
  hasPrivacyPolicyLink: boolean;
  hasPreCheckedMarketing: boolean;
}

export interface FormsAnalysisResult {
  totalForms: number;
  dataCollectionForms: number;
  formsWithConsent: number;
  formsWithoutConsent: number;
  formsWithPreCheckedMarketing: number;
  formsWithPrivacyLink: number;
  forms: FormInfo[];
  pagesScanned: string[];
}

export interface USServiceInfo {
  name: string;
  domain: string;
  category:
    | 'analytics'
    | 'advertising'
    | 'cdn'
    | 'cloud'
    | 'social'
    | 'payment'
    | 'other';
  dataProcessed: string;
}

export interface DataTransferInfo {
  usServicesDetected: USServiceInfo[];
  totalUSServices: number;
  highRiskTransfers: string[];
}

export interface TechnologyInfo {
  name: string;
  category: string;
  confidence: 'high' | 'medium' | 'low';
  gdprRelevant: boolean;
  gdprNote?: string;
}

export interface TechnologyDetectionResult {
  technologies: TechnologyInfo[];
  cms: string | null;
  framework: string | null;
  consentPlatform: string | null;
  analytics: string[];
  advertising: string[];
  cdn: string | null;
}

export interface SecurityHeadersInfo {
  headers: Record<string, string | null>;
  csp: {
    present: boolean;
    value: string | null;
    hasDefaultSrc: boolean;
    hasScriptSrc: boolean;
    hasUnsafeInline: boolean;
    hasUnsafeEval: boolean;
  };
  hsts: {
    present: boolean;
    value: string | null;
    maxAge: number | null;
    includesSubDomains: boolean;
    preload: boolean;
  };
  xFrameOptions: {
    present: boolean;
    value: string | null;
  };
  xContentTypeOptions: {
    present: boolean;
    value: string | null;
  };
  referrerPolicy: {
    present: boolean;
    value: string | null;
  };
  permissionsPolicy: {
    present: boolean;
    value: string | null;
  };
  missingHeaders: string[];
  score: number;
}

export interface SslCertificateInfo {
  valid: boolean;
  issuer: string | null;
  subject: string | null;
  validFrom: string | null;
  validTo: string | null;
  daysUntilExpiry: number | null;
  protocol: string | null;
  cipher: string | null;
  keyExchange: string | null;
  selfSigned: boolean;
  error: string | null;
}

export interface ScanIssue {
  code: string;
  title: string;
  description: string;
  riskLevel: RiskLevel;
  recommendation: string;
}

export interface CookieSecurityIssue {
  cookieName: string;
  issue: 'no_secure' | 'no_httponly' | 'no_samesite' | 'excessive_expiration';
  description: string;
  recommendation: string;
}

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
    excessiveExpiration: number;
    issues: CookieSecurityIssue[];
  };
}

export interface ScanResultDto {
  websiteUrl: string;
  scanDate: Date;
  scanDurationMs: number;
  overallRiskLevel: RiskLevel;
  cookies: {
    total: number;
    beforeConsent: number;
    list: CookieInfo[];
  };
  trackers: {
    total: number;
    beforeConsent: number;
    list: TrackerInfo[];
  };
  thirdPartyRequests: {
    total: number;
    beforeConsent: number;
    list: ThirdPartyRequest[];
  };
  consentBanner: ConsentBannerInfo;
  privacyPolicy: PrivacyPolicyInfo;
  security: SecurityInfo;
  securityHeaders: SecurityHeadersInfo;
  sslCertificate: SslCertificateInfo;
  forms: FormsAnalysisResult;
  dataTransfers: DataTransferInfo;
  technologies: TechnologyDetectionResult;
  issues: ScanIssue[];
  score: number; // 0-100
}
