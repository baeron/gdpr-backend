import { BadRequestException } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';

describe('PaymentController', () => {
  let controller: PaymentController;
  let mockPaymentService: Partial<PaymentService>;

  beforeEach(() => {
    mockPaymentService = {
      getPricing: jest.fn().mockReturnValue({ amount: 2900, currency: 'eur', variant: 'A' as const }),
      createCheckoutSession: jest.fn().mockResolvedValue({
        sessionId: 'cs_123',
        url: 'https://checkout.stripe.com/cs_123',
        pricing: { amount: 2900, currency: 'eur', variant: 'A' as const },
      }),
      verifyPayment: jest.fn().mockResolvedValue({ success: true, reportId: 'report-1' }),
      isReportUnlocked: jest.fn().mockResolvedValue(false),
      handleWebhook: jest.fn().mockResolvedValue(undefined),
    };
    controller = new PaymentController(mockPaymentService as PaymentService);
  });

  describe('getPricing', () => {
    it('should return pricing converted from cents', () => {
      const result = controller.getPricing('de', 'A');
      expect(result.amount).toBe(29);
      expect(result.currency).toBe('eur');
      expect(result.variant).toBe('A');
    });

    it('should use default region when not provided', () => {
      controller.getPricing();
      expect(mockPaymentService.getPricing).toHaveBeenCalledWith('en', undefined);
    });
  });

  describe('createCheckout', () => {
    it('should create checkout session and return converted pricing', async () => {
      const result = await controller.createCheckout(
        { reportId: 'report-1', region: 'de' },
        'https://policytracker.eu',
      );
      expect(result.sessionId).toBe('cs_123');
      expect(result.url).toBe('https://checkout.stripe.com/cs_123');
      expect(result.pricing.amount).toBe(29); // cents → euros
    });

    it('should throw BadRequestException when reportId is missing', async () => {
      await expect(
        controller.createCheckout({ reportId: '' } as any, 'https://example.com'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should use default baseUrl when origin is missing', async () => {
      await controller.createCheckout(
        { reportId: 'report-1' },
        undefined as unknown as string,
      );
      expect(mockPaymentService.createCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({
          successUrl: expect.stringContaining('policytracker.eu'),
        }),
      );
    });
  });

  describe('verifyPayment', () => {
    it('should verify payment by session ID', async () => {
      const result = await controller.verifyPayment('cs_123');
      expect(mockPaymentService.verifyPayment).toHaveBeenCalledWith('cs_123');
      expect(result).toEqual({ success: true, reportId: 'report-1' });
    });
  });

  describe('checkAccess', () => {
    it('should return unlocked status for report', async () => {
      const result = await controller.checkAccess('report-1');
      expect(result).toEqual({ reportId: 'report-1', unlocked: false });
    });

    it('should return true when report is unlocked', async () => {
      (mockPaymentService.isReportUnlocked as jest.Mock).mockResolvedValue(true);
      const result = await controller.checkAccess('report-1');
      expect(result.unlocked).toBe(true);
    });
  });

  describe('handleWebhook', () => {
    it('should process webhook and return received', async () => {
      const mockReq = { rawBody: Buffer.from('{}'), body: {} } as any;
      const result = await controller.handleWebhook(mockReq, 'sig_123');
      expect(mockPaymentService.handleWebhook).toHaveBeenCalled();
      expect(result).toEqual({ received: true });
    });

    it('should throw BadRequestException on webhook error', async () => {
      (mockPaymentService.handleWebhook as jest.Mock).mockRejectedValue(
        new Error('Webhook signature verification failed'),
      );
      const mockReq = { rawBody: Buffer.from('{}'), body: {} } as any;
      await expect(
        controller.handleWebhook(mockReq, 'bad_sig'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should use req.body when rawBody is not available', async () => {
      const mockReq = { body: { type: 'test' } } as any;
      await controller.handleWebhook(mockReq, 'sig_123');
      expect(mockPaymentService.handleWebhook).toHaveBeenCalledWith(
        expect.any(Buffer),
        'sig_123',
      );
    });
  });
});
