import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AdminGuard } from './admin.guard';
import { PricingController } from '../../pricing/pricing.controller';
import { AnalyticsReportController } from '../../analytics/analytics-report.controller';
import { HealthController } from '../../health/health.controller';
import { AuditController } from '../../audit/audit.controller';
import { ScannerController } from '../../scanner/scanner.controller';

/**
 * Regression net: every operator-only route must carry AdminGuard, and the
 * routes the public frontend depends on must NOT (or the site breaks).
 */
type Ctor = { prototype: object; name: string };

function guardsOf(controller: Ctor, method: string): unknown[] {
  const handler = (controller.prototype as Record<string, unknown>)[method];
  return [
    ...((Reflect.getMetadata(GUARDS_METADATA, controller) as unknown[]) ?? []),
    ...((Reflect.getMetadata(
      GUARDS_METADATA,
      handler as object,
    ) as unknown[]) ?? []),
  ];
}

describe('Admin route protection', () => {
  const protectedRoutes: [Ctor, string][] = [
    [PricingController, 'getAnalytics'],
    [PricingController, 'initializeCounters'],
    [PricingController, 'resetCounters'],
    [AnalyticsReportController, 'getOverview'],
    [AnalyticsReportController, 'getGeoReport'],
    [AnalyticsReportController, 'getSourcesReport'],
    [AnalyticsReportController, 'getFunnelReport'],
    [AnalyticsReportController, 'getPagesReport'],
    [HealthController, 'getDetailedHealth'],
    [HealthController, 'getQueueStats'],
    [AuditController, 'getAudit'],
    [ScannerController, 'scanWebsite'],
    [ScannerController, 'getReportsByWebsite'],
    [ScannerController, 'updateIssueStatus'],
    [ScannerController, 'cancelJob'],
    [ScannerController, 'getQueueStats'],
  ];

  it.each(protectedRoutes)('%p.%s requires AdminGuard', (ctrl, method) => {
    expect(guardsOf(ctrl, method)).toContain(AdminGuard);
  });

  const publicRoutes: [Ctor, string][] = [
    [PricingController, 'getCurrentPricing'],
    [PricingController, 'getAllPricing'],
    [HealthController, 'getHealth'],
    [HealthController, 'getLiveness'],
    [HealthController, 'getReadiness'],
    [AuditController, 'createAudit'],
    [ScannerController, 'queueScan'],
    [ScannerController, 'getJobStatus'],
    [ScannerController, 'getReport'],
    [ScannerController, 'retryJob'],
  ];

  it.each(publicRoutes)('%p.%s stays public', (ctrl, method) => {
    expect(guardsOf(ctrl, method)).not.toContain(AdminGuard);
  });
});
