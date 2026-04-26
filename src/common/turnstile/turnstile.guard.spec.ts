import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { TurnstileGuard } from './turnstile.guard';
import { TurnstileService } from './turnstile.service';

const makeContext = (req: Record<string, unknown>): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => req }),
  }) as unknown as ExecutionContext;

describe('TurnstileGuard', () => {
  it('lets the request through and strips turnstileToken on success', async () => {
    const service = {
      verify: jest.fn().mockResolvedValue({ success: true }),
      isRequired: () => true,
    } as unknown as TurnstileService;
    const guard = new TurnstileGuard(service);

    const req = {
      method: 'POST',
      url: '/audit',
      ip: '9.9.9.9',
      body: { email: 'a@b.c', turnstileToken: 'tok' },
    };
    const ok = await guard.canActivate(makeContext(req));

    expect(ok).toBe(true);
    expect(service.verify).toHaveBeenCalledWith('tok', '9.9.9.9');
    expect((req.body as Record<string, unknown>).turnstileToken).toBeUndefined();
    expect((req.body as Record<string, unknown>).email).toBe('a@b.c');
  });

  it('throws ForbiddenException when verification fails and captcha is required', async () => {
    const service = {
      verify: jest
        .fn()
        .mockResolvedValue({ success: false, errorCodes: ['x'] }),
      isRequired: () => true,
    } as unknown as TurnstileService;
    const guard = new TurnstileGuard(service);

    await expect(
      guard.canActivate(
        makeContext({ method: 'POST', url: '/audit', body: {} }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('passes through when verification fails but captcha is not required (dev)', async () => {
    const service = {
      verify: jest.fn().mockResolvedValue({ success: false }),
      isRequired: () => false,
    } as unknown as TurnstileService;
    const guard = new TurnstileGuard(service);

    const ok = await guard.canActivate(
      makeContext({ method: 'POST', url: '/audit', body: {} }),
    );
    expect(ok).toBe(true);
  });
});
