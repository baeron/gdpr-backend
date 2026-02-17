import { ScannerController, ScanRequestDto, QueueScanRequestDto } from './scanner.controller';
import { ScannerService } from './scanner.service';
import { ScannerReportService } from './scanner-report.service';
import { IQueueService } from './queue/queue.interface';
import { RiskLevel, ScanResultDto } from './dto/scan-result.dto';

describe('ScannerController', () => {
  let controller: ScannerController;
  let mockScannerService: Partial<ScannerService>;
  let mockReportService: Partial<ScannerReportService>;
  let mockQueueService: Partial<IQueueService>;

  const mockScanResult: ScanResultDto = {
    websiteUrl: 'https://example.com',
    scanDate: new Date(),
    scanDurationMs: 5000,
    overallRiskLevel: RiskLevel.MEDIUM,
    score: 65,
    cookies: { total: 0, beforeConsent: 0, list: [] },
    trackers: { total: 0, beforeConsent: 0, list: [] },
    thirdPartyRequests: { total: 0, beforeConsent: 0, list: [] },
    consentBanner: {
      found: true, hasRejectButton: true, hasAcceptButton: true, hasSettingsOption: true, isBlocking: false,
      quality: { hasPreCheckedBoxes: false, preCheckedCategories: [], hasEqualProminence: true, acceptButtonSize: null, rejectButtonSize: null, isCookieWall: false, hasGranularConsent: true, categoryCount: 0, closeButtonRejects: null },
      tcf: { detected: false, version: null, cmpId: null, cmpVersion: null, gdprApplies: null, purposeConsents: [], vendorConsents: [] },
    },
    privacyPolicy: {
      found: true, url: 'https://example.com/privacy',
      content: { analyzed: true, hasDataController: true, hasDPOContact: true, hasPurposeOfProcessing: true, hasLegalBasis: true, hasDataRetention: true, hasUserRights: true, hasRightToComplain: true, hasThirdPartySharing: true, hasInternationalTransfers: true, detectedElements: [], missingElements: [] },
    },
    security: {
      https: { enabled: true, redirectsToHttps: true },
      mixedContent: { found: false, resources: [] },
      cookieSecurity: { withoutSecure: 0, withoutHttpOnly: 0, withoutSameSite: 0, excessiveExpiration: 0, issues: [] },
    },
    securityHeaders: {
      headers: {}, csp: { present: true, value: "default-src 'self'", hasDefaultSrc: true, hasScriptSrc: false, hasUnsafeInline: false, hasUnsafeEval: false },
      hsts: { present: true, value: 'max-age=31536000', maxAge: 31536000, includesSubDomains: false, preload: false },
      xFrameOptions: { present: true, value: 'DENY' }, xContentTypeOptions: { present: true, value: 'nosniff' },
      referrerPolicy: { present: true, value: 'strict-origin' }, permissionsPolicy: { present: false, value: null },
      missingHeaders: [], score: 85,
    },
    sslCertificate: {
      valid: true, issuer: "Let's Encrypt", subject: 'example.com',
      validFrom: '2025-01-01', validTo: '2026-06-01', daysUntilExpiry: 150,
      protocol: 'TLSv1.3', cipher: 'TLS_AES_256_GCM_SHA384', keyExchange: null, selfSigned: false, error: null,
    },
    forms: { totalForms: 0, dataCollectionForms: 0, formsWithConsent: 0, formsWithoutConsent: 0, formsWithPreCheckedMarketing: 0, formsWithPrivacyLink: 0, forms: [], pagesScanned: [] },
    dataTransfers: { usServicesDetected: [], totalUSServices: 0, highRiskTransfers: [] },
    technologies: { technologies: [], cms: null, framework: null, consentPlatform: null, analytics: [], advertising: [], cdn: null },
    issues: [],
  };

  beforeEach(() => {
    mockScannerService = {
      scanWebsite: jest.fn().mockResolvedValue(mockScanResult),
    };
    mockReportService = {
      saveScanResult: jest.fn().mockResolvedValue('report-123'),
      getReport: jest.fn().mockResolvedValue({ id: 'report-123', websiteUrl: 'https://example.com' }),
      getReportsByWebsite: jest.fn().mockResolvedValue([]),
      updateIssueStatus: jest.fn().mockResolvedValue({ id: 'issue-1', status: 'RESOLVED' }),
    };
    mockQueueService = {
      addJob: jest.fn().mockResolvedValue({ id: 'job-1', status: 'QUEUED', position: 1 }),
      getJobStatus: jest.fn().mockResolvedValue({ id: 'job-1', status: 'PROCESSING', progress: 50 }),
      cancelJob: jest.fn().mockResolvedValue(true),
      getStats: jest.fn().mockResolvedValue({ queued: 2, processing: 1, completed: 10, failed: 0 }),
    };
    controller = new ScannerController(
      mockScannerService as ScannerService,
      mockReportService as ScannerReportService,
      mockQueueService as IQueueService,
    );
  });

  describe('scanWebsite', () => {
    it('should scan and save to DB by default', async () => {
      const body: ScanRequestDto = { websiteUrl: 'https://example.com' };
      const result = await controller.scanWebsite(body);
      expect(mockScannerService.scanWebsite).toHaveBeenCalledWith('https://example.com');
      expect(mockReportService.saveScanResult).toHaveBeenCalled();
      expect(result).toHaveProperty('reportId', 'report-123');
    });

    it('should skip DB save when saveToDb is false', async () => {
      const body: ScanRequestDto = { websiteUrl: 'https://example.com', saveToDb: false };
      const result = await controller.scanWebsite(body);
      expect(mockReportService.saveScanResult).not.toHaveBeenCalled();
      expect(result).not.toHaveProperty('reportId');
    });

    it('should pass auditRequestId to saveScanResult', async () => {
      const body: ScanRequestDto = { websiteUrl: 'https://example.com', auditRequestId: 'audit-1' };
      await controller.scanWebsite(body);
      expect(mockReportService.saveScanResult).toHaveBeenCalledWith(
        expect.anything(), 'audit-1',
      );
    });
  });

  describe('getReport', () => {
    it('should return report by ID', async () => {
      const result = await controller.getReport('report-123');
      expect(mockReportService.getReport).toHaveBeenCalledWith('report-123');
      expect(result).toHaveProperty('id', 'report-123');
    });
  });

  describe('getReportsByWebsite', () => {
    it('should fetch reports with default limit', async () => {
      await controller.getReportsByWebsite('example.com');
      expect(mockReportService.getReportsByWebsite).toHaveBeenCalledWith('example.com', 10);
    });

    it('should parse custom limit', async () => {
      await controller.getReportsByWebsite('example.com', '5');
      expect(mockReportService.getReportsByWebsite).toHaveBeenCalledWith('example.com', 5);
    });
  });

  describe('updateIssueStatus', () => {
    it('should update issue status', async () => {
      const result = await controller.updateIssueStatus('issue-1', { status: 'RESOLVED' });
      expect(mockReportService.updateIssueStatus).toHaveBeenCalledWith('issue-1', 'RESOLVED');
      expect(result).toHaveProperty('status', 'RESOLVED');
    });
  });

  describe('queueScan', () => {
    it('should queue a scan job', async () => {
      const body: QueueScanRequestDto = { websiteUrl: 'https://example.com' };
      const result = await controller.queueScan(body);
      expect(mockQueueService.addJob).toHaveBeenCalledWith(body);
      expect(result).toHaveProperty('status', 'QUEUED');
    });
  });

  describe('getJobStatus', () => {
    it('should return job status', async () => {
      const result = await controller.getJobStatus('job-1');
      expect(mockQueueService.getJobStatus).toHaveBeenCalledWith('job-1');
      expect(result).toHaveProperty('status', 'PROCESSING');
    });

    it('should return error when job not found', async () => {
      (mockQueueService.getJobStatus as jest.Mock).mockResolvedValue(null);
      const result = await controller.getJobStatus('nonexistent');
      expect(result).toEqual({ error: 'Job not found' });
    });
  });

  describe('cancelJob', () => {
    it('should cancel a job', async () => {
      const result = await controller.cancelJob('job-1');
      expect(mockQueueService.cancelJob).toHaveBeenCalledWith('job-1');
      expect(result).toEqual({ cancelled: true });
    });
  });

  describe('getQueueStats', () => {
    it('should return queue statistics', async () => {
      const result = await controller.getQueueStats();
      expect(mockQueueService.getStats).toHaveBeenCalled();
      expect(result).toHaveProperty('queued', 2);
    });
  });
});
