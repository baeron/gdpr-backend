import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';

@Injectable()
export class IpAnonymizerService {
  private readonly salt: string;

  constructor(private readonly config: ConfigService) {
    this.salt = this.config.get<string>('ANALYTICS_IP_SALT', 'default-analytics-salt');
  }

  /**
   * Hash an IP address with a daily rotating salt.
   * This ensures:
   * - Same IP on same day → same hash (session correlation)
   * - Cannot reverse-engineer the original IP (GDPR compliant)
   * - Different hash each day (limits long-term tracking)
   */
  hash(ip: string): string {
    if (!ip) return '';

    const dailySalt = this.getDailySalt();
    return createHash('sha256')
      .update(`${ip}:${dailySalt}`)
      .digest('hex');
  }

  /**
   * Generate a daily salt by combining the static salt with today's date.
   * This rotates the hash daily so the same IP produces different hashes
   * on different days — limiting long-term user tracking.
   */
  private getDailySalt(): string {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return `${this.salt}:${today}`;
  }
}
