import { Injectable } from '@nestjs/common';
import { UAParser } from 'ua-parser-js';
import { DeviceType } from '@prisma/client';

export interface UserAgentResult {
  browser: string | null;
  browserVersion: string | null;
  os: string | null;
  osVersion: string | null;
  deviceType: DeviceType;
}

@Injectable()
export class UserAgentService {
  private readonly parser = new UAParser();

  /**
   * Parse User-Agent string into structured device/browser/os info.
   */
  parse(userAgent: string): UserAgentResult {
    const fallback: UserAgentResult = {
      browser: null,
      browserVersion: null,
      os: null,
      osVersion: null,
      deviceType: DeviceType.UNKNOWN,
    };

    if (!userAgent) return fallback;

    const result = this.parser.setUA(userAgent).getResult();

    return {
      browser: result.browser?.name || null,
      browserVersion: result.browser?.version || null,
      os: result.os?.name || null,
      osVersion: result.os?.version || null,
      deviceType: this.mapDeviceType(result.device?.type),
    };
  }

  /**
   * Map ua-parser-js device type to our DeviceType enum.
   * ua-parser-js returns: console, mobile, tablet, smarttv, wearable, embedded, undefined
   */
  private mapDeviceType(type: string | undefined): DeviceType {
    switch (type) {
      case 'mobile':
        return DeviceType.MOBILE;
      case 'tablet':
        return DeviceType.TABLET;
      case undefined:
      case '':
        // ua-parser-js returns undefined for desktop browsers
        return DeviceType.DESKTOP;
      default:
        return DeviceType.UNKNOWN;
    }
  }
}
