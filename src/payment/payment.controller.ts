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
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiProperty,
} from '@nestjs/swagger';
import { IsString, IsOptional, IsIn } from 'class-validator';
import type { Request } from 'express';
import { PaymentService } from './payment.service';

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
  ) {
    if (!body.reportId) {
      throw new BadRequestException('reportId is required');
    }

    const baseUrl = origin || 'https://policytracker.eu';

    const result = await this.paymentService.createCheckoutSession({
      reportId: body.reportId,
      userEmail: body.userEmail,
      region: body.region || 'en',
      variant: body.variant,
      successUrl: `${baseUrl}/report/full/${body.reportId}`,
      cancelUrl: `${baseUrl}/scan/${body.reportId}`,
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
  ) {
    const pricing = this.paymentService.getPricing(region, variant);
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
  @ApiOperation({ summary: 'Stripe webhook endpoint' })
  async handleWebhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('stripe-signature') signature: string,
  ) {
    const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));

    try {
      await this.paymentService.handleWebhook(rawBody, signature);
      return { received: true };
    } catch (error) {
      this.logger.error(`Webhook error: ${error.message}`);
      throw new BadRequestException(error.message);
    }
  }
}
