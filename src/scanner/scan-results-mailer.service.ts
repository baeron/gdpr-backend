import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { frontendUrl } from '../common/frontend-url';
import { ScannerReportService } from './scanner-report.service';
import { RiskLevel, ScanResultDto } from './dto/scan-result.dto';

/** Give up on a job's results e-mail after this many failed sends. */
export const MAX_RESULTS_EMAIL_ATTEMPTS = 5;
const SWEEP_INTERVAL_MS = 30_000;
const BATCH_SIZE = 10;

type StoredReport = NonNullable<
  Awaited<ReturnType<ScannerReportService['getReport']>>
>;

const RISK_RANK: Record<string, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
  UNKNOWN: 0,
};

/**
 * Sends the "your scan results" e-mail (with the free PDF) once a scan
 * job completes.
 *
 * Works as an outbox sweep over ScanJob rather than a call inside each
 * queue implementation: jobs finish in four places (postgres, redis,
 * hybrid, and the Cloud Run worker process), and a sweep covers all of
 * them, survives restarts, and retries failed sends. Each job is claimed
 * with a conditional update, so several API replicas never double-send.
 */
@Injectable()
export class ScanResultsMailerService {
  private readonly logger = new Logger(ScanResultsMailerService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly reportService: ScannerReportService,
  ) {}

  @Interval(SWEEP_INTERVAL_MS)
  async sweep(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    let sent = 0;
    try {
      const jobs = await this.prisma.scanJob.findMany({
        where: {
          status: 'COMPLETED',
          userEmail: { not: null },
          reportId: { not: null },
          resultsEmailSentAt: null,
          resultsEmailAttempts: { lt: MAX_RESULTS_EMAIL_ATTEMPTS },
        },
        orderBy: { completedAt: 'asc' },
        take: BATCH_SIZE,
        select: {
          id: true,
          reportId: true,
          userEmail: true,
          locale: true,
          auditRequestId: true,
        },
      });

      for (const job of jobs) {
        if (await this.deliver(job)) sent++;
      }
    } catch (err) {
      this.logger.error(
        `Results e-mail sweep failed: ${(err as Error).message}`,
      );
    } finally {
      this.running = false;
    }
    return sent;
  }

  private async deliver(job: {
    id: string;
    reportId: string | null;
    userEmail: string | null;
    locale: string;
    auditRequestId: string | null;
  }): Promise<boolean> {
    const claim = await this.prisma.scanJob.updateMany({
      where: { id: job.id, resultsEmailSentAt: null },
      data: {
        resultsEmailSentAt: new Date(),
        resultsEmailAttempts: { increment: 1 },
      },
    });
    if (claim.count !== 1) return false; // another replica took it

    try {
      const report = await this.reportService.getReport(job.reportId!);
      if (!report) throw new Error(`report ${job.reportId} not found`);

      const ok = await this.emailService.sendAuditResults(job.userEmail!, {
        websiteUrl: report.websiteUrl,
        auditId: job.auditRequestId ?? job.id,
        reportId: report.id,
        score: report.overallScore ?? 0,
        issuesCount: report.issues.length,
        passedCount: countPassedChecks(report),
        topIssues: [...report.issues]
          .sort((a, b) => RISK_RANK[b.riskLevel] - RISK_RANK[a.riskLevel])
          .slice(0, 3)
          .map((i) => ({ title: i.title, severity: toSeverity(i.riskLevel) })),
        locale: job.locale,
        isFullReport: report.fullReportUnlocked,
        // The free report lives on the scan page, keyed by job id.
        reportUrl: frontendUrl(job.locale, `scan/${job.id}`),
        scanResult: toScanResult(report),
      });
      if (!ok) throw new Error('mail provider rejected the message');
      return true;
    } catch (err) {
      this.logger.error(
        `Results e-mail for job ${job.id} failed: ${(err as Error).message}`,
      );
      // Release the claim so a later sweep retries (bounded by attempts).
      await this.prisma.scanJob.update({
        where: { id: job.id },
        data: { resultsEmailSentAt: null },
      });
      return false;
    }
  }
}

function toSeverity(level: string): 'critical' | 'warning' | 'info' {
  if (level === 'CRITICAL' || level === 'HIGH') return 'critical';
  if (level === 'MEDIUM') return 'warning';
  return 'info';
}

/**
 * The analyzer sections are stored as Prisma Json columns; their shape is
 * the ScanResultDto section that saveScanResult wrote. Older or partial
 * rows may lack a section, hence the Partial view.
 */
type StoredSections = Partial<
  Pick<
    ScanResultDto,
    | 'cookies'
    | 'trackers'
    | 'thirdPartyRequests'
    | 'consentBanner'
    | 'privacyPolicy'
    | 'security'
    | 'forms'
    | 'dataTransfers'
    | 'technologies'
  >
>;

function sections(report: StoredReport): StoredSections {
  return report as unknown as StoredSections;
}

/** Same six headline checks the PDF report renders. */
export function countPassedChecks(report: StoredReport): number {
  const r = sections(report);
  const checks = [
    !!r.consentBanner?.found && !!r.consentBanner?.hasRejectButton,
    !!r.privacyPolicy?.found,
    r.cookies?.beforeConsent === 0,
    r.trackers?.beforeConsent === 0,
    !!r.security?.https?.enabled,
    r.dataTransfers?.totalUSServices === 0,
  ];
  return checks.filter(Boolean).length;
}

function toRisk(level: string): RiskLevel {
  return level === 'UNKNOWN' ? RiskLevel.LOW : (level as RiskLevel);
}

/**
 * Rebuild the scan result the PDF renderer expects from the stored row.
 * securityHeaders/sslCertificate are not persisted and the free PDF does
 * not render them; a missing section makes the PDF step fail, and
 * EmailService then sends the mail without the attachment.
 */
export function toScanResult(report: StoredReport): ScanResultDto {
  return {
    ...(sections(report) as ScanResultDto),
    websiteUrl: report.websiteUrl,
    scanDate: report.scannedAt,
    scanDurationMs: report.scanDurationMs ?? 0,
    overallRiskLevel: toRisk(report.riskLevel),
    issues: report.issues.map((i) => ({
      code: i.code,
      title: i.title,
      description: i.description,
      riskLevel: toRisk(i.riskLevel),
      recommendation: i.recommendation,
    })),
    score: report.overallScore ?? 0,
  };
}
