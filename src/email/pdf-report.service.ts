import { Injectable, Logger } from '@nestjs/common';
import PDFDocument = require('pdfkit');
import {
  ScanResultDto,
  ScanIssue,
  RiskLevel,
} from '../scanner/dto/scan-result.dto';

/**
 * Options for PDF report generation.
 *
 * - 'free': Short overview — score, category statuses, top-5 issue titles, upgrade CTA.
 *           Sent via email after free scan. No detailed descriptions/recommendations.
 * - 'full': Complete report — all issues with descriptions, recommendations,
 *           priority action plan. Available after payment (€99).
 */
export interface PdfReportOptions {
  mode: 'free' | 'full';
  /** URL for the upgrade CTA button (free mode only) */
  upgradeUrl?: string;
  /** Report ID for reference */
  reportId?: string;
}

/**
 * PDF Report color palette — matches email brand colors.
 */
const COLORS = {
  primary: '#2563eb',
  success: '#059669',
  warning: '#d97706',
  danger: '#dc2626',
  textPrimary: '#18181b',
  textSecondary: '#52525b',
  textMuted: '#a1a1aa',
  border: '#e4e4e7',
  background: '#f4f4f5',
  white: '#ffffff',
} as const;

/**
 * Map RiskLevel to display color.
 */
function riskColor(level: RiskLevel): string {
  switch (level) {
    case RiskLevel.CRITICAL:
      return COLORS.danger;
    case RiskLevel.HIGH:
      return COLORS.danger;
    case RiskLevel.MEDIUM:
      return COLORS.warning;
    case RiskLevel.LOW:
      return COLORS.success;
    default:
      return COLORS.textMuted;
  }
}

/**
 * Map score to color.
 */
function scoreColor(score: number): string {
  if (score >= 80) return COLORS.success;
  if (score >= 60) return COLORS.warning;
  return COLORS.danger;
}

/**
 * Map score to label.
 */
function scoreLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Needs Improvement';
  return 'Critical';
}

/**
 * Service for generating GDPR compliance PDF reports from scan results.
 *
 * AC:
 * - PDF contains logo, summary, and top-5 issues
 * - Generation completes in ≤ 10 seconds
 *
 * Uses PDFKit (pure Node.js, no headless browser required).
 */
@Injectable()
export class PdfReportService {
  private readonly logger = new Logger(PdfReportService.name);

