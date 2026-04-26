import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import { GeoService } from '../pricing/geo.service';

export interface PricingConfig {
  amount: number; // in cents
  currency: string;
  variant: 'A' | 'B';
}

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private readonly stripe: Stripe | null = null;

  // A/B test pricing variants by region
  private readonly pricingByRegion: Record<string, { A: number; B: number }> = {
    EU: { A: 100, B: 100 }, // €29 vs €49
    US: { A: 100, B: 100 }, // $29 vs $49
    UK: { A: 100, B: 100 }, // £24 vs £39
    DEFAULT: { A: 100, B: 100 },
  };

  private readonly currencyByRegion: Record<string, string> = {
    EU: 'eur',
    US: 'usd',
    UK: 'gbp',
    DEFAULT: 'eur',
  };

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly pricingService?: PricingService,
    private readonly geoService?: GeoService,
  ) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!secretKey) {
      this.logger.warn(
        'STRIPE_SECRET_KEY not configured - payment features disabled',
      );
    } else {
      this.stripe = new Stripe(secretKey);
    }
  }

  /**
   * Get pricing based on region and A/B test variant
   */
  getPricing(region: string, variant?: 'A' | 'B'): PricingConfig {
    const normalizedRegion = this.normalizeRegion(region);
    const pricing =
      this.pricingByRegion[normalizedRegion] || this.pricingByRegion.DEFAULT;
    const currency =
      this.currencyByRegion[normalizedRegion] || this.currencyByRegion.DEFAULT;

    // Random A/B assignment if not specified
    const selectedVariant = variant || (Math.random() < 0.5 ? 'A' : 'B');

    return {
      amount: pricing[selectedVariant],
      currency,
      variant: selectedVariant,
    };
  }

  /**
   * Create Stripe Checkout Session for launch campaign with dynamic pricing
   */
  async createLaunchCheckoutSession(params: {
    reportId: string;
    userEmail?: string;
    clientIp: string;
    country?: string;
    city?: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ 
    sessionId: string; 
    url: string; 
    priceEur: number;
    region: string;
    slotNumber: number;
  }> {
    if (!this.stripe) {
      throw new Error('Payment service not configured - STRIPE_SECRET_KEY missing');
    }

    if (!this.pricingService || !this.geoService) {
      throw new Error('Pricing service not available for launch campaign');
    }

    // Determine region from country or IP
    let region: any;
    if (params.country) {
      region = this.pricingService.getRegionFromCountry(params.country);
    } else {
      const geoData = await this.geoService.getGeoFromIP(params.clientIp);
      region = geoData 
        ? this.pricingService.getRegionFromCountry(geoData.country)
        : 'OTHER';
    }

    const ipHash = this.geoService.hashIP(params.clientIp);

    // Slot allocation can race when the Redis counter is unavailable and
    // the service falls back to the DB-based reserveSlot path. The DB has
    // a UNIQUE(region, campaignId, slotNumber) constraint as a backstop,
    // so a losing race surfaces as a Prisma P2002 error here. Retry up to
    // a small bound by re-reserving a fresh slot and re-issuing Stripe
    // with a fresh idempotency key.
    const MAX_SLOT_RETRIES = 5;
    let lastErr: unknown;

    for (let attempt = 1; attempt <= MAX_SLOT_RETRIES; attempt++) {
      const { slotNumber, price } =
        await this.pricingService.reserveSlot(region);

      this.logger.log(
        `Creating launch checkout for report ${params.reportId}, ` +
          `region: ${region}, slot: ${slotNumber}, price: €${price} ` +
          `(attempt ${attempt}/${MAX_SLOT_RETRIES})`,
      );

      // Each attempt gets its own id so a retry produces a NEW Stripe
      // session (we cannot reuse the previous idempotency key with
      // different metadata).
      const launchPurchaseId = randomUUID();

      // 1. Create the Stripe session FIRST. No orphan DB row on failure.
      const session = await this.stripe.checkout.sessions.create(
        {
          payment_method_types: ['card'],
          line_items: [
            {
              price_data: {
                currency: 'eur',
                product_data: {
                  name: 'GDPR Detailed Report - Launch Special',
                  description: `Complete GDPR analysis with recommendations (Launch price: €${price})`,
                },
                unit_amount: price * 100, // Convert to cents
              },
              quantity: 1,
            },
          ],
          mode: 'payment',
          success_url: `${params.successUrl}?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: params.cancelUrl,
          customer_email: params.userEmail,
          metadata: {
            reportId: params.reportId,
            launchPurchaseId,
            region,
            slotNumber: slotNumber.toString(),
            priceEur: price.toString(),
            campaignId: 'launch-2026',
          },
        },
        { idempotencyKey: launchPurchaseId },
      );

      try {
        // 2. Persist the LaunchPurchase with stripeSessionId already set.
        await this.pricingService.recordPurchase({
          id: launchPurchaseId,
          reportId: params.reportId,
          region,
          slotNumber,
          priceEur: price,
          country: params.country,
          city: params.city,
          ipHash,
          userEmail: params.userEmail,
          stripeSessionId: session.id,
        });

        return {
          sessionId: session.id,
          url: session.url!,
          priceEur: price,
          region,
          slotNumber,
        };
      } catch (err: unknown) {
        // P2002 = unique-constraint violation; here it can only mean
        // another concurrent reservation grabbed the same slot first.
        // The orphan Stripe session expires automatically and was never
        // charged (mode=payment, no payment_intent until checkout).
        const code = (err as { code?: string })?.code;
        if (code === 'P2002') {
          this.logger.warn(
            `Slot ${slotNumber} for region ${region} was taken by a concurrent ` +
              `reservation; retrying with a fresh slot.`,
          );
          lastErr = err;
          continue;
        }
        throw err;
      }
    }

    // Exhausted retries — surface the last race error so the caller can 5xx.
    throw new Error(
      `Failed to reserve a launch slot for region ${region} after ` +
        `${MAX_SLOT_RETRIES} attempts: ${(lastErr as Error)?.message ?? 'unknown'}`,
    );
  }

  /**
   * Create Stripe Checkout Session for full report purchase
   */
  async createCheckoutSession(params: {
    reportId: string;
    userEmail?: string;
    region: string;
    variant?: 'A' | 'B';
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ sessionId: string; url: string; pricing: PricingConfig }> {
    if (!this.stripe) {
      throw new Error(
        'Payment service not configured - STRIPE_SECRET_KEY missing',
      );
    }

    const pricing = this.getPricing(params.region, params.variant);

    this.logger.log(
      `Creating checkout session for report ${params.reportId}, ` +
        `pricing: ${pricing.amount} ${pricing.currency} (variant ${pricing.variant})`,
    );

    // Pre-generate the Payment id so it can be used as Stripe metadata
    // (the webhook looks it up by paymentId) and as Stripe idempotencyKey
    // (so a retried request never produces two checkout sessions).
    const paymentId = randomUUID();

    // 1. Create the Stripe session FIRST. If this throws, no DB row is
    //    written — we never end up with a PENDING Payment that has no
    //    matching Stripe session.
    const session = await this.stripe.checkout.sessions.create(
      {
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: pricing.currency,
              product_data: {
                name: 'GDPR Compliance Full Report',
                description:
                  'Complete GDPR compliance analysis with detailed recommendations',
              },
              unit_amount: pricing.amount,
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${params.successUrl}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: params.cancelUrl,
        customer_email: params.userEmail,
        metadata: {
          reportId: params.reportId,
          paymentId,
          priceVariant: pricing.variant,
        },
      },
      { idempotencyKey: paymentId },
    );

    // 2. Persist Payment with stripeSessionId already set in a single write.
    await this.prisma.payment.create({
      data: {
        id: paymentId,
        reportId: params.reportId,
        amount: pricing.amount,
        currency: pricing.currency,
        status: 'PENDING',
        priceVariant: pricing.variant,
        userEmail: params.userEmail,
        stripeSessionId: session.id,
      },
    });

    return {
      sessionId: session.id,
      url: session.url!,
      pricing,
    };
  }

  /**
   * Handle Stripe webhook events
   */
  async handleWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!this.stripe) {
      throw new Error(
        'Payment service not configured - STRIPE_SECRET_KEY missing',
      );
    }

    const webhookSecret = this.configService.get<string>(
      'STRIPE_WEBHOOK_SECRET',
    );

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        webhookSecret || '',
      );
    } catch (err) {
      this.logger.error(
        `Webhook signature verification failed: ${err.message}`,
      );
      throw new Error('Webhook signature verification failed');
    }

    this.logger.log(`Processing webhook event: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session,
        );
        break;
      case 'checkout.session.expired':
        await this.handleCheckoutExpired(
          event.data.object as Stripe.Checkout.Session,
        );
        break;
      default:
        this.logger.log(`Unhandled event type: ${event.type}`);
    }
  }

  /**
   * Verify payment and grant access to full report
   */
  async verifyPayment(sessionId: string): Promise<{
    success: boolean;
    reportId?: string;
    error?: string;
  }> {
    if (!this.stripe) {
      return { success: false, error: 'Payment service not configured' };
    }

    try {
      const session = await this.stripe.checkout.sessions.retrieve(sessionId);

      if (session.payment_status === 'paid') {
        const reportId = session.metadata?.reportId;

        // Update payment status
        if (session.metadata?.paymentId) {
          await this.prisma.payment.update({
            where: { id: session.metadata.paymentId },
            data: { status: 'COMPLETED' },
          });
        }

        // Grant access to full report
        if (reportId) {
          await this.prisma.auditReport.update({
            where: { id: reportId },
            data: { fullReportUnlocked: true },
          });
        }

        return { success: true, reportId };
      }

      return { success: false, error: 'Payment not completed' };
    } catch (error) {
      this.logger.error(`Error verifying payment: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if payment service is configured and available
   */
  isAvailable(): boolean {
    return this.stripe !== null;
  }

  /**
   * Check if full report is unlocked for a given report ID
   */
  async isReportUnlocked(reportId: string): Promise<boolean> {
    const report = await this.prisma.auditReport.findUnique({
      where: { id: reportId },
      select: { fullReportUnlocked: true },
    });
    return report?.fullReportUnlocked ?? false;
  }

  private async handleCheckoutCompleted(
    session: Stripe.Checkout.Session,
  ): Promise<void> {
    this.logger.log(`Checkout completed: ${session.id}`);

    const reportId = session.metadata?.reportId;
    const paymentId = session.metadata?.paymentId;
    const launchPurchaseId = session.metadata?.launchPurchaseId;
    const paymentIntentId = session.payment_intent as string;

    // All three writes (LaunchPurchase / Payment / AuditReport unlock)
    // must be applied atomically: a partial failure would leave the user
    // having paid Stripe without the report being unlocked, or vice-versa.
    await this.prisma.$transaction(async (tx) => {
      // Launch campaign purchase
      if (launchPurchaseId && this.pricingService) {
        await this.pricingService.updatePurchaseStatus(
          session.id,
          'COMPLETED',
          paymentIntentId,
          tx as unknown as Pick<PrismaService, 'launchPurchase'>,
        );
      }

      // Regular payment
      if (paymentId) {
        await tx.payment.update({
          where: { id: paymentId },
          data: {
            status: 'COMPLETED',
            stripePaymentIntentId: paymentIntentId,
          },
        });
      }

      // Unlock full report for both purchase flows
      if (reportId) {
        await tx.auditReport.update({
          where: { id: reportId },
          data: { fullReportUnlocked: true },
        });
      }
    });

    if (launchPurchaseId) {
      this.logger.log(`Launch purchase completed: ${launchPurchaseId}`);
      const region = session.metadata?.region;
      if (region) {
        // Note: Gateway broadcast will be called via PricingGateway injection
        this.logger.log(`Price updated for region ${region}`);
      }
    }
    if (reportId) {
      this.logger.log(`Full report unlocked for: ${reportId}`);
    }
  }

  private async handleCheckoutExpired(
    session: Stripe.Checkout.Session,
  ): Promise<void> {
    this.logger.log(`Checkout expired: ${session.id}`);

    const paymentId = session.metadata?.paymentId;
    if (paymentId) {
      await this.prisma.payment.update({
        where: { id: paymentId },
        data: { status: 'EXPIRED' },
      });
    }
  }

  private normalizeRegion(region: string): string {
    const regionMap: Record<string, string> = {
      // EU countries
      de: 'EU',
      fr: 'EU',
      it: 'EU',
      es: 'EU',
      nl: 'EU',
      be: 'EU',
      at: 'EU',
      pl: 'EU',
      pt: 'EU',
      ie: 'EU',
      gr: 'EU',
      cz: 'EU',
      ro: 'EU',
      hu: 'EU',
      se: 'EU',
      fi: 'EU',
      dk: 'EU',
      sk: 'EU',
      bg: 'EU',
      hr: 'EU',
      lt: 'EU',
      si: 'EU',
      lv: 'EU',
      ee: 'EU',
      cy: 'EU',
      lu: 'EU',
      mt: 'EU',
      // UK
      gb: 'UK',
      uk: 'UK',
      // US
      us: 'US',
      // Locales
      en: 'EU', // Default English to EU
      'en-us': 'US',
      'en-gb': 'UK',
    };

    return regionMap[region.toLowerCase()] || 'DEFAULT';
  }
}
