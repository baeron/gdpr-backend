/**
 * Integration test: Full email + PDF flow (#72)
 *
 * Tests the complete flow:
 * 1. Scan result → PdfReportService generates free PDF
 * 2. Scan result → PdfReportService generates full PDF
 * 3. EmailService.sendAuditResults with scanResult → generates PDF + attaches to email
 * 4. Timing: entire flow completes within AC limits
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';
import { PdfReportService } from './pdf-report.service';
import {
  ScanResultDto,
  RiskLevel,
} from '../scanner/dto/scan-result.dto';

describe('Email + PDF Integration Flow (#72)', () => {
  let emailService: EmailService;
  let pdfService: PdfReportService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        EMAIL_FROM: 'PolicyTracker <test@policytracker.eu>',
        ADMIN_EMAIL: 'admin@policytracker.eu',
      };
      return config[key] || undefined;
    }),
  };

  // Realistic scan result with issues across multiple categories
  const realisticScanResult: ScanResultDto = {
    websiteUrl: 'https://shop.example.com',
    scanDate: new Date('2026-02-12T10:00:00Z'),
    scanDurationMs: 12500,
    overallRiskLevel: RiskLevel.HIGH,
    score: 42,
    cookies: {
      total: 15,
      beforeConsent: 8,
      list: [
        {
          name: '_ga',
          domain: '.example.com',
          path: '/',
          expires: '2028-02-12',
          httpOnly: false,
          secure: false,
          sameSite: 'None',
          category: 'analytics',
          setBeforeConsent: true,
        },
        {
          name: '_fbp',
          domain: '.example.com',
          path: '/',
          expires: '2026-05-12',
          httpOnly: false,
          secure: true,
          sameSite: 'Lax',
          category: 'marketing',
          setBeforeConsent: true,
        },
      ],
    },
    trackers: {
      total: 5,
      beforeConsent: 3,
      list: [
        {
          name: 'Google Analytics',
          type: 'analytics',
          domain: 'google-analytics.com',
          loadedBeforeConsent: true,
        },
        {
          name: 'Facebook Pixel',
          type: 'advertising',
          domain: 'facebook.com',
          loadedBeforeConsent: true,
        },
      ],
    },
    thirdPartyRequests: {
      total: 25,
      beforeConsent: 12,
      list: [],
    },
    consentBanner: {
      found: true,
      hasRejectButton: false,
      hasAcceptButton: true,
      hasSettingsOption: false,
      isBlocking: false,
      quality: {
        hasPreCheckedBoxes: true,
        preCheckedCategories: ['analytics', 'marketing'],
        hasEqualProminence: false,
        acceptButtonSize: { width: 200, height: 50 },
        rejectButtonSize: null,
        isCookieWall: false,
        hasGranularConsent: false,
        categoryCount: 0,
        closeButtonRejects: false,
      },
    },
    privacyPolicy: {
      found: true,
      url: 'https://shop.example.com/privacy',
      content: {
        analyzed: true,
        hasDataController: true,
        hasDPOContact: false,
        hasPurposeOfProcessing: true,
        hasLegalBasis: false,
        hasDataRetention: false,
        hasUserRights: true,
        hasRightToComplain: false,
        hasThirdPartySharing: true,
        hasInternationalTransfers: false,
        detectedElements: ['Data Controller', 'Purpose', 'User Rights', 'Third Party'],
        missingElements: ['DPO Contact', 'Legal Basis', 'Data Retention', 'Right to Complain', 'International Transfers'],
      },
    },
    security: {
      https: { enabled: true, redirectsToHttps: true },
      mixedContent: { found: true, resources: ['http://cdn.example.com/image.jpg'] },
      cookieSecurity: {
        withoutSecure: 5,
        withoutHttpOnly: 8,
        withoutSameSite: 3,
        excessiveExpiration: 2,
        issues: [
          {
            cookieName: '_ga',
            issue: 'no_secure',
            description: 'Cookie _ga does not have the Secure flag',
            recommendation: 'Set the Secure flag on all cookies',
          },
        ],
      },
    },
    forms: {
      totalForms: 3,
      dataCollectionForms: 2,
      formsWithConsent: 0,
      formsWithoutConsent: 2,
      formsWithPreCheckedMarketing: 1,
      formsWithPrivacyLink: 0,
      forms: [
        {
          type: 'newsletter',
          hasEmailField: true,
          hasConsentCheckbox: false,
          hasPrivacyPolicyLink: false,
          hasPreCheckedMarketing: true,
        },
        {
          type: 'contact',
          hasEmailField: true,
          hasConsentCheckbox: false,
          hasPrivacyPolicyLink: false,
          hasPreCheckedMarketing: false,
        },
      ],
      pagesScanned: ['https://shop.example.com', 'https://shop.example.com/contact'],
    },
    dataTransfers: {
      usServicesDetected: [
        {
          name: 'Google Analytics',
          domain: 'google-analytics.com',
          category: 'analytics',
          dataProcessed: 'User behavior data',
        },
        {
          name: 'Facebook',
          domain: 'facebook.com',
          category: 'advertising',
          dataProcessed: 'User tracking data',
        },
      ],
      totalUSServices: 2,
      highRiskTransfers: ['Google Analytics', 'Facebook'],
    },
    technologies: {
      technologies: [
        { name: 'WordPress', category: 'CMS', confidence: 'high', gdprRelevant: false },
        { name: 'Google Analytics', category: 'Analytics', confidence: 'high', gdprRelevant: true, gdprNote: 'Transfers data to US' },
      ],
      cms: 'WordPress',
      framework: null,
      consentPlatform: null,
      analytics: ['Google Analytics'],
      advertising: ['Facebook Pixel'],
      cdn: null,
    },
    issues: [
      {
        code: 'COOKIES_BEFORE_CONSENT',
        title: 'Cookies set before user consent',
        description: '8 cookies are being set before the user has given consent, including analytics and marketing cookies.',
        riskLevel: RiskLevel.CRITICAL,
        recommendation: 'Implement a consent-first approach where no non-essential cookies are set until explicit consent is given.',
      },
      {
        code: 'NO_REJECT_BUTTON',
        title: 'Consent banner lacks reject option',
        description: 'The consent banner does not provide a clear option to reject all non-essential cookies.',
        riskLevel: RiskLevel.CRITICAL,
        recommendation: 'Add a clearly visible "Reject All" button with equal prominence to the "Accept All" button.',
      },
      {
        code: 'TRACKERS_BEFORE_CONSENT',
        title: 'Tracking scripts loaded before consent',
        description: '3 tracking scripts (Google Analytics, Facebook Pixel) are loaded before user consent.',
        riskLevel: RiskLevel.HIGH,
        recommendation: 'Defer loading of all tracking scripts until after explicit user consent.',
      },
      {
        code: 'PRE_CHECKED_CATEGORIES',
        title: 'Pre-checked consent categories',
        description: 'Analytics and marketing categories are pre-checked in the consent banner.',
        riskLevel: RiskLevel.HIGH,
        recommendation: 'Ensure all non-essential consent categories are unchecked by default.',
      },
      {
        code: 'FORMS_WITHOUT_CONSENT',
        title: 'Data collection forms without consent',
        description: '2 forms collect personal data without consent checkboxes or privacy policy links.',
        riskLevel: RiskLevel.HIGH,
        recommendation: 'Add consent checkboxes and privacy policy links to all data collection forms.',
      },
      {
        code: 'PRIVACY_POLICY_INCOMPLETE',
        title: 'Privacy policy missing required elements',
        description: 'Privacy policy is missing: DPO Contact, Legal Basis, Data Retention, Right to Complain, International Transfers.',
        riskLevel: RiskLevel.MEDIUM,
        recommendation: 'Update the privacy policy to include all required GDPR elements.',
      },
      {
        code: 'US_DATA_TRANSFERS',
        title: 'Data transfers to US services without safeguards',
        description: '2 US services detected (Google Analytics, Facebook) without documented transfer safeguards.',
        riskLevel: RiskLevel.MEDIUM,
        recommendation: 'Implement Standard Contractual Clauses (SCCs) or switch to EU-based alternatives.',
      },
      {
        code: 'MIXED_CONTENT',
        title: 'Mixed content detected',
        description: 'HTTP resources loaded on HTTPS pages.',
        riskLevel: RiskLevel.LOW,
        recommendation: 'Ensure all resources are loaded over HTTPS.',
      },
    ],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        PdfReportService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    emailService = module.get<EmailService>(EmailService);
    pdfService = module.get<PdfReportService>(PdfReportService);
  });

  describe('Step 1: Free PDF generation', () => {
    it('should generate free PDF with score, top-5 issues, and upgrade CTA', async () => {
      const buffer = await pdfService.generateReport(realisticScanResult, {
        mode: 'free',
        upgradeUrl: 'https://policytracker.eu/report/rpt-abc123?upgrade=true',
        reportId: 'rpt-abc123',
      });

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
      expect(buffer.length).toBeGreaterThan(1000);
    });
  });

  describe('Step 2: Full PDF generation', () => {
    it('should generate full PDF with all issues and priority action plan', async () => {
      const buffer = await pdfService.generateReport(realisticScanResult, {
        mode: 'full',
        reportId: 'rpt-abc123',
      });

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
      // Full report should be larger than free
      const freeBuffer = await pdfService.generateReport(realisticScanResult, { mode: 'free' });
      expect(buffer.length).toBeGreaterThan(freeBuffer.length);
    });
  });

  describe('Step 3: Email with PDF attachment', () => {
    it('should send audit results email with free PDF attached', async () => {
      const generateSpy = jest.spyOn(pdfService, 'generateReport');

      const result = await emailService.sendAuditResults('user@example.com', {
        websiteUrl: realisticScanResult.websiteUrl,
        auditId: 'audit-xyz789',
        reportId: 'rpt-abc123',
        score: realisticScanResult.score,
        issuesCount: realisticScanResult.issues.length,
        passedCount: 2,
        topIssues: realisticScanResult.issues.slice(0, 5).map((i) => ({
          title: i.title,
          severity: i.riskLevel === RiskLevel.CRITICAL ? 'critical' as const
            : i.riskLevel === RiskLevel.HIGH ? 'warning' as const
            : 'info' as const,
        })),
        isFullReport: false,
        locale: 'en',
        scanResult: realisticScanResult,
      });

      expect(result).toBe(true);
      expect(generateSpy).toHaveBeenCalledWith(
        realisticScanResult,
        expect.objectContaining({ mode: 'free', reportId: 'rpt-abc123' }),
      );
    });
  });

  describe('Step 4: Performance (AC: ≤10 seconds)', () => {
    it('should complete entire flow (free PDF + email) within 10 seconds', async () => {
      const start = Date.now();

      // Generate free PDF
      await pdfService.generateReport(realisticScanResult, { mode: 'free' });
      // Generate full PDF
      await pdfService.generateReport(realisticScanResult, { mode: 'full' });
      // Send email with attachment
      await emailService.sendAuditResults('user@example.com', {
        websiteUrl: realisticScanResult.websiteUrl,
        auditId: 'audit-perf',
        reportId: 'rpt-perf',
        score: realisticScanResult.score,
        issuesCount: realisticScanResult.issues.length,
        passedCount: 2,
        topIssues: [],
        isFullReport: false,
        scanResult: realisticScanResult,
      });

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(10000);
    });
  });
});
