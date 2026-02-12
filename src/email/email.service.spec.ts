import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';
import { PdfReportService } from './pdf-report.service';
import {
  ScanResultDto,
  RiskLevel,
} from '../scanner/dto/scan-result.dto';

describe('EmailService', () => {
  let service: EmailService;
  let pdfReportService: PdfReportService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        EMAIL_FROM: 'PolicyTracker <test@policytracker.eu>',
        ADMIN_EMAIL: 'admin@policytracker.eu',
        // No RESEND_API_KEY → mock mode
      };
      return config[key] || undefined;
    }),
  };

  const makeScanResult = (): ScanResultDto => ({
    websiteUrl: 'https://example.com',
    scanDate: new Date('2026-02-12T10:00:00Z'),
    scanDurationMs: 5000,
    overallRiskLevel: RiskLevel.LOW,
    score: 85,
    cookies: { total: 5, beforeConsent: 0, list: [] },
    trackers: { total: 2, beforeConsent: 0, list: [] },
    thirdPartyRequests: { total: 10, beforeConsent: 3, list: [] },
    consentBanner: {
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
    },
    privacyPolicy: {
      found: true,
      url: 'https://example.com/privacy',
      content: {
        analyzed: true,
        hasDataController: true,
        hasDPOContact: true,
        hasPurposeOfProcessing: true,
        hasLegalBasis: true,
        hasDataRetention: true,
        hasUserRights: true,
        hasRightToComplain: true,
        hasThirdPartySharing: true,
        hasInternationalTransfers: true,
        detectedElements: ['Data Controller'],
        missingElements: [],
      },
    },
    security: {
      https: { enabled: true, redirectsToHttps: true },
      mixedContent: { found: false, resources: [] },
      cookieSecurity: {
        withoutSecure: 0,
        withoutHttpOnly: 0,
        withoutSameSite: 0,
        excessiveExpiration: 0,
        issues: [],
      },
    },
    forms: {
      totalForms: 1,
      dataCollectionForms: 1,
      formsWithConsent: 1,
      formsWithoutConsent: 0,
      formsWithPreCheckedMarketing: 0,
      formsWithPrivacyLink: 1,
      forms: [],
      pagesScanned: ['https://example.com'],
    },
    dataTransfers: {
      usServicesDetected: [],
      totalUSServices: 0,
      highRiskTransfers: [],
    },
    technologies: {
      technologies: [],
      cms: null,
      framework: null,
      consentPlatform: null,
      analytics: [],
      advertising: [],
      cdn: null,
    },
    issues: [
      {
        code: 'TEST_ISSUE',
        title: 'Test Issue',
        description: 'Test description',
        riskLevel: RiskLevel.MEDIUM,
        recommendation: 'Test recommendation',
      },
    ],
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        PdfReportService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
    pdfReportService = module.get<PdfReportService>(PdfReportService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should be in mock mode (no RESEND_API_KEY)', () => {
    expect(service.isConfigured()).toBe(false);
  });

  describe('sendAuditResults', () => {
    it('should send audit results email without PDF when no scanResult provided', async () => {
      const result = await service.sendAuditResults('user@example.com', {
        websiteUrl: 'https://example.com',
        auditId: 'audit-123',
        reportId: 'report-456',
        score: 85,
        issuesCount: 3,
        passedCount: 4,
        topIssues: [
          { title: 'Issue 1', severity: 'critical' },
          { title: 'Issue 2', severity: 'warning' },
        ],
        isFullReport: false,
      });

      expect(result).toBe(true);
    });

    it('should send audit results email with PDF attachment when scanResult provided', async () => {
      const generateSpy = jest.spyOn(pdfReportService, 'generateReport');

      const result = await service.sendAuditResults('user@example.com', {
        websiteUrl: 'https://example.com',
        auditId: 'audit-123',
        reportId: 'report-456',
        score: 85,
        issuesCount: 3,
        passedCount: 4,
        topIssues: [
          { title: 'Issue 1', severity: 'critical' },
        ],
        isFullReport: false,
        scanResult: makeScanResult(),
      });

      expect(result).toBe(true);
      expect(generateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ websiteUrl: 'https://example.com' }),
        expect.objectContaining({
          mode: 'free',
          upgradeUrl: 'https://policytracker.eu/report/report-456?upgrade=true',
          reportId: 'report-456',
        }),
      );
    });

    it('should still send email if PDF generation fails', async () => {
      jest
        .spyOn(pdfReportService, 'generateReport')
        .mockRejectedValueOnce(new Error('PDF generation failed'));

      const result = await service.sendAuditResults('user@example.com', {
        websiteUrl: 'https://example.com',
        auditId: 'audit-123',
        reportId: 'report-456',
        score: 85,
        issuesCount: 3,
        passedCount: 4,
        topIssues: [],
        isFullReport: false,
        scanResult: makeScanResult(),
      });

      // Email should still be sent (mock mode returns true)
      expect(result).toBe(true);
    });
  });

  describe('sendAuditConfirmationTo', () => {
    it('should send audit confirmation email', async () => {
      const result = await service.sendAuditConfirmationTo('user@example.com', {
        websiteUrl: 'https://example.com',
        auditId: 'audit-123',
      });

      expect(result).toBe(true);
    });
  });

  describe('sendAdminNotification', () => {
    it('should send admin notification', async () => {
      const result = await service.sendAdminNotification({
        websiteUrl: 'https://example.com',
        auditId: 'audit-123',
        email: 'user@example.com',
        agreeMarketing: false,
        locale: 'en',
      });

      expect(result).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return initial stats', () => {
      const stats = service.getStats();
      expect(stats).toEqual({ sent: 0, failed: 0, total: 0 });
    });

    it('should track sent emails', async () => {
      await service.sendAuditConfirmationTo('user@example.com', {
        websiteUrl: 'https://example.com',
        auditId: 'audit-123',
      });

      const stats = service.getStats();
      expect(stats.sent).toBe(1);
      expect(stats.total).toBe(1);
    });
  });
});
