import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { GeoIpService } from './services/geoip.service';
import { UserAgentService } from './services/user-agent.service';
import { IpAnonymizerService } from './services/ip-anonymizer.service';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [AnalyticsController],
  providers: [
    AnalyticsService,
    GeoIpService,
    UserAgentService,
    IpAnonymizerService,
  ],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
