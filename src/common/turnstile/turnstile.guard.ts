import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Request } from 'express';
import { TurnstileService } from './turnstile.service';

/**
 * Reads `turnstileToken` from the request body, verifies it against
 * Cloudflare `siteverify`, and rejects the request with 403 if the challenge
 * was not solved. Attach with `@UseGuards(TurnstileGuard)` on any controller
 * route that accepts user-submitted forms (hero-form, audit request, scan
 * queue, etc.).
 */
@Injectable()
export class TurnstileGuard implements CanActivate {
  private readonly logger = new Logger(TurnstileGuard.name);

  constructor(private readonly turnstile: TurnstileService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const body = (req.body ?? {}) as { turnstileToken?: string };
    const token = body.turnstileToken;

    const result = await this.turnstile.verify(token, req.ip);

    if (!result.success) {
      if (!this.turnstile.isRequired()) {
        // Non-production + no secret configured: let the request through.
        return true;
      }
      this.logger.warn(
        `Turnstile verification failed for ${req.method} ${req.url}: ${
          result.errorCodes?.join(',') ?? 'unknown'
        }`,
      );
      throw new ForbiddenException({
        error: 'captcha_failed',
        message: 'Captcha verification failed. Please refresh and try again.',
        errorCodes: result.errorCodes,
      });
    }

    // Strip the token from the body so downstream DTO validation / services
    // don't see a field they don't care about.
    if ('turnstileToken' in body) {
      delete (body as Record<string, unknown>).turnstileToken;
    }
    return true;
  }
}
