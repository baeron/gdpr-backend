/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await --
 * Stripe/Prisma are hand-rolled jest mocks; private handlers are reached via `any`. */
import { PaymentService, WebhookSignatureError } from './payment.service';
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
      const euCountries = [
        'fr',
        'it',
        'es',
        'nl',
        'be',
        'at',
        'pl',
        'pt',
        'ie',
        'se',
        'fi',
        'dk',
      ];
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

  describe('createLaunchCheckoutSession (slot retry)', () => {
    /**
     * The DB has UNIQUE(region, campaignId, slotNumber). When two requests
     * race past the Redis fallback path and try to claim the same slot,
     * the loser must transparently re-reserve a fresh slot rather than
     * 500 to the user.
     */
    it('retries on P2002 with a fresh slot and a fresh Stripe session', async () => {
      let recordCalls = 0;
      const stripeCreate = jest.fn().mockImplementation(async () => ({
        id: `cs_${recordCalls + 1}`,
        url: 'https://stripe.test',
      }));
      const reserveSlot = jest
        .fn()
        .mockResolvedValueOnce({ slotNumber: 7, price: 7 })
        .mockResolvedValueOnce({ slotNumber: 8, price: 8 });
      const recordPurchase = jest.fn().mockImplementation(async () => {
        recordCalls++;
        if (recordCalls === 1) {
          const e: any = new Error('Unique constraint failed');
          e.code = 'P2002';
          throw e;
        }
        return { id: 'lp-2' };
      });

      const prisma: any = {
        launchPurchase: { update: jest.fn() },
        payment: { create: jest.fn(), update: jest.fn() },
        $transaction: jest.fn(),
      };
      const pricingService: any = {
        getRegionFromCountry: () => 'EU',
        reserveSlot,
        recordPurchase,
        updatePurchaseStatus: jest.fn(),
      };
      const geoService: any = {
        getGeoFromIP: jest.fn(),
        hashIP: () => 'hash',
      };

      const svc = new PaymentService(
        { get: jest.fn().mockReturnValue('sk_test') } as any,
        prisma,
        pricingService,
        geoService,
      );
      // Inject a fake Stripe client
      (svc as any).stripe = {
        checkout: { sessions: { create: stripeCreate } },
      };

      const result = await svc.createLaunchCheckoutSession({
        reportId: 'r-1',
        clientIp: '1.2.3.4',
        country: 'DE',
        successUrl: 'https://x/s',
        cancelUrl: 'https://x/c',
      });

      expect(reserveSlot).toHaveBeenCalledTimes(2);
      expect(stripeCreate).toHaveBeenCalledTimes(2);
      expect(recordPurchase).toHaveBeenCalledTimes(2);
      expect(result.slotNumber).toBe(8);
      // Each retry must use a *new* idempotencyKey
      const keys = stripeCreate.mock.calls.map((c) => c[1].idempotencyKey);
      expect(new Set(keys).size).toBe(2);
    });

    it('rethrows non-P2002 errors without retrying', async () => {
      const stripeCreate = jest
        .fn()
        .mockResolvedValue({ id: 'cs_1', url: 'https://stripe.test' });
      const reserveSlot = jest
        .fn()
        .mockResolvedValue({ slotNumber: 1, price: 1 });
      const recordPurchase = jest.fn().mockRejectedValue(new Error('boom'));

      const svc = new PaymentService(
        { get: jest.fn().mockReturnValue('sk_test') } as any,
        { launchPurchase: { update: jest.fn() } } as any,
        {
          getRegionFromCountry: () => 'EU',
          reserveSlot,
          recordPurchase,
        } as any,
        { hashIP: () => 'h', getGeoFromIP: jest.fn() } as any,
      );
      (svc as any).stripe = {
        checkout: { sessions: { create: stripeCreate } },
      };

      await expect(
        svc.createLaunchCheckoutSession({
          reportId: 'r-1',
          clientIp: '1.2.3.4',
          country: 'DE',
          successUrl: 'https://x/s',
          cancelUrl: 'https://x/c',
        }),
      ).rejects.toThrow('boom');

      expect(reserveSlot).toHaveBeenCalledTimes(1);
      expect(recordPurchase).toHaveBeenCalledTimes(1);
    });
  });

  describe('handleCheckoutCompleted (transaction)', () => {
    /**
     * The webhook handler must apply Payment.update + AuditReport.update
     * (and optionally LaunchPurchase.update) inside a single
     * prisma.$transaction so a partial DB failure cannot leave the user
     * paid-but-locked or vice-versa.
     */
    it('runs all writes inside a single $transaction', async () => {
      const txClient = {
        payment: { update: jest.fn().mockResolvedValue({}) },
        auditReport: { update: jest.fn().mockResolvedValue({}) },
        launchPurchase: { update: jest.fn().mockResolvedValue({}) },
      };
      const txSpy = jest
        .fn()
        .mockImplementation(async (cb: any) => cb(txClient));

      const prisma: any = {
        ...mockPrisma,
        $transaction: txSpy,
      };
      const pricingService: any = {
        updatePurchaseStatus: jest.fn(async (id, status, intent, tx) => {
          // Caller must forward the tx client so the launchPurchase update
          // is part of the same atomic transaction.
          expect(tx).toBe(txClient);
          return tx.launchPurchase.update({
            where: { stripeSessionId: id },
            data: { status, stripePaymentIntentId: intent },
          });
        }),
      };

      const svc = new PaymentService(
        mockConfigService as ConfigService,
        prisma,
        pricingService,
      );

      // Call the private handler via bracket access
      await (svc as any).handleCheckoutCompleted({
        id: 'sess_1',
        payment_intent: 'pi_1',
        payment_status: 'paid',
        metadata: {
          reportId: 'report-1',
          paymentId: 'pay-1',
          launchPurchaseId: 'launch-1',
          region: 'EU',
        },
      });

      expect(txSpy).toHaveBeenCalledTimes(1);
      expect(pricingService.updatePurchaseStatus).toHaveBeenCalledTimes(1);
      expect(txClient.payment.update).toHaveBeenCalledTimes(1);
      expect(txClient.auditReport.update).toHaveBeenCalledTimes(1);
      expect(txClient.launchPurchase.update).toHaveBeenCalledTimes(1);
    });

    it('does not partially update when one write fails', async () => {
      const txSpy = jest.fn().mockImplementation(async (cb: any) => {
        // Simulate Prisma rolling back the whole transaction on error.
        const tx = {
          payment: { update: jest.fn().mockResolvedValue({}) },
          auditReport: {
            update: jest.fn().mockRejectedValue(new Error('DB down')),
          },
          launchPurchase: { update: jest.fn() },
        };
        return cb(tx);
      });

      const prisma: any = { ...mockPrisma, $transaction: txSpy };
      const svc = new PaymentService(
        mockConfigService as ConfigService,
        prisma,
      );

      await expect(
        (svc as any).handleCheckoutCompleted({
          id: 'sess_1',
          payment_intent: 'pi_1',
          payment_status: 'paid',
          metadata: { reportId: 'report-1', paymentId: 'pay-1' },
        }),
      ).rejects.toThrow('DB down');

      // Top-level prisma writes must NOT be called outside the tx
      expect(mockPrisma.payment.update).not.toHaveBeenCalled();
      expect(mockPrisma.auditReport.update).not.toHaveBeenCalled();
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
      mockPrisma.auditReport.findUnique.mockResolvedValue({
        fullReportUnlocked: true,
      });
      const result = await service.isReportUnlocked('report-1');
      expect(result).toBe(true);
    });

    it('should return false when report not found', async () => {
      mockPrisma.auditReport.findUnique.mockResolvedValue(null);
      const result = await service.isReportUnlocked('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('handleWebhook', () => {
    const paidSession = {
      id: 'cs_1',
      payment_intent: 'pi_1',
      payment_status: 'paid',
      amount_total: 999,
      currency: 'eur',
      customer_details: { email: 'buyer@example.com' },
      metadata: { reportId: 'report-1', paymentId: 'pay-1' },
    };

    function build(
      opts: {
        event?: any;
        secret?: string | undefined;
        constructEvent?: jest.Mock;
        createEvent?: jest.Mock;
      } = {},
    ) {
      const tx = {
        payment: { update: jest.fn().mockResolvedValue({}) },
        auditReport: { update: jest.fn().mockResolvedValue({}) },
      };
      const prisma: any = {
        payment: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
        auditReport: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ websiteUrl: 'https://shop.example' }),
        },
        scanJob: { findFirst: jest.fn().mockResolvedValue({ locale: 'de' }) },
        stripeWebhookEvent: {
          create: opts.createEvent ?? jest.fn().mockResolvedValue({}),
          delete: jest.fn().mockResolvedValue({}),
        },
        $transaction: jest.fn(async (cb: any) => cb(tx)),
      };
      const email: any = {
        sendPaymentConfirmation: jest.fn().mockResolvedValue(true),
      };
      const config: any = {
        get: jest.fn((k: string) =>
          k === 'STRIPE_WEBHOOK_SECRET'
            ? 'secret' in opts
              ? opts.secret
              : 'whsec_test'
            : 'sk_test',
        ),
      };
      const svc = new PaymentService(
        config,
        prisma,
        undefined,
        undefined,
        email,
      );
      const event = opts.event ?? {
        id: 'evt_1',
        type: 'checkout.session.completed',
        data: { object: paidSession },
      };
      (svc as any).stripe = {
        webhooks: {
          constructEvent:
            opts.constructEvent ?? jest.fn().mockReturnValue(event),
        },
      };
      return { svc, prisma, tx, email };
    }

    it('unlocks the report and sends a localized confirmation', async () => {
      const { svc, tx, email, prisma } = build();
      await svc.handleWebhook(Buffer.from('{}'), 'sig');

      expect(prisma.stripeWebhookEvent.create).toHaveBeenCalledWith({
        data: { id: 'evt_1', type: 'checkout.session.completed' },
      });
      expect(tx.auditReport.update).toHaveBeenCalledWith({
        where: { id: 'report-1' },
        data: { fullReportUnlocked: true },
      });
      expect(email.sendPaymentConfirmation).toHaveBeenCalledWith(
        'buyer@example.com',
        expect.objectContaining({
          reportId: 'report-1',
          websiteUrl: 'https://shop.example',
          amount: '9.99',
          currency: 'eur',
          locale: 'de',
          reportUrl: 'https://policytracker.eu/de/report/full/report-1',
        }),
      );
    });

    it('skips a redelivered event without touching the report', async () => {
      const dup = Object.assign(new Error('unique'), { code: 'P2002' });
      const { svc, tx, email } = build({
        createEvent: jest.fn().mockRejectedValue(dup),
      });
      await svc.handleWebhook(Buffer.from('{}'), 'sig');
      expect(tx.auditReport.update).not.toHaveBeenCalled();
      expect(email.sendPaymentConfirmation).not.toHaveBeenCalled();
    });

    it('does not unlock while an async payment is still unpaid', async () => {
      const { svc, tx } = build({
        event: {
          id: 'evt_2',
          type: 'checkout.session.completed',
          data: { object: { ...paidSession, payment_status: 'unpaid' } },
        },
      });
      await svc.handleWebhook(Buffer.from('{}'), 'sig');
      expect(tx.auditReport.update).not.toHaveBeenCalled();
    });

    it('raises WebhookSignatureError on a bad signature', async () => {
      const { svc, prisma } = build({
        constructEvent: jest.fn(() => {
          throw new Error('No signatures found');
        }),
      });
      await expect(
        svc.handleWebhook(Buffer.from('{}'), 'bad'),
      ).rejects.toBeInstanceOf(WebhookSignatureError);
      expect(prisma.stripeWebhookEvent.create).not.toHaveBeenCalled();
    });

    it('refuses to verify without a webhook secret', async () => {
      const { svc } = build({ secret: undefined });
      await expect(svc.handleWebhook(Buffer.from('{}'), 'sig')).rejects.toThrow(
        'STRIPE_WEBHOOK_SECRET is not configured',
      );
    });

    it('releases the event claim when processing fails so Stripe can retry', async () => {
      const { svc, prisma } = build();
      prisma.$transaction.mockRejectedValueOnce(new Error('DB down'));
      await expect(svc.handleWebhook(Buffer.from('{}'), 'sig')).rejects.toThrow(
        'DB down',
      );
      expect(prisma.stripeWebhookEvent.delete).toHaveBeenCalledWith({
        where: { id: 'evt_1' },
      });
    });

    it('keeps the unlock when the confirmation e-mail fails', async () => {
      const { svc, tx, email, prisma } = build();
      email.sendPaymentConfirmation.mockRejectedValueOnce(new Error('smtp'));
      await expect(
        svc.handleWebhook(Buffer.from('{}'), 'sig'),
      ).resolves.toBeUndefined();
      expect(tx.auditReport.update).toHaveBeenCalled();
      expect(prisma.stripeWebhookEvent.delete).not.toHaveBeenCalled();
    });

    it('never downgrades a completed payment on a late expiry', async () => {
      const { svc, prisma } = build({
        event: {
          id: 'evt_3',
          type: 'checkout.session.expired',
          data: { object: { ...paidSession, payment_status: 'unpaid' } },
        },
      });
      await svc.handleWebhook(Buffer.from('{}'), 'sig');
      expect(prisma.payment.updateMany).toHaveBeenCalledWith({
        where: { id: 'pay-1', status: 'PENDING' },
        data: { status: 'EXPIRED' },
      });
    });
  });
});
