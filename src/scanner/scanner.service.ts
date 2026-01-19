import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { chromium, Browser, Page, Request } from 'playwright';
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
  RiskLevel,
  ScanIssue,
  CookieInfo,
  ThirdPartyRequest,
  ConsentBannerInfo,
  FormsAnalysisResult,
  PrivacyPolicyInfo,
  DataTransferInfo,
  TechnologyDetectionResult,
} from './dto/scan-result.dto';

@Injectable()
export class ScannerService implements OnModuleDestroy {
  private readonly logger = new Logger(ScannerService.name);
  private browser: Browser | null = null;
  private browserPromise: Promise<Browser> | null = null;

  private readonly cookieAnalyzer = new CookieAnalyzer();
  private readonly trackerAnalyzer = new TrackerAnalyzer();
  private readonly consentAnalyzer = new ConsentAnalyzer();
  private readonly privacyPolicyAnalyzer = new PrivacyPolicyAnalyzer();
  private readonly securityAnalyzer = new SecurityAnalyzer();
  private readonly formAnalyzer = new FormAnalyzer();
  private readonly dataTransferAnalyzer = new DataTransferAnalyzer();
  private readonly technologyAnalyzer = new TechnologyAnalyzer();

  async scanWebsite(url: string): Promise<ScanResultDto> {
    const startTime = Date.now();
    this.logger.log(`Starting scan for ${url}`);

    // Normalize URL
    const normalizedUrl = this.normalizeUrl(url);

    // Initialize browser with race condition protection
    if (!this.browser) {
      if (!this.browserPromise) {
        this.browserPromise = chromium.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        }).then(browser => {
          this.browser = browser;
          return browser;
        });
      }
      await this.browserPromise;
    }

    const context = await this.browser!.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
    });

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
        if (!this.isSameDomain(baseDomain, requestDomain)) {
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
      
      const cookiesBeforeConsent = await this.cookieAnalyzer.analyzeCookies(page, true);
      const consentBanner = await this.consentAnalyzer.analyzeConsentBanner(page);
      const privacyPolicy = await this.privacyPolicyAnalyzer.analyzePrivacyPolicy(page);

      // Phase 2: Click accept and analyze AFTER consent
      this.logger.log('Phase 2: Analyzing after consent...');
      
      if (consentBanner.found && consentBanner.hasAcceptButton) {
        consentGiven = true;
        await this.consentAnalyzer.clickAcceptButton(page);
        await page.waitForTimeout(2000);
      }

      const cookiesAfterConsent = await this.cookieAnalyzer.analyzeCookies(page, false);

      // Merge cookies (mark which were set before consent)
      const allCookies = this.mergeCookies(cookiesBeforeConsent, cookiesAfterConsent);

      // Get all detected trackers
      const trackers = this.trackerAnalyzer.getDetectedTrackers();

      // Phase 3: Security analysis
      this.logger.log('Phase 3: Security analysis...');
      const httpsInfo = await this.securityAnalyzer.analyzeHttps(page, normalizedUrl);
      const mixedContentInfo = this.securityAnalyzer.getMixedContentInfo();
      const cookieSecurityInfo = this.securityAnalyzer.analyzeCookieSecurity(allCookies);

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
        const ppPage = await context.newPage();
        try {
          privacyPolicy.content = await this.privacyPolicyAnalyzer.analyzePrivacyPolicyContent(ppPage, privacyPolicy.url);
        } finally {
          await ppPage.close();
        }
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
      const technologies: TechnologyDetectionResult = await this.technologyAnalyzer.analyzePage(page);
      
      // Map to simplified FormInfo for response
      const forms: FormsAnalysisResult = {
        totalForms: formsAnalysis.totalForms,
        dataCollectionForms: formsAnalysis.dataCollectionForms,
        formsWithConsent: formsAnalysis.formsWithConsent,
        formsWithoutConsent: formsAnalysis.formsWithoutConsent,
        formsWithPreCheckedMarketing: formsAnalysis.formsWithPreCheckedMarketing,
        formsWithPrivacyLink: formsAnalysis.formsWithPrivacyLink,
        forms: formsAnalysis.forms.map(f => ({
          type: f.type,
          hasEmailField: f.hasEmailField,
          hasConsentCheckbox: f.hasConsentCheckbox,
          hasPrivacyPolicyLink: f.hasPrivacyPolicyLink,
          hasPreCheckedMarketing: f.hasPreCheckedMarketing,
        })),
        pagesScanned: formsAnalysis.pagesScanned,
      };

      // Generate issues
      const issues = this.generateIssues(
        allCookies,
        trackers,
        thirdPartyRequests,
        consentBanner,
        privacyPolicy,
        security,
        forms,
        dataTransfers
      );

      // Calculate overall risk level and score
      const overallRiskLevel = this.calculateOverallRisk(issues);
      const score = this.calculateScore(issues);

      const scanDurationMs = Date.now() - startTime;
      this.logger.log(`Scan completed in ${scanDurationMs}ms. Score: ${score}/100`);

      return {
        websiteUrl: normalizedUrl,
        scanDate: new Date(),
        scanDurationMs,
        overallRiskLevel,
        cookies: {
          total: allCookies.length,
          beforeConsent: allCookies.filter(c => c.setBeforeConsent).length,
          list: allCookies,
        },
        trackers: {
          total: trackers.length,
          beforeConsent: trackers.filter(t => t.loadedBeforeConsent).length,
          list: trackers,
        },
        thirdPartyRequests: {
          total: thirdPartyRequests.length,
          beforeConsent: thirdPartyRequests.filter(r => r.beforeConsent).length,
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
    } catch (error) {
      this.logger.error(`Scan failed for ${url}: ${error.message}`);
      throw error;
    } finally {
      await context.close();
    }
  }

  private normalizeUrl(url: string): string {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    return url;
  }

  private isSameDomain(baseDomain: string, requestDomain: string): boolean {
    // Remove www prefix for comparison
    const normalizeD = (d: string) => d.replace(/^www\./, '');
    return normalizeD(requestDomain).endsWith(normalizeD(baseDomain));
  }

  private mergeCookies(before: CookieInfo[], after: CookieInfo[]): CookieInfo[] {
    const cookieMap = new Map<string, CookieInfo>();

    // Add cookies from before consent
    for (const cookie of before) {
      cookieMap.set(`${cookie.name}|${cookie.domain}`, cookie);
    }

    // Add/update cookies from after consent
    for (const cookie of after) {
      const key = `${cookie.name}|${cookie.domain}`;
      if (!cookieMap.has(key)) {
        cookieMap.set(key, cookie);
      }
    }

    return Array.from(cookieMap.values());
  }

  private generateIssues(
    cookies: CookieInfo[],
    trackers: { loadedBeforeConsent: boolean; name: string; type: string }[],
    thirdPartyRequests: ThirdPartyRequest[],
    consentBanner: ConsentBannerInfo,
    privacyPolicy: PrivacyPolicyInfo,
    security: SecurityInfo,
    forms: FormsAnalysisResult,
    dataTransfers: DataTransferInfo
  ): ScanIssue[] {
    const issues: ScanIssue[] = [];

    // Check for non-essential cookies before consent
    const nonEssentialBeforeConsent = cookies.filter(
      c => c.setBeforeConsent && c.category !== 'necessary'
    );
    if (nonEssentialBeforeConsent.length > 0) {
      issues.push({
        code: 'COOKIES_BEFORE_CONSENT',
        title: 'Non-essential cookies set before consent',
        description: `${nonEssentialBeforeConsent.length} non-essential cookie(s) were set before user consent was obtained.`,
        riskLevel: RiskLevel.HIGH,
        recommendation: 'Ensure all non-essential cookies are only set after obtaining explicit user consent.',
      });
    }

    // Check for trackers before consent
    const trackersBeforeConsent = trackers.filter(t => t.loadedBeforeConsent);
    if (trackersBeforeConsent.length > 0) {
      issues.push({
        code: 'TRACKERS_BEFORE_CONSENT',
        title: 'Tracking scripts loaded before consent',
        description: `${trackersBeforeConsent.length} tracking script(s) were loaded before user consent: ${trackersBeforeConsent.map(t => t.name).join(', ')}.`,
        riskLevel: RiskLevel.HIGH,
        recommendation: 'Delay loading of all tracking scripts until user consent is obtained.',
      });
    }

    // Check for missing consent banner
    if (!consentBanner.found) {
      issues.push({
        code: 'NO_CONSENT_BANNER',
        title: 'No cookie consent banner detected',
        description: 'No cookie consent mechanism was detected on the website.',
        riskLevel: RiskLevel.CRITICAL,
        recommendation: 'Implement a GDPR-compliant cookie consent banner that appears before any non-essential cookies are set.',
      });
    }

    // Check for missing reject option
    if (consentBanner.found && !consentBanner.hasRejectButton) {
      issues.push({
        code: 'NO_REJECT_OPTION',
        title: 'No option to reject cookies',
        description: 'The consent banner does not provide an easy way to reject non-essential cookies.',
        riskLevel: RiskLevel.HIGH,
        recommendation: 'Add a clearly visible "Reject" or "Decline" button to the consent banner.',
      });
    }

    // Check for missing privacy policy
    if (!privacyPolicy.found) {
      issues.push({
        code: 'NO_PRIVACY_POLICY',
        title: 'No privacy policy link found',
        description: 'No link to a privacy policy was detected on the website.',
        riskLevel: RiskLevel.MEDIUM,
        recommendation: 'Add a clearly visible link to your privacy policy in the footer and consent banner.',
      });
    }

    // Check for third-party requests before consent
    const thirdPartyBeforeConsent = thirdPartyRequests.filter(r => r.beforeConsent);
    if (thirdPartyBeforeConsent.length > 10) {
      issues.push({
        code: 'EXCESSIVE_THIRD_PARTY',
        title: 'Excessive third-party requests before consent',
        description: `${thirdPartyBeforeConsent.length} third-party requests were made before user consent.`,
        riskLevel: RiskLevel.MEDIUM,
        recommendation: 'Review and minimize third-party requests that occur before user consent.',
      });
    }

    // Security issues
    
    // Check HTTPS
    if (!security.https.enabled) {
      issues.push({
        code: 'NO_HTTPS',
        title: 'Website not using HTTPS',
        description: 'The website is not served over a secure HTTPS connection.',
        riskLevel: RiskLevel.HIGH,
        recommendation: 'Enable HTTPS with a valid SSL/TLS certificate to encrypt data in transit.',
      });
    }

    // Check mixed content
    if (security.mixedContent.found) {
      issues.push({
        code: 'MIXED_CONTENT',
        title: 'Mixed content detected',
        description: `${security.mixedContent.resources.length} resource(s) are loaded over insecure HTTP on an HTTPS page.`,
        riskLevel: RiskLevel.MEDIUM,
        recommendation: 'Ensure all resources (scripts, images, stylesheets) are loaded over HTTPS.',
      });
    }

    // Check cookie security - excessive expiration
    if (security.cookieSecurity.excessiveExpiration > 0) {
      issues.push({
        code: 'COOKIE_EXCESSIVE_EXPIRATION',
        title: 'Cookies with excessive lifetime',
        description: `${security.cookieSecurity.excessiveExpiration} cookie(s) have a lifetime exceeding 13 months (CNIL guideline).`,
        riskLevel: RiskLevel.MEDIUM,
        recommendation: 'Reduce cookie lifetime to maximum 13 months as recommended by CNIL.',
      });
    }

    // Check cookie security - missing Secure flag
    if (security.cookieSecurity.withoutSecure > 0 && security.https.enabled) {
      issues.push({
        code: 'COOKIES_WITHOUT_SECURE',
        title: 'Cookies missing Secure flag',
        description: `${security.cookieSecurity.withoutSecure} cookie(s) are missing the Secure flag on an HTTPS site.`,
        riskLevel: RiskLevel.MEDIUM,
        recommendation: 'Add the Secure flag to all cookies to ensure they are only sent over HTTPS.',
      });
    }

    // Check cookie security - missing SameSite
    if (security.cookieSecurity.withoutSameSite > 3) {
      issues.push({
        code: 'COOKIES_WITHOUT_SAMESITE',
        title: 'Cookies missing SameSite attribute',
        description: `${security.cookieSecurity.withoutSameSite} cookie(s) are missing the SameSite attribute.`,
        riskLevel: RiskLevel.LOW,
        recommendation: 'Add SameSite=Lax or SameSite=Strict to cookies for CSRF protection.',
      });
    }

    // Consent Quality issues (Phase 3)
    
    // Check for pre-checked non-essential boxes
    if (consentBanner.found && consentBanner.quality.hasPreCheckedBoxes) {
      issues.push({
        code: 'PRE_CHECKED_BOXES',
        title: 'Non-essential cookies pre-selected',
        description: `Non-essential cookie categories are pre-checked: ${consentBanner.quality.preCheckedCategories.join(', ')}.`,
        riskLevel: RiskLevel.HIGH,
        recommendation: 'All non-essential cookie categories must be unchecked by default. Only "necessary" cookies can be pre-selected.',
      });
    }

    // Check for unequal button prominence
    if (consentBanner.found && !consentBanner.quality.hasEqualProminence) {
      issues.push({
        code: 'UNEQUAL_BUTTON_PROMINENCE',
        title: 'Accept and Reject buttons have unequal prominence',
        description: 'The "Accept" button is significantly more prominent than the "Reject" option, which may manipulate user choice.',
        riskLevel: RiskLevel.HIGH,
        recommendation: 'Make the "Reject" button equally visible and accessible as the "Accept" button (similar size, color, and position).',
      });
    }

    // Check for cookie wall
    if (consentBanner.found && consentBanner.quality.isCookieWall) {
      issues.push({
        code: 'COOKIE_WALL',
        title: 'Cookie wall detected',
        description: 'The website blocks access to content until cookies are accepted, with no option to reject or customize.',
        riskLevel: RiskLevel.CRITICAL,
        recommendation: 'Remove the cookie wall. Users must be able to access the website without accepting non-essential cookies.',
      });
    }

    // Check for lack of granular consent
    if (consentBanner.found && !consentBanner.quality.hasGranularConsent && consentBanner.hasAcceptButton) {
      issues.push({
        code: 'NO_GRANULAR_CONSENT',
        title: 'No granular cookie consent options',
        description: 'The consent banner does not allow users to choose which cookie categories to accept.',
        riskLevel: RiskLevel.MEDIUM,
        recommendation: 'Provide options to accept/reject different cookie categories (e.g., Analytics, Marketing, Functional).',
      });
    }

    // Privacy Policy content issues (Phase 5)
    if (privacyPolicy.found && privacyPolicy.content.analyzed) {
      // Check for missing required elements
      if (privacyPolicy.content.missingElements.length > 0) {
        issues.push({
          code: 'PRIVACY_POLICY_INCOMPLETE',
          title: 'Privacy policy missing required information',
          description: `The privacy policy is missing: ${privacyPolicy.content.missingElements.join(', ')}.`,
          riskLevel: RiskLevel.HIGH,
          recommendation: 'Update your privacy policy to include all required GDPR Art. 13-14 elements.',
        });
      }

      // Check for missing data retention info
      if (!privacyPolicy.content.hasDataRetention) {
        issues.push({
          code: 'NO_DATA_RETENTION_INFO',
          title: 'No data retention period specified',
          description: 'The privacy policy does not specify how long personal data is retained.',
          riskLevel: RiskLevel.MEDIUM,
          recommendation: 'Add clear information about data retention periods for each type of data processing.',
        });
      }

      // Check for missing right to complain
      if (!privacyPolicy.content.hasRightToComplain) {
        issues.push({
          code: 'NO_COMPLAINT_RIGHT_INFO',
          title: 'No information about right to complain',
          description: 'The privacy policy does not mention the right to lodge a complaint with a supervisory authority.',
          riskLevel: RiskLevel.MEDIUM,
          recommendation: 'Add information about the right to complain to the relevant data protection authority.',
        });
      }
    }

    // Form issues (Phase 4)
    
    // Check for forms without consent
    if (forms.formsWithoutConsent > 0) {
      issues.push({
        code: 'FORMS_WITHOUT_CONSENT',
        title: 'Data collection forms without consent checkbox',
        description: `${forms.formsWithoutConsent} form(s) collect personal data without a consent checkbox.`,
        riskLevel: RiskLevel.HIGH,
        recommendation: 'Add a consent checkbox to all forms that collect personal data (email, name, phone).',
      });
    }

    // Check for pre-checked marketing in forms
    if (forms.formsWithPreCheckedMarketing > 0) {
      issues.push({
        code: 'FORMS_PRECHECKED_MARKETING',
        title: 'Marketing consent pre-checked in forms',
        description: `${forms.formsWithPreCheckedMarketing} form(s) have marketing/newsletter consent pre-checked.`,
        riskLevel: RiskLevel.HIGH,
        recommendation: 'Marketing consent checkboxes must be unchecked by default. Users must actively opt-in.',
      });
    }

    // Check for forms without privacy policy link
    const dataFormsWithoutPrivacy = forms.dataCollectionForms - forms.formsWithPrivacyLink;
    if (dataFormsWithoutPrivacy > 0 && forms.dataCollectionForms > 0) {
      issues.push({
        code: 'FORMS_NO_PRIVACY_LINK',
        title: 'Forms missing privacy policy link',
        description: `${dataFormsWithoutPrivacy} data collection form(s) do not link to the privacy policy.`,
        riskLevel: RiskLevel.MEDIUM,
        recommendation: 'Add a link to your privacy policy near all forms that collect personal data.',
      });
    }

    // Data Transfer issues (Phase 6)
    
    // Check for high-risk US data transfers
    if (dataTransfers.highRiskTransfers.length > 0) {
      issues.push({
        code: 'US_DATA_TRANSFERS',
        title: 'Data transfers to US-based services',
        description: `${dataTransfers.highRiskTransfers.length} US-based analytics/advertising service(s) detected: ${dataTransfers.highRiskTransfers.slice(0, 5).join(', ')}${dataTransfers.highRiskTransfers.length > 5 ? '...' : ''}.`,
        riskLevel: RiskLevel.HIGH,
        recommendation: 'After Schrems II, transfers to US require additional safeguards (SCCs, supplementary measures). Consider EU-based alternatives or ensure proper legal basis.',
      });
    }

    // Check for excessive US services
    if (dataTransfers.totalUSServices > 10) {
      issues.push({
        code: 'EXCESSIVE_US_SERVICES',
        title: 'Excessive number of US-based services',
        description: `${dataTransfers.totalUSServices} US-based services detected. This increases data transfer compliance complexity.`,
        riskLevel: RiskLevel.MEDIUM,
        recommendation: 'Review and minimize the number of US-based third-party services. Consider EU-based alternatives where possible.',
      });
    }

    return issues;
  }

  private calculateOverallRisk(issues: ScanIssue[]): RiskLevel {
    if (issues.some(i => i.riskLevel === RiskLevel.CRITICAL)) {
      return RiskLevel.CRITICAL;
    }
    if (issues.some(i => i.riskLevel === RiskLevel.HIGH)) {
      return RiskLevel.HIGH;
    }
    if (issues.some(i => i.riskLevel === RiskLevel.MEDIUM)) {
      return RiskLevel.MEDIUM;
    }
    return RiskLevel.LOW;
  }

  private calculateScore(issues: ScanIssue[]): number {
    let score = 100;

    for (const issue of issues) {
      switch (issue.riskLevel) {
        case RiskLevel.CRITICAL:
          score -= 30;
          break;
        case RiskLevel.HIGH:
          score -= 20;
          break;
        case RiskLevel.MEDIUM:
          score -= 10;
          break;
        case RiskLevel.LOW:
          score -= 5;
          break;
      }
    }

    return Math.max(0, score);
  }

  async onModuleDestroy() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}
