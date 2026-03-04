import { Module } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { GeoService } from './geo.service';
import { PricingController } from './pricing.controller';
import { PricingGateway } from './pricing.gateway';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PricingController],
  providers: [PricingService, GeoService, PricingGateway],
  exports: [PricingService, GeoService],
})
export class PricingModule {}
