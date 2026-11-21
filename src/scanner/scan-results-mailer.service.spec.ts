/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call --
 * Prisma/EmailService are hand-rolled jest mocks here. */
import {
  ScanResultsMailerService,
  MAX_RESULTS_EMAIL_ATTEMPTS,
  countPassedChecks,
  toScanResult,
} from './scan-results-mailer.service';

const report = {
  id: 'report-1',
  websiteUrl: 'https://shop.example',
  overallScore: 62,
  riskLevel: 'HIGH',
  scanDurationMs: 4200,
  scannedAt: new Date('2026-11-20T10:00:00Z'),
  fullReportUnlocked: false,
  cookies: { total: 3, beforeConsent: 2, list: [] },
  trackers: { total: 1, beforeConsent: 0, list: [] },
  thirdPartyRequests: { total: 0, beforeConsent: 0, list: [] },
  consentBanner: { found: true, hasRejectButton: false },
  privacyPolicy: { found: true, content: { analyzed: false } },
  security: { https: { enabled: true } },
  forms: {},
  dataTransfers: { totalUSServices: 1 },
  technologies: {},
  issues: [
    {
      code: 'A',
      title: 'Low one',
      description: 'd',
      riskLevel: 'LOW',
      recommendation: 'r',
    },
    {
      code: 'B',
      title: 'Critical one',
      description: 'd',
      riskLevel: 'CRITICAL',
      recommendation: 'r',
    },
    {
      code: 'C',
      title: 'Medium one',
      description: 'd',
      riskLevel: 'MEDIUM',
      recommendation: 'r',
    },
    {
      code: 'D',
      title: 'High one',
      description: 'd',
      riskLevel: 'HIGH',
      recommendation: 'r',
    },
  ],
};

const job = {
  id: 'job-1',
  reportId: 'report-1',
  userEmail: 'owner@shop.example',
  locale: 'fr',
  auditRequestId: 'audit-1',
};

function build() {
  const prisma: any = {
    scanJob: {
      findMany: jest.fn().mockResolvedValue([job]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue({}),
    },
  };
  const email: any = { sendAuditResults: jest.fn().mockResolvedValue(true) };
  const reports: any = { getReport: jest.fn().mockResolvedValue(report) };
  return {
    svc: new ScanResultsMailerService(prisma, email, reports),
    prisma,
    email,
    reports,
  };
}

describe('ScanResultsMailerService', () => {
  it('only picks completed, e-mail-bearing, unsent jobs under the attempt cap', async () => {
    const { svc, prisma } = build();
    await svc.sweep();
    expect(prisma.scanJob.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'COMPLETED',
          userEmail: { not: null },
          reportId: { not: null },
          resultsEmailSentAt: null,
          resultsEmailAttempts: { lt: MAX_RESULTS_EMAIL_ATTEMPTS },
        },
      }),
    );
  });

  it('claims the job, then sends a localized e-mail linking to the scan page', async () => {
    const { svc, prisma, email } = build();
    await expect(svc.sweep()).resolves.toBe(1);

    expect(prisma.scanJob.updateMany).toHaveBeenCalledWith({
      where: { id: 'job-1', resultsEmailSentAt: null },
      data: {
        resultsEmailSentAt: expect.any(Date),
        resultsEmailAttempts: { increment: 1 },
      },
    });
    expect(email.sendAuditResults).toHaveBeenCalledWith(
      'owner@shop.example',
      expect.objectContaining({
        auditId: 'audit-1',
        reportId: 'report-1',
        score: 62,
        issuesCount: 4,
        locale: 'fr',
        isFullReport: false,
        reportUrl: 'https://policytracker.eu/fr/scan/job-1',
        topIssues: [
          { title: 'Critical one', severity: 'critical' },
          { title: 'High one', severity: 'critical' },
          { title: 'Medium one', severity: 'warning' },
        ],
        scanResult: expect.objectContaining({
          websiteUrl: 'https://shop.example',
        }),
      }),
    );
    expect(prisma.scanJob.update).not.toHaveBeenCalled();
  });

  it('does not send when another replica already claimed the job', async () => {
    const { svc, prisma, email } = build();
    prisma.scanJob.updateMany.mockResolvedValue({ count: 0 });
    await expect(svc.sweep()).resolves.toBe(0);
    expect(email.sendAuditResults).not.toHaveBeenCalled();
  });

  it('releases the claim when the provider rejects the message', async () => {
    const { svc, prisma, email } = build();
    email.sendAuditResults.mockResolvedValue(false);
    await expect(svc.sweep()).resolves.toBe(0);
    expect(prisma.scanJob.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: { resultsEmailSentAt: null },
    });
  });

  it('releases the claim when the report is gone', async () => {
    const { svc, prisma, reports } = build();
    reports.getReport.mockResolvedValue(null);
    await svc.sweep();
    expect(prisma.scanJob.update).toHaveBeenCalled();
  });

  it('survives a database outage without throwing', async () => {
    const { svc, prisma } = build();
    prisma.scanJob.findMany.mockRejectedValue(new Error('DB down'));
    await expect(svc.sweep()).resolves.toBe(0);
  });

  it('counts the same six headline checks as the PDF', () => {
    // banner w/o reject ✗, policy ✓, cookies before consent ✗,
    // trackers before consent ✓, https ✓, US services ✗
    expect(countPassedChecks(report as any)).toBe(3);
  });

  it('rebuilds a scan result the PDF renderer can consume', () => {
    const result = toScanResult({ ...report, riskLevel: 'UNKNOWN' } as any);
    expect(result.overallRiskLevel).toBe('LOW');
    expect(result.scanDate).toEqual(report.scannedAt);
    expect(result.cookies.beforeConsent).toBe(2);
    expect(result.issues).toHaveLength(4);
  });
});
