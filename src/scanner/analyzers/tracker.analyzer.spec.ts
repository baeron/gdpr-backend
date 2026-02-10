import { TrackerAnalyzer } from './tracker.analyzer';
import { RiskLevel } from '../dto/scan-result.dto';

describe('TrackerAnalyzer', () => {
  let analyzer: TrackerAnalyzer;

  beforeEach(() => {
    analyzer = new TrackerAnalyzer();
  });

  describe('generateIssues', () => {
    it('should flag trackers loaded before consent', () => {
      const trackers = [
        { loadedBeforeConsent: true, name: 'Google Analytics', type: 'analytics' },
      ];
      const issues = TrackerAnalyzer.generateIssues(trackers);
      expect(issues).toHaveLength(1);
      expect(issues[0].code).toBe('TRACKERS_BEFORE_CONSENT');
      expect(issues[0].riskLevel).toBe(RiskLevel.HIGH);
    });

    it('should NOT flag trackers loaded after consent', () => {
      const trackers = [
        { loadedBeforeConsent: false, name: 'GA', type: 'analytics' },
      ];
      expect(TrackerAnalyzer.generateIssues(trackers)).toHaveLength(0);
    });

    it('should list tracker names in description', () => {
      const trackers = [
        { loadedBeforeConsent: true, name: 'GA', type: 'analytics' },
        { loadedBeforeConsent: true, name: 'FB', type: 'marketing' },
      ];
      const issues = TrackerAnalyzer.generateIssues(trackers);
      expect(issues[0].description).toContain('GA, FB');
    });

    it('should return empty for no trackers', () => {
      expect(TrackerAnalyzer.generateIssues([])).toHaveLength(0);
    });
  });

  describe('reset', () => {
    it('should clear detected trackers', () => {
      analyzer.reset();
      expect(analyzer.getDetectedTrackers()).toHaveLength(0);
    });
  });
});
