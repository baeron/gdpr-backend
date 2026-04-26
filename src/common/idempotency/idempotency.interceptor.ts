import {
  CallHandler,
  ConflictException,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, from, of } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { IdempotencyService } from './idempotency.service';

export const IDEMPOTENT_METADATA_KEY = 'cascade:idempotent';

/**
 * Class/handler decorator opt-in. Routes without it ignore the header.
 */
export const Idempotent = (): MethodDecorator & ClassDecorator => {
  return (target: any, propertyKey?: any, descriptor?: any) => {
    if (descriptor) {
      Reflect.defineMetadata(
        IDEMPOTENT_METADATA_KEY,
        true,
        descriptor.value,
      );
    } else {
      Reflect.defineMetadata(IDEMPOTENT_METADATA_KEY, true, target);
    }
  };
};

const HEADER_NAME = 'idempotency-key';
const KEY_PATTERN = /^[a-zA-Z0-9_-]{8,128}$/;

/**
 * Intercepts requests on routes marked @Idempotent() and:
 *   - if no `Idempotency-Key` header → pass-through
 *   - if header present and request was already seen with the same body
 *     → return cached response (no handler invocation)
 *   - if header reused with a different body → 409 Conflict
 *   - otherwise → run handler, cache the (success-only) response
 *
 * Errors are not cached: a transient failure should be retried, not
 * frozen-in by the cache.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);

  constructor(
    private readonly idempotency: IdempotencyService,
    private readonly reflector: Reflector,
  ) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const isIdempotent =
      this.reflector.get<boolean>(
        IDEMPOTENT_METADATA_KEY,
        context.getHandler(),
      ) ||
      this.reflector.get<boolean>(
        IDEMPOTENT_METADATA_KEY,
        context.getClass(),
      );

    if (!isIdempotent) return next.handle();

    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const rawKey = req.header(HEADER_NAME);

    if (!rawKey) {
      // Header is optional — opt-in even on idempotent routes. Without
      // a key we have nothing to deduplicate against, so behave as
      // before.
      return next.handle();
    }

    const key = rawKey.trim();
    if (!KEY_PATTERN.test(key)) {
      throw new ConflictException(
        'Invalid Idempotency-Key: must be 8-128 chars, [A-Za-z0-9_-].',
      );
    }

    const endpoint = `${req.method} ${this.routeOf(req)}`;
    const requestHash = this.idempotency.hashRequestBody(req.body ?? {});

    return from(this.idempotency.lookup(key, endpoint, requestHash)).pipe(
      switchMap((found) => {
        if (found.hit && found.conflict) {
          throw new ConflictException(
            'Idempotency-Key already used with a different request body.',
          );
        }

        if (found.hit) {
          this.logger.log(
            `Idempotency cache HIT for ${endpoint} key=${this.shortKey(key)}`,
          );
          res.status(found.response.status);
          res.setHeader('Idempotent-Replay', 'true');
          return of(found.response.body);
        }

        // Cache miss — run the handler and capture the result.
        return next.handle().pipe(
          tap((body) => {
            const status = res.statusCode || 200;
            // Don't cache errors / non-success — let the client retry.
            if (status >= 200 && status < 300) {
              this.idempotency
                .store(key, endpoint, requestHash, { status, body })
                .catch((err) =>
                  this.logger.warn(
                    `Failed to persist idempotency record: ${(err as Error).message}`,
                  ),
                );
            }
          }),
        );
      }),
    );
  }

  /**
   * Use the matched route template (e.g. /api/scanner/queue) rather
   * than the raw URL so query strings don't fragment the cache.
   */
  private routeOf(req: Request): string {
    return (
      (req as Request & { route?: { path?: string } }).route?.path ||
      req.path ||
      req.url
    );
  }

  private shortKey(k: string): string {
    return k.length <= 12 ? k : `${k.slice(0, 6)}…${k.slice(-4)}`;
  }
}
