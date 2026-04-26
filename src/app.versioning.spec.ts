import { Controller, Get, INestApplication, VersioningType, VERSION_NEUTRAL } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');

@Controller('hello')
class HelloController {
  @Get()
  sayHi() {
    return { ok: true };
  }
}

/**
 * Verifies the dual-mount versioning configured in main.ts:
 * controllers without an explicit @Version() must answer on BOTH the
 * historical `/api/<path>` and the new `/api/v1/<path>` URLs.
 */
describe('URI versioning (dual mount)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [HelloController],
    }).compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: ['1', VERSION_NEUTRAL],
      prefix: 'v',
    });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves the legacy unversioned URL', async () => {
    const r = await request(app.getHttpServer()).get('/api/hello');
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true });
  });

  it('serves the same handler under /api/v1', async () => {
    const r = await request(app.getHttpServer()).get('/api/v1/hello');
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true });
  });

  it('does NOT mount the handler under an unrelated version', async () => {
    const r = await request(app.getHttpServer()).get('/api/v2/hello');
    expect(r.status).toBe(404);
  });
});
