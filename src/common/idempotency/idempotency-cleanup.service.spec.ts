import { IdempotencyCleanupService } from './idempotency-cleanup.service';
import { IdempotencyService } from './idempotency.service';

describe('IdempotencyCleanupService', () => {
  let service: IdempotencyCleanupService;
  let idempotency: jest.Mocked<Pick<IdempotencyService, 'cleanupExpired'>>;

  beforeEach(() => {
    idempotency = {
      cleanupExpired: jest.fn(),
    };
    service = new IdempotencyCleanupService(
      idempotency as unknown as IdempotencyService,
    );
  });

  it('delegates to IdempotencyService.cleanupExpired', async () => {
    idempotency.cleanupExpired.mockResolvedValue(5);
    await service.runDailyCleanup();
    expect(idempotency.cleanupExpired).toHaveBeenCalledTimes(1);
  });

  it('swallows errors so the cron never crashes the app', async () => {
    idempotency.cleanupExpired.mockRejectedValue(new Error('db down'));
    // Must NOT throw; the cron framework would otherwise log the
    // unhandled rejection but keep the schedule alive — we want a
    // controlled failure path that hits our logger instead.
    await expect(service.runDailyCleanup()).resolves.toBeUndefined();
  });

  it('logs nothing-to-do silently', async () => {
    idempotency.cleanupExpired.mockResolvedValue(0);
    await expect(service.runDailyCleanup()).resolves.toBeUndefined();
    expect(idempotency.cleanupExpired).toHaveBeenCalled();
  });
});
