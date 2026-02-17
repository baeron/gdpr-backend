import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class SanitizeUrlPipe implements PipeTransform<string, string> {
  private readonly BLOCKED_PROTOCOLS = [
    'javascript:',
    'data:',
    'file:',
    'ftp:',
    'gopher:',
  ];

  private readonly BLOCKED_HOSTS = [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '::1',
    '169.254.',    // link-local
    '10.',         // private class A
    '192.168.',    // private class C
  ];

  transform(value: string): string {
    if (!value || typeof value !== 'string') {
      throw new BadRequestException('URL is required');
    }

    const trimmed = value.trim();

    // Block dangerous protocols
    const lowerUrl = trimmed.toLowerCase();
    for (const protocol of this.BLOCKED_PROTOCOLS) {
      if (lowerUrl.startsWith(protocol)) {
        throw new BadRequestException(
          `Protocol "${protocol}" is not allowed. Use http:// or https://`,
        );
      }
    }

    // Parse URL
    let parsed: URL;
    try {
      // Add https:// if no protocol
      const urlWithProtocol =
        trimmed.startsWith('http://') || trimmed.startsWith('https://')
          ? trimmed
          : `https://${trimmed}`;
      parsed = new URL(urlWithProtocol);
    } catch {
      throw new BadRequestException('Invalid URL format');
    }

    // Block internal/private hosts (SSRF protection)
    const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    for (const blocked of this.BLOCKED_HOSTS) {
      if (hostname === blocked || hostname.startsWith(blocked)) {
        throw new BadRequestException(
          'Scanning internal or private network addresses is not allowed',
        );
      }
    }

    // Block 172.16.0.0/12 private range
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) {
      throw new BadRequestException(
        'Scanning internal or private network addresses is not allowed',
      );
    }

    // Only allow http and https
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new BadRequestException(
        'Only http:// and https:// URLs are allowed',
      );
    }

    // Max URL length
    if (trimmed.length > 2048) {
      throw new BadRequestException('URL is too long (max 2048 characters)');
    }

    return parsed.href;
  }
}
