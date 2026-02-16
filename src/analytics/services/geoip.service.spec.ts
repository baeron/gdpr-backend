import { GeoIpService, GeoIpResult } from './geoip.service';

// Mock geoip-lite
jest.mock('geoip-lite', () => ({
  lookup: jest.fn((ip: string) => {
    const db: Record<string, { country: string; city: string; region: string; timezone: string }> = {
      '8.8.8.8': { country: 'US', city: 'Mountain View', region: 'CA', timezone: 'America/Los_Angeles' },
      '185.86.151.11': { country: 'DE', city: 'Frankfurt', region: 'HE', timezone: 'Europe/Berlin' },
      '2001:4860:4860::8888': { country: 'US', city: '', region: '', timezone: 'America/Chicago' },
    };
    return db[ip] || null;
  }),
}));

describe('GeoIpService', () => {
  let service: GeoIpService;

  beforeEach(() => {
    service = new GeoIpService();
  });

  it('should resolve known IPv4 address', () => {
    const result = service.lookup('8.8.8.8');
    expect(result.country).toBe('US');
    expect(result.city).toBe('Mountain View');
    expect(result.region).toBe('CA');
    expect(result.timezone).toBe('America/Los_Angeles');
  });

  it('should resolve German IP', () => {
    const result = service.lookup('185.86.151.11');
    expect(result.country).toBe('DE');
    expect(result.city).toBe('Frankfurt');
  });

  it('should resolve IPv6 address', () => {
    const result = service.lookup('2001:4860:4860::8888');
    expect(result.country).toBe('US');
  });

  it('should strip ::ffff: prefix from mapped IPv4', () => {
    const result = service.lookup('::ffff:8.8.8.8');
    expect(result.country).toBe('US');
  });

  it('should return nulls for unknown IP', () => {
    const result = service.lookup('192.168.1.1');
    expect(result).toEqual<GeoIpResult>({
      country: null,
      city: null,
      region: null,
      timezone: null,
    });
  });

  it('should return nulls for empty string', () => {
    const result = service.lookup('');
    expect(result.country).toBeNull();
  });

  it('should handle null fields in geoip response', () => {
    const result = service.lookup('2001:4860:4860::8888');
    // city and region are empty strings → should become null
    expect(result.city).toBeNull();
    expect(result.region).toBeNull();
  });
});
