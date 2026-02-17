import { Injectable } from '@nestjs/common';
import { Page, Response } from 'playwright';
import { RiskLevel, ScanIssue } from '../dto/scan-result.dto';

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
  score: number; // 0-100 sub-score for headers
}

const SECURITY_HEADERS = [
  'content-security-policy',
  'strict-transport-security',
  'x-frame-options',
  'x-content-type-options',
  'referrer-policy',
  'permissions-policy',
] as const;

@Injectable()
export class HeadersAnalyzer {
  async analyzeHeaders(page: Page): Promise<SecurityHeadersInfo> {
    // Get the main document response by reloading or using the last navigation response
    const response = await this.getMainResponse(page);
    const rawHeaders: Record<string, string | null> = {};

    for (const header of SECURITY_HEADERS) {
      rawHeaders[header] = response ? (response.headers()[header] ?? null) : null;
    }

    const csp = this.analyzeCSP(rawHeaders['content-security-policy']);
    const hsts = this.analyzeHSTS(rawHeaders['strict-transport-security']);
    const xFrameOptions = this.analyzeXFrameOptions(rawHeaders['x-frame-options']);
    const xContentTypeOptions = this.analyzeXContentTypeOptions(rawHeaders['x-content-type-options']);
    const referrerPolicy = this.analyzeReferrerPolicy(rawHeaders['referrer-policy']);
    const permissionsPolicy = this.analyzePermissionsPolicy(rawHeaders['permissions-policy']);

    const missingHeaders: string[] = [];
    if (!csp.present) missingHeaders.push('Content-Security-Policy');
    if (!hsts.present) missingHeaders.push('Strict-Transport-Security');
    if (!xFrameOptions.present) missingHeaders.push('X-Frame-Options');
    if (!xContentTypeOptions.present) missingHeaders.push('X-Content-Type-Options');
    if (!referrerPolicy.present) missingHeaders.push('Referrer-Policy');
    if (!permissionsPolicy.present) missingHeaders.push('Permissions-Policy');

    const score = this.calculateHeadersScore(
      csp,
      hsts,
      xFrameOptions,
      xContentTypeOptions,
      referrerPolicy,
      permissionsPolicy,
    );

    return {
      headers: rawHeaders,
      csp,
      hsts,
      xFrameOptions,
      xContentTypeOptions,
      referrerPolicy,
      permissionsPolicy,
      missingHeaders,
      score,
    };
  }

  private async getMainResponse(page: Page): Promise<Response | null> {
    try {
      const response = await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
      return response;
    } catch {
      return null;
    }
  }

  private analyzeCSP(value: string | null): SecurityHeadersInfo['csp'] {
    if (!value) {
      return {
        present: false,
        value: null,
        hasDefaultSrc: false,
        hasScriptSrc: false,
        hasUnsafeInline: false,
        hasUnsafeEval: false,
      };
    }

    const lower = value.toLowerCase();
    return {
      present: true,
      value,
      hasDefaultSrc: lower.includes('default-src'),
      hasScriptSrc: lower.includes('script-src'),
      hasUnsafeInline: lower.includes("'unsafe-inline'"),
      hasUnsafeEval: lower.includes("'unsafe-eval'"),
    };
  }

  private analyzeHSTS(value: string | null): SecurityHeadersInfo['hsts'] {
    if (!value) {
      return {
        present: false,
        value: null,
        maxAge: null,
        includesSubDomains: false,
        preload: false,
      };
    }

    const lower = value.toLowerCase();
    const maxAgeMatch = lower.match(/max-age=(\d+)/);
    const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) : null;

