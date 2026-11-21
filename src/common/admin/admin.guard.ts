import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import type { Request } from 'express';

/**
 * Protects operator-only endpoints (campaign analytics, counter resets,
 * queue/DLQ management, detailed health, etc.).
 *
 * Clients authenticate with `Authorization: Bearer <ADMIN_API_TOKEN>`.
 *
 * Behaviour when `ADMIN_API_TOKEN` is NOT configured:
 *   - production → every request is rejected (fail closed),
 *   - any other env → requests pass through with a one-time warning, so
 *     local development and CI load tests keep working without a secret.
 *
 * The guard has no constructor dependencies on purpose: it reads
 * `process.env` at request time (ConfigModule already loads `.env` into it),
 * so it can be attached to controllers in any module — and in unit tests —
 * without wiring ConfigModule into every testing module.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  private readonly logger = new Logger(AdminGuard.name);
  private static warnedOpen = false;

  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.ADMIN_API_TOKEN ?? '';
    const isProduction = process.env.NODE_ENV === 'production';

    if (!expected) {
      if (isProduction) {
        this.logger.error(
          'ADMIN_API_TOKEN is not set in production — admin endpoints are locked.',
        );
        throw new ForbiddenException('Admin access is not configured');
      }
      if (!AdminGuard.warnedOpen) {
        AdminGuard.warnedOpen = true;
        this.logger.warn(
          'ADMIN_API_TOKEN is not set; admin endpoints are OPEN (non-production only).',
        );
      }
      return true;
    }

    const req = context.switchToHttp().getRequest<Request>();
    const header = req.headers['authorization'] ?? '';
    const match = /^Bearer\s+(.+)$/i.exec(
      Array.isArray(header) ? header[0] : header,
    );
    if (!match || !AdminGuard.safeEqual(match[1].trim(), expected)) {
      this.logger.warn(`Rejected admin request: ${req.method} ${req.url}`);
      throw new UnauthorizedException('Admin token required');
    }
    return true;
  }

  private static safeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  }
}
