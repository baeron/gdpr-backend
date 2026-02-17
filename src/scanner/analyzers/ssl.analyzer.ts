import { Injectable } from '@nestjs/common';
import * as tls from 'tls';
import * as https from 'https';
import { RiskLevel, ScanIssue } from '../dto/scan-result.dto';

export interface SslCertificateInfo {
  valid: boolean;
  issuer: string | null;
  subject: string | null;
  validFrom: string | null;
  validTo: string | null;
  daysUntilExpiry: number | null;
  protocol: string | null;
  cipher: string | null;
  keyExchange: string | null;
  selfSigned: boolean;
  error: string | null;
}

@Injectable()
export class SslAnalyzer {
  async analyzeSsl(url: string): Promise<SslCertificateInfo> {
    const defaultResult: SslCertificateInfo = {
      valid: false,
      issuer: null,
      subject: null,
      validFrom: null,
      validTo: null,
      daysUntilExpiry: null,
      protocol: null,
      cipher: null,
      keyExchange: null,
      selfSigned: false,
      error: null,
    };

    try {
      const parsedUrl = new URL(url);

      if (parsedUrl.protocol !== 'https:') {
        return { ...defaultResult, error: 'Not an HTTPS URL' };
      }

      const hostname = parsedUrl.hostname;
      const port = parsedUrl.port ? parseInt(parsedUrl.port, 10) : 443;

      return await this.getCertificateInfo(hostname, port);
    } catch (err) {
      return {
        ...defaultResult,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  private getCertificateInfo(
    hostname: string,
    port: number,
  ): Promise<SslCertificateInfo> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve({
          valid: false,
          issuer: null,
          subject: null,
          validFrom: null,
          validTo: null,
          daysUntilExpiry: null,
          protocol: null,
          cipher: null,
          keyExchange: null,
          selfSigned: false,
          error: 'Connection timeout',
        });
      }, 10000);

      const options: https.RequestOptions = {
        hostname,
        port,
        method: 'HEAD',
        path: '/',
        rejectUnauthorized: false, // Allow self-signed for inspection
        timeout: 8000,
      };

      const req = https.request(options, (res) => {
        clearTimeout(timeout);

        const socket = res.socket as tls.TLSSocket;

        if (!socket || !socket.getPeerCertificate) {
          resolve({
            valid: false,
            issuer: null,
            subject: null,
            validFrom: null,
            validTo: null,
            daysUntilExpiry: null,
            protocol: null,
            cipher: null,
            keyExchange: null,
            selfSigned: false,
            error: 'Unable to get certificate',
          });
          return;
        }

        const cert = socket.getPeerCertificate(false);
        const authorized = socket.authorized;
        const protocol = socket.getProtocol() || null;
        const cipherInfo = socket.getCipher();

        if (!cert || !cert.valid_from) {
          resolve({
            valid: false,
            issuer: null,
            subject: null,
            validFrom: null,
            validTo: null,
            daysUntilExpiry: null,
            protocol,
            cipher: cipherInfo?.name || null,
            keyExchange: null,
            selfSigned: false,
            error: 'No certificate returned',
          });
          return;
        }

        const validFrom = new Date(cert.valid_from);
        const validTo = new Date(cert.valid_to);
        const now = new Date();
        const daysUntilExpiry = Math.floor(
          (validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        );

        const issuerCN = cert.issuer?.CN || cert.issuer?.O || null;
        const subjectCN = cert.subject?.CN || null;
        const selfSigned =
          !authorized &&
          cert.issuer?.CN === cert.subject?.CN &&
          cert.issuer?.O === cert.subject?.O;

        resolve({
          valid: authorized && daysUntilExpiry > 0,
          issuer: issuerCN,
          subject: subjectCN,
          validFrom: validFrom.toISOString(),
          validTo: validTo.toISOString(),
          daysUntilExpiry,
          protocol,
          cipher: cipherInfo?.name || null,
          keyExchange: null,
          selfSigned,
          error: authorized ? null : (String(socket.authorizationError) || 'Certificate not trusted'),
        });

        res.destroy();
      });

      req.on('error', (err) => {
        clearTimeout(timeout);
        resolve({
          valid: false,
          issuer: null,
          subject: null,
          validFrom: null,
          validTo: null,
          daysUntilExpiry: null,
          protocol: null,
          cipher: null,
          keyExchange: null,
          selfSigned: false,
          error: err.message,
        });
      });

      req.on('timeout', () => {
        req.destroy();
      });

      req.end();
    });
  }

  static generateIssues(ssl: SslCertificateInfo): ScanIssue[] {
    const issues: ScanIssue[] = [];

    if (ssl.error === 'Not an HTTPS URL') {
      // Already covered by NO_HTTPS in SecurityAnalyzer
      return issues;
    }

    if (ssl.selfSigned) {
      issues.push({
        code: 'SSL_SELF_SIGNED',
        title: 'Self-signed SSL certificate',
        description:
          'The website uses a self-signed SSL certificate, which browsers will flag as untrusted.',
        riskLevel: RiskLevel.HIGH,
        recommendation:
          'Obtain a valid SSL certificate from a trusted Certificate Authority (e.g., Let\'s Encrypt).',
      });
    }

    if (!ssl.valid && !ssl.selfSigned && ssl.error) {
      issues.push({
        code: 'SSL_INVALID',
        title: 'Invalid SSL certificate',
        description: `The SSL certificate is invalid: ${ssl.error}.`,
        riskLevel: RiskLevel.HIGH,
        recommendation:
          'Fix the SSL certificate issue to ensure encrypted data transmission for GDPR compliance.',
      });
    }

    if (ssl.daysUntilExpiry !== null && ssl.daysUntilExpiry <= 0) {
      issues.push({
        code: 'SSL_EXPIRED',
        title: 'SSL certificate has expired',
        description: `The SSL certificate expired ${Math.abs(ssl.daysUntilExpiry)} day(s) ago.`,
        riskLevel: RiskLevel.CRITICAL,
        recommendation:
          'Renew the SSL certificate immediately to restore encrypted connections.',
      });
    } else if (ssl.daysUntilExpiry !== null && ssl.daysUntilExpiry <= 30) {
      issues.push({
        code: 'SSL_EXPIRING_SOON',
        title: 'SSL certificate expiring soon',
        description: `The SSL certificate expires in ${ssl.daysUntilExpiry} day(s).`,
        riskLevel: RiskLevel.MEDIUM,
        recommendation:
          'Renew the SSL certificate before it expires to avoid service interruption.',
      });
    }

    if (ssl.protocol) {
      const weakProtocols = ['TLSv1', 'TLSv1.1', 'SSLv3'];
      if (weakProtocols.includes(ssl.protocol)) {
        issues.push({
          code: 'SSL_WEAK_PROTOCOL',
          title: 'Weak TLS protocol version',
          description: `The server uses ${ssl.protocol}, which is considered insecure.`,
          riskLevel: RiskLevel.HIGH,
          recommendation:
            'Upgrade to TLS 1.2 or TLS 1.3. Disable TLS 1.0, TLS 1.1, and SSLv3.',
        });
      }
    }

    return issues;
  }
}
