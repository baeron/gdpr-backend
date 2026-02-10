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
      expect(service.normalizeUrl('https://example.com')).toBe('https://example.com');
    });

    it('should keep http://', () => {
      expect(service.normalizeUrl('http://example.com')).toBe('http://example.com');
    });

    it('should handle URLs with paths', () => {
      expect(service.normalizeUrl('example.com/page')).toBe('https://example.com/page');
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
      expect(service.isSameDomain('sub.example.com', 'example.com')).toBe(false);
    });

    it('should match deep subdomain', () => {
      expect(service.isSameDomain('example.com', 'a.b.c.example.com')).toBe(true);
    });
  });

  describe('mergeCookies', () => {
    const makeCookie = (name: string, domain: string, beforeConsent: boolean): CookieInfo => ({
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
