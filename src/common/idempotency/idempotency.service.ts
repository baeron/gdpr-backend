import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface CachedResponse {
  status: number;
  body: unknown;
}

/**
 * Stripe-style idempotency cache for unsafe HTTP methods.
 *
 * Lifecycle:
 *   1. Client sends `Idempotency-Key: <uuid>` on a POST.
 *   2. Server hashes the request body (canonicalised) and looks up
 *      (key, endpoint) in IdempotencyRecord.
 *      - hit + matching hash  → return cached response (true replay)
 *      - hit + different hash → throw (key reused with different body —
 *        unambiguous client bug; surface it instead of silently
 *        returning stale data)
 *      - miss                 → process request, then store result
 *   3. A periodic cleanup drops records past expiresAt.
 *
 * The store is in PostgreSQL rather than Redis so cached responses
 * survive a Redis flush / restart and so it works on the postgres-only
 * QUEUE_TYPE deployment.
 */
@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Stable hash of an arbitrary JSON-able request body. Sorting keys
   * matters because JSON.stringify is order-preserving for objects —
   * a payload-equivalent body with shuffled keys would otherwise hash
   * differently and trigger a false 422.
   */
  hashRequestBody(body: unknown): string {
    const canonical = JSON.stringify(body, this.sortedReplacer);
    return createHash('sha256').update(canonical).digest('hex');
  }

  private readonly sortedReplacer = (_key: string, value: unknown) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.keys(value as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((acc, k) => {
          acc[k] = (value as Record<string, unknown>)[k];
          return acc;
        }, {});
    }
    return value;
  };

  /**
   * Look up a previously-cached response.
   * Returns:
   *   - { hit: false }                     → no record
   *   - { hit: true, conflict: true }      → key reused with different body
   *   - { hit: true, response }            → safe replay
   */
  async lookup(
    key: string,
    endpoint: string,
    requestHash: string,
  ): Promise<
    | { hit: false }
    | { hit: true; conflict: true }
    | { hit: true; conflict: false; response: CachedResponse }
  > {
    const record = await (this.prisma as any).idempotencyRecord.findUnique({
      where: { key_endpoint: { key, endpoint } },
    });

    if (!record) return { hit: false };

    // Treat already-expired records as a miss; they will be overwritten
    // by the upsert in store(). The cleanup cron will eventually GC
    // them too, but we don't want to wait for it on the hot path.
    if (record.expiresAt.getTime() <= Date.now()) {
      return { hit: false };
    }

    if (record.requestHash !== requestHash) {
      return { hit: true, conflict: true };
    }

    return {
      hit: true,
      conflict: false,
      response: {
        status: record.responseStatus,
        body: record.responseBody,
      },
    };
  }

  /**
   * Store the response so subsequent retries can replay it. Uses an
   * upsert keyed on (key, endpoint) so a stale-expired row is replaced
   * rather than colliding.
   */
  async store(
    key: string,
    endpoint: string,
    requestHash: string,
    response: CachedResponse,
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + TTL_MS);

    await (this.prisma as any).idempotencyRecord.upsert({
      where: { key_endpoint: { key, endpoint } },
      create: {
        key,
        endpoint,
        requestHash,
        responseStatus: response.status,
        responseBody: response.body as object,
        expiresAt,
      },
      update: {
        requestHash,
        responseStatus: response.status,
        responseBody: response.body as object,
        expiresAt,
      },
    });
  }

  /**
   * Drop records past their TTL. Intended for a periodic cron; safe to
   * call on demand (e.g. tests).
   */
  async cleanupExpired(): Promise<number> {
    const result = await (this.prisma as any).idempotencyRecord.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    if (result.count > 0) {
      this.logger.log(
        `Cleaned up ${result.count} expired idempotency record(s)`,
      );
    }
    return result.count;
  }
}
