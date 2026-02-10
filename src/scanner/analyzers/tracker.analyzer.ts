import { Injectable } from '@nestjs/common';
import { Page, Request } from 'playwright';
import { TrackerInfo, RiskLevel, ScanIssue } from '../dto/scan-result.dto';

interface TrackerPattern {
  name: string;
  type: TrackerInfo['type'];
  patterns: RegExp[];
}

const TRACKER_PATTERNS: TrackerPattern[] = [
  // Analytics
  {
    name: 'Google Analytics',
    type: 'analytics',
    patterns: [
      /google-analytics\.com/i,
      /googletagmanager\.com/i,
      /analytics\.google\.com/i,
      /www\.googletagmanager\.com\/gtag/i,
    ],
  },
  {
    name: 'Hotjar',
    type: 'analytics',
    patterns: [/hotjar\.com/i, /static\.hotjar\.com/i],
  },
  {
    name: 'Mixpanel',
    type: 'analytics',
    patterns: [/mixpanel\.com/i, /cdn\.mxpnl\.com/i],
  },
  {
    name: 'Amplitude',
    type: 'analytics',
    patterns: [/amplitude\.com/i, /cdn\.amplitude\.com/i],
  },
  {
    name: 'Heap Analytics',
    type: 'analytics',
    patterns: [/heap\.io/i, /heapanalytics\.com/i],
  },

  // Advertising
  {
    name: 'Facebook Pixel',
    type: 'advertising',
    patterns: [/connect\.facebook\.net/i, /facebook\.com\/tr/i],
  },
  {
    name: 'Google Ads',
    type: 'advertising',
    patterns: [
      /googleadservices\.com/i,
      /googlesyndication\.com/i,
      /doubleclick\.net/i,
      /googleads\.g\.doubleclick\.net/i,
    ],
  },
  {
    name: 'LinkedIn Insight',
    type: 'advertising',
    patterns: [/snap\.licdn\.com/i, /linkedin\.com\/px/i],
  },
  {
    name: 'Twitter Pixel',
    type: 'advertising',
    patterns: [/static\.ads-twitter\.com/i, /t\.co\/i\/adsct/i],
  },
  {
    name: 'TikTok Pixel',
    type: 'advertising',
    patterns: [/analytics\.tiktok\.com/i],
  },
  {
    name: 'Criteo',
    type: 'advertising',
    patterns: [/criteo\.com/i, /criteo\.net/i],
  },

  // Social
  {
    name: 'Facebook SDK',
    type: 'social',
    patterns: [/connect\.facebook\.net\/.*\/sdk\.js/i],
  },
  {
    name: 'Twitter Widgets',
    type: 'social',
    patterns: [/platform\.twitter\.com/i],
  },
  {
    name: 'LinkedIn SDK',
    type: 'social',
    patterns: [/platform\.linkedin\.com/i],
  },
];

@Injectable()
export class TrackerAnalyzer {
  private detectedTrackers: Map<string, TrackerInfo> = new Map();

  analyzeRequest(request: Request, beforeConsent: boolean): TrackerInfo | null {
    const url = request.url();

    for (const tracker of TRACKER_PATTERNS) {
      for (const pattern of tracker.patterns) {
        if (pattern.test(url)) {
          const domain = new URL(url).hostname;
          const key = `${tracker.name}-${domain}`;

          // Only update if this is the first detection or if detected before consent
          if (!this.detectedTrackers.has(key) || beforeConsent) {
            const trackerInfo: TrackerInfo = {
              name: tracker.name,
              type: tracker.type,
              domain,
              loadedBeforeConsent: beforeConsent,
            };
            this.detectedTrackers.set(key, trackerInfo);
            return trackerInfo;
          }

          return null;
        }
      }
    }

    return null;
  }

  getDetectedTrackers(): TrackerInfo[] {
    return Array.from(this.detectedTrackers.values());
  }

  reset(): void {
    this.detectedTrackers.clear();
  }

  static generateIssues(
    trackers: { loadedBeforeConsent: boolean; name: string; type: string }[],
  ): ScanIssue[] {
    const issues: ScanIssue[] = [];
    const trackersBeforeConsent = trackers.filter((t) => t.loadedBeforeConsent);
    if (trackersBeforeConsent.length > 0) {
      issues.push({
        code: 'TRACKERS_BEFORE_CONSENT',
        title: 'Tracking scripts loaded before consent',
        description: `${trackersBeforeConsent.length} tracking script(s) were loaded before user consent: ${trackersBeforeConsent.map((t) => t.name).join(', ')}.`,
        riskLevel: RiskLevel.HIGH,
        recommendation:
          'Delay loading of all tracking scripts until user consent is obtained.',
      });
    }
    return issues;
  }
}
