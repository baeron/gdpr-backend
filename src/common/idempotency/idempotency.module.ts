import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { IdempotencyService } from './idempotency.service';
import { IdempotencyInterceptor } from './idempotency.interceptor';

/**
 * Provides the IdempotencyService and its NestInterceptor. Importing
 * modules wire the interceptor either globally (main.ts) or per
 * controller (Reflector picks it up from @Idempotent()).
 */
@Module({
  imports: [PrismaModule],
  providers: [IdempotencyService, IdempotencyInterceptor],
  exports: [IdempotencyService, IdempotencyInterceptor],
})
export class IdempotencyModule {}
