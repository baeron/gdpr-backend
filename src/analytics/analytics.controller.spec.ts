import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsController', () => {
  let controller: AnalyticsController;

  const mockAnalyticsService = {
    createSession: jest.fn(),
    trackEvents: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [
        { provide: AnalyticsService, useValue: mockAnalyticsService },
      ],
    }).compile();

    controller = module.get<AnalyticsController>(AnalyticsController);
    jest.clearAllMocks();
  });

  describe('POST /analytics/session', () => {
    it('should create session and pass IP + User-Agent', async () => {
      mockAnalyticsService.createSession.mockResolvedValue({
        sessionId: 'sess-123',
      });

      const req = {
        headers: {
          'user-agent': 'Mozilla/5.0 Chrome/120',
          'x-forwarded-for': '185.86.151.11',
        },
        ip: '127.0.0.1',
        socket: { remoteAddress: '127.0.0.1' },
      } as any;

      const result = await controller.createSession(
        {
          sessionId: 'sess-123',
          referrer: 'https://google.com',
          utmSource: 'google',
          landingPage: '/',
        },
        req,
      );

      expect(result).toEqual({ sessionId: 'sess-123' });
      expect(mockAnalyticsService.createSession).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: 'sess-123' }),
        '185.86.151.11',
        'Mozilla/5.0 Chrome/120',
      );
    });

    it('should extract IP from x-real-ip header', async () => {
      mockAnalyticsService.createSession.mockResolvedValue({
        sessionId: 'sess-456',
      });

      const req = {
        headers: {
          'user-agent': 'Mozilla/5.0',
          'x-real-ip': '10.0.0.1',
        },
        ip: '127.0.0.1',
        socket: { remoteAddress: '127.0.0.1' },
      } as any;

      await controller.createSession({ sessionId: 'sess-456' }, req);

      expect(mockAnalyticsService.createSession).toHaveBeenCalledWith(
        expect.anything(),
        '10.0.0.1',
        'Mozilla/5.0',
      );
    });

    it('should fallback to req.ip when no proxy headers', async () => {
      mockAnalyticsService.createSession.mockResolvedValue({
        sessionId: 'sess-789',
      });

      const req = {
        headers: { 'user-agent': '' },
        ip: '192.168.1.1',
        socket: { remoteAddress: '192.168.1.1' },
      } as any;

      await controller.createSession({ sessionId: 'sess-789' }, req);

      expect(mockAnalyticsService.createSession).toHaveBeenCalledWith(
        expect.anything(),
        '192.168.1.1',
        '',
      );
    });
  });

  describe('POST /analytics/events', () => {
    it('should track events batch', async () => {
      mockAnalyticsService.trackEvents.mockResolvedValue({ tracked: 3 });

      const req = {
        headers: {
          'user-agent': 'Mozilla/5.0',
          'x-forwarded-for': '8.8.8.8, 10.0.0.1',
        },
        ip: '127.0.0.1',
        socket: { remoteAddress: '127.0.0.1' },
      } as any;

      const result = await controller.trackEvents(
        {
          sessionId: 'sess-123',
          events: [
            { eventType: 'PAGE_VIEW' as any, page: '/' },
            { eventType: 'SCROLL_DEPTH' as any, page: '/', metadata: { percent: 50 } },
            { eventType: 'FAQ_EXPAND' as any, page: '/', elementId: 'faq-3' },
          ],
        },
        req,
      );

      expect(result).toEqual({ tracked: 3 });
      // Should use first IP from X-Forwarded-For
      expect(mockAnalyticsService.trackEvents).toHaveBeenCalledWith(
        expect.anything(),
        '8.8.8.8',
        'Mozilla/5.0',
      );
    });
  });
});
