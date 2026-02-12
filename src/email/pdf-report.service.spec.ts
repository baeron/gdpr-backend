import { PdfReportService, PdfReportOptions } from './pdf-report.service';
import {
  ScanResultDto,
  RiskLevel,
  ConsentBannerInfo,
  PrivacyPolicyInfo,
  FormsAnalysisResult,
  DataTransferInfo,
  TechnologyDetectionResult,
  SecurityInfo,
} from '../scanner/dto/scan-result.dto';

describe('PdfReportService', () => {
  let service: PdfReportService;

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
      detectedElements: ['Data Controller', 'DPO Contact'],
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
    totalForms: 1,
    dataCollectionForms: 1,
    formsWithConsent: 1,
    formsWithoutConsent: 0,
    formsWithPreCheckedMarketing: 0,
    formsWithPrivacyLink: 1,
    forms: [],
    pagesScanned: ['https://example.com'],
  };

  const defaultDataTransfers: DataTransferInfo = {
    usServicesDetected: [],
    totalUSServices: 0,
    highRiskTransfers: [],
  };

  const defaultTechnologies: TechnologyDetectionResult = {
    technologies: [],
    cms: null,
    framework: null,
    consentPlatform: null,
    analytics: [],
    advertising: [],
    cdn: null,
  };

  const makeScanResult = (overrides: Partial<ScanResultDto> = {}): ScanResultDto => ({
    websiteUrl: 'https://example.com',
    scanDate: new Date('2026-02-12T10:00:00Z'),
    scanDurationMs: 5000,
    overallRiskLevel: RiskLevel.LOW,
    score: 85,
    cookies: { total: 5, beforeConsent: 0, list: [] },
    trackers: { total: 2, beforeConsent: 0, list: [] },
    thirdPartyRequests: { total: 10, beforeConsent: 3, list: [] },
    consentBanner: defaultConsent,
    privacyPolicy: defaultPrivacy,
    security: defaultSecurity,
    forms: defaultForms,
    dataTransfers: defaultDataTransfers,
    technologies: defaultTechnologies,
    issues: [],
    ...overrides,
  });

  beforeEach(() => {
    service = new PdfReportService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ==================== FREE MODE ====================

  describe('free mode (default)', () => {
    it('should generate a valid PDF buffer', async () => {
      const buffer = await service.generateReport(makeScanResult());
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
      // PDF magic bytes: %PDF
      expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
    });

    it('should generate PDF within 10 seconds (AC)', async () => {
      const start = Date.now();
      await service.generateReport(makeScanResult());
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(10000);
    });

    it('should default to free mode when no options provided', async () => {
      const buffer = await service.generateReport(makeScanResult());
      expect(buffer).toBeInstanceOf(Buffer);
    });

    it('should handle scan result with no issues', async () => {
      const buffer = await service.generateReport(makeScanResult({ issues: [] }));
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('should handle scan result with many issues (shows top 5)', async () => {
      const issues = Array(20)
        .fill(null)
        .map((_, i) => ({
          code: `ISSUE_${i}`,
          title: `Issue ${i}`,
          description: `Description for issue ${i}`,
          riskLevel: i < 3 ? RiskLevel.CRITICAL : i < 8 ? RiskLevel.HIGH : RiskLevel.MEDIUM,
          recommendation: `Fix issue ${i}`,
        }));

      const buffer = await service.generateReport(makeScanResult({ issues }));
      expect(buffer).toBeInstanceOf(Buffer);
    });

    it('should handle missing consent banner and privacy policy', async () => {
      const buffer = await service.generateReport(
        makeScanResult({
          consentBanner: { ...defaultConsent, found: false, hasRejectButton: false },
          privacyPolicy: { ...defaultPrivacy, found: false, url: null },
          security: {
            ...defaultSecurity,
            https: { enabled: false, redirectsToHttps: false },
          },
        }),
      );
      expect(buffer).toBeInstanceOf(Buffer);
    });

    it('should accept upgradeUrl option', async () => {
      const buffer = await service.generateReport(makeScanResult(), {
        mode: 'free',
        upgradeUrl: 'https://policytracker.eu/report/abc123?upgrade=true',
      });
      expect(buffer).toBeInstanceOf(Buffer);
    });
  });

  // ==================== FULL MODE ====================

  describe('full mode', () => {
    const fullOptions: PdfReportOptions = { mode: 'full', reportId: 'rpt-12345' };

    it('should generate a valid PDF buffer', async () => {
      const buffer = await service.generateReport(makeScanResult(), fullOptions);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
    });

    it('should generate PDF within 10 seconds (AC)', async () => {
      const start = Date.now();
      await service.generateReport(makeScanResult(), fullOptions);
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(10000);
    });

    it('should handle scan result with no issues', async () => {
      const buffer = await service.generateReport(makeScanResult({ issues: [] }), fullOptions);
      expect(buffer).toBeInstanceOf(Buffer);
    });

    it('should handle many issues with detailed findings', async () => {
      const issues = Array(20)
        .fill(null)
        .map((_, i) => ({
          code: `ISSUE_${i}`,
          title: `Issue ${i}`,
          description: `Description for issue ${i}`,
          riskLevel: i < 3 ? RiskLevel.CRITICAL : i < 8 ? RiskLevel.HIGH : RiskLevel.MEDIUM,
          recommendation: `Fix issue ${i}`,
        }));

      const buffer = await service.generateReport(makeScanResult({ issues }), fullOptions);
      expect(buffer).toBeInstanceOf(Buffer);
    });

    it('should handle critical risk level', async () => {
      const buffer = await service.generateReport(
        makeScanResult({
          score: 15,
          overallRiskLevel: RiskLevel.CRITICAL,
          issues: [
            {
              code: 'NO_CONSENT_BANNER',
              title: 'No consent banner found',
              description: 'The website does not display a cookie consent banner.',
              riskLevel: RiskLevel.CRITICAL,
              recommendation: 'Implement a GDPR-compliant consent banner.',
            },
          ],
        }),
        fullOptions,
      );
      expect(buffer).toBeInstanceOf(Buffer);
    });
  });

  // ==================== MODE COMPARISON ====================

  describe('free vs full comparison', () => {
    const issuesData = Array(10)
      .fill(null)
      .map((_, i) => ({
        code: `ISSUE_${i}`,
        title: `Issue ${i} with a longer title for testing`,
        description: `Detailed description for issue ${i} that explains the problem in depth.`,
        riskLevel: RiskLevel.HIGH,
        recommendation: `Recommendation for fixing issue ${i} with specific steps.`,
      }));

    it('should produce a larger PDF for full mode than free mode', async () => {
      const scanResult = makeScanResult({ issues: issuesData });

      const freeBuffer = await service.generateReport(scanResult, { mode: 'free' });
      const fullBuffer = await service.generateReport(scanResult, { mode: 'full' });

      // Full report includes all issues + priority action plan, so it should be larger
      expect(fullBuffer.length).toBeGreaterThan(freeBuffer.length);
    });

    it('should produce different PDF sizes for different scan results', async () => {
      const simpleResult = makeScanResult({ issues: [] });
      const complexResult = makeScanResult({ issues: issuesData });

      const simpleBuffer = await service.generateReport(simpleResult);
      const complexBuffer = await service.generateReport(complexResult);

      expect(complexBuffer.length).toBeGreaterThan(simpleBuffer.length);
    });

    it('should handle cookies and trackers before consent in both modes', async () => {
      const scanResult = makeScanResult({
        cookies: { total: 10, beforeConsent: 5, list: [] },
        trackers: { total: 4, beforeConsent: 3, list: [] },
        dataTransfers: {
          usServicesDetected: [],
          totalUSServices: 5,
          highRiskTransfers: ['Google Analytics'],
        },
      });

      const freeBuffer = await service.generateReport(scanResult, { mode: 'free' });
      const fullBuffer = await service.generateReport(scanResult, { mode: 'full' });

      expect(freeBuffer).toBeInstanceOf(Buffer);
      expect(fullBuffer).toBeInstanceOf(Buffer);
    });
  });
});
