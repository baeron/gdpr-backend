import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ScanResultDto, RiskLevel } from './dto/scan-result.dto';

// Issue category mapping
const ISSUE_CATEGORY_MAP: Record<string, string> = {
  COOKIES_BEFORE_CONSENT: 'COOKIES',
  COOKIE_EXCESSIVE_EXPIRATION: 'COOKIES',
  COOKIES_WITHOUT_SECURE: 'COOKIES',
  COOKIES_WITHOUT_HTTPONLY: 'COOKIES',
  TRACKERS_BEFORE_CONSENT: 'TRACKERS',
  NO_CONSENT_BANNER: 'CONSENT',
  NO_REJECT_OPTION: 'CONSENT',
  PRECHECKED_CONSENT: 'CONSENT',
  UNEQUAL_BUTTON_PROMINENCE: 'CONSENT',
  COOKIE_WALL_DETECTED: 'CONSENT',
  NO_GRANULAR_CONSENT: 'CONSENT',
  CLOSE_ACCEPTS_ALL: 'CONSENT',
  NO_PRIVACY_POLICY: 'PRIVACY_POLICY',
  PRIVACY_POLICY_INCOMPLETE: 'PRIVACY_POLICY',
  NO_DATA_RETENTION_INFO: 'PRIVACY_POLICY',
  NO_COMPLAINT_RIGHT_INFO: 'PRIVACY_POLICY',
  NO_HTTPS: 'SECURITY',
  MIXED_CONTENT: 'SECURITY',
  FORMS_WITHOUT_CONSENT: 'FORMS',
  FORMS_PRECHECKED_MARKETING: 'FORMS',
  FORMS_NO_PRIVACY_LINK: 'FORMS',
  US_DATA_TRANSFERS: 'DATA_TRANSFER',
  EXCESSIVE_US_SERVICES: 'DATA_TRANSFER',
  EXCESSIVE_THIRD_PARTY: 'OTHER',
};

// Effort and cost estimates per issue type
const ISSUE_ESTIMATES: Record<string, { effort: string; cost: string }> = {
  COOKIES_BEFORE_CONSENT: { effort: '2-4', cost: '€150-300' },
  TRACKERS_BEFORE_CONSENT: { effort: '2-4', cost: '€150-300' },
  NO_CONSENT_BANNER: { effort: '4-8', cost: '€300-600' },
  NO_REJECT_OPTION: { effort: '1-2', cost: '€100-200' },
  PRECHECKED_CONSENT: { effort: '1-2', cost: '€75-150' },
  UNEQUAL_BUTTON_PROMINENCE: { effort: '1-2', cost: '€75-150' },
  COOKIE_WALL_DETECTED: { effort: '2-4', cost: '€150-300' },
  NO_GRANULAR_CONSENT: { effort: '2-4', cost: '€150-300' },
  CLOSE_ACCEPTS_ALL: { effort: '1-2', cost: '€75-150' },
  NO_PRIVACY_POLICY: { effort: '4-8', cost: '€300-600' },
  PRIVACY_POLICY_INCOMPLETE: { effort: '2-4', cost: '€150-300' },
  NO_DATA_RETENTION_INFO: { effort: '1-2', cost: '€100-150' },
  NO_COMPLAINT_RIGHT_INFO: { effort: '1-2', cost: '€100-150' },
  NO_HTTPS: { effort: '2-4', cost: '€100-200' },
  MIXED_CONTENT: { effort: '1-2', cost: '€75-150' },
  COOKIE_EXCESSIVE_EXPIRATION: { effort: '1-2', cost: '€75-150' },
  COOKIES_WITHOUT_SECURE: { effort: '1-2', cost: '€75-150' },
  COOKIES_WITHOUT_HTTPONLY: { effort: '1-2', cost: '€75-150' },
  FORMS_WITHOUT_CONSENT: { effort: '1-2', cost: '€50-100' },
  FORMS_PRECHECKED_MARKETING: { effort: '0.5-1', cost: '€50-75' },
  FORMS_NO_PRIVACY_LINK: { effort: '0.5-1', cost: '€50-75' },
  US_DATA_TRANSFERS: { effort: '4-8', cost: '€300-600' },
  EXCESSIVE_US_SERVICES: { effort: '2-4', cost: '€150-300' },
  EXCESSIVE_THIRD_PARTY: { effort: '2-4', cost: '€150-300' },
};

// Code examples for common issues
const CODE_EXAMPLES: Record<string, string> = {
  COOKIES_BEFORE_CONSENT: `// Wait for consent before setting cookies
if (userConsent.analytics) {
  gtag('consent', 'update', {
    'analytics_storage': 'granted'
  });
}`,
  NO_REJECT_OPTION: `<div class="cookie-buttons">
  <button class="btn-secondary">Reject All</button>
  <button class="btn-secondary">Manage</button>
  <button class="btn-primary">Accept All</button>
</div>`,
  FORMS_WITHOUT_CONSENT: `<label class="consent-checkbox">
  <input type="checkbox" required name="privacy_consent">
  I agree to the <a href="/privacy-policy">Privacy Policy</a>
</label>`,
  TRACKERS_BEFORE_CONSENT: `// Only initialize after consent
if (userConsent.marketing) {
  fbq('init', 'YOUR_PIXEL_ID');
  fbq('track', 'PageView');
}`,
};

@Injectable()
export class ScannerReportService {
  private readonly logger = new Logger(ScannerReportService.name);

  constructor(private readonly prisma: PrismaService) {}

