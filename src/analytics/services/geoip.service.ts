import { Injectable, Logger } from '@nestjs/common';
import * as geoip from 'geoip-lite';

export interface GeoIpResult {
  country: string | null; // ISO 3166-1 alpha-2
  city: string | null;
  region: string | null;
  timezone: string | null;
}

@Injectable()
export class GeoIpService {
  private readonly logger = new Logger(GeoIpService.name);

  /**
   * Lookup geographic information from an IP address.
   * Works for both IPv4 and IPv6.
   * Returns null fields if IP cannot be resolved.
   */
  lookup(ip: string): GeoIpResult {
    const fallback: GeoIpResult = {
      country: null,
      city: null,
      region: null,
      timezone: null,
    };

    if (!ip) return fallback;

    try {
      // Strip IPv6 prefix for mapped IPv4 addresses (e.g., ::ffff:127.0.0.1)
      const cleanIp = ip.replace(/^::ffff:/, '');

      const geo = geoip.lookup(cleanIp);
      if (!geo) return fallback;

      return {
        country: geo.country || null,
        city: geo.city || null,
        region: geo.region || null,
        timezone: geo.timezone || null,
      };
    } catch (error) {
      this.logger.warn(`GeoIP lookup failed for IP: ${error.message}`);
      return fallback;
    }
  }
}
