import { BadRequestException } from '@nestjs/common';
import { SanitizeUrlPipe } from './sanitize-url.pipe';

describe('SanitizeUrlPipe', () => {
  let pipe: SanitizeUrlPipe;

  beforeEach(() => {
    pipe = new SanitizeUrlPipe();
  });

  describe('valid URLs', () => {
    it('should pass through valid https URL', () => {
      expect(pipe.transform('https://example.com')).toBe('https://example.com/');
    });

    it('should pass through valid http URL', () => {
      expect(pipe.transform('http://example.com')).toBe('http://example.com/');
    });

    it('should add https:// if no protocol', () => {
      expect(pipe.transform('example.com')).toBe('https://example.com/');
    });

    it('should trim whitespace', () => {
      expect(pipe.transform('  https://example.com  ')).toBe('https://example.com/');
    });

    it('should preserve path and query', () => {
      expect(pipe.transform('https://example.com/page?q=test')).toBe(
        'https://example.com/page?q=test',
      );
    });
  });

  describe('blocked protocols', () => {
    it('should reject javascript: protocol', () => {
      expect(() => pipe.transform('javascript:alert(1)')).toThrow(BadRequestException);
    });

    it('should reject data: protocol', () => {
      expect(() => pipe.transform('data:text/html,<h1>hi</h1>')).toThrow(BadRequestException);
    });

    it('should reject file: protocol', () => {
      expect(() => pipe.transform('file:///etc/passwd')).toThrow(BadRequestException);
    });

    it('should reject ftp: protocol', () => {
      expect(() => pipe.transform('ftp://example.com')).toThrow(BadRequestException);
    });
  });

  describe('SSRF protection — blocked hosts', () => {
    it('should reject localhost', () => {
      expect(() => pipe.transform('http://localhost')).toThrow(BadRequestException);
    });

    it('should reject 127.0.0.1', () => {
      expect(() => pipe.transform('http://127.0.0.1')).toThrow(BadRequestException);
    });

    it('should reject 0.0.0.0', () => {
      expect(() => pipe.transform('http://0.0.0.0')).toThrow(BadRequestException);
    });

    it('should reject ::1 (IPv6 loopback)', () => {
      expect(() => pipe.transform('http://[::1]')).toThrow(BadRequestException);
    });

    it('should reject 10.x.x.x (private class A)', () => {
      expect(() => pipe.transform('http://10.0.0.1')).toThrow(BadRequestException);
    });

    it('should reject 192.168.x.x (private class C)', () => {
      expect(() => pipe.transform('http://192.168.1.1')).toThrow(BadRequestException);
    });

    it('should reject 172.16.x.x (private class B)', () => {
      expect(() => pipe.transform('http://172.16.0.1')).toThrow(BadRequestException);
    });

    it('should reject 169.254.x.x (link-local)', () => {
      expect(() => pipe.transform('http://169.254.169.254')).toThrow(BadRequestException);
    });

    it('should allow 172.32.x.x (not private)', () => {
      expect(pipe.transform('http://172.32.0.1')).toBe('http://172.32.0.1/');
    });
  });

  describe('invalid input', () => {
    it('should reject empty string', () => {
      expect(() => pipe.transform('')).toThrow(BadRequestException);
    });

    it('should reject null-like values', () => {
      expect(() => pipe.transform(null as unknown as string)).toThrow(BadRequestException);
    });

    it('should reject URLs longer than 2048 chars', () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(2048);
      expect(() => pipe.transform(longUrl)).toThrow(BadRequestException);
    });
  });
});
