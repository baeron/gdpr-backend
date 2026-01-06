import { Page, Request } from 'playwright';

export interface TechnologyInfo {
  name: string;
  category: TechnologyCategory;
  version?: string;
  confidence: 'high' | 'medium' | 'low';
  gdprRelevant: boolean;
  gdprNote?: string;
}

export type TechnologyCategory = 
  | 'cms'
  | 'framework'
  | 'analytics'
  | 'advertising'
  | 'consent'
  | 'cdn'
  | 'ecommerce'
  | 'hosting'
  | 'security'
  | 'email'
  | 'chat'
  | 'social'
  | 'other';

export interface TechnologyDetectionResult {
  technologies: TechnologyInfo[];
  cms: string | null;
  framework: string | null;
  consentPlatform: string | null;
  analytics: string[];
  advertising: string[];
  cdn: string | null;
}

// Technology signatures
const TECH_SIGNATURES: Array<{
  name: string;
  category: TechnologyCategory;
  patterns: {
    html?: RegExp[];
    headers?: Record<string, RegExp>;
    scripts?: RegExp[];
    cookies?: RegExp[];
    meta?: Record<string, RegExp>;
    globals?: string[];
  };
  gdprRelevant: boolean;
  gdprNote?: string;
}> = [
  // CMS
  {
    name: 'WordPress',
    category: 'cms',
    patterns: {
      html: [/wp-content/i, /wp-includes/i, /wordpress/i],
      meta: { generator: /wordpress/i },
      globals: ['wp', 'wpApiSettings'],
    },
    gdprRelevant: false,
  },
  {
    name: 'Drupal',
    category: 'cms',
    patterns: {
      html: [/drupal/i, /sites\/default\/files/i],
      meta: { generator: /drupal/i },
      globals: ['Drupal'],
    },
    gdprRelevant: false,
  },
  {
    name: 'Shopify',
    category: 'cms',
    patterns: {
      html: [/cdn\.shopify\.com/i, /shopify/i],
      scripts: [/cdn\.shopify\.com/i],
      globals: ['Shopify'],
    },
    gdprRelevant: true,
    gdprNote: 'Shopify processes customer data - ensure DPA is in place',
  },
  {
    name: 'Wix',
    category: 'cms',
    patterns: {
      html: [/wix\.com/i, /wixstatic\.com/i],
      scripts: [/static\.wixstatic\.com/i],
    },
    gdprRelevant: true,
    gdprNote: 'Wix is US-based - check data transfer compliance',
  },
  {
    name: 'Squarespace',
    category: 'cms',
    patterns: {
      html: [/squarespace/i, /sqsp/i],
      scripts: [/squarespace\.com/i],
    },
    gdprRelevant: true,
    gdprNote: 'Squarespace is US-based - check data transfer compliance',
  },

  // Frameworks
  {
    name: 'React',
    category: 'framework',
    patterns: {
      html: [/react/i, /_reactRootContainer/i, /data-reactroot/i],
      globals: ['React', '__REACT_DEVTOOLS_GLOBAL_HOOK__'],
    },
    gdprRelevant: false,
  },
  {
    name: 'Angular',
    category: 'framework',
    patterns: {
      html: [/ng-version/i, /ng-app/i, /_ngcontent/i],
      globals: ['ng', 'angular'],
    },
    gdprRelevant: false,
  },
  {
    name: 'Vue.js',
    category: 'framework',
    patterns: {
      html: [/data-v-[a-f0-9]/i, /vue/i],
      globals: ['Vue', '__VUE__'],
    },
    gdprRelevant: false,
  },
  {
    name: 'Next.js',
    category: 'framework',
    patterns: {
      html: [/__NEXT_DATA__/i, /_next\//i],
      scripts: [/_next\/static/i],
      globals: ['__NEXT_DATA__'],
    },
    gdprRelevant: false,
  },
  {
    name: 'Nuxt.js',
    category: 'framework',
    patterns: {
      html: [/__NUXT__/i, /_nuxt\//i],
      globals: ['__NUXT__', '$nuxt'],
    },
    gdprRelevant: false,
  },

  // Analytics
  {
    name: 'Google Analytics',
    category: 'analytics',
    patterns: {
      scripts: [/google-analytics\.com\/analytics\.js/i, /googletagmanager\.com\/gtag/i, /ga\.js/i],
      globals: ['ga', 'gtag', 'dataLayer'],
    },
    gdprRelevant: true,
    gdprNote: 'Requires consent before loading. US data transfer concerns.',
  },
  {
    name: 'Google Tag Manager',
    category: 'analytics',
    patterns: {
      scripts: [/googletagmanager\.com\/gtm\.js/i],
      globals: ['google_tag_manager'],
    },
    gdprRelevant: true,
    gdprNote: 'Configure to respect consent. Can load other trackers.',
  },
  {
    name: 'Hotjar',
    category: 'analytics',
    patterns: {
      scripts: [/static\.hotjar\.com/i, /hotjar/i],
      globals: ['hj', 'hjSiteSettings'],
    },
    gdprRelevant: true,
    gdprNote: 'Session recording requires explicit consent.',
  },
  {
    name: 'Mixpanel',
    category: 'analytics',
    patterns: {
      scripts: [/cdn\.mxpnl\.com/i, /mixpanel/i],
      globals: ['mixpanel'],
    },
    gdprRelevant: true,
    gdprNote: 'User behavior tracking - requires consent.',
  },
  {
    name: 'Matomo/Piwik',
    category: 'analytics',
    patterns: {
      scripts: [/matomo\.js/i, /piwik\.js/i],
      globals: ['_paq', 'Matomo'],
    },
    gdprRelevant: true,
    gdprNote: 'Can be self-hosted for better GDPR compliance.',
  },
  {
    name: 'Plausible',
    category: 'analytics',
    patterns: {
      scripts: [/plausible\.io/i],
    },
    gdprRelevant: false,
    gdprNote: 'Privacy-friendly, no cookies, EU-hosted option.',
  },

  // Advertising
  {
    name: 'Google Ads',
    category: 'advertising',
    patterns: {
      scripts: [/googleadservices\.com/i, /googlesyndication\.com/i],
    },
    gdprRelevant: true,
    gdprNote: 'Requires marketing consent. US data transfer.',
  },
  {
    name: 'Facebook Pixel',
    category: 'advertising',
    patterns: {
      scripts: [/connect\.facebook\.net/i, /facebook\.com\/tr/i],
      globals: ['fbq', '_fbq'],
    },
    gdprRelevant: true,
    gdprNote: 'Requires marketing consent. US data transfer concerns.',
  },
  {
    name: 'LinkedIn Insight',
    category: 'advertising',
    patterns: {
      scripts: [/snap\.licdn\.com/i, /linkedin\.com\/px/i],
      globals: ['_linkedin_data_partner_ids'],
    },
    gdprRelevant: true,
    gdprNote: 'Requires marketing consent.',
  },
  {
    name: 'TikTok Pixel',
    category: 'advertising',
    patterns: {
      scripts: [/analytics\.tiktok\.com/i],
      globals: ['ttq'],
    },
    gdprRelevant: true,
    gdprNote: 'Requires marketing consent. Data transfer to China/US.',
  },

  // Consent Management Platforms
  {
    name: 'OneTrust',
    category: 'consent',
    patterns: {
      scripts: [/cdn\.cookielaw\.org/i, /onetrust/i],
      html: [/onetrust/i, /optanon/i],
      globals: ['OneTrust', 'OptanonWrapper'],
    },
    gdprRelevant: true,
    gdprNote: 'Consent Management Platform detected.',
  },
  {
    name: 'Cookiebot',
    category: 'consent',
    patterns: {
      scripts: [/consent\.cookiebot\.com/i],
      html: [/cookiebot/i, /CybotCookiebot/i],
      globals: ['Cookiebot', 'CookieConsent'],
    },
    gdprRelevant: true,
    gdprNote: 'Consent Management Platform detected.',
  },
  {
    name: 'TrustArc',
    category: 'consent',
    patterns: {
      scripts: [/consent\.trustarc\.com/i, /truste/i],
      globals: ['truste'],
    },
    gdprRelevant: true,
    gdprNote: 'Consent Management Platform detected.',
  },
  {
    name: 'Quantcast Choice',
    category: 'consent',
    patterns: {
      scripts: [/quantcast\.mgr\.consensu\.org/i],
      globals: ['__tcfapi'],
    },
    gdprRelevant: true,
    gdprNote: 'TCF 2.0 Consent Management Platform.',
  },
  {
    name: 'Cookie Script',
    category: 'consent',
    patterns: {
      scripts: [/cookie-script\.com/i],
    },
    gdprRelevant: true,
    gdprNote: 'Consent Management Platform detected.',
  },

  // CDN
  {
    name: 'Cloudflare',
    category: 'cdn',
    patterns: {
      headers: { server: /cloudflare/i },
      cookies: [/__cf/i, /cf_clearance/i],
    },
    gdprRelevant: true,
    gdprNote: 'US-based CDN - check data processing agreement.',
  },
  {
    name: 'AWS CloudFront',
    category: 'cdn',
    patterns: {
      scripts: [/cloudfront\.net/i],
      headers: { 'x-amz-cf-id': /.+/ },
    },
    gdprRelevant: true,
    gdprNote: 'AWS - ensure EU region or proper safeguards.',
  },
  {
    name: 'Akamai',
    category: 'cdn',
    patterns: {
      headers: { server: /akamai/i },
      scripts: [/akamaized\.net/i],
    },
    gdprRelevant: false,
  },

  // E-commerce
  {
    name: 'WooCommerce',
    category: 'ecommerce',
    patterns: {
      html: [/woocommerce/i, /wc-/i],
      globals: ['wc_add_to_cart_params'],
    },
    gdprRelevant: true,
    gdprNote: 'E-commerce - ensure customer data protection.',
  },
  {
    name: 'Magento',
    category: 'ecommerce',
    patterns: {
      html: [/magento/i, /mage\//i],
      cookies: [/PHPSESSID/i, /frontend/i],
    },
    gdprRelevant: true,
    gdprNote: 'E-commerce - ensure customer data protection.',
  },

  // Chat/Support
  {
    name: 'Intercom',
    category: 'chat',
    patterns: {
      scripts: [/widget\.intercom\.io/i],
      globals: ['Intercom'],
    },
    gdprRelevant: true,
    gdprNote: 'Chat widget - user data processing. US-based.',
  },
  {
    name: 'Zendesk',
    category: 'chat',
    patterns: {
      scripts: [/static\.zdassets\.com/i, /zendesk/i],
      globals: ['zE', 'zESettings'],
    },
    gdprRelevant: true,
    gdprNote: 'Support widget - user data processing.',
  },
  {
    name: 'Crisp',
    category: 'chat',
    patterns: {
      scripts: [/client\.crisp\.chat/i],
      globals: ['$crisp', 'CRISP_WEBSITE_ID'],
    },
    gdprRelevant: true,
    gdprNote: 'Chat widget - EU-based option available.',
  },
  {
    name: 'LiveChat',
    category: 'chat',
    patterns: {
      scripts: [/cdn\.livechatinc\.com/i],
      globals: ['LiveChatWidget'],
    },
    gdprRelevant: true,
    gdprNote: 'Chat widget - user data processing.',
  },

  // Email
  {
    name: 'Mailchimp',
    category: 'email',
    patterns: {
      html: [/mailchimp/i, /mc\.us/i],
      scripts: [/chimpstatic\.com/i],
    },
    gdprRelevant: true,
    gdprNote: 'Email marketing - US-based. Ensure consent for newsletters.',
  },
  {
    name: 'HubSpot',
    category: 'email',
    patterns: {
      scripts: [/js\.hs-scripts\.com/i, /hubspot/i],
      globals: ['HubSpotConversations', '_hsq'],
    },
    gdprRelevant: true,
    gdprNote: 'Marketing platform - US-based. Multiple tracking features.',
  },

  // Security
  {
    name: 'reCAPTCHA',
    category: 'security',
    patterns: {
      scripts: [/google\.com\/recaptcha/i],
      globals: ['grecaptcha'],
    },
    gdprRelevant: true,
    gdprNote: 'Google service - data sent to US. Consider alternatives.',
  },
  {
    name: 'hCaptcha',
    category: 'security',
    patterns: {
      scripts: [/hcaptcha\.com/i],
      globals: ['hcaptcha'],
    },
    gdprRelevant: false,
    gdprNote: 'Privacy-focused CAPTCHA alternative.',
  },
];

export class TechnologyAnalyzer {
  private detectedTechnologies: Map<string, TechnologyInfo> = new Map();
  private pageHtml: string = '';
  private scriptUrls: string[] = [];

  reset(): void {
    this.detectedTechnologies.clear();
    this.pageHtml = '';
    this.scriptUrls = [];
  }

  trackRequest(request: Request): void {
    const url = request.url();
    if (request.resourceType() === 'script') {
      this.scriptUrls.push(url);
    }
  }

  async analyzePage(page: Page): Promise<TechnologyDetectionResult> {
    // Get page HTML
    this.pageHtml = await page.content();

    // Check for global JS variables
    const globals = await page.evaluate(() => {
      const detected: string[] = [];
      const globalsToCheck = [
        'React', 'Vue', 'angular', 'ng', 'jQuery', '$',
        'wp', 'Drupal', 'Shopify',
        'ga', 'gtag', 'dataLayer', 'fbq', 'hj', 'mixpanel',
        'OneTrust', 'Cookiebot', 'CookieConsent',
        '__NEXT_DATA__', '__NUXT__',
        'Intercom', 'zE', '$crisp',
        'grecaptcha', 'hcaptcha',
      ];
      
      for (const g of globalsToCheck) {
        try {
          if ((window as any)[g] !== undefined) {
            detected.push(g);
          }
        } catch {
          // Skip
        }
      }
      return detected;
    });

    // Check each technology signature
    for (const tech of TECH_SIGNATURES) {
      if (this.matchesTechnology(tech, globals)) {
        this.detectedTechnologies.set(tech.name, {
          name: tech.name,
          category: tech.category,
          confidence: 'high',
          gdprRelevant: tech.gdprRelevant,
          gdprNote: tech.gdprNote,
        });
      }
    }

    return this.getResult();
  }

  private matchesTechnology(
    tech: typeof TECH_SIGNATURES[0],
    globals: string[]
  ): boolean {
    const patterns = tech.patterns;

    // Check HTML patterns
    if (patterns.html) {
      for (const pattern of patterns.html) {
        if (pattern.test(this.pageHtml)) {
          return true;
        }
      }
    }

    // Check script URLs
    if (patterns.scripts) {
      for (const pattern of patterns.scripts) {
        if (this.scriptUrls.some(url => pattern.test(url))) {
          return true;
        }
      }
    }

    // Check global variables
    if (patterns.globals) {
      for (const g of patterns.globals) {
        if (globals.includes(g)) {
          return true;
        }
      }
    }

    return false;
  }

  private getResult(): TechnologyDetectionResult {
    const technologies = Array.from(this.detectedTechnologies.values());

    return {
      technologies,
      cms: technologies.find(t => t.category === 'cms')?.name || null,
      framework: technologies.find(t => t.category === 'framework')?.name || null,
      consentPlatform: technologies.find(t => t.category === 'consent')?.name || null,
      analytics: technologies.filter(t => t.category === 'analytics').map(t => t.name),
      advertising: technologies.filter(t => t.category === 'advertising').map(t => t.name),
      cdn: technologies.find(t => t.category === 'cdn')?.name || null,
    };
  }
}
