import { ConfigService } from '@nestjs/config';
import { IpAnonymizerService } from './ip-anonymizer.service';

describe('IpAnonymizerService', () => {
  let service: IpAnonymizerService;

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue: string) => {
      if (key === 'ANALYTICS_IP_SALT') return 'test-salt-secret';
      return defaultValue;
    }),
  };

  beforeEach(() => {
    service = new IpAnonymizerService(mockConfigService as unknown as ConfigService);
  });

  it('should hash an IP address', () => {
    const hash = service.hash('8.8.8.8');
    expect(hash).toBeDefined();
    expect(hash.length).toBe(64); // SHA-256 hex = 64 chars
  });

  it('should produce consistent hash for same IP on same day', () => {
    const hash1 = service.hash('8.8.8.8');
    const hash2 = service.hash('8.8.8.8');
    expect(hash1).toBe(hash2);
  });

  it('should produce different hashes for different IPs', () => {
    const hash1 = service.hash('8.8.8.8');
    const hash2 = service.hash('1.1.1.1');
    expect(hash1).not.toBe(hash2);
  });

  it('should return empty string for empty IP', () => {
    const hash = service.hash('');
    expect(hash).toBe('');
  });

  it('should not return the original IP', () => {
    const ip = '185.86.151.11';
    const hash = service.hash(ip);
    expect(hash).not.toContain(ip);
    expect(hash).not.toContain('185');
  });

  it('should produce different hash on different days', () => {
    // Test by creating two services with mocked dates
    const hash1 = service.hash('8.8.8.8');

    // Mock Date to next day
    const originalDate = Date;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    jest.spyOn(global, 'Date').mockImplementation(() => tomorrow as unknown as Date);

    const service2 = new IpAnonymizerService(mockConfigService as unknown as ConfigService);
    const hash2 = service2.hash('8.8.8.8');

    // Restore Date
    global.Date = originalDate;

    expect(hash1).not.toBe(hash2);
  });
});
