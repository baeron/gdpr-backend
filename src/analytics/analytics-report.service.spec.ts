import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsReportService } from './analytics-report.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AnalyticsReportService', () => {
  let service: AnalyticsReportService;

  const mockPrisma = {
    analyticsSession: {
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    analyticsEvent: {
      count: jest.fn(),
      groupBy: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsReportService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AnalyticsReportService>(AnalyticsReportService);
    jest.clearAllMocks();
  });

  describe('getOverview', () => {
    it('should return overview with totals and breakdowns', async () => {
      mockPrisma.analyticsSession.count.mockResolvedValue(150);
      mockPrisma.analyticsEvent.count.mockResolvedValue(3200);
      mockPrisma.analyticsSession.groupBy
        .mockResolvedValueOnce([
          { country: 'DE', _count: 80 },
          { country: 'US', _count: 40 },
          { country: 'PL', _count: 30 },
        ])
        .mockResolvedValueOnce([
          { deviceType: 'DESKTOP', _count: 100 },
          { deviceType: 'MOBILE', _count: 40 },
          { deviceType: 'TABLET', _count: 10 },
        ]);
      mockPrisma.analyticsEvent.groupBy
        .mockResolvedValueOnce([
          { page: '/', _count: 500 },
          { page: '/scan/abc', _count: 200 },
        ])
        .mockResolvedValueOnce([
          { eventType: 'PAGE_VIEW', _count: 1200 },
          { eventType: 'FORM_SUBMIT', _count: 80 },
        ]);

      const result = await service.getOverview();

      expect(result.totalSessions).toBe(150);
      expect(result.totalEvents).toBe(3200);
      expect(result.uniqueCountries).toBe(3);
      expect(result.topPages).toHaveLength(2);
      expect(result.topPages[0]).toEqual({ page: '/', views: 500 });
      expect(result.deviceBreakdown).toHaveLength(3);
      expect(result.eventBreakdown).toHaveLength(2);
    });

    it('should pass date filters when provided', async () => {
      mockPrisma.analyticsSession.count.mockResolvedValue(0);
      mockPrisma.analyticsEvent.count.mockResolvedValue(0);
      mockPrisma.analyticsSession.groupBy.mockResolvedValue([]);
      mockPrisma.analyticsEvent.groupBy.mockResolvedValue([]);

      const from = new Date('2026-01-01');
      const to = new Date('2026-01-31');
      await service.getOverview(from, to);

      expect(mockPrisma.analyticsSession.count).toHaveBeenCalledWith({
        where: { createdAt: { gte: from, lte: to } },
      });
    });
  });

  describe('getGeoReport', () => {
    it('should return countries and cities', async () => {
      mockPrisma.analyticsSession.groupBy
        .mockResolvedValueOnce([
          { country: 'DE', _count: 80 },
          { country: 'US', _count: 40 },
        ])
        .mockResolvedValueOnce([
          { city: 'Berlin', country: 'DE', _count: 50 },
          { city: 'Munich', country: 'DE', _count: 30 },
        ]);

      const result = await service.getGeoReport();

      expect(result.countries).toHaveLength(2);
      expect(result.countries[0]).toEqual({ country: 'DE', sessions: 80 });
      expect(result.cities).toHaveLength(2);
      expect(result.cities[0]).toEqual({
        city: 'Berlin',
        country: 'DE',
        sessions: 50,
      });
    });
  });

  describe('getSourcesReport', () => {
    it('should return referrers and UTM data', async () => {
      mockPrisma.analyticsSession.groupBy
        .mockResolvedValueOnce([
          { referrer: 'https://google.com', _count: 60 },
        ])
        .mockResolvedValueOnce([{ utmSource: 'google', _count: 40 }])
        .mockResolvedValueOnce([{ utmCampaign: 'spring_2026', _count: 20 }]);

      const result = await service.getSourcesReport();

      expect(result.referrers).toHaveLength(1);
      expect(result.referrers[0].referrer).toBe('https://google.com');
      expect(result.utmSources).toHaveLength(1);
      expect(result.utmSources[0].source).toBe('google');
      expect(result.utmCampaigns).toHaveLength(1);
      expect(result.utmCampaigns[0].campaign).toBe('spring_2026');
    });
  });

  describe('getFunnelReport', () => {
    it('should return funnel step counts', async () => {
      mockPrisma.analyticsEvent.groupBy.mockResolvedValue([
        { eventType: 'PAGE_VIEW', _count: 1000 },
        { eventType: 'FORM_FOCUS', _count: 300 },
        { eventType: 'FORM_SUBMIT', _count: 100 },
        { eventType: 'SCAN_STARTED', _count: 95 },
        { eventType: 'SCAN_COMPLETED', _count: 80 },
        { eventType: 'CHECKOUT_STARTED', _count: 30 },
        { eventType: 'CHECKOUT_REDIRECT', _count: 25 },
        { eventType: 'PAYMENT_VERIFIED', _count: 20 },
      ]);
      mockPrisma.analyticsEvent.count.mockResolvedValue(150);

      const result = await service.getFunnelReport();

      expect(result.pageViews).toBe(1000);
      expect(result.formFocus).toBe(300);
      expect(result.formSubmit).toBe(100);
      expect(result.scanStarted).toBe(95);
      expect(result.scanCompleted).toBe(80);
      expect(result.checkoutStarted).toBe(30);
      expect(result.checkoutRedirect).toBe(25);
      expect(result.paymentVerified).toBe(20);
      expect(result.reportViewFree).toBe(150);
    });
  });

  describe('getPagesReport', () => {
    it('should return page views with unique sessions', async () => {
      mockPrisma.analyticsEvent.groupBy
        .mockResolvedValueOnce([
          { page: '/', _count: 500 },
          { page: '/scan/abc', _count: 200 },
        ])
        .mockResolvedValueOnce([{ sessionId: 's1' }, { sessionId: 's2' }])
        .mockResolvedValueOnce([{ sessionId: 's1' }]);

      const result = await service.getPagesReport();

      expect(result.pages).toHaveLength(2);
      expect(result.pages[0]).toEqual({
        page: '/',
        views: 500,
        uniqueSessions: 2,
      });
      expect(result.pages[1]).toEqual({
        page: '/scan/abc',
        views: 200,
        uniqueSessions: 1,
      });
    });
  });
});
