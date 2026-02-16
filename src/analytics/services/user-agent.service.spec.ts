import { UserAgentService } from './user-agent.service';

describe('UserAgentService', () => {
  let service: UserAgentService;

  beforeEach(() => {
    service = new UserAgentService();
  });

  describe('Desktop browsers', () => {
    it('should parse Chrome on Windows', () => {
      const ua =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      const result = service.parse(ua);

      expect(result.browser).toBe('Chrome');
      expect(result.browserVersion).toContain('120');
      expect(result.os).toBe('Windows');
      expect(result.osVersion).toBe('10');
      expect(result.deviceType).toBe('DESKTOP');
    });

    it('should parse Firefox on macOS', () => {
      const ua =
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0';
      const result = service.parse(ua);

      expect(result.browser).toBe('Firefox');
      expect(result.os).toBe('macOS');
      expect(result.deviceType).toBe('DESKTOP');
    });

    it('should parse Safari on macOS', () => {
      const ua =
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15';
      const result = service.parse(ua);

      expect(result.browser).toBe('Safari');
      expect(result.os).toBe('macOS');
      expect(result.deviceType).toBe('DESKTOP');
    });

    it('should parse Edge on Windows', () => {
      const ua =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0';
      const result = service.parse(ua);

      expect(result.browser).toBe('Edge');
      expect(result.os).toBe('Windows');
      expect(result.deviceType).toBe('DESKTOP');
    });
  });

  describe('Mobile browsers', () => {
    it('should parse Chrome on Android', () => {
      const ua =
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
      const result = service.parse(ua);

      expect(result.browser).toBe('Mobile Chrome');
      expect(result.os).toBe('Android');
      expect(result.deviceType).toBe('MOBILE');
    });

    it('should parse Safari on iPhone', () => {
      const ua =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1';
      const result = service.parse(ua);

      expect(result.browser).toBe('Mobile Safari');
      expect(result.os).toBe('iOS');
      expect(result.deviceType).toBe('MOBILE');
    });
  });

  describe('Tablet browsers', () => {
    it('should parse Safari on iPad', () => {
      const ua =
        'Mozilla/5.0 (iPad; CPU OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1';
      const result = service.parse(ua);

      expect(result.browser).toBe('Mobile Safari');
      expect(result.os).toBe('iOS');
      expect(result.deviceType).toBe('TABLET');
    });
  });

  describe('Edge cases', () => {
    it('should return UNKNOWN for empty string', () => {
      const result = service.parse('');
      expect(result.browser).toBeNull();
      expect(result.os).toBeNull();
      expect(result.deviceType).toBe('UNKNOWN');
    });

    it('should handle bot user agents', () => {
      const ua = 'Googlebot/2.1 (+http://www.google.com/bot.html)';
      const result = service.parse(ua);

      // Should not crash, device type should be DESKTOP or UNKNOWN
      expect(['DESKTOP', 'UNKNOWN']).toContain(result.deviceType);
    });
  });
});
