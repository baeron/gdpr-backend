import { UrlUtilsService } from './url-utils.service';
import { CookieInfo } from './dto/scan-result.dto';

describe('UrlUtilsService', () => {
  let service: UrlUtilsService;

  beforeEach(() => {
    service = new UrlUtilsService();
  });

  describe('normalizeUrl', () => {
    it('should add https:// when no protocol', () => {
      expect(service.normalizeUrl('example.com')).toBe('https://example.com');
    });

    it('should keep https://', () => {
      expect(service.normalizeUrl('https://example.com')).toBe(
        'https://example.com',
      );
    });

    it('should keep http://', () => {
      expect(service.normalizeUrl('http://example.com')).toBe(
        'http://example.com',
      );
    });

    it('should handle URLs with paths', () => {
      expect(service.normalizeUrl('example.com/page')).toBe(
        'https://example.com/page',
      );
    });
  });

  describe('isSameDomain', () => {
    it('should match exact domain', () => {
      expect(service.isSameDomain('example.com', 'example.com')).toBe(true);
    });

    it('should match www subdomain', () => {
      expect(service.isSameDomain('example.com', 'www.example.com')).toBe(true);
    });

    it('should match subdomain', () => {
      expect(service.isSameDomain('example.com', 'api.example.com')).toBe(true);
    });

    it('should NOT match different domain', () => {
      expect(service.isSameDomain('example.com', 'google.com')).toBe(false);
    });

    it('should NOT match partial domain (bug fix)', () => {
      expect(service.isSameDomain('example.com', 'notexample.com')).toBe(false);
    });

    it('should handle www on base domain', () => {
      expect(service.isSameDomain('www.example.com', 'example.com')).toBe(true);
    });

    it('should NOT match superdomain', () => {
      expect(service.isSameDomain('sub.example.com', 'example.com')).toBe(
        false,
      );
    });

    it('should match deep subdomain', () => {
      expect(service.isSameDomain('example.com', 'a.b.c.example.com')).toBe(
        true,
      );
    });
  });

  describe('validateAndCheckUrl', () => {
    const withDns = (map: Record<string, string[]>) => {
      service.resolver = (host: string) =>
        map[host]
          ? Promise.resolve(map[host])
          : Promise.reject(new Error('ENOTFOUND'));
    };

    it('accepts a public domain and keeps the normalized URL', async () => {
      withDns({ 'example.org': ['93.184.216.34'] });
      const res = await service.validateAndCheckUrl('example.org');
      expect(res).toEqual({
        isValid: true,
        normalizedUrl: 'https://example.org',
      });
    });

    it('rejects domains resolving to loopback (SSRF via nip.io)', async () => {
      withDns({ '127.0.0.1.nip.io': ['127.0.0.1'] });
      const res = await service.validateAndCheckUrl('http://127.0.0.1.nip.io');
      expect(res.isValid).toBe(false);
      expect(res.error).toMatch(/private network/);
    });

    it('rejects domains resolving to cloud metadata / private ranges', async () => {
      withDns({
        'meta.evil.test': ['169.254.169.254'],
        'lan.evil.test': ['93.184.216.34', '10.0.0.1'],
      });
      expect(
        (await service.validateAndCheckUrl('meta.evil.test')).isValid,
      ).toBe(false);
      expect((await service.validateAndCheckUrl('lan.evil.test')).isValid).toBe(
        false,
      );
    });

    it('rejects raw IP addresses, including IPv6 loopback', async () => {
      withDns({});
      for (const url of [
        'http://127.0.0.1',
        'https://8.8.8.8',
        'http://[::1]/',
        'http://169.254.169.254/latest',
      ]) {
        const res = await service.validateAndCheckUrl(url);
        expect(res.isValid).toBe(false);
      }
    });

    it('rejects localhost', async () => {
      withDns({});
      expect(
        (await service.validateAndCheckUrl('http://localhost:3000')).isValid,
      ).toBe(false);
      expect((await service.validateAndCheckUrl('localhost')).isValid).toBe(
        false,
      );
    });

    it('rejects non-standard ports, credentials and other schemes', async () => {
      withDns({ 'example.org': ['93.184.216.34'] });
      expect(
        (await service.validateAndCheckUrl('https://example.org:6379')).error,
      ).toMatch(/ports/);
      expect(
        (await service.validateAndCheckUrl('https://user:pw@example.org'))
          .error,
      ).toMatch(/credentials/);
      expect(
        (await service.validateAndCheckUrl('ftp://example.org')).isValid,
      ).toBe(false);
      expect(
        (await service.validateAndCheckUrl('https://example.org:443/ok'))
          .isValid,
      ).toBe(true);
    });

    it('reports unresolvable domains', async () => {
      withDns({});
      const res = await service.validateAndCheckUrl('does-not-exist.example');
      expect(res.error).toMatch(/could not be resolved/);
    });

    it('should reject blacklisted domains', async () => {
      const result = await service.validateAndCheckUrl(
        'https://google.com/test',
      );
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('not allowed');
    });

    it('should reject adult sites', async () => {
      const result = await service.validateAndCheckUrl('https://pornhub.com');
      expect(result.isValid).toBe(false);
    });

    it('should reject .gov domains', async () => {
      const result = await service.validateAndCheckUrl(
        'https://whitehouse.gov',
      );
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('not allowed');
    });

    it('should reject .edu domains', async () => {
      const result = await service.validateAndCheckUrl('https://harvard.edu');
      expect(result.isValid).toBe(false);
    });

    it('should handle invalid URLs', async () => {
      const result = await service.validateAndCheckUrl(
        'http://not-a-valid-domain-%#@.com',
      );
      expect(result.isValid).toBe(false);
    });
  });

  describe('mergeCookies', () => {
    const makeCookie = (
      name: string,
      domain: string,
      beforeConsent: boolean,
    ): CookieInfo => ({
      name,
      domain,
      path: '/',
      expires: null,
      httpOnly: false,
      secure: false,
      sameSite: 'None',
      category: 'unknown',
      setBeforeConsent: beforeConsent,
    });

    it('should merge unique cookies', () => {
      const before = [makeCookie('a', '.example.com', true)];
      const after = [makeCookie('b', '.example.com', false)];
      expect(service.mergeCookies(before, after)).toHaveLength(2);
    });

    it('should keep before-consent version on duplicate', () => {
      const before = [makeCookie('a', '.example.com', true)];
      const after = [makeCookie('a', '.example.com', false)];
      const result = service.mergeCookies(before, after);
      expect(result).toHaveLength(1);
      expect(result[0].setBeforeConsent).toBe(true);
    });

    it('should return empty for empty inputs', () => {
      expect(service.mergeCookies([], [])).toHaveLength(0);
    });

    it('should treat same name different domain as separate', () => {
      const before = [makeCookie('a', '.one.com', true)];
      const after = [makeCookie('a', '.two.com', false)];
      expect(service.mergeCookies(before, after)).toHaveLength(2);
    });
  });
});
