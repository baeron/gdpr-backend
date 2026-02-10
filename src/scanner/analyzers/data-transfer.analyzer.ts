import { Injectable } from '@nestjs/common';
import { Request } from 'playwright';
import { RiskLevel, ScanIssue } from '../dto/scan-result.dto';

export interface DataTransferInfo {
  usServicesDetected: USServiceInfo[];
  thirdCountryServices: ThirdCountryServiceInfo[];
  totalUSServices: number;
  totalThirdCountryServices: number;
  highRiskTransfers: string[];
}

export interface USServiceInfo {
  name: string;
  domain: string;
  category:
    | 'analytics'
    | 'advertising'
    | 'cdn'
    | 'cloud'
    | 'social'
    | 'payment'
    | 'other';
  dataProcessed: string;
}

export interface ThirdCountryServiceInfo {
  domain: string;
  country: string;
  isAdequate: boolean; // Has EU adequacy decision
}

// US-based services commonly used on websites
const US_SERVICES: Record<
  string,
  { name: string; category: USServiceInfo['category']; dataProcessed: string }
> = {
  // Analytics
  'google-analytics.com': {
    name: 'Google Analytics',
    category: 'analytics',
    dataProcessed: 'User behavior, IP address, device info',
  },
  'googletagmanager.com': {
    name: 'Google Tag Manager',
    category: 'analytics',
    dataProcessed: 'Tag firing data, user interactions',
  },
  'analytics.google.com': {
    name: 'Google Analytics',
    category: 'analytics',
    dataProcessed: 'User behavior, IP address, device info',
  },
  'hotjar.com': {
    name: 'Hotjar',
    category: 'analytics',
    dataProcessed: 'Session recordings, heatmaps, user behavior',
  },
  'fullstory.com': {
    name: 'FullStory',
    category: 'analytics',
    dataProcessed: 'Session recordings, user interactions',
  },
  'mixpanel.com': {
    name: 'Mixpanel',
    category: 'analytics',
    dataProcessed: 'User events, behavior analytics',
  },
  'segment.com': {
    name: 'Segment',
    category: 'analytics',
    dataProcessed: 'Customer data, events',
  },
  'segment.io': {
    name: 'Segment',
    category: 'analytics',
    dataProcessed: 'Customer data, events',
  },
  'amplitude.com': {
    name: 'Amplitude',
    category: 'analytics',
    dataProcessed: 'Product analytics, user behavior',
  },
  'heap.io': {
    name: 'Heap',
    category: 'analytics',
    dataProcessed: 'User interactions, events',
  },
  'newrelic.com': {
    name: 'New Relic',
    category: 'analytics',
    dataProcessed: 'Performance data, errors',
  },
  'sentry.io': {
    name: 'Sentry',
    category: 'analytics',
    dataProcessed: 'Error tracking, stack traces',
  },

  // Advertising
  'doubleclick.net': {
    name: 'Google Ads (DoubleClick)',
    category: 'advertising',
    dataProcessed: 'Ad targeting, user profiles',
  },
  'googlesyndication.com': {
    name: 'Google AdSense',
    category: 'advertising',
    dataProcessed: 'Ad serving, user interests',
  },
  'googleadservices.com': {
    name: 'Google Ads',
    category: 'advertising',
    dataProcessed: 'Conversion tracking, remarketing',
  },
  'facebook.com': {
    name: 'Facebook/Meta',
    category: 'advertising',
    dataProcessed: 'User profiles, ad targeting',
  },
  'facebook.net': {
    name: 'Facebook/Meta',
    category: 'advertising',
    dataProcessed: 'Pixel tracking, conversions',
  },
  'connect.facebook.net': {
    name: 'Facebook SDK',
    category: 'advertising',
    dataProcessed: 'Social login, sharing data',
  },
  'meta.com': {
    name: 'Meta',
    category: 'advertising',
    dataProcessed: 'User profiles, ad targeting',
  },
  'tiktok.com': {
    name: 'TikTok',
    category: 'advertising',
    dataProcessed: 'Pixel tracking, user behavior',
  },
  'snapchat.com': {
    name: 'Snapchat',
    category: 'advertising',
    dataProcessed: 'Pixel tracking, conversions',
  },
  'twitter.com': {
    name: 'Twitter/X',
    category: 'advertising',
    dataProcessed: 'Pixel tracking, user data',
  },
  'ads-twitter.com': {
    name: 'Twitter Ads',
    category: 'advertising',
    dataProcessed: 'Ad targeting, conversions',
  },
  'linkedin.com': {
    name: 'LinkedIn',
    category: 'advertising',
    dataProcessed: 'Professional data, ad targeting',
  },
  'bing.com': {
    name: 'Microsoft Ads',
    category: 'advertising',
    dataProcessed: 'Search data, conversions',
  },
  'criteo.com': {
    name: 'Criteo',
    category: 'advertising',
    dataProcessed: 'Retargeting, user behavior',
  },
  'taboola.com': {
    name: 'Taboola',
    category: 'advertising',
    dataProcessed: 'Content recommendations, user interests',
  },
  'outbrain.com': {
    name: 'Outbrain',
    category: 'advertising',
    dataProcessed: 'Content recommendations, user interests',
  },

  // CDN & Cloud
  'cloudflare.com': {
    name: 'Cloudflare',
    category: 'cdn',
    dataProcessed: 'IP addresses, request data',
  },
  'cloudfront.net': {
    name: 'AWS CloudFront',
    category: 'cdn',
    dataProcessed: 'Content delivery, IP addresses',
  },
  'amazonaws.com': {
    name: 'Amazon AWS',
    category: 'cloud',
    dataProcessed: 'Hosted data, logs',
  },
  'akamai.net': {
    name: 'Akamai',
    category: 'cdn',
    dataProcessed: 'Content delivery, IP addresses',
  },
  'fastly.net': {
    name: 'Fastly',
    category: 'cdn',
    dataProcessed: 'Content delivery, IP addresses',
  },
  'azureedge.net': {
    name: 'Microsoft Azure CDN',
    category: 'cdn',
    dataProcessed: 'Content delivery, IP addresses',
  },
  'azure.com': {
    name: 'Microsoft Azure',
    category: 'cloud',
    dataProcessed: 'Hosted data, logs',
  },
  'googleapis.com': {
    name: 'Google APIs',
    category: 'cloud',
    dataProcessed: 'API requests, user data',
  },
  'gstatic.com': {
    name: 'Google Static',
    category: 'cdn',
    dataProcessed: 'Static content delivery',
  },

  // Social
  'instagram.com': {
    name: 'Instagram',
    category: 'social',
    dataProcessed: 'Social widgets, user data',
  },
  'youtube.com': {
    name: 'YouTube',
    category: 'social',
    dataProcessed: 'Video views, user preferences',
  },
  'ytimg.com': {
    name: 'YouTube Images',
    category: 'social',
    dataProcessed: 'Video thumbnails',
  },
  'pinterest.com': {
    name: 'Pinterest',
    category: 'social',
    dataProcessed: 'Pin data, user interests',
  },

  // Payment
  'stripe.com': {
    name: 'Stripe',
    category: 'payment',
    dataProcessed: 'Payment data, transactions',
  },
  'paypal.com': {
    name: 'PayPal',
    category: 'payment',
    dataProcessed: 'Payment data, transactions',
  },
  'braintreegateway.com': {
    name: 'Braintree',
    category: 'payment',
    dataProcessed: 'Payment data, transactions',
  },
};

