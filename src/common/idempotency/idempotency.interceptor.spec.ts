import {
  Body,
  Controller,
  INestApplication,
  Post,
} from '@nestjs/common';
import { APP_INTERCEPTOR, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import {
  Idempotent,
  IdempotencyInterceptor,
} from './idempotency.interceptor';
import { IdempotencyService } from './idempotency.service';

@Controller('test')
class TestController {
  public callCount = 0;

  constructor() {}

  @Post('idem')
  @Idempotent()
  async idem(@Body() body: any) {
    (this as any).callCount = ((this as any).callCount ?? 0) + 1;
    return { echoed: body, n: (this as any).callCount };
  }

  @Post('plain')
  async plain(@Body() body: any) {
    return { echoed: body };
  }
}

/**
 * In-memory IdempotencyService — exercises the interceptor without
 * spinning up Postgres.
 */
class InMemoryIdempotency extends IdempotencyService {
  private cache = new Map<string, any>();

  constructor() {
    super({} as any);
  }

  async lookup(key: string, endpoint: string, hash: string) {
    const stored = this.cache.get(`${key}::${endpoint}`);
    if (!stored) return { hit: false } as const;
    if (stored.requestHash !== hash) {
      return { hit: true, conflict: true } as const;
    }
    return {
      hit: true,
      conflict: false,
      response: { status: stored.status, body: stored.body },
    } as const;
  }

  async store(key: string, endpoint: string, hash: string, response: any) {
    this.cache.set(`${key}::${endpoint}`, {
      requestHash: hash,
      status: response.status,
      body: response.body,
    });
  }
}

describe('IdempotencyInterceptor (e2e)', () => {
  let app: INestApplication;
  let controller: TestController;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [TestController],
      providers: [
        Reflector,
        // useValue avoids Nest trying to construct InMemoryIdempotency
        // (and resolving its inherited PrismaService dependency).
        { provide: IdempotencyService, useValue: new InMemoryIdempotency() },
        {
          provide: APP_INTERCEPTOR,
          useClass: IdempotencyInterceptor,
        },
      ],
    }).compile();

    app = module.createNestApplication();
    controller = app.get(TestController);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('passes through when no Idempotency-Key header is sent', async () => {
    const before = controller.callCount;
    const r1 = await request(app.getHttpServer())
      .post('/test/idem')
      .send({ a: 1 });
    const r2 = await request(app.getHttpServer())
      .post('/test/idem')
      .send({ a: 1 });
    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);
    // Two real handler invocations, two distinct counts
    expect(controller.callCount - before).toBe(2);
    expect(r2.body.n).toBeGreaterThan(r1.body.n);
  });

  it('replays the cached response when key + body match', async () => {
    const before = controller.callCount;
    const key = 'replay-key-1234';
    const r1 = await request(app.getHttpServer())
      .post('/test/idem')
      .set('Idempotency-Key', key)
      .send({ x: 'y' });
    const r2 = await request(app.getHttpServer())
      .post('/test/idem')
      .set('Idempotency-Key', key)
      .send({ x: 'y' });

    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);
    // Handler ran exactly once; r2 is the cached replay
    expect(controller.callCount - before).toBe(1);
    expect(r2.body).toEqual(r1.body);
    expect(r2.headers['idempotent-replay']).toBe('true');
  });

  it('rejects with 409 when the same key is reused with a different body', async () => {
    const key = 'conflict-key-9876';
    await request(app.getHttpServer())
      .post('/test/idem')
      .set('Idempotency-Key', key)
      .send({ x: 1 })
      .expect(201);

    const r2 = await request(app.getHttpServer())
      .post('/test/idem')
      .set('Idempotency-Key', key)
      .send({ x: 2 });

    expect(r2.status).toBe(409);
  });

  it('rejects keys that fail the format check', async () => {
    const r = await request(app.getHttpServer())
      .post('/test/idem')
      .set('Idempotency-Key', 'short') // < 8 chars
      .send({ a: 1 });
    expect(r.status).toBe(409);
  });

  it('ignores the header on routes not marked @Idempotent()', async () => {
    const r1 = await request(app.getHttpServer())
      .post('/test/plain')
      .set('Idempotency-Key', 'irrelevant-key-12345')
      .send({ a: 1 })
      .expect(201);
    const r2 = await request(app.getHttpServer())
      .post('/test/plain')
      .set('Idempotency-Key', 'irrelevant-key-12345')
      .send({ a: 1 })
      .expect(201);
    // Each call returns its own response — no caching
    expect(r1.body).toEqual({ echoed: { a: 1 } });
    expect(r2.body).toEqual({ echoed: { a: 1 } });
  });
});
