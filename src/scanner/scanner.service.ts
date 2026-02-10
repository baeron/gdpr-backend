import { Injectable, Logger } from '@nestjs/common';
import { Request } from 'playwright';
import { CookieAnalyzer } from './analyzers/cookie.analyzer';
import { TrackerAnalyzer } from './analyzers/tracker.analyzer';
import { ConsentAnalyzer } from './analyzers/consent.analyzer';
import { PrivacyPolicyAnalyzer } from './analyzers/privacy-policy.analyzer';
import { SecurityAnalyzer, SecurityInfo } from './analyzers/security.analyzer';
import { FormAnalyzer } from './analyzers/form.analyzer';
import { DataTransferAnalyzer } from './analyzers/data-transfer.analyzer';
import { TechnologyAnalyzer } from './analyzers/technology.analyzer';
import {
  ScanResultDto,
  ThirdPartyRequest,
  FormsAnalysisResult,
  DataTransferInfo,
  TechnologyDetectionResult,
} from './dto/scan-result.dto';
import { BrowserManagerService } from './browser-manager.service';
import { IssueGeneratorService } from './issue-generator.service';
import { ScoreCalculatorService } from './score-calculator.service';
import { UrlUtilsService } from './url-utils.service';

@Injectable()
export class ScannerService {
  private readonly logger = new Logger(ScannerService.name);

  private readonly cookieAnalyzer: CookieAnalyzer;
  private readonly trackerAnalyzer: TrackerAnalyzer;
  private readonly consentAnalyzer: ConsentAnalyzer;
  private readonly privacyPolicyAnalyzer: PrivacyPolicyAnalyzer;
  private readonly securityAnalyzer: SecurityAnalyzer;
  private readonly formAnalyzer: FormAnalyzer;
  private readonly dataTransferAnalyzer: DataTransferAnalyzer;
  private readonly technologyAnalyzer: TechnologyAnalyzer;
  private readonly browserManager: BrowserManagerService;
  private readonly issueGenerator: IssueGeneratorService;
  private readonly scoreCalculator: ScoreCalculatorService;
  private readonly urlUtils: UrlUtilsService;

  constructor(
    cookieAnalyzer?: CookieAnalyzer,
    trackerAnalyzer?: TrackerAnalyzer,
    consentAnalyzer?: ConsentAnalyzer,
    privacyPolicyAnalyzer?: PrivacyPolicyAnalyzer,
    securityAnalyzer?: SecurityAnalyzer,
    formAnalyzer?: FormAnalyzer,
    dataTransferAnalyzer?: DataTransferAnalyzer,
    technologyAnalyzer?: TechnologyAnalyzer,
    browserManager?: BrowserManagerService,
    issueGenerator?: IssueGeneratorService,
    scoreCalculator?: ScoreCalculatorService,
    urlUtils?: UrlUtilsService,
  ) {
    this.cookieAnalyzer = cookieAnalyzer ?? new CookieAnalyzer();
    this.trackerAnalyzer = trackerAnalyzer ?? new TrackerAnalyzer();
    this.consentAnalyzer = consentAnalyzer ?? new ConsentAnalyzer();
    this.privacyPolicyAnalyzer = privacyPolicyAnalyzer ?? new PrivacyPolicyAnalyzer();
    this.securityAnalyzer = securityAnalyzer ?? new SecurityAnalyzer();
    this.formAnalyzer = formAnalyzer ?? new FormAnalyzer();
    this.dataTransferAnalyzer = dataTransferAnalyzer ?? new DataTransferAnalyzer();
    this.technologyAnalyzer = technologyAnalyzer ?? new TechnologyAnalyzer();
    this.browserManager = browserManager ?? new BrowserManagerService();
    this.issueGenerator = issueGenerator ?? new IssueGeneratorService();
    this.scoreCalculator = scoreCalculator ?? new ScoreCalculatorService();
    this.urlUtils = urlUtils ?? new UrlUtilsService();
  }

