import { ScannerReportService } from './scanner-report.service';
import { RiskLevel, ScanResultDto } from './dto/scan-result.dto';

describe('ScannerReportService', () => {
  let service: ScannerReportService;
  let mockPrisma: any;

  const makeScanResult = (overrides: Partial<ScanResultDto> = {}): ScanResultDto => ({
    websiteUrl: 'https://example.com',
    scanDate: new Date('2026-01-01'),
    scanDurationMs: 5000,
    overallRiskLevel: RiskLevel.MEDIUM,
    score: 65,
    cookies: { total: 2, beforeConsent: 1, list: [
      { name: '_ga', domain: '.example.com', path: '/', expires: '2027-01-01', httpOnly: false, secure: true, sameSite: 'Lax', category: 'analytics', setBeforeConsent: true },
    ] },
    trackers: { total: 1, beforeConsent: 1, list: [
      { name: 'Google Analytics', domain: 'google-analytics.com', type: 'analytics', loadedBeforeConsent: true },
    ] },
    thirdPartyRequests: { total: 5, beforeConsent: 2, list: [] },
    consentBanner: {
      found: true, hasRejectButton: false, hasAcceptButton: true, hasSettingsOption: true, isBlocking: false,
      quality: { hasPreCheckedBoxes: false, preCheckedCategories: [], hasEqualProminence: false, acceptButtonSize: null, rejectButtonSize: null, isCookieWall: false, hasGranularConsent: true, categoryCount: 0, closeButtonRejects: null },
      tcf: { detected: false, version: null, cmpId: null, cmpVersion: null, gdprApplies: null, purposeConsents: [], vendorConsents: [] },
    },
    privacyPolicy: {
      found: true, url: 'https://example.com/privacy',
      content: { analyzed: true, hasDataController: true, hasDPOContact: false, hasPurposeOfProcessing: true, hasLegalBasis: true, hasDataRetention: false, hasUserRights: true, hasRightToComplain: false, hasThirdPartySharing: false, hasInternationalTransfers: false, detectedElements: [], missingElements: ['DPO Contact'] },
    },
    security: {
      https: { enabled: true, redirectsToHttps: true },
      mixedContent: { found: false, resources: [] },
      cookieSecurity: { withoutSecure: 0, withoutHttpOnly: 1, withoutSameSite: 0, excessiveExpiration: 0, issues: [] },
    },
    securityHeaders: {
      headers: {}, csp: { present: true, value: "default-src 'self'", hasDefaultSrc: true, hasScriptSrc: false, hasUnsafeInline: false, hasUnsafeEval: false },
      hsts: { present: true, value: 'max-age=31536000', maxAge: 31536000, includesSubDomains: false, preload: false },
      xFrameOptions: { present: true, value: 'DENY' }, xContentTypeOptions: { present: true, value: 'nosniff' },
      referrerPolicy: { present: true, value: 'strict-origin' }, permissionsPolicy: { present: false, value: null },
      missingHeaders: ['Permissions-Policy'], score: 70,
    },
    sslCertificate: {
      valid: true, issuer: "Let's Encrypt", subject: 'example.com',
      validFrom: '2025-01-01', validTo: '2026-06-01', daysUntilExpiry: 150,
      protocol: 'TLSv1.3', cipher: 'TLS_AES_256_GCM_SHA384', keyExchange: null, selfSigned: false, error: null,
    },
    forms: { totalForms: 1, dataCollectionForms: 1, formsWithConsent: 0, formsWithoutConsent: 1, formsWithPreCheckedMarketing: 0, formsWithPrivacyLink: 0, forms: [], pagesScanned: [] },
    dataTransfers: { usServicesDetected: [], totalUSServices: 0, highRiskTransfers: ['Google Analytics'] },
    technologies: { technologies: [], cms: null, framework: null, consentPlatform: null, analytics: [], advertising: [], cdn: null },
    issues: [
      { code: 'NO_REJECT_OPTION', title: 'No Reject', description: 'desc', riskLevel: RiskLevel.HIGH, recommendation: 'rec' },
      { code: 'FORMS_WITHOUT_CONSENT', title: 'Forms', description: 'desc', riskLevel: RiskLevel.MEDIUM, recommendation: 'rec' },
    ],
    ...overrides,
  });

  beforeEach(() => {
    mockPrisma = {
      auditReport: {
        create: jest.fn().mockResolvedValue({ id: 'report-123', issues: [] }),
        findUnique: jest.fn().mockResolvedValue({ id: 'report-123' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      scanIssue: {
        update: jest.fn().mockResolvedValue({ id: 'issue-1', status: 'RESOLVED' }),
      },
    };
    service = new ScannerReportService(mockPrisma);
  });

  describe('saveScanResult', () => {
    it('should save scan result and return report ID', async () => {
      const result = makeScanResult();
      const reportId = await service.saveScanResult(result);
      expect(reportId).toBe('report-123');
      expect(mockPrisma.auditReport.create).toHaveBeenCalledTimes(1);
    });

    it('should pass auditRequestId when provided', async () => {
      await service.saveScanResult(makeScanResult(), 'audit-456');
      const createCall = mockPrisma.auditReport.create.mock.calls[0][0];
      expect(createCall.data.auditRequestId).toBe('audit-456');
    });

    it('should map risk levels correctly', async () => {
      await service.saveScanResult(makeScanResult({ overallRiskLevel: RiskLevel.CRITICAL }));
      const createCall = mockPrisma.auditReport.create.mock.calls[0][0];
      expect(createCall.data.riskLevel).toBe('CRITICAL');
    });

    it('should create issues with category mapping', async () => {
      await service.saveScanResult(makeScanResult());
      const createCall = mockPrisma.auditReport.create.mock.calls[0][0];
      const issues = createCall.data.issues.create;
      expect(issues).toHaveLength(2);
      expect(issues[0].category).toBe('CONSENT');
      expect(issues[1].category).toBe('FORMS');
    });

    it('should generate evidence for known issue codes', async () => {
      await service.saveScanResult(makeScanResult());
      const createCall = mockPrisma.auditReport.create.mock.calls[0][0];
      const issues = createCall.data.issues.create;
      expect(issues[0].evidence).toContain('Reject');
      expect(issues[1].evidence).toContain('form');
    });

    it('should include effort and cost estimates', async () => {
      await service.saveScanResult(makeScanResult());
      const createCall = mockPrisma.auditReport.create.mock.calls[0][0];
      const issue = createCall.data.issues.create[0];
      expect(issue.effortHours).toBeDefined();
      expect(issue.estimatedCost).toBeDefined();
    });

    it('should generate evidence for COOKIES_BEFORE_CONSENT', async () => {
      const result = makeScanResult({
        issues: [{ code: 'COOKIES_BEFORE_CONSENT', title: 'T', description: 'D', riskLevel: RiskLevel.HIGH, recommendation: 'R' }],
      });
      await service.saveScanResult(result);
      const issues = mockPrisma.auditReport.create.mock.calls[0][0].data.issues.create;
      expect(issues[0].evidence).toContain('_ga');
    });

    it('should generate evidence for TRACKERS_BEFORE_CONSENT', async () => {
      const result = makeScanResult({
        issues: [{ code: 'TRACKERS_BEFORE_CONSENT', title: 'T', description: 'D', riskLevel: RiskLevel.HIGH, recommendation: 'R' }],
      });
      await service.saveScanResult(result);
      const issues = mockPrisma.auditReport.create.mock.calls[0][0].data.issues.create;
      expect(issues[0].evidence).toContain('Google Analytics');
    });

    it('should generate evidence for PRIVACY_POLICY_INCOMPLETE', async () => {
      const result = makeScanResult({
        issues: [{ code: 'PRIVACY_POLICY_INCOMPLETE', title: 'T', description: 'D', riskLevel: RiskLevel.MEDIUM, recommendation: 'R' }],
      });
      await service.saveScanResult(result);
      const issues = mockPrisma.auditReport.create.mock.calls[0][0].data.issues.create;
      expect(issues[0].evidence).toContain('DPO Contact');
    });

    it('should generate evidence for US_DATA_TRANSFERS', async () => {
      const result = makeScanResult({
        issues: [{ code: 'US_DATA_TRANSFERS', title: 'T', description: 'D', riskLevel: RiskLevel.HIGH, recommendation: 'R' }],
      });
      await service.saveScanResult(result);
      const issues = mockPrisma.auditReport.create.mock.calls[0][0].data.issues.create;
      expect(issues[0].evidence).toContain('Google Analytics');
    });

    it('should generate evidence for NO_HTTPS', async () => {
      const result = makeScanResult({
        issues: [{ code: 'NO_HTTPS', title: 'T', description: 'D', riskLevel: RiskLevel.HIGH, recommendation: 'R' }],
      });
      await service.saveScanResult(result);
      const issues = mockPrisma.auditReport.create.mock.calls[0][0].data.issues.create;
      expect(issues[0].evidence).toContain('HTTPS');
    });

    it('should generate evidence for MIXED_CONTENT', async () => {
      const result = makeScanResult({
        issues: [{ code: 'MIXED_CONTENT', title: 'T', description: 'D', riskLevel: RiskLevel.MEDIUM, recommendation: 'R' }],
      });
      await service.saveScanResult(result);
      const issues = mockPrisma.auditReport.create.mock.calls[0][0].data.issues.create;
      expect(issues[0].evidence).toContain('HTTP');
    });

    it('should generate evidence for NO_PRIVACY_POLICY', async () => {
      const result = makeScanResult({
        issues: [{ code: 'NO_PRIVACY_POLICY', title: 'T', description: 'D', riskLevel: RiskLevel.HIGH, recommendation: 'R' }],
      });
      await service.saveScanResult(result);
      const issues = mockPrisma.auditReport.create.mock.calls[0][0].data.issues.create;
      expect(issues[0].evidence).toContain('privacy policy');
    });

    it('should generate evidence for UNEQUAL_BUTTON_PROMINENCE', async () => {
      const result = makeScanResult({
        issues: [{ code: 'UNEQUAL_BUTTON_PROMINENCE', title: 'T', description: 'D', riskLevel: RiskLevel.MEDIUM, recommendation: 'R' }],
      });
      await service.saveScanResult(result);
      const issues = mockPrisma.auditReport.create.mock.calls[0][0].data.issues.create;
      expect(issues[0].evidence).toContain('prominent');
    });

    it('should return empty evidence for unknown issue code', async () => {
      const result = makeScanResult({
        issues: [{ code: 'UNKNOWN_CODE', title: 'T', description: 'D', riskLevel: RiskLevel.LOW, recommendation: 'R' }],
      });
      await service.saveScanResult(result);
      const issues = mockPrisma.auditReport.create.mock.calls[0][0].data.issues.create;
      expect(issues[0].evidence).toBe('');
      expect(issues[0].category).toBe('OTHER');
    });
  });

  describe('getReport', () => {
    it('should call findUnique with correct id', async () => {
      await service.getReport('report-123');
      expect(mockPrisma.auditReport.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'report-123' } }),
      );
    });
  });

  describe('getReportByAuditRequest', () => {
    it('should call findUnique with auditRequestId', async () => {
      await service.getReportByAuditRequest('audit-456');
      expect(mockPrisma.auditReport.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { auditRequestId: 'audit-456' } }),
      );
    });
  });

  describe('getReportsByWebsite', () => {
    it('should call findMany with url filter', async () => {
      await service.getReportsByWebsite('example.com');
      expect(mockPrisma.auditReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { websiteUrl: { contains: 'example.com' } },
          take: 10,
        }),
      );
    });

    it('should respect custom limit', async () => {
      await service.getReportsByWebsite('example.com', 5);
      expect(mockPrisma.auditReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 }),
      );
    });
  });

  describe('updateIssueStatus', () => {
    it('should update issue to RESOLVED with resolvedAt', async () => {
      await service.updateIssueStatus('issue-1', 'RESOLVED');
      const call = mockPrisma.scanIssue.update.mock.calls[0][0];
      expect(call.data.status).toBe('RESOLVED');
      expect(call.data.resolvedAt).toBeInstanceOf(Date);
    });

    it('should update issue to OPEN with null resolvedAt', async () => {
      await service.updateIssueStatus('issue-1', 'OPEN');
      const call = mockPrisma.scanIssue.update.mock.calls[0][0];
      expect(call.data.status).toBe('OPEN');
      expect(call.data.resolvedAt).toBeNull();
    });

    it('should update issue to IN_PROGRESS', async () => {
      await service.updateIssueStatus('issue-1', 'IN_PROGRESS');
      const call = mockPrisma.scanIssue.update.mock.calls[0][0];
      expect(call.data.status).toBe('IN_PROGRESS');
    });

    it('should update issue to WONT_FIX', async () => {
      await service.updateIssueStatus('issue-1', 'WONT_FIX');
      const call = mockPrisma.scanIssue.update.mock.calls[0][0];
      expect(call.data.status).toBe('WONT_FIX');
    });
  });
});
