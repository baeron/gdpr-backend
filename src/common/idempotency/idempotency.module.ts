import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { IdempotencyService } from './idempotency.service';
import { IdempotencyInterceptor } from './idempotency.interceptor';
import { IdempotencyCleanupService } from './idempotency-cleanup.service';

/**
 * Provides the IdempotencyService and its NestInterceptor. Importing
 * modules wire the interceptor globally (main.ts) or per controller
 * (Reflector picks it up from @Idempotent()).
 *
 * IdempotencyCleanupService runs a daily @Cron — it relies on
 * ScheduleModule.forRoot() being imported from AppModule.
 */
@Module({
  imports: [PrismaModule],
  providers: [
    IdempotencyService,
    IdempotencyInterceptor,
    IdempotencyCleanupService,
  ],
  exports: [IdempotencyService, IdempotencyInterceptor],
})
export class IdempotencyModule {}
