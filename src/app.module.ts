import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { RedisModule } from '@nestjs-modules/ioredis';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { IdempotencyModule } from './common/idempotency/idempotency.module';
import { IdempotencyInterceptor } from './common/idempotency/idempotency.interceptor';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuditModule } from './audit/audit.module';
import { EmailModule } from './email/email.module';
import { ScannerModule } from './scanner/scanner.module';
import { PaymentModule } from './payment/payment.module';
import { HealthModule } from './health/health.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { PricingModule } from './pricing/pricing.module';
import { TurnstileModule } from './common/turnstile/turnstile.module';

// Conditional Redis import - only when needed
const queueType = process.env.QUEUE_TYPE || 'postgres';
const needsRedis = ['redis', 'hybrid'].includes(queueType) || process.env.REDIS_URL;

const conditionalImports = needsRedis
  ? [
      RedisModule.forRootAsync({
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          type: 'single',
          url: config.get('REDIS_URL', 'redis://localhost:6379'),
        }),
      }),
    ]
  : [];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ...conditionalImports,
    TurnstileModule,
    PrismaModule,
    IdempotencyModule,
    EmailModule,
    AuditModule,
    ScannerModule,
    PaymentModule,
    HealthModule,
    AnalyticsModule,
    PricingModule,
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,
        limit: 10,  // 10 requests per second
      },
      {
        name: 'medium',
        ttl: 60000,
        limit: 100, // 100 requests per minute
      },
      {
        name: 'long',
        ttl: 3600000,
        limit: 1000, // 1000 requests per hour
      },
    ]),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      // Global so any controller method tagged with @Idempotent() is
      // covered without re-wiring per controller. Untagged routes
      // pass through unchanged (the interceptor checks the metadata
      // before doing any work).
      provide: APP_INTERCEPTOR,
      useClass: IdempotencyInterceptor,
    },
  ],
})
export class AppModule {}
