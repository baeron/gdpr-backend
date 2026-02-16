import { Controller, Get, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { AnalyticsReportService } from './analytics-report.service';

@Controller('analytics/reports')
export class AnalyticsReportController {
  constructor(private readonly reportService: AnalyticsReportService) {}

  /**
   * GET /analytics/reports/overview?from=&to=
   * Dashboard overview: totals, top pages, device breakdown
   */
  @Get('overview')
  @HttpCode(HttpStatus.OK)
  async getOverview(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reportService.getOverview(
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }

  /**
   * GET /analytics/reports/geo?from=&to=
   * Geographic distribution of sessions
   */
  @Get('geo')
  @HttpCode(HttpStatus.OK)
  async getGeoReport(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reportService.getGeoReport(
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }

  /**
   * GET /analytics/reports/sources?from=&to=
   * Traffic sources: referrers, UTM
   */
  @Get('sources')
  @HttpCode(HttpStatus.OK)
  async getSourcesReport(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reportService.getSourcesReport(
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }

  /**
   * GET /analytics/reports/funnel?from=&to=
   * Conversion funnel from page view to payment
   */
  @Get('funnel')
  @HttpCode(HttpStatus.OK)
  async getFunnelReport(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reportService.getFunnelReport(
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }

  /**
   * GET /analytics/reports/pages?from=&to=
   * Page-level analytics
   */
  @Get('pages')
  @HttpCode(HttpStatus.OK)
  async getPagesReport(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reportService.getPagesReport(
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }
}
