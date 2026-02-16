import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface OverviewReport {
  totalSessions: number;
  totalEvents: number;
  uniqueCountries: number;
  topPages: { page: string; views: number }[];
  deviceBreakdown: { deviceType: string; count: number }[];
  eventBreakdown: { eventType: string; count: number }[];
}

export interface GeoReport {
  countries: { country: string; sessions: number }[];
  cities: { city: string; country: string; sessions: number }[];
}

export interface SourcesReport {
  referrers: { referrer: string; sessions: number }[];
  utmSources: { source: string; sessions: number }[];
  utmCampaigns: { campaign: string; sessions: number }[];
}

export interface FunnelReport {
  pageViews: number;
  formFocus: number;
  formSubmit: number;
  scanStarted: number;
  scanCompleted: number;
  checkoutStarted: number;
  checkoutRedirect: number;
  paymentVerified: number;
  reportViewFree: number;
  reportViewFull: number;
}

export interface PagesReport {
  pages: { page: string; views: number; uniqueSessions: number }[];
}

@Injectable()
export class AnalyticsReportService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Overview dashboard: totals, top pages, device breakdown, event breakdown
   */
  async getOverview(from?: Date, to?: Date): Promise<OverviewReport> {
    const dateFilter = this.buildDateFilter(from, to);

    const [totalSessions, totalEvents, countries, topPages, devices, events] =
      await Promise.all([
        this.prisma.analyticsSession.count({ where: dateFilter.session }),
        this.prisma.analyticsEvent.count({ where: dateFilter.event }),
        this.prisma.analyticsSession.groupBy({
          by: ['country'],
          where: { ...dateFilter.session, country: { not: null } },
          _count: true,
        }),
        this.prisma.analyticsEvent.groupBy({
          by: ['page'],
          where: { ...dateFilter.event, eventType: 'PAGE_VIEW', page: { not: null } },
          _count: true,
          orderBy: { _count: { page: 'desc' } },
          take: 10,
        }),
        this.prisma.analyticsSession.groupBy({
          by: ['deviceType'],
          where: dateFilter.session,
          _count: true,
        }),
        this.prisma.analyticsEvent.groupBy({
          by: ['eventType'],
          where: dateFilter.event,
          _count: true,
          orderBy: { _count: { eventType: 'desc' } },
          take: 15,
        }),
      ]);

    return {
      totalSessions,
      totalEvents,
      uniqueCountries: countries.length,
      topPages: topPages.map((p) => ({
        page: p.page || '/',
        views: p._count,
      })),
      deviceBreakdown: devices.map((d) => ({
        deviceType: d.deviceType,
        count: d._count,
      })),
      eventBreakdown: events.map((e) => ({
        eventType: e.eventType,
        count: e._count,
      })),
    };
  }

  /**
   * Geographic distribution of sessions
   */
  async getGeoReport(from?: Date, to?: Date): Promise<GeoReport> {
    const dateFilter = this.buildDateFilter(from, to);

    const [countries, cities] = await Promise.all([
      this.prisma.analyticsSession.groupBy({
        by: ['country'],
        where: { ...dateFilter.session, country: { not: null } },
        _count: true,
        orderBy: { _count: { country: 'desc' } },
        take: 30,
      }),
      this.prisma.analyticsSession.groupBy({
        by: ['city', 'country'],
        where: {
          ...dateFilter.session,
          city: { not: null },
          country: { not: null },
        },
        _count: true,
        orderBy: { _count: { city: 'desc' } },
        take: 20,
      }),
    ]);

    return {
      countries: countries.map((c) => ({
        country: c.country!,
        sessions: c._count,
      })),
      cities: cities.map((c) => ({
        city: c.city!,
        country: c.country!,
        sessions: c._count,
      })),
    };
  }

  /**
   * Traffic sources: referrers, UTM sources, UTM campaigns
   */
  async getSourcesReport(from?: Date, to?: Date): Promise<SourcesReport> {
    const dateFilter = this.buildDateFilter(from, to);

    const [referrers, utmSources, utmCampaigns] = await Promise.all([
      this.prisma.analyticsSession.groupBy({
        by: ['referrer'],
        where: {
          ...dateFilter.session,
          referrer: { not: null },
          NOT: { referrer: '' },
        },
        _count: true,
        orderBy: { _count: { referrer: 'desc' } },
        take: 20,
      }),
      this.prisma.analyticsSession.groupBy({
        by: ['utmSource'],
        where: { ...dateFilter.session, utmSource: { not: null } },
        _count: true,
        orderBy: { _count: { utmSource: 'desc' } },
        take: 20,
      }),
      this.prisma.analyticsSession.groupBy({
        by: ['utmCampaign'],
        where: { ...dateFilter.session, utmCampaign: { not: null } },
        _count: true,
        orderBy: { _count: { utmCampaign: 'desc' } },
        take: 20,
      }),
    ]);

    return {
      referrers: referrers.map((r) => ({
        referrer: r.referrer!,
        sessions: r._count,
      })),
      utmSources: utmSources.map((s) => ({
        source: s.utmSource!,
        sessions: s._count,
      })),
      utmCampaigns: utmCampaigns.map((c) => ({
        campaign: c.utmCampaign!,
        sessions: c._count,
      })),
    };
  }

  /**
   * Conversion funnel: counts for each step from page view to payment
   */
  async getFunnelReport(from?: Date, to?: Date): Promise<FunnelReport> {
    const dateFilter = this.buildDateFilter(from, to);
    const where = dateFilter.event;

    const counts = await this.prisma.analyticsEvent.groupBy({
      by: ['eventType'],
      where: {
        ...where,
        eventType: {
          in: [
            'PAGE_VIEW',
            'FORM_FOCUS',
            'FORM_SUBMIT',
            'SCAN_STARTED',
            'SCAN_COMPLETED',
            'CHECKOUT_STARTED',
            'CHECKOUT_REDIRECT',
            'PAYMENT_VERIFIED',
            'REPORT_VIEW',
          ],
        },
      },
      _count: true,
    });

    const countMap = new Map(counts.map((c) => [c.eventType, c._count]));

    // For REPORT_VIEW, we need to split by metadata.report_type
    const reportViews = await this.prisma.analyticsEvent.count({
      where: { ...where, eventType: 'REPORT_VIEW' },
    });

    return {
      pageViews: countMap.get('PAGE_VIEW') || 0,
      formFocus: countMap.get('FORM_FOCUS') || 0,
      formSubmit: countMap.get('FORM_SUBMIT') || 0,
      scanStarted: countMap.get('SCAN_STARTED') || 0,
      scanCompleted: countMap.get('SCAN_COMPLETED') || 0,
      checkoutStarted: countMap.get('CHECKOUT_STARTED') || 0,
      checkoutRedirect: countMap.get('CHECKOUT_REDIRECT') || 0,
      paymentVerified: countMap.get('PAYMENT_VERIFIED') || 0,
      reportViewFree: reportViews, // simplified — both free+full
      reportViewFull: countMap.get('PAYMENT_VERIFIED') || 0,
    };
  }

  /**
   * Page-level analytics: views and unique sessions per page
   */
  async getPagesReport(from?: Date, to?: Date): Promise<PagesReport> {
    const dateFilter = this.buildDateFilter(from, to);

    const pages = await this.prisma.analyticsEvent.groupBy({
      by: ['page'],
      where: {
        ...dateFilter.event,
        eventType: 'PAGE_VIEW',
        page: { not: null },
      },
      _count: true,
      orderBy: { _count: { page: 'desc' } },
      take: 50,
    });

    // Get unique sessions per page
    const pagesWithSessions = await Promise.all(
      pages.map(async (p) => {
        const uniqueSessions = await this.prisma.analyticsEvent.groupBy({
          by: ['sessionId'],
          where: {
            ...dateFilter.event,
            eventType: 'PAGE_VIEW',
            page: p.page,
          },
        });

        return {
          page: p.page || '/',
          views: p._count,
          uniqueSessions: uniqueSessions.length,
        };
      }),
    );

    return { pages: pagesWithSessions };
  }

  /**
   * Build date filter for session and event queries
   */
  private buildDateFilter(
    from?: Date,
    to?: Date,
  ): {
    session: Record<string, unknown>;
    event: Record<string, unknown>;
  } {
    const sessionFilter: Record<string, unknown> = {};
    const eventFilter: Record<string, unknown> = {};

    if (from || to) {
      const dateRange: Record<string, Date> = {};
      if (from) dateRange.gte = from;
      if (to) dateRange.lte = to;

      sessionFilter.createdAt = dateRange;
      eventFilter.timestamp = dateRange;
    }

    return { session: sessionFilter, event: eventFilter };
  }
}
