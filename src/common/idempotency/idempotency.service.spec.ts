import { IdempotencyService } from './idempotency.service';

/**
 * Unit-tests for the cache layer. The interceptor wiring is exercised
 * by the existing controller specs (which now run through APP_INTERCEPTOR).
 */
describe('IdempotencyService', () => {
  let service: IdempotencyService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      idempotencyRecord: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        deleteMany: jest.fn(),
      },
    };
    service = new IdempotencyService(prisma);
  });

  describe('hashRequestBody', () => {
    it('produces the same hash regardless of object key order', () => {
      const a = service.hashRequestBody({ a: 1, b: 2, c: 3 });
      const b = service.hashRequestBody({ c: 3, b: 2, a: 1 });
      expect(a).toBe(b);
    });

    it('produces different hashes for different content', () => {
      const a = service.hashRequestBody({ a: 1 });
      const b = service.hashRequestBody({ a: 2 });
      expect(a).not.toBe(b);
    });

    it('hashes nested objects regardless of key order', () => {
      const a = service.hashRequestBody({ outer: { x: 1, y: 2 } });
      const b = service.hashRequestBody({ outer: { y: 2, x: 1 } });
      expect(a).toBe(b);
    });

    it('preserves array order (arrays are NOT canonicalised)', () => {
      const a = service.hashRequestBody([1, 2, 3]);
      const b = service.hashRequestBody([3, 2, 1]);
      expect(a).not.toBe(b);
    });
  });

  describe('lookup', () => {
    it('returns hit=false when no record exists', async () => {
      prisma.idempotencyRecord.findUnique.mockResolvedValue(null);
      const result = await service.lookup('k', 'POST /x', 'h');
      expect(result).toEqual({ hit: false });
    });

    it('treats expired records as a miss', async () => {
      prisma.idempotencyRecord.findUnique.mockResolvedValue({
        requestHash: 'h',
        responseStatus: 200,
        responseBody: {},
        expiresAt: new Date(Date.now() - 1000),
      });
      const result = await service.lookup('k', 'POST /x', 'h');
      expect(result).toEqual({ hit: false });
    });

    it('returns conflict=true when the body hash differs', async () => {
      prisma.idempotencyRecord.findUnique.mockResolvedValue({
        requestHash: 'OTHER',
        responseStatus: 200,
        responseBody: {},
        expiresAt: new Date(Date.now() + 60_000),
      });
      const result = await service.lookup('k', 'POST /x', 'h');
      expect(result).toEqual({ hit: true, conflict: true });
    });

    it('returns the cached response on a true replay', async () => {
      prisma.idempotencyRecord.findUnique.mockResolvedValue({
        requestHash: 'h',
        responseStatus: 201,
        responseBody: { id: '42' },
        expiresAt: new Date(Date.now() + 60_000),
      });
      const result = await service.lookup('k', 'POST /x', 'h');
      expect(result).toEqual({
        hit: true,
        conflict: false,
        response: { status: 201, body: { id: '42' } },
      });
    });
  });

  describe('store', () => {
    it('upserts with a 24h TTL', async () => {
      prisma.idempotencyRecord.upsert.mockResolvedValue({});
      const before = Date.now();
      await service.store('k', 'POST /x', 'h', {
        status: 200,
        body: { ok: true },
      });

      const args = prisma.idempotencyRecord.upsert.mock.calls[0][0];
      expect(args.where).toEqual({ key_endpoint: { key: 'k', endpoint: 'POST /x' } });
      expect(args.create.requestHash).toBe('h');
      expect(args.create.responseStatus).toBe(200);
      expect(args.create.responseBody).toEqual({ ok: true });

      const ttlMs = args.create.expiresAt.getTime() - before;
      expect(ttlMs).toBeGreaterThan(23 * 60 * 60 * 1000);
      expect(ttlMs).toBeLessThan(25 * 60 * 60 * 1000);
    });
  });

  describe('cleanupExpired', () => {
    it('deletes only past-expiry records', async () => {
      prisma.idempotencyRecord.deleteMany.mockResolvedValue({ count: 7 });
      const count = await service.cleanupExpired();
      expect(count).toBe(7);
      const args = prisma.idempotencyRecord.deleteMany.mock.calls[0][0];
      expect(args.where.expiresAt.lt).toBeInstanceOf(Date);
    });
  });
});
