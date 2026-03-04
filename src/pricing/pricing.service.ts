import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { PricingRegion } from '@prisma/client';

export interface PricingInfo {
  region: PricingRegion;
  currentSlot: number;
  currentPrice: number;
  nextPrice: number;
  maxPrice: number;
  totalPurchases: number;
}

export interface GeoLocation {
  country: string;
  city?: string;
  region: PricingRegion;
}

@Injectable()
export class PricingService {
  private readonly logger = new Logger(PricingService.name);
  private readonly CAMPAIGN_ID = 'launch-2026';
  private readonly MAX_PRICE = 99;
  private readonly PRICE_STEP = 1;

  // Redis key patterns
  private readonly COUNTER_KEY_PREFIX = 'pricing:launch:';
  
  // Country to region mapping
  private readonly REGION_MAP: Record<string, PricingRegion> = {
    // EU countries
    AT: 'EU', BE: 'EU', BG: 'EU', HR: 'EU', CY: 'EU', CZ: 'EU',
    DK: 'EU', EE: 'EU', FI: 'EU', FR: 'EU', DE: 'EU', GR: 'EU',
    HU: 'EU', IE: 'EU', IT: 'EU', LV: 'EU', LT: 'EU', LU: 'EU',
    MT: 'EU', NL: 'EU', PL: 'EU', PT: 'EU', RO: 'EU', SK: 'EU',
    SI: 'EU', ES: 'EU', SE: 'EU',
    
    // UK
    GB: 'UK',
    
    // US + Canada
    US: 'US', CA: 'US',
    
    // Asia-Pacific
    JP: 'ASIA', SG: 'ASIA', KR: 'ASIA', HK: 'ASIA', TW: 'ASIA',
    AU: 'ASIA', NZ: 'ASIA', IN: 'ASIA', TH: 'ASIA', MY: 'ASIA',
    PH: 'ASIA', ID: 'ASIA', VN: 'ASIA',
    
    // Latin America
    MX: 'LATAM', BR: 'LATAM', AR: 'LATAM', CL: 'LATAM', CO: 'LATAM',
    PE: 'LATAM', VE: 'LATAM', EC: 'LATAM', BO: 'LATAM', PY: 'LATAM',
    UY: 'LATAM', CR: 'LATAM', PA: 'LATAM', GT: 'LATAM', HN: 'LATAM',
    SV: 'LATAM', NI: 'LATAM', DO: 'LATAM', CU: 'LATAM',
  };

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Determine pricing region from country code
   */
  getRegionFromCountry(countryCode: string): PricingRegion {
    const upperCode = countryCode?.toUpperCase();
    return this.REGION_MAP[upperCode] || 'OTHER';
  }

  /**
   * Get current pricing info for a region
   */
  async getCurrentPricing(region: PricingRegion): Promise<PricingInfo> {
    const counterKey = `${this.COUNTER_KEY_PREFIX}${region}`;
    const currentSlot = await this.redis.get(counterKey);
    const slotNumber = currentSlot ? parseInt(currentSlot, 10) : 0;
    
    const currentPrice = Math.min(slotNumber + 1, this.MAX_PRICE);
    const nextPrice = Math.min(slotNumber + 2, this.MAX_PRICE);
    
    return {
      region,
      currentSlot: slotNumber,
      currentPrice,
      nextPrice,
      maxPrice: this.MAX_PRICE,
      totalPurchases: slotNumber,
    };
  }

  /**
   * Get pricing info for all regions
   */
  async getAllRegionsPricing(): Promise<Record<PricingRegion, PricingInfo>> {
    const regions: PricingRegion[] = ['EU', 'US', 'UK', 'ASIA', 'LATAM', 'OTHER'];
    const pricingData: Record<string, PricingInfo> = {};
    
    for (const region of regions) {
      pricingData[region] = await this.getCurrentPricing(region);
    }
    
    return pricingData as Record<PricingRegion, PricingInfo>;
  }

  /**
   * Reserve a slot and get the price (atomic operation)
   * Returns the slot number and price for this purchase
   */
  async reserveSlot(region: PricingRegion): Promise<{ slotNumber: number; price: number }> {
    const counterKey = `${this.COUNTER_KEY_PREFIX}${region}`;
    
    // Atomic increment
    const slotNumber = await this.redis.incr(counterKey);
    
    // Calculate price (slot 1 = €1, slot 2 = €2, etc.)
    const price = Math.min(slotNumber, this.MAX_PRICE);
    
    this.logger.log(`Reserved slot ${slotNumber} for region ${region} at €${price}`);
    
    return { slotNumber, price };
  }

