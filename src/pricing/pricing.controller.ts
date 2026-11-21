import {
  Controller,
  Get,
  Post,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { PricingService } from './pricing.service';
import { GeoService } from './geo.service';
import type { PricingRegion } from '@prisma/client';
import { AdminGuard } from '../common/admin/admin.guard';

@Controller('pricing')
export class PricingController {
  constructor(
    private readonly pricingService: PricingService,
    private readonly geoService: GeoService,
  ) {}

  /**
   * Get current pricing for user's region
   * GET /pricing/current
   */
  @Get('current')
  async getCurrentPricing(@Req() req: Request) {
    const clientIp = this.geoService.getClientIP(req);
    const geoData = await this.geoService.getGeoFromIP(
      clientIp,
      req.headers as any,
    );

    const region = geoData
      ? this.pricingService.getRegionFromCountry(geoData.country)
      : ('OTHER' as PricingRegion);

    const pricing = await this.pricingService.getCurrentPricing(region);

    return {
      pricing,
      geo: {
        region,
        country: geoData?.country,
        city: geoData?.city,
      },
    };
  }

  /**
   * Get pricing for all regions
   * GET /pricing/all
   */
  @Get('all')
  async getAllPricing() {
    return this.pricingService.getAllRegionsPricing();
  }

  /**
   * Get campaign analytics (admin only)
   * GET /pricing/analytics
   */
  @UseGuards(AdminGuard)
  @Get('analytics')
  async getAnalytics() {
    return this.pricingService.getCampaignAnalytics();
  }

  /**
   * Initialize counters from database (admin only)
   * POST /pricing/init
   */
  @UseGuards(AdminGuard)
  @Post('init')
  @HttpCode(HttpStatus.OK)
  async initializeCounters() {
    await this.pricingService.initializeCountersFromDatabase();
    return { message: 'Counters initialized from database' };
  }

  /**
   * Reset all counters (admin only)
   * POST /pricing/reset
   */
  @UseGuards(AdminGuard)
  @Post('reset')
  @HttpCode(HttpStatus.OK)
  async resetCounters() {
    await this.pricingService.resetCounters();
    return { message: 'All counters reset' };
  }
}