    return {
      present: true,
      value,
      maxAge,
      includesSubDomains: lower.includes('includesubdomains'),
      preload: lower.includes('preload'),
    };
  }

  private analyzeXFrameOptions(value: string | null): SecurityHeadersInfo['xFrameOptions'] {
    return {
      present: !!value,
      value,
    };
  }

  private analyzeXContentTypeOptions(value: string | null): SecurityHeadersInfo['xContentTypeOptions'] {
    return {
      present: !!value,
      value,
    };
  }

  private analyzeReferrerPolicy(value: string | null): SecurityHeadersInfo['referrerPolicy'] {
    return {
      present: !!value,
      value,
    };
  }

  private analyzePermissionsPolicy(value: string | null): SecurityHeadersInfo['permissionsPolicy'] {
    return {
      present: !!value,
      value,
    };
  }

  private calculateHeadersScore(
    csp: SecurityHeadersInfo['csp'],
    hsts: SecurityHeadersInfo['hsts'],
    xFrameOptions: SecurityHeadersInfo['xFrameOptions'],
    xContentTypeOptions: SecurityHeadersInfo['xContentTypeOptions'],
    referrerPolicy: SecurityHeadersInfo['referrerPolicy'],
    permissionsPolicy: SecurityHeadersInfo['permissionsPolicy'],
  ): number {
    let score = 0;
    const maxScore = 100;

    // CSP: 30 points (most important)
    if (csp.present) {
      score += 15;
      if (csp.hasDefaultSrc) score += 5;
      if (csp.hasScriptSrc) score += 5;
      if (!csp.hasUnsafeInline) score += 3;
      if (!csp.hasUnsafeEval) score += 2;
    }

    // HSTS: 25 points
    if (hsts.present) {
      score += 10;
      if (hsts.maxAge && hsts.maxAge >= 31536000) score += 8; // >= 1 year
      if (hsts.includesSubDomains) score += 4;
      if (hsts.preload) score += 3;
    }

    // X-Frame-Options: 15 points
    if (xFrameOptions.present) score += 15;

    // X-Content-Type-Options: 10 points
    if (xContentTypeOptions.present) score += 10;

    // Referrer-Policy: 10 points
    if (referrerPolicy.present) score += 10;

    // Permissions-Policy: 10 points
    if (permissionsPolicy.present) score += 10;

    return Math.min(score, maxScore);
  }

  static generateIssues(headersInfo: SecurityHeadersInfo): ScanIssue[] {
    const issues: ScanIssue[] = [];

    // No security headers at all
    if (headersInfo.missingHeaders.length >= 5) {
      issues.push({
        code: 'NO_SECURITY_HEADERS',
        title: 'Most security headers are missing',
        description: `${headersInfo.missingHeaders.length} of 6 recommended security headers are missing: ${headersInfo.missingHeaders.join(', ')}.`,
        riskLevel: RiskLevel.HIGH,
        recommendation:
          'Implement security headers: Content-Security-Policy, Strict-Transport-Security, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, and Permissions-Policy.',
      });
      return issues; // Don't add individual header issues if most are missing
    }

    // Missing CSP
    if (!headersInfo.csp.present) {
      issues.push({
        code: 'MISSING_CSP',
        title: 'Content-Security-Policy header is missing',
        description:
          'The Content-Security-Policy (CSP) header is not set. CSP helps prevent XSS attacks and unauthorized data exfiltration, which is relevant for GDPR data protection.',
        riskLevel: RiskLevel.MEDIUM,
        recommendation:
          "Add a Content-Security-Policy header with at least default-src 'self' and appropriate script-src directives.",
      });
    } else if (headersInfo.csp.hasUnsafeInline && headersInfo.csp.hasUnsafeEval) {
      issues.push({
        code: 'WEAK_CSP',
        title: 'Content-Security-Policy uses unsafe directives',
        description:
          "The CSP header contains both 'unsafe-inline' and 'unsafe-eval', which significantly weakens its protection against XSS attacks.",
        riskLevel: RiskLevel.LOW,
        recommendation:
          "Remove 'unsafe-inline' and 'unsafe-eval' from CSP. Use nonces or hashes for inline scripts instead.",
      });
    }

    // Missing HSTS
    if (!headersInfo.hsts.present) {
      issues.push({
        code: 'MISSING_HSTS',
        title: 'Strict-Transport-Security header is missing',
        description:
          'The HSTS header is not set. Without HSTS, users may be vulnerable to protocol downgrade attacks and cookie hijacking.',
        riskLevel: RiskLevel.MEDIUM,
        recommendation:
          'Add Strict-Transport-Security header with max-age of at least 31536000 (1 year) and includeSubDomains.',
      });
    } else if (headersInfo.hsts.maxAge !== null && headersInfo.hsts.maxAge < 31536000) {
      issues.push({
        code: 'WEAK_HSTS',
        title: 'HSTS max-age is too short',
        description: `The HSTS max-age is set to ${headersInfo.hsts.maxAge} seconds (${Math.round(headersInfo.hsts.maxAge / 86400)} days). Recommended minimum is 1 year (31536000 seconds).`,
        riskLevel: RiskLevel.LOW,
        recommendation:
          'Increase HSTS max-age to at least 31536000 (1 year) and consider adding includeSubDomains and preload.',
      });
    }

    // Missing X-Frame-Options
    if (!headersInfo.xFrameOptions.present) {
      issues.push({
        code: 'MISSING_X_FRAME_OPTIONS',
        title: 'X-Frame-Options header is missing',
        description:
          'The X-Frame-Options header is not set. This makes the site vulnerable to clickjacking attacks.',
        riskLevel: RiskLevel.LOW,
        recommendation:
          "Add X-Frame-Options: DENY or SAMEORIGIN header, or use CSP frame-ancestors directive.",
      });
    }

    // Missing X-Content-Type-Options
    if (!headersInfo.xContentTypeOptions.present) {
      issues.push({
        code: 'MISSING_X_CONTENT_TYPE_OPTIONS',
        title: 'X-Content-Type-Options header is missing',
        description:
          'The X-Content-Type-Options header is not set. Browsers may MIME-sniff responses, potentially executing malicious content.',
        riskLevel: RiskLevel.LOW,
        recommendation: 'Add X-Content-Type-Options: nosniff header.',
      });
    }

    // Missing Referrer-Policy
    if (!headersInfo.referrerPolicy.present) {
      issues.push({
        code: 'MISSING_REFERRER_POLICY',
        title: 'Referrer-Policy header is missing',
        description:
          'The Referrer-Policy header is not set. Without it, the browser may send the full URL (including query parameters with personal data) to third parties via the Referer header.',
        riskLevel: RiskLevel.LOW,
        recommendation:
          'Add Referrer-Policy: strict-origin-when-cross-origin or no-referrer to prevent leaking sensitive URL data to third parties.',
      });
    }

    // Missing Permissions-Policy
    if (!headersInfo.permissionsPolicy.present) {
      issues.push({
        code: 'MISSING_PERMISSIONS_POLICY',
        title: 'Permissions-Policy header is missing',
        description:
          'The Permissions-Policy header is not set. Third-party scripts may access browser features like camera, microphone, or geolocation without restriction.',
        riskLevel: RiskLevel.LOW,
        recommendation:
          'Add a Permissions-Policy header to restrict access to sensitive browser features (camera, microphone, geolocation, etc.).',
      });
    }

    return issues;
  }
}