  async scanWebsite(url: string, retryCount = 0): Promise<ScanResultDto> {
    const startTime = Date.now();
    this.logger.log(`Starting scan for ${url}`);

    // Normalize URL
    const normalizedUrl = this.urlUtils.normalizeUrl(url);

    // Initialize browser with recovery
    const browser = await this.browserManager.ensureBrowser();
    const context = await this.browserManager.createContext(browser);
    const page = await context.newPage();

    // Track third-party requests
    const thirdPartyRequests: ThirdPartyRequest[] = [];
    const baseDomain = new URL(normalizedUrl).hostname;
    let consentGiven = false;

    // Reset analyzers
    this.trackerAnalyzer.reset();
    this.securityAnalyzer.resetMixedContent();
    this.dataTransferAnalyzer.reset();
    this.technologyAnalyzer.reset();

    // Track if page is HTTPS for mixed content detection
    const pageIsHttps = normalizedUrl.startsWith('https://');

    // Listen to all requests
    page.on('request', (request: Request) => {
      try {
        const requestUrl = new URL(request.url());
        const requestDomain = requestUrl.hostname;

        // Check if third-party
        if (!this.urlUtils.isSameDomain(baseDomain, requestDomain)) {
          thirdPartyRequests.push({
            url: request.url(),
            domain: requestDomain,
            type: request.resourceType(),
            beforeConsent: !consentGiven,
          });

          // Analyze for trackers
          this.trackerAnalyzer.analyzeRequest(request, !consentGiven);
        }

        // Track mixed content
        this.securityAnalyzer.trackMixedContent(request, pageIsHttps);

        // Track data transfers (Phase 6)
        this.dataTransferAnalyzer.analyzeRequest(request);

        // Track technologies
        this.technologyAnalyzer.trackRequest(request);
      } catch {
        // Invalid URL, skip
      }
    });

    try {
      // Navigate to page
      await page.goto(normalizedUrl, {
        waitUntil: 'networkidle',
        timeout: 30000,
      });

      // Phase 1: Analyze BEFORE consent
      this.logger.log('Phase 1: Analyzing before consent...');

      const cookiesBeforeConsent = await this.cookieAnalyzer.analyzeCookies(
        page,
        true,
      );
      const consentBanner =
        await this.consentAnalyzer.analyzeConsentBanner(page);
      const privacyPolicy =
        await this.privacyPolicyAnalyzer.analyzePrivacyPolicy(page);

      // Phase 2: Click accept and analyze AFTER consent
      this.logger.log('Phase 2: Analyzing after consent...');

      if (consentBanner.found && consentBanner.hasAcceptButton) {
        consentGiven = true;
        await this.consentAnalyzer.clickAcceptButton(page);
        await page.waitForTimeout(2000);
      }

      const cookiesAfterConsent = await this.cookieAnalyzer.analyzeCookies(
        page,
        false,
      );

      // Merge cookies (mark which were set before consent)
      const allCookies = this.urlUtils.mergeCookies(
        cookiesBeforeConsent,
        cookiesAfterConsent,
      );

      // Get all detected trackers
      const trackers = this.trackerAnalyzer.getDetectedTrackers();

      // Phase 3: Security analysis
      this.logger.log('Phase 3: Security analysis...');
      const httpsInfo = await this.securityAnalyzer.analyzeHttps(
        page,
        normalizedUrl,
      );
      const mixedContentInfo = this.securityAnalyzer.getMixedContentInfo();
      const cookieSecurityInfo =
        this.securityAnalyzer.analyzeCookieSecurity(allCookies);

      const security: SecurityInfo = {
        https: {
          enabled: httpsInfo.enabled,
          redirectsToHttps: httpsInfo.redirectsToHttps,
        },
        mixedContent: mixedContentInfo,
        cookieSecurity: cookieSecurityInfo,
      };

      // Phase 4: Form analysis
      this.logger.log('Phase 4: Form analysis...');
      const formsAnalysis = await this.formAnalyzer.analyzeForms(page);

      // Phase 5: Privacy Policy content analysis
      if (privacyPolicy.found && privacyPolicy.url) {
        this.logger.log('Phase 5: Privacy Policy content analysis...');
        privacyPolicy.content =
          await this.privacyPolicyAnalyzer.analyzePrivacyPolicyContent(
            page,
            privacyPolicy.url,
          );
      }

      // Phase 6: Data Transfer analysis
      this.logger.log('Phase 6: Data Transfer analysis...');
      const dataTransferInfo = this.dataTransferAnalyzer.getDataTransferInfo();
      const dataTransfers: DataTransferInfo = {
        usServicesDetected: dataTransferInfo.usServicesDetected,
        totalUSServices: dataTransferInfo.totalUSServices,
        highRiskTransfers: dataTransferInfo.highRiskTransfers,
      };

      // Phase 7: Technology Detection
      this.logger.log('Phase 7: Technology Detection...');
      const technologies: TechnologyDetectionResult =
        await this.technologyAnalyzer.analyzePage(page);

      // Map to simplified FormInfo for response
      const forms: FormsAnalysisResult = {
        totalForms: formsAnalysis.totalForms,
        dataCollectionForms: formsAnalysis.dataCollectionForms,
        formsWithConsent: formsAnalysis.formsWithConsent,
        formsWithoutConsent: formsAnalysis.formsWithoutConsent,
        formsWithPreCheckedMarketing:
          formsAnalysis.formsWithPreCheckedMarketing,
        formsWithPrivacyLink: formsAnalysis.formsWithPrivacyLink,
        forms: formsAnalysis.forms.map((f) => ({
          type: f.type,
          hasEmailField: f.hasEmailField,
          hasConsentCheckbox: f.hasConsentCheckbox,
          hasPrivacyPolicyLink: f.hasPrivacyPolicyLink,
          hasPreCheckedMarketing: f.hasPreCheckedMarketing,
        })),
        pagesScanned: formsAnalysis.pagesScanned,
      };

      // Generate issues
      const issues = this.issueGenerator.generateIssues(
        allCookies,
        trackers,
        thirdPartyRequests,
        consentBanner,
        privacyPolicy,
        security,
        forms,
        dataTransfers,
      );

      // Calculate overall risk level and score
      const overallRiskLevel = this.scoreCalculator.calculateOverallRisk(issues);
      const score = this.scoreCalculator.calculateScore(issues);

      const scanDurationMs = Date.now() - startTime;
      this.logger.log(
        `Scan completed in ${scanDurationMs}ms. Score: ${score}/100`,
      );

      return {
        websiteUrl: normalizedUrl,
        scanDate: new Date(),
        scanDurationMs,
        overallRiskLevel,
        cookies: {
          total: allCookies.length,
          beforeConsent: allCookies.filter((c) => c.setBeforeConsent).length,
          list: allCookies,
        },
        trackers: {
          total: trackers.length,
          beforeConsent: trackers.filter((t) => t.loadedBeforeConsent).length,
          list: trackers,
        },
        thirdPartyRequests: {
          total: thirdPartyRequests.length,
          beforeConsent: thirdPartyRequests.filter((r) => r.beforeConsent)
            .length,
          list: thirdPartyRequests.slice(0, 50), // Limit to 50 for response size
        },
        consentBanner,
        privacyPolicy,
        security,
        forms,
        dataTransfers,
        technologies,
        issues,
        score,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Scan failed for ${url}: ${errorMessage}`);

      if (this.browserManager.isBrowserCrashError(error)) {
        this.logger.warn('Browser crashed, resetting browser instance...');
        await this.browserManager.closeBrowser();

        // Retry once if browser crashed
        if (retryCount < 1) {
          this.logger.log(
            `Retrying scan for ${url} (attempt ${retryCount + 2})`,
          );
          await this.browserManager.closeContext(context);
          return this.scanWebsite(url, retryCount + 1);
        }
      }

      throw error;
    } finally {
      // Always close context
      await this.browserManager.closeContext(context);
    }
  }

  // ============================================================
  // Delegated accessors for backward compatibility in tests
  // These will be removed once all consumers use the extracted services directly.
  // ============================================================

  /** @deprecated Use UrlUtilsService directly */
  private normalizeUrl(url: string): string {
    return this.urlUtils.normalizeUrl(url);
  }

  /** @deprecated Use UrlUtilsService directly */
  private isSameDomain(baseDomain: string, requestDomain: string): boolean {
    return this.urlUtils.isSameDomain(baseDomain, requestDomain);
  }

  /** @deprecated Use UrlUtilsService directly */
  private mergeCookies(
    before: import('./dto/scan-result.dto').CookieInfo[],
    after: import('./dto/scan-result.dto').CookieInfo[],
  ): import('./dto/scan-result.dto').CookieInfo[] {
    return this.urlUtils.mergeCookies(before, after);
  }

  /** @deprecated Use IssueGeneratorService directly */
  private generateIssues(
    cookies: import('./dto/scan-result.dto').CookieInfo[],
    trackers: { loadedBeforeConsent: boolean; name: string; type: string }[],
    thirdPartyRequests: ThirdPartyRequest[],
    consentBanner: import('./dto/scan-result.dto').ConsentBannerInfo,
    privacyPolicy: import('./dto/scan-result.dto').PrivacyPolicyInfo,
    security: SecurityInfo,
    forms: FormsAnalysisResult,
    dataTransfers: DataTransferInfo,
  ): import('./dto/scan-result.dto').ScanIssue[] {
    return this.issueGenerator.generateIssues(
      cookies, trackers, thirdPartyRequests, consentBanner,
      privacyPolicy, security, forms, dataTransfers,
    );
  }

  /** @deprecated Use ScoreCalculatorService directly */
  private calculateOverallRisk(
    issues: import('./dto/scan-result.dto').ScanIssue[],
  ): import('./dto/scan-result.dto').RiskLevel {
    return this.scoreCalculator.calculateOverallRisk(issues);
  }

  /** @deprecated Use ScoreCalculatorService directly */
  private calculateScore(
    issues: import('./dto/scan-result.dto').ScanIssue[],
  ): number {
    return this.scoreCalculator.calculateScore(issues);
  }

  async onModuleDestroy() {
    await this.browserManager.closeBrowser();
  }
}