  async saveScanResult(
    scanResult: ScanResultDto,
    auditRequestId?: string,
  ): Promise<string> {
    this.logger.log(`Saving scan result for ${scanResult.websiteUrl}`);

    const prismaRiskLevel = this.mapRiskLevel(scanResult.overallRiskLevel);

    // Create the audit report with issues
    // Using 'as any' to bypass Prisma client cache issues in IDE
    const report = await (this.prisma.auditReport as any).create({
      data: {
        auditRequestId: auditRequestId ?? undefined,
        websiteUrl: scanResult.websiteUrl,
        scanDurationMs: scanResult.scanDurationMs,
        overallScore: scanResult.score,
        riskLevel: prismaRiskLevel,
        cookies: scanResult.cookies,
        trackers: scanResult.trackers,
        thirdPartyRequests: scanResult.thirdPartyRequests,
        consentBanner: scanResult.consentBanner,
        privacyPolicy: scanResult.privacyPolicy,
        security: scanResult.security,
        forms: scanResult.forms,
        dataTransfers: scanResult.dataTransfers,
        technologies: scanResult.technologies,
        scannedAt: scanResult.scanDate,
        issues: {
          create: scanResult.issues.map((issue) => ({
            code: issue.code,
            category: ISSUE_CATEGORY_MAP[issue.code] || 'OTHER',
            title: issue.title,
            description: issue.description,
            riskLevel: this.mapRiskLevel(issue.riskLevel),
            evidence: this.generateEvidence(issue.code, scanResult),
            recommendation: issue.recommendation,
            codeExample: CODE_EXAMPLES[issue.code] || null,
            effortHours: ISSUE_ESTIMATES[issue.code]?.effort || '1-2',
            estimatedCost: ISSUE_ESTIMATES[issue.code]?.cost || '€75-150',
          })),
        },
      },
      include: {
        issues: true,
      },
    });

    this.logger.log(`Saved report ${report.id} with ${report.issues.length} issues`);
    return report.id;
  }

  async getReport(reportId: string) {
    return (this.prisma.auditReport as any).findUnique({
      where: { id: reportId },
      include: {
        issues: {
          orderBy: [
            { riskLevel: 'desc' },
            { category: 'asc' },
          ],
        },
        auditRequest: true,
      },
    });
  }

  async getReportByAuditRequest(auditRequestId: string) {
    return (this.prisma.auditReport as any).findUnique({
      where: { auditRequestId },
      include: {
        issues: {
          orderBy: [
            { riskLevel: 'desc' },
            { category: 'asc' },
          ],
        },
      },
    });
  }

  async getReportsByWebsite(websiteUrl: string, limit = 10) {
    return (this.prisma.auditReport as any).findMany({
      where: { websiteUrl: { contains: websiteUrl } },
      orderBy: { scannedAt: 'desc' },
      take: limit,
      include: {
        issues: true,
      },
    });
  }

  async updateIssueStatus(
    issueId: string,
    status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'WONT_FIX',
  ) {
    return (this.prisma as any).scanIssue.update({
      where: { id: issueId },
      data: {
        status,
        resolvedAt: status === 'RESOLVED' ? new Date() : null,
      },
    });
  }

  private mapRiskLevel(level: RiskLevel): string {
    const mapping: Record<RiskLevel, string> = {
      [RiskLevel.CRITICAL]: 'CRITICAL',
      [RiskLevel.HIGH]: 'HIGH',
      [RiskLevel.MEDIUM]: 'MEDIUM',
      [RiskLevel.LOW]: 'LOW',
    };
    return mapping[level] || 'UNKNOWN';
  }

  private generateEvidence(code: string, scanResult: ScanResultDto): string {
    switch (code) {
      case 'COOKIES_BEFORE_CONSENT': {
        const cookies = scanResult.cookies.list
          .filter(c => c.setBeforeConsent && c.category !== 'necessary')
          .slice(0, 5)
          .map(c => c.name);
        return `Non-essential cookies set before consent: ${cookies.join(', ')}`;
      }
      
      case 'TRACKERS_BEFORE_CONSENT': {
        const trackers = scanResult.trackers.list
          .filter(t => t.loadedBeforeConsent)
          .slice(0, 5)
          .map(t => t.name);
        return `Trackers loaded before consent: ${trackers.join(', ')}`;
      }
      
      case 'NO_REJECT_OPTION':
        return 'Cookie banner does not include a "Reject All" or equivalent button.';
      
      case 'UNEQUAL_BUTTON_PROMINENCE':
        return 'Accept button is more prominent than reject/settings options.';
      
      case 'NO_PRIVACY_POLICY':
        return 'No privacy policy link found on the website.';
      
      case 'PRIVACY_POLICY_INCOMPLETE': {
        const missing: string[] = [];
        const content = scanResult.privacyPolicy.content;
        if (content) {
          if (!content.hasDataController) missing.push('Data Controller');
          if (!content.hasDPOContact) missing.push('DPO Contact');
          if (!content.hasLegalBasis) missing.push('Legal Basis');
          if (!content.hasUserRights) missing.push('User Rights');
        }
        return `Privacy policy missing required elements: ${missing.join(', ')}`;
      }
      
      case 'US_DATA_TRANSFERS': {
        const services = scanResult.dataTransfers.highRiskTransfers.slice(0, 5);
        return `US-based services detected: ${services.join(', ')}`;
      }
      
      case 'FORMS_WITHOUT_CONSENT': {
        const count = scanResult.forms.formsWithoutConsent;
        return `${count} form(s) collecting personal data without consent checkbox.`;
      }
      
      case 'NO_HTTPS':
        return 'Website is not served over HTTPS.';
      
      case 'MIXED_CONTENT':
        return 'HTTPS page loads resources over insecure HTTP.';
      
      default:
        return '';
    }
  }
}
