import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';

export interface GeoData {
  country: string;
  city?: string;
  region?: string;
  timezone?: string;
}

@Injectable()
export class GeoService {
  private readonly logger = new Logger(GeoService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Get geo data from IP address
   * Uses CloudFlare headers if available, otherwise falls back to external service
   */
  async getGeoFromIP(ip: string, headers?: Record<string, string>): Promise<GeoData | null> {
    try {
      // Try CloudFlare headers first (if behind CloudFlare)
      if (headers) {
        const cfCountry = headers['cf-ipcountry'];
        const cfCity = headers['cf-ipcity'];
        const cfRegion = headers['cf-region'];
        const cfTimezone = headers['cf-timezone'];

        if (cfCountry && cfCountry !== 'XX') {
          return {
            country: cfCountry,
            city: cfCity,
            region: cfRegion,
            timezone: cfTimezone,
          };
        }
      }

      // Fallback to ip-api.com (free, 45 req/min)
      // In production, consider using paid service like MaxMind GeoIP2
      const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,countryCode,city,regionName,timezone`);
      
      if (!response.ok) {
        this.logger.warn(`Failed to get geo data for IP ${ip}: ${response.statusText}`);
        return null;
      }

      const data = await response.json();

      if (data.status === 'success') {
        return {
          country: data.countryCode,
          city: data.city,
          region: data.regionName,
          timezone: data.timezone,
        };
      }

      return null;
    } catch (error) {
      this.logger.error(`Error getting geo data for IP ${ip}:`, error);
      return null;
    }
  }

  /**
   * Hash IP address for privacy (GDPR compliance)
   * Uses daily salt so same IP has different hash each day
   */
  hashIP(ip: string): string {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const salt = this.config.get('IP_HASH_SALT', 'default-salt');
    const data = `${ip}:${today}:${salt}`;
    
    return createHash('sha256').update(data).digest('hex');
  }

  /**
   * Extract client IP from request
   * Handles proxies, load balancers, CloudFlare, etc.
   */
  getClientIP(req: any): string {
    // CloudFlare
    const cfConnectingIp = req.headers['cf-connecting-ip'];
    if (cfConnectingIp) return cfConnectingIp;

    // Standard proxy headers
    const xForwardedFor = req.headers['x-forwarded-for'];
    if (xForwardedFor) {
      const ips = xForwardedFor.split(',').map((ip: string) => ip.trim());
      return ips[0]; // First IP is the client
    }

    const xRealIp = req.headers['x-real-ip'];
    if (xRealIp) return xRealIp;

    // Direct connection
    return req.ip || req.connection?.remoteAddress || 'unknown';
  }
}
