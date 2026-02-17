import { SslAnalyzer, SslCertificateInfo } from './ssl.analyzer';
import { RiskLevel } from '../dto/scan-result.dto';

describe('SslAnalyzer', () => {
  const makeValidSsl = (overrides: Partial<SslCertificateInfo> = {}): SslCertificateInfo => ({
    valid: true,
    issuer: "Let's Encrypt",
    subject: 'example.com',
    validFrom: '2025-01-01T00:00:00Z',
    validTo: '2026-06-01T00:00:00Z',
    daysUntilExpiry: 200,
    protocol: 'TLSv1.3',
    cipher: 'TLS_AES_256_GCM_SHA384',
    keyExchange: null,
    selfSigned: false,
    error: null,
    ...overrides,
  });

  describe('generateIssues', () => {
    it('should return empty for valid certificate', () => {
      expect(SslAnalyzer.generateIssues(makeValidSsl())).toHaveLength(0);
    });

    it('should skip non-HTTPS URLs', () => {
      const ssl = makeValidSsl({ valid: false, error: 'Not an HTTPS URL' });
      expect(SslAnalyzer.generateIssues(ssl)).toHaveLength(0);
    });

    it('SSL_SELF_SIGNED for self-signed certificate', () => {
      const ssl = makeValidSsl({ valid: false, selfSigned: true, error: 'DEPTH_ZERO_SELF_SIGNED_CERT' });
      const issues = SslAnalyzer.generateIssues(ssl);
      expect(issues.some((i) => i.code === 'SSL_SELF_SIGNED')).toBe(true);
      expect(issues.find((i) => i.code === 'SSL_SELF_SIGNED')!.riskLevel).toBe(RiskLevel.HIGH);
    });

    it('SSL_INVALID for invalid certificate (not self-signed)', () => {
      const ssl = makeValidSsl({ valid: false, selfSigned: false, error: 'CERT_HAS_EXPIRED' });
      const issues = SslAnalyzer.generateIssues(ssl);
      expect(issues.some((i) => i.code === 'SSL_INVALID' || i.code === 'SSL_EXPIRED')).toBe(true);
    });

    it('SSL_EXPIRED when daysUntilExpiry <= 0', () => {
      const ssl = makeValidSsl({ valid: false, daysUntilExpiry: -5, error: 'CERT_HAS_EXPIRED' });
      const issues = SslAnalyzer.generateIssues(ssl);
      expect(issues.some((i) => i.code === 'SSL_EXPIRED')).toBe(true);
      expect(issues.find((i) => i.code === 'SSL_EXPIRED')!.riskLevel).toBe(RiskLevel.CRITICAL);
    });

    it('SSL_EXPIRING_SOON when daysUntilExpiry <= 30', () => {
      const ssl = makeValidSsl({ daysUntilExpiry: 15 });
      const issues = SslAnalyzer.generateIssues(ssl);
      expect(issues.some((i) => i.code === 'SSL_EXPIRING_SOON')).toBe(true);
      expect(issues.find((i) => i.code === 'SSL_EXPIRING_SOON')!.riskLevel).toBe(RiskLevel.MEDIUM);
    });

    it('should NOT flag SSL_EXPIRING_SOON when > 30 days', () => {
      const ssl = makeValidSsl({ daysUntilExpiry: 60 });
      expect(SslAnalyzer.generateIssues(ssl).some((i) => i.code === 'SSL_EXPIRING_SOON')).toBe(false);
    });

    it('SSL_WEAK_PROTOCOL for TLSv1', () => {
      const ssl = makeValidSsl({ protocol: 'TLSv1' });
      const issues = SslAnalyzer.generateIssues(ssl);
      expect(issues.some((i) => i.code === 'SSL_WEAK_PROTOCOL')).toBe(true);
      expect(issues.find((i) => i.code === 'SSL_WEAK_PROTOCOL')!.riskLevel).toBe(RiskLevel.HIGH);
    });

    it('SSL_WEAK_PROTOCOL for TLSv1.1', () => {
      const ssl = makeValidSsl({ protocol: 'TLSv1.1' });
      expect(SslAnalyzer.generateIssues(ssl).some((i) => i.code === 'SSL_WEAK_PROTOCOL')).toBe(true);
    });

    it('SSL_WEAK_PROTOCOL for SSLv3', () => {
      const ssl = makeValidSsl({ protocol: 'SSLv3' });
      expect(SslAnalyzer.generateIssues(ssl).some((i) => i.code === 'SSL_WEAK_PROTOCOL')).toBe(true);
    });

    it('should NOT flag SSL_WEAK_PROTOCOL for TLSv1.2', () => {
      const ssl = makeValidSsl({ protocol: 'TLSv1.2' });
      expect(SslAnalyzer.generateIssues(ssl).some((i) => i.code === 'SSL_WEAK_PROTOCOL')).toBe(false);
    });

    it('should NOT flag SSL_WEAK_PROTOCOL for TLSv1.3', () => {
      const ssl = makeValidSsl({ protocol: 'TLSv1.3' });
      expect(SslAnalyzer.generateIssues(ssl).some((i) => i.code === 'SSL_WEAK_PROTOCOL')).toBe(false);
    });

    it('should return multiple issues for expired + weak protocol', () => {
      const ssl = makeValidSsl({
        valid: false,
        daysUntilExpiry: -10,
        protocol: 'TLSv1',
        error: 'CERT_HAS_EXPIRED',
      });
      const issues = SslAnalyzer.generateIssues(ssl);
      expect(issues.some((i) => i.code === 'SSL_EXPIRED')).toBe(true);
      expect(issues.some((i) => i.code === 'SSL_WEAK_PROTOCOL')).toBe(true);
    });
  });
});