// Countries with EU adequacy decisions
const ADEQUATE_COUNTRIES = [
  'andorra',
  'argentina',
  'canada',
  'faroe islands',
  'guernsey',
  'israel',
  'isle of man',
  'japan',
  'jersey',
  'new zealand',
  'republic of korea',
  'south korea',
  'switzerland',
  'united kingdom',
  'uk',
  'uruguay',
];

@Injectable()
export class DataTransferAnalyzer {
  private detectedServices: Map<string, USServiceInfo> = new Map();

  reset(): void {
    this.detectedServices.clear();
  }

  analyzeRequest(request: Request): void {
    try {
      const url = new URL(request.url());
      const domain = url.hostname.toLowerCase();

      // Check against known US services
      for (const [serviceDomain, serviceInfo] of Object.entries(US_SERVICES)) {
        if (domain.includes(serviceDomain) || domain.endsWith(serviceDomain)) {
          const key = serviceInfo.name;
          if (!this.detectedServices.has(key)) {
            this.detectedServices.set(key, {
              name: serviceInfo.name,
              domain: serviceDomain,
              category: serviceInfo.category,
              dataProcessed: serviceInfo.dataProcessed,
            });
          }
          break;
        }
      }
    } catch {
      // Invalid URL, skip
    }
  }

  getDataTransferInfo(): DataTransferInfo {
    const usServices = Array.from(this.detectedServices.values());

    // Identify high-risk transfers (advertising and analytics to US)
    const highRiskTransfers = usServices
      .filter((s) => s.category === 'advertising' || s.category === 'analytics')
      .map((s) => s.name);

    return {
      usServicesDetected: usServices,
      thirdCountryServices: [], // Could be extended to detect other third countries
      totalUSServices: usServices.length,
      totalThirdCountryServices: 0,
      highRiskTransfers: [...new Set(highRiskTransfers)],
    };
  }

  isAdequateCountry(country: string): boolean {
    return ADEQUATE_COUNTRIES.some(
      (c) =>
        country.toLowerCase().includes(c) || c.includes(country.toLowerCase()),
    );
  }

  static generateIssues(dataTransfers: Pick<DataTransferInfo, 'highRiskTransfers' | 'totalUSServices'>): ScanIssue[] {
    const issues: ScanIssue[] = [];

    if (dataTransfers.highRiskTransfers.length > 0) {
      issues.push({
        code: 'US_DATA_TRANSFERS',
        title: 'Data transfers to US-based services',
        description: `${dataTransfers.highRiskTransfers.length} US-based analytics/advertising service(s) detected: ${dataTransfers.highRiskTransfers.slice(0, 5).join(', ')}${dataTransfers.highRiskTransfers.length > 5 ? '...' : ''}.`,
        riskLevel: RiskLevel.HIGH,
        recommendation:
          'After Schrems II, transfers to US require additional safeguards (SCCs, supplementary measures). Consider EU-based alternatives or ensure proper legal basis.',
      });
    }

    if (dataTransfers.totalUSServices > 10) {
      issues.push({
        code: 'EXCESSIVE_US_SERVICES',
        title: 'Excessive number of US-based services',
        description: `${dataTransfers.totalUSServices} US-based services detected. This increases data transfer compliance complexity.`,
        riskLevel: RiskLevel.MEDIUM,
        recommendation:
          'Review and minimize the number of US-based third-party services. Consider EU-based alternatives where possible.',
      });
    }

    return issues;
  }
}
