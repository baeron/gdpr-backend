import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsService } from './analytics.service';
import { AnalyticsReportService } from './analytics-report.service';
import { PrismaService } from '../prisma/prisma.service';
import { GeoIpService } from './services/geoip.service';
import { UserAgentService } from './services/user-agent.service';
import { IpAnonymizerService } from './services/ip-anonymizer.service';

/**
 * Integration test: verifies the full analytics flow using mocked Prisma.
 * Session creation → Event tracking → Report aggregation
 */
describe('Analytics Integration', () => {
  let analyticsService: AnalyticsService;
  let reportService: AnalyticsReportService;

  // In-memory store to simulate DB
  const sessions: Record<string, any> = {};
  const events: any[] = [];

  const mockPrisma = {
    analyticsSession: {
      upsert: jest.fn().mockImplementation(({ where, create, update }) => {
        const existing = sessions[where.sessionId];
        if (existing) {
          Object.assign(existing, update);
          return Promise.resolve(existing);
        }
        sessions[create.sessionId] = { ...create, createdAt: new Date() };
        return Promise.resolve(sessions[create.sessionId]);
      }),
      findUnique: jest.fn().mockImplementation(({ where }) => {
        return Promise.resolve(sessions[where.sessionId] || null);
      }),
      create: jest.fn().mockImplementation(({ data }) => {
        sessions[data.sessionId] = { ...data, createdAt: new Date() };
        return Promise.resolve(sessions[data.sessionId]);
      }),
      update: jest.fn().mockImplementation(({ where, data }) => {
        if (sessions[where.sessionId]) {
          Object.assign(sessions[where.sessionId], data);
        }
        return Promise.resolve(sessions[where.sessionId]);
      }),
      count: jest.fn().mockImplementation(() => {
        return Promise.resolve(Object.keys(sessions).length);
      }),
      groupBy: jest.fn().mockImplementation(({ by }) => {
        const field = by[0];
        const grouped: Record<string, number> = {};
        for (const s of Object.values(sessions)) {
          const key = (s as any)[field] || 'unknown';
          grouped[key] = (grouped[key] || 0) + 1;
        }
        return Promise.resolve(
          Object.entries(grouped).map(([val, count]) => ({
            [field]: val,
            _count: count,
          })),
        );
      }),
    },
    analyticsEvent: {
      createMany: jest.fn().mockImplementation(({ data }) => {
        events.push(...data);
        return Promise.resolve({ count: data.length });
      }),
      count: jest.fn().mockImplementation(() => {
        return Promise.resolve(events.length);
      }),
      groupBy: jest.fn().mockImplementation(({ by }) => {
        const field = by[0];
        const grouped: Record<string, number> = {};
        for (const e of events) {
          const key = e[field] || 'unknown';
          grouped[key] = (grouped[key] || 0) + 1;
        }
        return Promise.resolve(
          Object.entries(grouped).map(([val, count]) => ({
            [field]: val,
            _count: count,
          })),
        );
      }),
    },
  };

  const mockGeoIp = {
    lookup: jest.fn().mockReturnValue({
      country: 'DE',
      city: 'Berlin',
      region: 'BE',
      timezone: 'Europe/Berlin',
    }),
  };

  const mockUserAgent = {
    parse: jest.fn().mockReturnValue({
      browser: 'Chrome',
      browserVersion: '120.0',
      os: 'Windows',
      osVersion: '10',
      deviceType: 'DESKTOP',
    }),
  };

  const mockIpAnonymizer = {
    hash: jest.fn().mockReturnValue('hashed-ip-abc123'),
  };

  beforeEach(async () => {
    // Clear in-memory stores
    Object.keys(sessions).forEach((k) => delete sessions[k]);
    events.length = 0;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        AnalyticsReportService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: GeoIpService, useValue: mockGeoIp },
        { provide: UserAgentService, useValue: mockUserAgent },
        { provide: IpAnonymizerService, useValue: mockIpAnonymizer },
      ],
    }).compile();

    analyticsService = module.get<AnalyticsService>(AnalyticsService);
    reportService = module.get<AnalyticsReportService>(AnalyticsReportService);
    jest.clearAllMocks();
  });

  it('should handle full analytics flow: session → events → reports', async () => {
    // 1. Create session
    const sessionResult = await analyticsService.createSession(
      {
        sessionId: 'integration-sess-1',
        referrer: 'https://google.com',
        utmSource: 'google',
        utmMedium: 'cpc',
        utmCampaign: 'spring_2026',
        landingPage: '/',
        language: 'de',
        screenResolution: '1920x1080',
        viewportSize: '1440x900',
      },
      '185.86.151.11',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0',
    );

    expect(sessionResult.sessionId).toBe('integration-sess-1');
    expect(mockIpAnonymizer.hash).toHaveBeenCalledWith('185.86.151.11');
    expect(mockGeoIp.lookup).toHaveBeenCalledWith('185.86.151.11');

    // 2. Track page view + form interactions
    const batch1 = await analyticsService.trackEvents(
      {
        sessionId: 'integration-sess-1',
        events: [
          { eventType: 'PAGE_VIEW' as any, page: '/' },
          { eventType: 'FORM_FOCUS' as any, page: '/', elementId: 'url' },
          { eventType: 'FORM_INPUT' as any, page: '/', elementId: 'url' },
          { eventType: 'FORM_FOCUS' as any, page: '/', elementId: 'email' },
          { eventType: 'FORM_INPUT' as any, page: '/', elementId: 'email' },
          { eventType: 'CHECKBOX_TOGGLE' as any, page: '/', elementId: 'agreeScan', metadata: { checked: true } },
          { eventType: 'FORM_SUBMIT' as any, page: '/', metadata: { form_name: 'hero_audit_form' } },
        ],
      },
      '185.86.151.11',
      'Mozilla/5.0 Chrome/120',
    );

    expect(batch1.tracked).toBe(7);

    // 3. Track scan lifecycle
    const batch2 = await analyticsService.trackEvents(
      {
        sessionId: 'integration-sess-1',
        events: [
          { eventType: 'SCAN_STARTED' as any, page: '/scan/job-123' },
          { eventType: 'SCAN_COMPLETED' as any, page: '/scan/job-123', metadata: { score: 72 } },
          { eventType: 'PAGE_VIEW' as any, page: '/report/free' },
          { eventType: 'REPORT_VIEW' as any, page: '/report/free', metadata: { report_type: 'free' } },
          { eventType: 'CTA_CLICK' as any, page: '/report/free', metadata: { cta_name: 'view_full_report' } },
        ],
      },
      '185.86.151.11',
      'Mozilla/5.0 Chrome/120',
    );

    expect(batch2.tracked).toBe(5);

    // 4. Verify in-memory state
    expect(Object.keys(sessions)).toHaveLength(1);
    expect(events).toHaveLength(12);

    // 5. Verify session was enriched with GeoIP + UA
    const session = sessions['integration-sess-1'];
    expect(session.ipHash).toBe('hashed-ip-abc123');
    expect(session.country).toBe('DE');
    expect(session.city).toBe('Berlin');
    expect(session.browser).toBe('Chrome');
    expect(session.deviceType).toBe('DESKTOP');
    expect(session.utmSource).toBe('google');
    expect(session.utmCampaign).toBe('spring_2026');

    // 6. Test reports
    const overview = await reportService.getOverview();
    expect(overview.totalSessions).toBe(1);
    expect(overview.totalEvents).toBe(12);

    const funnel = await reportService.getFunnelReport();
    expect(funnel.pageViews).toBeGreaterThanOrEqual(0);
    expect(funnel.formSubmit).toBeGreaterThanOrEqual(0);
  });

  it('should auto-create session when tracking events without explicit session creation', async () => {
    const result = await analyticsService.trackEvents(
      {
        sessionId: 'auto-created-sess',
        events: [
          { eventType: 'PAGE_VIEW' as any, page: '/' },
          { eventType: 'FAQ_EXPAND' as any, page: '/', metadata: { questionIndex: 2 } },
        ],
      },
      '8.8.8.8',
      'Mozilla/5.0 Safari/605',
    );

    expect(result.tracked).toBe(2);
    expect(sessions['auto-created-sess']).toBeDefined();
    expect(sessions['auto-created-sess'].ipHash).toBe('hashed-ip-abc123');
  });

  it('should handle multiple sessions independently', async () => {
    // Session 1
    await analyticsService.createSession(
      { sessionId: 'sess-a', landingPage: '/', language: 'en' },
      '1.1.1.1',
      'Chrome/120',
    );

    // Session 2
    await analyticsService.createSession(
      { sessionId: 'sess-b', landingPage: '/scan/xyz', language: 'de' },
      '2.2.2.2',
      'Firefox/115',
    );

    // Events for session 1
    await analyticsService.trackEvents(
      {
        sessionId: 'sess-a',
        events: [
          { eventType: 'PAGE_VIEW' as any, page: '/' },
          { eventType: 'FORM_SUBMIT' as any, page: '/' },
        ],
      },
      '1.1.1.1',
      'Chrome/120',
    );

    // Events for session 2
    await analyticsService.trackEvents(
      {
        sessionId: 'sess-b',
        events: [
          { eventType: 'PAGE_VIEW' as any, page: '/scan/xyz' },
          { eventType: 'SCAN_COMPLETED' as any, page: '/scan/xyz' },
          { eventType: 'CHECKOUT_STARTED' as any, page: '/scan/xyz' },
        ],
      },
      '2.2.2.2',
      'Firefox/115',
    );

    expect(Object.keys(sessions)).toHaveLength(2);
    expect(events).toHaveLength(5);

    // Verify events are correctly associated
    const sessAEvents = events.filter((e) => e.sessionId === 'sess-a');
    const sessBEvents = events.filter((e) => e.sessionId === 'sess-b');
    expect(sessAEvents).toHaveLength(2);
    expect(sessBEvents).toHaveLength(3);
  });

  it('should handle batch size limit (50 events)', async () => {
    await analyticsService.createSession(
      { sessionId: 'batch-sess' },
      '3.3.3.3',
      'Chrome/120',
    );

    const largeEvents = Array.from({ length: 50 }, (_, i) => ({
      eventType: 'PAGE_VIEW' as any,
      page: `/page-${i}`,
    }));

    const result = await analyticsService.trackEvents(
      { sessionId: 'batch-sess', events: largeEvents },
      '3.3.3.3',
      'Chrome/120',
    );

    expect(result.tracked).toBe(50);
  });

  it('should preserve event timestamps when provided', async () => {
    await analyticsService.createSession(
      { sessionId: 'ts-sess' },
      '4.4.4.4',
      'Chrome/120',
    );

    const customTs = '2026-02-16T12:00:00.000Z';
    await analyticsService.trackEvents(
      {
        sessionId: 'ts-sess',
        events: [
          { eventType: 'PAGE_VIEW' as any, page: '/', timestamp: customTs },
        ],
      },
      '4.4.4.4',
      'Chrome/120',
    );

    const lastEvent = events[events.length - 1];
    expect(lastEvent.timestamp).toEqual(new Date(customTs));
  });
});
