import { PaymentService } from './payment.service';
import { ConfigService } from '@nestjs/config';

describe('PaymentService', () => {
  let service: PaymentService;
  let mockPrisma: any;
  let mockConfigService: Partial<ConfigService>;

  beforeEach(() => {
    mockPrisma = {
      payment: {
        create: jest.fn().mockResolvedValue({ id: 'pay-1' }),
        update: jest.fn().mockResolvedValue({ id: 'pay-1' }),
      },
      auditReport: {
        findUnique: jest.fn().mockResolvedValue({ fullReportUnlocked: false }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    // No STRIPE_SECRET_KEY — payment features disabled
    mockConfigService = {
      get: jest.fn().mockReturnValue(undefined),
    };
    service = new PaymentService(
      mockConfigService as ConfigService,
      mockPrisma,
    );
  });

  describe('isAvailable', () => {
    it('should return false when Stripe is not configured', () => {
      expect(service.isAvailable()).toBe(false);
    });
  });

  describe('getPricing', () => {
    it('should return EU pricing for German region', () => {
      const pricing = service.getPricing('de', 'A');
      expect(pricing.currency).toBe('eur');
      expect(pricing.variant).toBe('A');
      expect(pricing.amount).toBeDefined();
    });

    it('should return US pricing for US region', () => {
      const pricing = service.getPricing('us', 'A');
      expect(pricing.currency).toBe('usd');
    });

    it('should return UK pricing for GB region', () => {
      const pricing = service.getPricing('gb', 'B');
      expect(pricing.currency).toBe('gbp');
      expect(pricing.variant).toBe('B');
    });

    it('should return default pricing for unknown region', () => {
      const pricing = service.getPricing('xx', 'A');
      expect(pricing.currency).toBe('eur');
    });

    it('should return EU pricing for en locale', () => {
      const pricing = service.getPricing('en', 'A');
      expect(pricing.currency).toBe('eur');
    });

    it('should return US pricing for en-us locale', () => {
      const pricing = service.getPricing('en-us', 'A');
      expect(pricing.currency).toBe('usd');
    });

    it('should return UK pricing for en-gb locale', () => {
      const pricing = service.getPricing('en-gb', 'A');
      expect(pricing.currency).toBe('gbp');
    });

    it('should auto-assign variant A or B when not specified', () => {
      const pricing = service.getPricing('de');
      expect(['A', 'B']).toContain(pricing.variant);
    });

    it('should return EU pricing for various EU countries', () => {
      const euCountries = ['fr', 'it', 'es', 'nl', 'be', 'at', 'pl', 'pt', 'ie', 'se', 'fi', 'dk'];
      for (const country of euCountries) {
        const pricing = service.getPricing(country, 'A');
        expect(pricing.currency).toBe('eur');
      }
    });
  });

  describe('createCheckoutSession', () => {
    it('should throw when Stripe is not configured', async () => {
      await expect(
        service.createCheckoutSession({
          reportId: 'report-1',
          region: 'de',
          successUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/cancel',
        }),
      ).rejects.toThrow('Payment service not configured');
    });
  });

  describe('handleWebhook', () => {
    it('should throw when Stripe is not configured', async () => {
      await expect(
        service.handleWebhook(Buffer.from('{}'), 'sig'),
      ).rejects.toThrow('Payment service not configured');
    });
  });

  describe('verifyPayment', () => {
    it('should return error when Stripe is not configured', async () => {
      const result = await service.verifyPayment('session-1');
      expect(result.success).toBe(false);
      expect(result.error).toContain('not configured');
    });
  });

  describe('isReportUnlocked', () => {
    it('should return false when report is not unlocked', async () => {
      const result = await service.isReportUnlocked('report-1');
      expect(result).toBe(false);
      expect(mockPrisma.auditReport.findUnique).toHaveBeenCalledWith({
        where: { id: 'report-1' },
        select: { fullReportUnlocked: true },
      });
    });

    it('should return true when report is unlocked', async () => {
      mockPrisma.auditReport.findUnique.mockResolvedValue({ fullReportUnlocked: true });
      const result = await service.isReportUnlocked('report-1');
      expect(result).toBe(true);
    });

    it('should return false when report not found', async () => {
      mockPrisma.auditReport.findUnique.mockResolvedValue(null);
      const result = await service.isReportUnlocked('nonexistent');
      expect(result).toBe(false);
    });
  });
});
