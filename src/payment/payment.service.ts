import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import { EmailService } from '../email/email.service';
import { frontendUrl } from '../common/frontend-url';

/** Raised when a webhook payload does not carry a valid Stripe signature. */
export class WebhookSignatureError extends Error {}

/** Checkout payment states that mean the money is in (or none was owed). */
const SETTLED_PAYMENT_STATUSES = new Set(['paid', 'no_payment_required']);

/**
 * Launch price points, in minor units (cents/pence). Variant A is the
 * baseline, B the higher test arm. UK is set separately because a
 * same-number £ price would be ~17% dearer. All overridable via env so a
 * price change does not need a release; see .env.example.
 */
const DEFAULT_PRICES = {
  A: 999,
  B: 1499,
  UK_A: 899,
  UK_B: 1299,
} as const;

/** Stripe's minimum charge for EUR/USD/GBP is 50 minor units. */
const MIN_CHARGE = 50;

export interface PricingConfig {
  amount: number; // in cents
  currency: string;
  variant: 'A' | 'B';
}

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private readonly stripe: Stripe | null = null;

  // A/B test pricing variants by region (minor units). Filled from env.
  private readonly pricingByRegion: Record<string, { A: number; B: number }>;
  private readonly abTestEnabled: boolean;

  private readonly currencyByRegion: Record<string, string> = {
    EU: 'eur',
    US: 'usd',
    UK: 'gbp',
    DEFAULT: 'eur',
  };

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    // Only used to settle legacy launch-campaign sessions created before
    // the fixed-price switch; new checkouts never carry launchPurchaseId.
    @Optional() private readonly pricingService?: PricingService,
    @Optional() private readonly emailService?: EmailService,
  ) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!secretKey) {
      this.logger.warn(
        'STRIPE_SECRET_KEY not configured - payment features disabled',
      );
    } else {
      this.stripe = new Stripe(secretKey);
    }

    const a = this.priceFromEnv('PRICE_A_CENTS', DEFAULT_PRICES.A);
    const b = this.priceFromEnv('PRICE_B_CENTS', DEFAULT_PRICES.B);
    const ukA = this.priceFromEnv('PRICE_UK_A_CENTS', DEFAULT_PRICES.UK_A);
    const ukB = this.priceFromEnv('PRICE_UK_B_CENTS', DEFAULT_PRICES.UK_B);
    this.pricingByRegion = {
      EU: { A: a, B: b },
      US: { A: a, B: b },
      UK: { A: ukA, B: ukB },
      DEFAULT: { A: a, B: b },
    };
    this.abTestEnabled =
      this.configService.get<string>('PRICE_AB_TEST_ENABLED') !== 'false';
  }

  /** Integer minor-unit price from env, or the default when unset/invalid. */
  private priceFromEnv(key: string, fallback: number): number {
    const raw = this.configService.get<string>(key);
    if (raw === undefined || raw === '') return fallback;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < MIN_CHARGE) {
      this.logger.error(
        `${key}="${raw}" is not an integer amount in cents >= ${MIN_CHARGE}; using ${fallback}`,
      );
      return fallback;
    }
    return value;
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

    // Random A/B assignment if not specified. With the test switched off
    // everyone gets A, whatever variant the client sends back.
    const selectedVariant = !this.abTestEnabled
      ? 'A'
      : variant || (Math.random() < 0.5 ? 'A' : 'B');

    return {
      amount: pricing[selectedVariant],
      currency,
      variant: selectedVariant,
    };
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
    if (!webhookSecret) {
      // Config error, not a bad request: 5xx makes Stripe keep retrying
      // until the secret is deployed instead of dropping the event.
      throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
    }

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        webhookSecret,
      );
    } catch (err) {
      this.logger.error(
        `Webhook signature verification failed: ${(err as Error).message}`,
      );
      throw new WebhookSignatureError('Webhook signature verification failed');
    }

    // Stripe delivers at-least-once. Claim the event id first so a
    // redelivery (or a concurrent duplicate) is acknowledged without
    // unlocking twice or sending a second confirmation e-mail.
    try {
      await this.prisma.stripeWebhookEvent.create({
        data: { id: event.id, type: event.type },
      });
    } catch (err) {
      if ((err as { code?: string })?.code === 'P2002') {
        this.logger.log(`Duplicate webhook event ${event.id}, skipping`);
        return;
      }
      throw err;
    }

    this.logger.log(`Processing webhook event ${event.id}: ${event.type}`);

    try {
      switch (event.type) {
        case 'checkout.session.completed':
        case 'checkout.session.async_payment_succeeded':
          await this.handleCheckoutCompleted(event.data.object);
          break;
        case 'checkout.session.expired':
        case 'checkout.session.async_payment_failed':
          await this.handleCheckoutExpired(event.data.object);
          break;
        default:
          this.logger.log(`Unhandled event type: ${event.type}`);
      }
    } catch (err) {
      // Release the claim so Stripe's redelivery is processed again.
      await this.prisma.stripeWebhookEvent
        .delete({ where: { id: event.id } })
        .catch(() => undefined);
      throw err;
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
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error verifying payment: ${message}`);
      return { success: false, error: message };
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
    this.logger.log(
      `Checkout completed: ${session.id} (payment_status=${session.payment_status})`,
    );

    // `completed` also fires for delayed payment methods before the money
    // arrives (payment_status=unpaid); those unlock on
    // async_payment_succeeded instead.
    if (!SETTLED_PAYMENT_STATUSES.has(session.payment_status)) {
      this.logger.log(`Session ${session.id} not paid yet, not unlocking`);
      return;
    }

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
      await this.sendPaymentConfirmation(session, reportId);
    }
  }

  /**
   * Payment receipt with the link to the unlocked report. The link is the
   * buyer's only way back to the report if they closed the success page,
   * so it is sent from the webhook rather than the redirect. A mail
   * failure is logged and never fails the webhook: the unlock is already
   * committed and a retry would not re-send (the event is claimed).
   */
  private async sendPaymentConfirmation(
    session: Stripe.Checkout.Session,
    reportId: string,
  ): Promise<void> {
    if (!this.emailService) return;

    try {
      const to = session.customer_details?.email ?? session.customer_email;
      if (!to) {
        this.logger.warn(
          `No buyer e-mail on session ${session.id}; confirmation not sent`,
        );
        return;
      }

      const [report, job] = await Promise.all([
        this.prisma.auditReport.findUnique({
          where: { id: reportId },
          select: { websiteUrl: true },
        }),
        this.prisma.scanJob.findFirst({
          where: { reportId },
          select: { locale: true },
        }),
      ]);
      const locale = job?.locale ?? 'en';

      await this.emailService.sendPaymentConfirmation(to, {
        reportId,
        websiteUrl: report?.websiteUrl ?? '',
        amount: ((session.amount_total ?? 0) / 100).toFixed(2),
        currency: session.currency ?? 'eur',
        paymentDate: new Date(),
        locale,
        reportUrl: frontendUrl(locale, `report/full/${reportId}`),
      });
    } catch (err) {
      this.logger.error(
        `Payment confirmation e-mail for report ${reportId} failed: ${(err as Error).message}`,
      );
    }
  }

  private async handleCheckoutExpired(
    session: Stripe.Checkout.Session,
  ): Promise<void> {
    this.logger.log(`Checkout expired: ${session.id}`);

    const paymentId = session.metadata?.paymentId;
    if (paymentId) {
      // updateMany: a missing or already-completed row is not an error
      // worth a Stripe retry loop, and a late `expired` must never
      // downgrade a payment that already completed.
      await this.prisma.payment.updateMany({
        where: { id: paymentId, status: 'PENDING' },
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

    // Accept full locales (en-us), bare countries (de) and language-region
    // tags whose region part decides (de-at -> at -> EU).
    const tag = (region || '').toLowerCase().replace('_', '-');
    const [lang, country] = tag.split('-');
    return (
      regionMap[tag] ||
      (country && regionMap[country]) ||
      regionMap[lang] ||
      'DEFAULT'
    );
  }
}
