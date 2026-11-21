import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Headers,
  Req,
  HttpCode,
  HttpStatus,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiProperty,
} from '@nestjs/swagger';
import { IsString, IsOptional, IsIn } from 'class-validator';
import type { Request } from 'express';
import { PaymentService, WebhookSignatureError } from './payment.service';
import { EU_LOCALES } from '../email/i18n/types';

// Stripe redirects back to the origin that started checkout. Only our own
// frontends qualify, otherwise any caller could point the success/cancel
// URLs at an arbitrary site.
const CHECKOUT_ORIGINS = new Set([
  'https://policytracker.eu',
  'https://www.policytracker.eu',
  'https://dev.policytracker.eu',
  'https://www.dev.policytracker.eu',
  'http://localhost:4200',
]);
const DEFAULT_CHECKOUT_ORIGIN = 'https://policytracker.eu';

class CreateCheckoutDto {
  @ApiProperty({ description: 'Report ID to purchase' })
  @IsString()
  reportId: string;

  @ApiProperty({ description: 'User email', required: false })
  @IsOptional()
  @IsString()
  userEmail?: string;

  @ApiProperty({ description: 'User region/locale', required: false })
  @IsOptional()
  @IsString()
  region?: string;

  @ApiProperty({
    description: 'A/B test variant',
    required: false,
    enum: ['A', 'B'],
  })
  @IsOptional()
  @IsIn(['A', 'B'])
  variant?: 'A' | 'B';

  @ApiProperty({
    description: 'Site locale; Stripe redirects back to /<locale>/…',
    required: false,
    enum: EU_LOCALES,
  })
  @IsOptional()
  @IsIn(EU_LOCALES as unknown as string[])
  locale?: string;
}

@ApiTags('payment')
@Controller('payment')
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(private readonly paymentService: PaymentService) {}

  @Post('checkout')
  @ApiOperation({ summary: 'Create Stripe checkout session for full report' })
  @ApiBody({ type: CreateCheckoutDto })
  @ApiResponse({ status: 200, description: 'Checkout session created' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  async createCheckout(
    @Body() body: CreateCheckoutDto,
    @Headers('origin') origin: string,
    @Req() req?: Request,
  ) {
    if (!body.reportId) {
      throw new BadRequestException('reportId is required');
    }

    const baseUrl =
      origin && CHECKOUT_ORIGINS.has(origin) ? origin : DEFAULT_CHECKOUT_ORIGIN;
    const localePrefix = body.locale ? `/${body.locale}` : '';
    const reportUrl = `${baseUrl}${localePrefix}/report/full/${encodeURIComponent(body.reportId)}`;

    const result = await this.paymentService.createCheckoutSession({
      reportId: body.reportId,
      userEmail: body.userEmail,
      region: body.region || 'en',
      variant: body.variant,
      clientKey: req?.ip,
      // Back to the report page in the visitor's language either way: paid
      // → full report; cancelled → the same page shows the paywall again.
      // (The scan page is keyed by job id, so /scan/<reportId> was a 404.)
      successUrl: reportUrl,
      cancelUrl: reportUrl,
    });

    return {
      sessionId: result.sessionId,
      url: result.url,
      pricing: {
        amount: result.pricing.amount / 100, // Convert cents to currency
        currency: result.pricing.currency,
        variant: result.pricing.variant,
      },
    };
  }

  @Get('pricing')
  @ApiOperation({ summary: 'Get pricing for a region (A/B test)' })
  @ApiResponse({ status: 200, description: 'Pricing information' })
  getPricing(
    @Query('region') region: string = 'en',
    @Query('variant') variant?: 'A' | 'B',
    @Req() req?: Request,
  ) {
    const pricing = this.paymentService.getPricing(region, variant, req?.ip);
    return {
      amount: pricing.amount / 100,
      currency: pricing.currency,
      variant: pricing.variant,
    };
  }

  @Get('verify/:sessionId')
  @ApiOperation({ summary: 'Verify payment status' })
  @ApiResponse({ status: 200, description: 'Payment verification result' })
  async verifyPayment(@Param('sessionId') sessionId: string) {
    return this.paymentService.verifyPayment(sessionId);
  }

  @Get('report/:reportId/access')
  @ApiOperation({ summary: 'Check if full report is unlocked' })
  @ApiResponse({ status: 200, description: 'Access status' })
  async checkAccess(@Param('reportId') reportId: string) {
    const unlocked = await this.paymentService.isReportUnlocked(reportId);
    return { reportId, unlocked };
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  // Stripe retries bursts from a small set of IPs; rate limiting them
  // would drop paid-order events. The signature check is the gate here.
  @SkipThrottle({ short: true, medium: true, long: true })
  @ApiOperation({ summary: 'Stripe webhook endpoint' })
  async handleWebhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('stripe-signature') signature: string,
  ) {
    if (!req.rawBody || !signature) {
      throw new BadRequestException('Missing raw body or Stripe signature');
    }

    try {
      await this.paymentService.handleWebhook(req.rawBody, signature);
      return { received: true };
    } catch (error) {
      if (error instanceof WebhookSignatureError) {
        throw new BadRequestException(error.message);
      }
      // Processing failure: answer 5xx so Stripe redelivers the event.
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Webhook processing failed: ${message}`);
      throw new InternalServerErrorException('Webhook processing failed');
    }
  }
}
