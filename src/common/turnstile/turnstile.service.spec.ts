import { ConfigService } from '@nestjs/config';
import { TurnstileService } from './turnstile.service';

describe('TurnstileService', () => {
  const makeConfig = (overrides: Record<string, string | undefined>) => {
    return {
      get: <T = string>(key: string): T | undefined =>
        overrides[key] as unknown as T,
    } as unknown as ConfigService;
  };

  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  describe('when secret key is missing', () => {
    it('reports disabled and not required outside of production', () => {
      const svc = new TurnstileService(
        makeConfig({ NODE_ENV: 'development' }),
      );
      expect(svc.isEnabled()).toBe(false);
      expect(svc.isRequired()).toBe(false);
    });

    it('fail-opens (success=true) outside of production', async () => {
      const svc = new TurnstileService(
        makeConfig({ NODE_ENV: 'development' }),
      );
      const r = await svc.verify('whatever');
      expect(r.success).toBe(true);
    });

    it('fail-closes in production', async () => {
      const svc = new TurnstileService(
        makeConfig({ NODE_ENV: 'production' }),
      );
      expect(svc.isRequired()).toBe(true);
      const r = await svc.verify('whatever');
      expect(r.success).toBe(false);
    });
  });

  describe('when secret key is configured', () => {
    const cfg = () =>
      makeConfig({
        TURNSTILE_SECRET_KEY: 'sekret',
        NODE_ENV: 'production',
      });

    it('rejects missing token without hitting the network', async () => {
      const fetchSpy = jest.fn();
      global.fetch = fetchSpy as unknown as typeof fetch;
      const svc = new TurnstileService(cfg());

      const r = await svc.verify(undefined);
      expect(r.success).toBe(false);
      expect(r.errorCodes).toEqual(['missing-input-response']);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('posts secret + token (+ remoteip) to siteverify and parses success', async () => {
      const fetchSpy = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          hostname: 'example.com',
          action: 'audit',
          challenge_ts: '2026-01-01T00:00:00Z',
        }),
      });
      global.fetch = fetchSpy as unknown as typeof fetch;
      const svc = new TurnstileService(cfg());

      const r = await svc.verify('tok-123', '1.2.3.4');

      expect(r.success).toBe(true);
      expect(r.hostname).toBe('example.com');
      expect(r.action).toBe('audit');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      );
      expect(init.method).toBe('POST');
      const body = (init.body as URLSearchParams).toString();
      expect(body).toContain('secret=sekret');
      expect(body).toContain('response=tok-123');
      expect(body).toContain('remoteip=1.2.3.4');
    });

    it('returns success=false with error codes when CF rejects', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: false,
          'error-codes': ['invalid-input-response'],
        }),
      }) as unknown as typeof fetch;
      const svc = new TurnstileService(cfg());

      const r = await svc.verify('bad');
      expect(r.success).toBe(false);
      expect(r.errorCodes).toEqual(['invalid-input-response']);
    });

    it('returns failure on network errors instead of throwing', async () => {
      global.fetch = jest
        .fn()
        .mockRejectedValue(new Error('boom')) as unknown as typeof fetch;
      const svc = new TurnstileService(cfg());

      const r = await svc.verify('tok');
      expect(r.success).toBe(false);
      expect(r.errorCodes).toEqual(['siteverify-network-error']);
    });

    it('returns failure on non-2xx siteverify response', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({}),
      }) as unknown as typeof fetch;
      const svc = new TurnstileService(cfg());

      const r = await svc.verify('tok');
      expect(r.success).toBe(false);
      expect(r.errorCodes).toEqual(['siteverify-http-error']);
    });
  });
});
