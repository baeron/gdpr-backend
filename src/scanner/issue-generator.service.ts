import { Injectable } from '@nestjs/common';
import {
  RiskLevel,
  ScanIssue,
  CookieInfo,
  ThirdPartyRequest,
  ConsentBannerInfo,
  PrivacyPolicyInfo,
  FormsAnalysisResult,
  DataTransferInfo,
  SecurityHeadersInfo,
  SslCertificateInfo,
} from './dto/scan-result.dto';
import { SecurityInfo } from './analyzers/security.analyzer';
import { CookieAnalyzer } from './analyzers/cookie.analyzer';
import { TrackerAnalyzer } from './analyzers/tracker.analyzer';
import { ConsentAnalyzer } from './analyzers/consent.analyzer';
import { PrivacyPolicyAnalyzer } from './analyzers/privacy-policy.analyzer';
import { SecurityAnalyzer } from './analyzers/security.analyzer';
import { FormAnalyzer } from './analyzers/form.analyzer';
import { DataTransferAnalyzer } from './analyzers/data-transfer.analyzer';
import { HeadersAnalyzer } from './analyzers/headers.analyzer';
import { SslAnalyzer } from './analyzers/ssl.analyzer';

/**
 * Generates GDPR compliance issues from scan analysis results.
 *
 * Delegates issue generation to each analyzer's static generateIssues() method (OCP).
 * Adding a new analyzer only requires calling its generateIssues() here — no logic duplication.
 *
 * The only issue type that doesn't belong to a specific analyzer is EXCESSIVE_THIRD_PARTY,
 * which is handled directly here as it spans multiple analyzers.
 */
@Injectable()
export class IssueGeneratorService {
  /**
   * Generate all issues from scan results by delegating to analyzer-specific generators.
   */
  generateIssues(
    cookies: CookieInfo[],
    trackers: { loadedBeforeConsent: boolean; name: string; type: string }[],
    thirdPartyRequests: ThirdPartyRequest[],
    consentBanner: ConsentBannerInfo,
    privacyPolicy: PrivacyPolicyInfo,
    security: SecurityInfo,
    forms: FormsAnalysisResult,
    dataTransfers: DataTransferInfo,
    securityHeaders?: SecurityHeadersInfo,
    sslCertificate?: SslCertificateInfo,
  ): ScanIssue[] {
    return [
      ...CookieAnalyzer.generateIssues(cookies),
      ...TrackerAnalyzer.generateIssues(trackers),
      ...ConsentAnalyzer.generateIssues(consentBanner),
      ...PrivacyPolicyAnalyzer.generateIssues(privacyPolicy),
      ...this.checkThirdPartyIssues(thirdPartyRequests),
      ...SecurityAnalyzer.generateIssues(security),
      ...FormAnalyzer.generateIssues(forms),
      ...DataTransferAnalyzer.generateIssues(dataTransfers),
      ...(securityHeaders ? HeadersAnalyzer.generateIssues(securityHeaders) : []),
      ...(sslCertificate ? SslAnalyzer.generateIssues(sslCertificate) : []),
    ];
  }

  private checkThirdPartyIssues(
    thirdPartyRequests: ThirdPartyRequest[],
  ): ScanIssue[] {
    const issues: ScanIssue[] = [];
    const thirdPartyBeforeConsent = thirdPartyRequests.filter(
      (r) => r.beforeConsent,
    );
    if (thirdPartyBeforeConsent.length > 10) {
      issues.push({
        code: 'EXCESSIVE_THIRD_PARTY',
        title: 'Excessive third-party requests before consent',
        description: `${thirdPartyBeforeConsent.length} third-party requests were made before user consent.`,
        riskLevel: RiskLevel.MEDIUM,
        recommendation:
          'Review and minimize third-party requests that occur before user consent.',
      });
    }
    return issues;
  }
}