  /**
   * Record a purchase in the database
   */
  async recordPurchase(data: {
    reportId: string;
    region: PricingRegion;
    slotNumber: number;
    priceEur: number;
    country?: string;
    city?: string;
    ipHash?: string;
    userEmail?: string;
    stripeSessionId?: string;
  }) {
    return this.prisma.launchPurchase.create({
      data: {
        reportId: data.reportId,
        region: data.region,
        slotNumber: data.slotNumber,
        priceEur: data.priceEur,
        country: data.country,
        city: data.city,
        ipHash: data.ipHash,
        userEmail: data.userEmail,
        stripeSessionId: data.stripeSessionId,
        campaignId: this.CAMPAIGN_ID,
        status: 'PENDING',
      },
    });
  }

  /**
   * Update purchase status (after Stripe webhook)
   */
  async updatePurchaseStatus(
    stripeSessionId: string,
    status: 'COMPLETED' | 'FAILED' | 'EXPIRED',
    stripePaymentIntentId?: string,
  ) {
    return this.prisma.launchPurchase.update({
      where: { stripeSessionId },
      data: {
        status,
        stripePaymentIntentId,
      },
    });
  }

  /**
   * Get analytics data for the campaign
   */
  async getCampaignAnalytics() {
    const purchases = await this.prisma.launchPurchase.findMany({
      where: {
        campaignId: this.CAMPAIGN_ID,
        status: 'COMPLETED',
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group by region
    const byRegion = purchases.reduce((acc, p) => {
      if (!acc[p.region]) {
        acc[p.region] = {
          count: 0,
          totalRevenue: 0,
          avgPrice: 0,
          minPrice: Infinity,
          maxPrice: 0,
          countries: new Set<string>(),
        };
      }
      
      acc[p.region].count++;
      acc[p.region].totalRevenue += p.priceEur;
      acc[p.region].minPrice = Math.min(acc[p.region].minPrice, p.priceEur);
      acc[p.region].maxPrice = Math.max(acc[p.region].maxPrice, p.priceEur);
      if (p.country) acc[p.region].countries.add(p.country);
      
      return acc;
    }, {} as Record<string, any>);

    // Calculate averages
    Object.keys(byRegion).forEach(region => {
      byRegion[region].avgPrice = byRegion[region].totalRevenue / byRegion[region].count;
      byRegion[region].countries = Array.from(byRegion[region].countries);
    });

    return {
      totalPurchases: purchases.length,
      totalRevenue: purchases.reduce((sum, p) => sum + p.priceEur, 0),
      byRegion,
      timeline: purchases.map(p => ({
        timestamp: p.createdAt,
        region: p.region,
        price: p.priceEur,
        slotNumber: p.slotNumber,
      })),
    };
  }

  /**
   * Reset counters (for testing or new campaign)
   */
  async resetCounters() {
    const regions: PricingRegion[] = ['EU', 'US', 'UK', 'ASIA', 'LATAM', 'OTHER'];
    
    for (const region of regions) {
      const counterKey = `${this.COUNTER_KEY_PREFIX}${region}`;
      await this.redis.del(counterKey);
    }
    
    this.logger.warn('All pricing counters have been reset');
  }

  /**
   * Initialize counters from database (in case Redis was cleared)
   */
  async initializeCountersFromDatabase() {
    const regions: PricingRegion[] = ['EU', 'US', 'UK', 'ASIA', 'LATAM', 'OTHER'];
    
    for (const region of regions) {
      const maxSlot = await this.prisma.launchPurchase.findFirst({
        where: {
          region,
          campaignId: this.CAMPAIGN_ID,
          status: 'COMPLETED',
        },
        orderBy: { slotNumber: 'desc' },
        select: { slotNumber: true },
      });

      if (maxSlot) {
        const counterKey = `${this.COUNTER_KEY_PREFIX}${region}`;
        await this.redis.set(counterKey, maxSlot.slotNumber);
        this.logger.log(`Initialized ${region} counter to ${maxSlot.slotNumber}`);
      }
    }
  }
}
