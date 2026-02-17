import { Injectable } from '@nestjs/common';
import { Page, Request } from 'playwright';
import { TrackerInfo, RiskLevel, ScanIssue } from '../dto/scan-result.dto';
import { TRACKER_PATTERNS } from '../data/known-trackers';

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
