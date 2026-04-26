import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { IdempotencyService } from './idempotency.service';

/**
 * Periodic cleanup for the IdempotencyRecord table.
 *
 * Records have a 24h TTL and lookup() already treats expired rows as
 * a miss, so the table is functionally bounded — but without active
 * GC it grows unboundedly on disk and bloats the (key, endpoint)
 * primary index. Running once per day at 03:00 server time keeps the
 * table small without competing with peak traffic.
 *
 * The job is idempotent and the underlying deleteMany acquires only
 * row-level locks, so multi-instance deployments don't need a
 * coordinator — at worst, both instances delete the same handful of
 * rows on the same tick.
 */
@Injectable()
export class IdempotencyCleanupService {
  private readonly logger = new Logger(IdempotencyCleanupService.name);

  constructor(private readonly idempotency: IdempotencyService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM, {
    name: 'idempotency-cleanup',
    // Server timezone is fine — we don't care about exact wall-clock
    // alignment, only "off-peak-ish".
  })
  async runDailyCleanup(): Promise<void> {
    try {
      const count = await this.idempotency.cleanupExpired();
      if (count > 0) {
        this.logger.log(`Daily cleanup removed ${count} expired record(s)`);
      } else {
        this.logger.debug('Daily cleanup: nothing to remove');
      }
    } catch (err) {
      // Never let the cron throw — Nest will silently retry next tick,
      // but we want visibility in logs / Sentry.
      this.logger.error(
        `Daily cleanup failed: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }
}