  /**
   * Generate a PDF report buffer from scan results.
   * Returns a Buffer that can be attached to an email or saved to disk.
   *
   * @param scanResult - The scan result data
   * @param options - Report options (mode: 'free' | 'full'). Defaults to 'free'.
   */
  async generateReport(
    scanResult: ScanResultDto,
    options: PdfReportOptions = { mode: 'free' },
  ): Promise<Buffer> {
    const startTime = Date.now();
    const { mode } = options;

    return new Promise<Buffer>((resolve, reject) => {
      try {
        const titleSuffix = mode === 'full' ? 'Full Audit' : 'Overview';
        const doc = new PDFDocument({
          size: 'A4',
          margins: { top: 50, bottom: 50, left: 50, right: 50 },
          info: {
            Title: `GDPR Compliance Report (${titleSuffix}) — ${scanResult.websiteUrl}`,
            Author: 'PolicyTracker',
            Subject: 'GDPR Compliance Audit Report',
            Creator: 'PolicyTracker (policytracker.eu)',
          },
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => {
          const buffer = Buffer.concat(chunks);
          const durationMs = Date.now() - startTime;
          this.logger.log(
            `PDF [${mode}] generated for ${scanResult.websiteUrl} in ${durationMs}ms (${(buffer.length / 1024).toFixed(1)} KB)`,
          );
          resolve(buffer);
        });
        doc.on('error', reject);

        this.renderHeader(doc, scanResult, mode);
        this.renderScoreSummary(doc, scanResult);
        this.renderKeyFindings(doc, scanResult);

        if (mode === 'full') {
          this.renderPriorityActionPlan(doc, scanResult.issues);
          this.renderAllIssuesDetailed(doc, scanResult.issues);
        } else {
          this.renderTopIssues(doc, scanResult.issues);
          this.renderUpgradeCta(doc, options.upgradeUrl);
        }

        this.renderFooter(doc, scanResult, options.reportId);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Render the header with branding.
   */
  private renderHeader(doc: PDFKit.PDFDocument, scanResult: ScanResultDto, mode: 'free' | 'full'): void {
    // Brand name
    doc
      .fontSize(24)
      .fillColor(COLORS.primary)
      .text('🛡️ PolicyTracker', { align: 'left' });

    doc.moveDown(0.3);

    // Title with badge
    const title = mode === 'full' ? 'GDPR Compliance Audit Report' : 'GDPR Compliance Overview';
    const badge = mode === 'full' ? '  [Full Report]' : '  [Free Report]';
    doc
      .fontSize(18)
      .fillColor(COLORS.textPrimary)
      .text(title, { continued: true })
      .fontSize(10)
      .fillColor(mode === 'full' ? COLORS.success : COLORS.textMuted)
      .text(badge);

    doc.moveDown(0.3);

    // Website URL and date
    doc
      .fontSize(11)
      .fillColor(COLORS.textSecondary)
      .text(`Website: ${scanResult.websiteUrl}`, { continued: true })
      .text(
        `    Scan date: ${new Date(scanResult.scanDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`,
        { align: 'right' },
      );

    // Divider
    doc.moveDown(0.8);
    this.drawDivider(doc);
    doc.moveDown(0.8);
  }

  /**
   * Render the score summary section.
   */
  private renderScoreSummary(doc: PDFKit.PDFDocument, scanResult: ScanResultDto): void {
    const { score, overallRiskLevel, issues } = scanResult;
    const color = scoreColor(score);
    const label = scoreLabel(score);

    // Score circle (simulated with text)
    doc
      .fontSize(48)
      .fillColor(color)
      .text(`${score}`, 50, doc.y, { width: 100, align: 'center' });

    const scoreY = doc.y;

    doc
      .fontSize(11)
      .fillColor(color)
      .text(`/ 100`, 50, scoreY, { width: 100, align: 'center' });

    doc.moveDown(0.3);

    doc
      .fontSize(13)
      .fillColor(color)
      .text(label.toUpperCase(), 50, doc.y, { width: 100, align: 'center' });

    // Summary stats on the right
    const statsX = 200;
    const statsY = scoreY - 60;

    doc
      .fontSize(12)
      .fillColor(COLORS.textPrimary)
      .text('Summary', statsX, statsY, { underline: true });

    const statsStartY = statsY + 22;
    const lineHeight = 20;

    const stats = [
      { label: 'Overall Risk Level', value: overallRiskLevel, color: riskColor(overallRiskLevel) },
      { label: 'Total Issues', value: `${issues.length}`, color: COLORS.textPrimary },
      {
        label: 'Critical / High',
        value: `${issues.filter((i) => i.riskLevel === RiskLevel.CRITICAL).length} / ${issues.filter((i) => i.riskLevel === RiskLevel.HIGH).length}`,
        color: COLORS.danger,
      },
      { label: 'Cookies (before consent)', value: `${scanResult.cookies.beforeConsent} of ${scanResult.cookies.total}`, color: COLORS.textPrimary },
      { label: 'Trackers (before consent)', value: `${scanResult.trackers.beforeConsent} of ${scanResult.trackers.total}`, color: COLORS.textPrimary },
      { label: 'Consent Banner', value: scanResult.consentBanner.found ? 'Found' : 'Not Found', color: scanResult.consentBanner.found ? COLORS.success : COLORS.danger },
      { label: 'Privacy Policy', value: scanResult.privacyPolicy.found ? 'Found' : 'Not Found', color: scanResult.privacyPolicy.found ? COLORS.success : COLORS.danger },
      { label: 'HTTPS', value: scanResult.security.https.enabled ? 'Enabled' : 'Disabled', color: scanResult.security.https.enabled ? COLORS.success : COLORS.danger },
    ];

    stats.forEach((stat, i) => {
      const y = statsStartY + i * lineHeight;
      doc
        .fontSize(10)
        .fillColor(COLORS.textSecondary)
        .text(stat.label, statsX, y, { width: 180 });
      doc
        .fontSize(10)
        .fillColor(stat.color)
        .text(stat.value, statsX + 180, y, { width: 120 });
    });

    // Move below the stats
    doc.y = statsStartY + stats.length * lineHeight + 10;
    doc.x = 50;

    this.drawDivider(doc);
    doc.moveDown(0.8);
  }

  /**
   * Render key findings section.
   */
  private renderKeyFindings(doc: PDFKit.PDFDocument, scanResult: ScanResultDto): void {
    doc
      .fontSize(14)
      .fillColor(COLORS.textPrimary)
      .text('Key Findings', { underline: true });

    doc.moveDown(0.5);

    const findings: { label: string; status: string; ok: boolean }[] = [
      {
        label: 'Consent Banner',
        status: scanResult.consentBanner.found
          ? scanResult.consentBanner.hasRejectButton
            ? '✅ Found with reject option'
            : '⚠️ Found but no reject option'
          : '❌ Not found',
        ok: scanResult.consentBanner.found && scanResult.consentBanner.hasRejectButton,
      },
      {
        label: 'Privacy Policy',
        status: scanResult.privacyPolicy.found
          ? `✅ Found${scanResult.privacyPolicy.content.analyzed ? ` (${scanResult.privacyPolicy.content.detectedElements.length} elements detected)` : ''}`
          : '❌ Not found',
        ok: scanResult.privacyPolicy.found,
      },
      {
        label: 'Cookies Before Consent',
        status: scanResult.cookies.beforeConsent === 0
          ? '✅ None'
          : `⚠️ ${scanResult.cookies.beforeConsent} cookie(s) set before consent`,
        ok: scanResult.cookies.beforeConsent === 0,
      },
      {
        label: 'Trackers Before Consent',
        status: scanResult.trackers.beforeConsent === 0
          ? '✅ None'
          : `⚠️ ${scanResult.trackers.beforeConsent} tracker(s) loaded before consent`,
        ok: scanResult.trackers.beforeConsent === 0,
      },
      {
        label: 'HTTPS',
        status: scanResult.security.https.enabled ? '✅ Enabled' : '❌ Not enabled',
        ok: scanResult.security.https.enabled,
      },
      {
        label: 'US Data Transfers',
        status: scanResult.dataTransfers.totalUSServices === 0
          ? '✅ None detected'
          : `⚠️ ${scanResult.dataTransfers.totalUSServices} US service(s) detected`,
        ok: scanResult.dataTransfers.totalUSServices === 0,
      },
    ];

    findings.forEach((f) => {
      doc
        .fontSize(10)
        .fillColor(COLORS.textSecondary)
        .text(`${f.label}: `, { continued: true })
        .fillColor(f.ok ? COLORS.success : COLORS.warning)
        .text(f.status);
      doc.moveDown(0.2);
    });

    doc.moveDown(0.5);
    this.drawDivider(doc);
    doc.moveDown(0.8);
  }

  /**
   * Render top-5 issues section (free mode — titles + severity only, no details).
   */
  private renderTopIssues(doc: PDFKit.PDFDocument, issues: ScanIssue[]): void {
    doc
      .fontSize(14)
      .fillColor(COLORS.textPrimary)
      .text('Top Issues', { underline: true });

    doc.moveDown(0.5);

    if (issues.length === 0) {
      doc
        .fontSize(11)
        .fillColor(COLORS.success)
        .text('🎉 No GDPR compliance issues detected. Great job!');
      doc.moveDown(1);
      return;
    }

    const sorted = this.sortIssuesBySeverity(issues);
    const topIssues = sorted.slice(0, 5);

    topIssues.forEach((issue, index) => {
      if (doc.y > 700) doc.addPage();

      const color = riskColor(issue.riskLevel);

      // Issue number + severity badge + title only
      doc
        .fontSize(11)
        .fillColor(color)
        .text(`${index + 1}. [${issue.riskLevel}] ${issue.title}`);

      // Short description only (no recommendation in free mode)
      doc
        .fontSize(9)
        .fillColor(COLORS.textSecondary)
        .text(issue.description, { indent: 16 });

      doc.moveDown(0.4);
    });

    if (issues.length > 5) {
      doc
        .fontSize(9)
        .fillColor(COLORS.textMuted)
        .text(`... and ${issues.length - 5} more issue(s). Upgrade to the Full Report for details and recommendations.`);
    }

    doc.moveDown(0.5);
  }

  /**
   * Render upgrade CTA block (free mode only).
   */
  private renderUpgradeCta(doc: PDFKit.PDFDocument, upgradeUrl?: string): void {
    doc.moveDown(0.5);
    this.drawDivider(doc);
    doc.moveDown(0.8);

    doc
      .fontSize(16)
      .fillColor(COLORS.primary)
      .text('Get the Full Audit Report', { align: 'center' });

    doc.moveDown(0.4);

    doc
      .fontSize(10)
      .fillColor(COLORS.textSecondary)
      .text(
        'Unlock detailed findings, specific code examples, step-by-step fix instructions, ' +
          'effort & cost estimates, and a priority action plan.',
        { align: 'center' },
      );

    doc.moveDown(0.5);

    const features = [
      '✅ Detailed issue descriptions with evidence',
      '✅ Copy-paste code fixes for each issue',
      '✅ Time & cost estimates per fix',
      '✅ Priority action plan',
      '✅ 30-minute consultation call',
    ];

    features.forEach((f) => {
      doc.fontSize(10).fillColor(COLORS.textPrimary).text(f, { align: 'center' });
    });

    doc.moveDown(0.5);

    doc
      .fontSize(20)
      .fillColor(COLORS.primary)
      .text('€99', { align: 'center' });

    doc
      .fontSize(9)
      .fillColor(COLORS.textMuted)
      .text('One-time payment · VAT included · Invoice provided', { align: 'center' });

    if (upgradeUrl) {
      doc.moveDown(0.3);
      doc
        .fontSize(10)
        .fillColor(COLORS.primary)
        .text(upgradeUrl, { align: 'center', link: upgradeUrl, underline: true });
    }

    doc.moveDown(1);
  }

  /**
   * Render priority action plan table (full mode only).
   */
  private renderPriorityActionPlan(doc: PDFKit.PDFDocument, issues: ScanIssue[]): void {
    doc
      .fontSize(14)
      .fillColor(COLORS.textPrimary)
      .text('Priority Action Plan', { underline: true });

    doc.moveDown(0.5);

    if (issues.length === 0) {
      doc
        .fontSize(11)
        .fillColor(COLORS.success)
        .text('🎉 No GDPR compliance issues detected. Great job!');
      doc.moveDown(1);
      this.drawDivider(doc);
      doc.moveDown(0.8);
      return;
    }

    const sorted = this.sortIssuesBySeverity(issues).slice(0, 10);

    // Table header
    const colX = { priority: 50, issue: 120, severity: 420 };
    doc
      .fontSize(9)
      .fillColor(COLORS.textMuted)
      .text('#', colX.priority, doc.y)
      .text('Issue', colX.issue, doc.y - 11)
      .text('Severity', colX.severity, doc.y - 11);

    doc.moveDown(0.3);
    this.drawDivider(doc);
    doc.moveDown(0.3);

    sorted.forEach((issue, i) => {
      if (doc.y > 720) doc.addPage();

      const y = doc.y;
      const color = riskColor(issue.riskLevel);

      doc.fontSize(9).fillColor(COLORS.textSecondary).text(`${i + 1}`, colX.priority, y);
      doc.fontSize(9).fillColor(COLORS.textPrimary).text(issue.title, colX.issue, y, { width: 290 });
      doc.fontSize(9).fillColor(color).text(issue.riskLevel, colX.severity, y);

      doc.y = Math.max(doc.y, y + 14);
      doc.moveDown(0.2);
    });

    if (issues.length > 10) {
      doc
        .fontSize(9)
        .fillColor(COLORS.textMuted)
        .text(`... and ${issues.length - 10} more issue(s) listed below.`);
    }

    doc.moveDown(0.5);
    this.drawDivider(doc);
    doc.moveDown(0.8);
  }

  /**
   * Render all issues with full details (full mode only).
   * Includes: description, recommendation, evidence placeholder.
   */
  private renderAllIssuesDetailed(doc: PDFKit.PDFDocument, issues: ScanIssue[]): void {
    if (issues.length === 0) return;

    doc
      .fontSize(14)
      .fillColor(COLORS.textPrimary)
      .text('Detailed Findings', { underline: true });

    doc.moveDown(0.5);

    const sorted = this.sortIssuesBySeverity(issues);

    sorted.forEach((issue, index) => {
      if (doc.y > 680) doc.addPage();

      const color = riskColor(issue.riskLevel);

      // Issue header
      doc
        .fontSize(11)
        .fillColor(color)
        .text(`${index + 1}. [${issue.riskLevel}] ${issue.title}`);

      // Description
      doc
        .fontSize(9)
        .fillColor(COLORS.textSecondary)
        .text(issue.description, { indent: 16 });

      // Recommendation
      doc
        .fontSize(9)
        .fillColor(COLORS.textMuted)
        .text(`💡 Recommendation: ${issue.recommendation}`, { indent: 16 });

      doc.moveDown(0.5);
    });

    doc.moveDown(0.5);
  }

  /**
   * Render footer with disclaimer and branding.
   */
  private renderFooter(doc: PDFKit.PDFDocument, scanResult: ScanResultDto, reportId?: string): void {
    // Ensure footer is at the bottom
    if (doc.y < 700) {
      doc.y = 700;
    }

    this.drawDivider(doc);
    doc.moveDown(0.5);

    doc
      .fontSize(8)
      .fillColor(COLORS.textMuted)
      .text(
        'This report was generated automatically by PolicyTracker (policytracker.eu). ' +
          'It provides an automated assessment of GDPR compliance based on publicly observable website behavior. ' +
          'This report does not constitute legal advice. For a comprehensive compliance assessment, consult a qualified data protection professional.',
        { align: 'center', lineGap: 2 },
      );

    doc.moveDown(0.3);

    const idPart = reportId
      ? `Report ID: ${reportId}`
      : `Report ID: ${scanResult.websiteUrl.replace(/[^a-zA-Z0-9]/g, '-')}`;

    doc
      .fontSize(8)
      .fillColor(COLORS.textMuted)
      .text(
        `${idPart} | ` +
          `Generated: ${new Date().toISOString()} | ` +
          `Scan duration: ${(scanResult.scanDurationMs / 1000).toFixed(1)}s`,
        { align: 'center' },
      );

    doc.moveDown(0.3);

    doc
      .fontSize(9)
      .fillColor(COLORS.primary)
      .text('© PolicyTracker — GDPR Compliance Audit Service', {
        align: 'center',
        link: 'https://policytracker.eu',
      });
  }

  /**
   * Sort issues by severity: CRITICAL > HIGH > MEDIUM > LOW.
   */
  private sortIssuesBySeverity(issues: ScanIssue[]): ScanIssue[] {
    const severityOrder: Record<string, number> = {
      [RiskLevel.CRITICAL]: 0,
      [RiskLevel.HIGH]: 1,
      [RiskLevel.MEDIUM]: 2,
      [RiskLevel.LOW]: 3,
    };
    return [...issues].sort(
      (a, b) => (severityOrder[a.riskLevel] ?? 4) - (severityOrder[b.riskLevel] ?? 4),
    );
  }

  /**
   * Draw a horizontal divider line.
   */
  private drawDivider(doc: PDFKit.PDFDocument): void {
    const y = doc.y;
    doc
      .strokeColor(COLORS.border)
      .lineWidth(1)
      .moveTo(50, y)
      .lineTo(545, y)
      .stroke();
  }
}
