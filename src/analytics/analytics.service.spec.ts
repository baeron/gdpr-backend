import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../prisma/prisma.service';
import { GeoIpService } from './services/geoip.service';
import { UserAgentService } from './services/user-agent.service';
import { IpAnonymizerService } from './services/ip-anonymizer.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;

  const mockPrisma = {
    analyticsSession: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    analyticsEvent: {
      createMany: jest.fn(),
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
    hash: jest.fn().mockReturnValue('abc123hash'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: GeoIpService, useValue: mockGeoIp },
        { provide: UserAgentService, useValue: mockUserAgent },
        { provide: IpAnonymizerService, useValue: mockIpAnonymizer },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
    jest.clearAllMocks();
  });

  describe('createSession', () => {
    it('should create a session with GeoIP and UA data', async () => {
      mockPrisma.analyticsSession.upsert.mockResolvedValue({
        sessionId: 'sess-123',
      });

      const result = await service.createSession(
        {
          sessionId: 'sess-123',
          referrer: 'https://google.com',
          utmSource: 'google',
          utmMedium: 'cpc',
          landingPage: '/',
          language: 'de',
          screenResolution: '1920x1080',
          viewportSize: '1440x900',
        },
        '185.86.151.11',
        'Mozilla/5.0 Chrome/120',
      );

      expect(result).toEqual({ sessionId: 'sess-123' });
      expect(mockIpAnonymizer.hash).toHaveBeenCalledWith('185.86.151.11');
      expect(mockGeoIp.lookup).toHaveBeenCalledWith('185.86.151.11');
      expect(mockUserAgent.parse).toHaveBeenCalledWith('Mozilla/5.0 Chrome/120');

      expect(mockPrisma.analyticsSession.upsert).toHaveBeenCalledWith({
        where: { sessionId: 'sess-123' },
        update: { lastActivityAt: expect.any(Date) },
        create: expect.objectContaining({
          sessionId: 'sess-123',
          ipHash: 'abc123hash',
          country: 'DE',
          city: 'Berlin',
          browser: 'Chrome',
          os: 'Windows',
          deviceType: 'DESKTOP',
          referrer: 'https://google.com',
          utmSource: 'google',
          utmMedium: 'cpc',
          landingPage: '/',
          language: 'de',
          screenResolution: '1920x1080',
          viewportSize: '1440x900',
        }),
      });
    });

    it('should handle missing optional fields', async () => {
      mockPrisma.analyticsSession.upsert.mockResolvedValue({
        sessionId: 'sess-456',
      });

      const result = await service.createSession(
        { sessionId: 'sess-456' },
        '8.8.8.8',
        '',
      );

      expect(result).toEqual({ sessionId: 'sess-456' });
      expect(mockPrisma.analyticsSession.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            referrer: null,
            utmSource: null,
            landingPage: null,
          }),
        }),
      );
    });
  });

  describe('trackEvents', () => {
    it('should create events for existing session', async () => {
      mockPrisma.analyticsSession.findUnique.mockResolvedValue({
        sessionId: 'sess-123',
      });
      mockPrisma.analyticsSession.update.mockResolvedValue({});
      mockPrisma.analyticsEvent.createMany.mockResolvedValue({ count: 2 });

      const result = await service.trackEvents(
        {
          sessionId: 'sess-123',
          events: [
            { eventType: 'PAGE_VIEW' as any, page: '/' },
            {
              eventType: 'FAQ_EXPAND' as any,
              page: '/',
              elementId: 'faq-3',
              metadata: { questionIndex: 3 },
            },
          ],
        },
        '185.86.151.11',
        'Mozilla/5.0',
      );

      expect(result).toEqual({ tracked: 2 });
      expect(mockPrisma.analyticsSession.findUnique).toHaveBeenCalledWith({
        where: { sessionId: 'sess-123' },
      });
      expect(mockPrisma.analyticsSession.update).toHaveBeenCalled();
      expect(mockPrisma.analyticsEvent.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            sessionId: 'sess-123',
            eventType: 'PAGE_VIEW',
            page: '/',
          }),
          expect.objectContaining({
            sessionId: 'sess-123',
            eventType: 'FAQ_EXPAND',
            elementId: 'faq-3',
            metadata: { questionIndex: 3 },
          }),
        ]),
      });
    });

    it('should auto-create session if not found', async () => {
      mockPrisma.analyticsSession.findUnique.mockResolvedValue(null);
      mockPrisma.analyticsSession.create.mockResolvedValue({
        sessionId: 'sess-new',
      });
      mockPrisma.analyticsEvent.createMany.mockResolvedValue({ count: 1 });

      const result = await service.trackEvents(
        {
          sessionId: 'sess-new',
          events: [{ eventType: 'PAGE_VIEW' as any, page: '/scan/abc' }],
        },
        '1.1.1.1',
        'Mozilla/5.0',
      );

      expect(result).toEqual({ tracked: 1 });
      expect(mockPrisma.analyticsSession.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          sessionId: 'sess-new',
          ipHash: 'abc123hash',
          country: 'DE',
          browser: 'Chrome',
        }),
      });
    });

    it('should handle empty events array', async () => {
      mockPrisma.analyticsSession.findUnique.mockResolvedValue({
        sessionId: 'sess-123',
      });
      mockPrisma.analyticsSession.update.mockResolvedValue({});
      mockPrisma.analyticsEvent.createMany.mockResolvedValue({ count: 0 });

      const result = await service.trackEvents(
        { sessionId: 'sess-123', events: [] },
        '8.8.8.8',
        '',
      );

      expect(result).toEqual({ tracked: 0 });
    });

    it('should use provided timestamp when available', async () => {
      mockPrisma.analyticsSession.findUnique.mockResolvedValue({
        sessionId: 'sess-123',
      });
      mockPrisma.analyticsSession.update.mockResolvedValue({});
      mockPrisma.analyticsEvent.createMany.mockResolvedValue({ count: 1 });

      const ts = '2026-02-16T20:00:00.000Z';
      await service.trackEvents(
        {
          sessionId: 'sess-123',
          events: [{ eventType: 'SCROLL_DEPTH' as any, page: '/', timestamp: ts }],
        },
        '8.8.8.8',
        '',
      );

      expect(mockPrisma.analyticsEvent.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            timestamp: new Date(ts),
          }),
        ],
      });
    });
  });
});
