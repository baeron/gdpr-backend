import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const SITEVERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export interface TurnstileVerifyResult {
  success: boolean;
  /** Cloudflare error-codes array (e.g. 'missing-input-response', 'invalid-input-response'). */
  errorCodes?: string[];
  /** Hostname the challenge was solved on (useful for logging/auditing). */
  hostname?: string;
  /** Action passed to the widget (if any). */
  action?: string;
  /** cdata passed to the widget (if any). */
  cdata?: string;
  /** ISO timestamp of challenge resolution. */
  challengeTs?: string;
}

/**
 * Thin wrapper around Cloudflare Turnstile's `siteverify` endpoint.
 *
 * The Secret Key lives ONLY here (server-side env). It must never be exposed
 * to any client, bundle, or frontend variable group. If the key is missing
 * and `NODE_ENV !== 'production'`, verification is skipped so local dev and
 * tests don't require a real Cloudflare site.
 */
@Injectable()
export class TurnstileService {
  private readonly logger = new Logger(TurnstileService.name);
  private readonly secretKey: string | undefined;
  private readonly isProduction: boolean;

  constructor(private readonly config: ConfigService) {
    this.secretKey = this.config.get<string>('TURNSTILE_SECRET_KEY');
    this.isProduction =
      this.config.get<string>('NODE_ENV') === 'production';

    if (!this.secretKey) {
      if (this.isProduction) {
        this.logger.error(
          'TURNSTILE_SECRET_KEY is not set in production. All captcha checks will FAIL closed.',
        );
      } else {
        this.logger.warn(
          'TURNSTILE_SECRET_KEY is not set; Turnstile verification is disabled (non-production).',
        );
      }
    }
  }

  /** Returns true iff captcha is configured and should be enforced. */
  isEnabled(): boolean {
    return Boolean(this.secretKey);
  }

  /** Returns true iff missing/invalid tokens should be rejected. */
  isRequired(): boolean {
    // In production we always require captcha. Outside of production we only
    // require it if a secret key is configured.
    return this.isProduction || this.isEnabled();
  }

  async verify(
    token: string | undefined | null,
    remoteIp?: string,
  ): Promise<TurnstileVerifyResult> {
    if (!this.isEnabled()) {
      // Fail-open only in non-production; production is handled by isRequired().
      return { success: !this.isProduction };
    }

    if (!token) {
      return { success: false, errorCodes: ['missing-input-response'] };
    }

    const body = new URLSearchParams({
      secret: this.secretKey!,
      response: token,
    });
    if (remoteIp) body.append('remoteip', remoteIp);

    try {
      const res = await fetch(SITEVERIFY_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body,
      });

      if (!res.ok) {
        this.logger.error(
          `Turnstile siteverify returned HTTP ${res.status}`,
        );
        return { success: false, errorCodes: ['siteverify-http-error'] };
      }

      const data = (await res.json()) as {
        success: boolean;
        'error-codes'?: string[];
        hostname?: string;
        action?: string;
        cdata?: string;
        challenge_ts?: string;
      };

      return {
        success: Boolean(data.success),
        errorCodes: data['error-codes'],
        hostname: data.hostname,
        action: data.action,
        cdata: data.cdata,
        challengeTs: data.challenge_ts,
      };
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      this.logger.error(
        `Turnstile siteverify request failed: ${e.message}`,
        e.stack,
      );
      return { success: false, errorCodes: ['siteverify-network-error'] };
    }
  }
}
