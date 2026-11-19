import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { AdminGuard } from './admin.guard';

function ctx(authorization?: string): ExecutionContext {
  const req = {
    method: 'GET',
    url: '/api/pricing/analytics',
    headers: authorization ? { authorization } : {},
  };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

describe('AdminGuard', () => {
  const env = { ...process.env };
  let guard: AdminGuard;

  beforeEach(() => {
    guard = new AdminGuard();
  });

  afterEach(() => {
    process.env = { ...env };
  });

  describe('with ADMIN_API_TOKEN configured', () => {
    beforeEach(() => {
      process.env.ADMIN_API_TOKEN = 'secret-token-123';
      process.env.NODE_ENV = 'production';
    });

    it('allows a matching bearer token', () => {
      expect(guard.canActivate(ctx('Bearer secret-token-123'))).toBe(true);
    });

    it('rejects a missing header', () => {
      expect(() => guard.canActivate(ctx())).toThrow(UnauthorizedException);
    });

    it('rejects a wrong token', () => {
      expect(() => guard.canActivate(ctx('Bearer wrong'))).toThrow(
        UnauthorizedException,
      );
    });

    it('rejects a token of the same length but different value', () => {
      expect(() => guard.canActivate(ctx('Bearer secret-token-124'))).toThrow(
        UnauthorizedException,
      );
    });

    it('rejects a non-bearer scheme', () => {
      expect(() => guard.canActivate(ctx('Basic secret-token-123'))).toThrow(
        UnauthorizedException,
      );
    });

    it('enforces the token outside production too', () => {
      process.env.NODE_ENV = 'development';
      expect(() => guard.canActivate(ctx())).toThrow(UnauthorizedException);
    });
  });

  describe('without ADMIN_API_TOKEN', () => {
    beforeEach(() => {
      delete process.env.ADMIN_API_TOKEN;
    });

    it('fails closed in production', () => {
      process.env.NODE_ENV = 'production';
      expect(() => guard.canActivate(ctx('Bearer anything'))).toThrow(
        ForbiddenException,
      );
    });

    it('stays open in non-production environments', () => {
      process.env.NODE_ENV = 'development';
      expect(guard.canActivate(ctx())).toBe(true);
    });
  });
});
