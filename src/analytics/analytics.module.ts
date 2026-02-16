import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsReportController } from './analytics-report.controller';
import { AnalyticsService } from './analytics.service';
import { AnalyticsReportService } from './analytics-report.service';
import { GeoIpService } from './services/geoip.service';
import { UserAgentService } from './services/user-agent.service';
import { IpAnonymizerService } from './services/ip-anonymizer.service';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [AnalyticsController, AnalyticsReportController],
  providers: [
    AnalyticsService,
    AnalyticsReportService,
    GeoIpService,
    UserAgentService,
    IpAnonymizerService,
  ],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
