import { ConsentAnalyzer } from './consent.analyzer';
import { ConsentBannerInfo, RiskLevel } from '../dto/scan-result.dto';

describe('ConsentAnalyzer', () => {
  const defaultConsent: ConsentBannerInfo = {
    found: true,
    hasRejectButton: true,
    hasAcceptButton: true,
    hasSettingsOption: true,
    isBlocking: false,
    quality: {
      hasPreCheckedBoxes: false,
      preCheckedCategories: [],
      hasEqualProminence: true,
      acceptButtonSize: null,
      rejectButtonSize: null,
      isCookieWall: false,
      hasGranularConsent: true,
      categoryCount: 3,
      closeButtonRejects: null,
    },
    tcf: {
      detected: false,
      version: null,
      cmpId: null,
      cmpVersion: null,
      gdprApplies: null,
      purposeConsents: [],
      vendorConsents: [],
    },
  };

  describe('generateIssues', () => {
    it('should return empty for compliant banner', () => {
      expect(ConsentAnalyzer.generateIssues(defaultConsent)).toHaveLength(0);
    });

    it('NO_CONSENT_BANNER — CRITICAL', () => {
      const issues = ConsentAnalyzer.generateIssues({ ...defaultConsent, found: false });
      expect(issues.find((i) => i.code === 'NO_CONSENT_BANNER')).toBeDefined();
      expect(issues[0].riskLevel).toBe(RiskLevel.CRITICAL);
    });

    it('NO_REJECT_OPTION', () => {
      const issues = ConsentAnalyzer.generateIssues({ ...defaultConsent, hasRejectButton: false });
      expect(issues.some((i) => i.code === 'NO_REJECT_OPTION')).toBe(true);
    });

    it('PRE_CHECKED_BOXES', () => {
      const consent = {
        ...defaultConsent,
        quality: { ...defaultConsent.quality, hasPreCheckedBoxes: true, preCheckedCategories: ['marketing'] },
      };
      expect(ConsentAnalyzer.generateIssues(consent).some((i) => i.code === 'PRE_CHECKED_BOXES')).toBe(true);
    });

    it('UNEQUAL_BUTTON_PROMINENCE', () => {
      const consent = {
        ...defaultConsent,
        quality: { ...defaultConsent.quality, hasEqualProminence: false },
      };
      expect(ConsentAnalyzer.generateIssues(consent).some((i) => i.code === 'UNEQUAL_BUTTON_PROMINENCE')).toBe(true);
    });

    it('COOKIE_WALL — CRITICAL', () => {
      const consent = {
        ...defaultConsent,
        quality: { ...defaultConsent.quality, isCookieWall: true },
      };
      const issue = ConsentAnalyzer.generateIssues(consent).find((i) => i.code === 'COOKIE_WALL');
      expect(issue).toBeDefined();
      expect(issue!.riskLevel).toBe(RiskLevel.CRITICAL);
    });

    it('NO_GRANULAR_CONSENT', () => {
      const consent = {
        ...defaultConsent,
        quality: { ...defaultConsent.quality, hasGranularConsent: false },
      };
      expect(ConsentAnalyzer.generateIssues(consent).some((i) => i.code === 'NO_GRANULAR_CONSENT')).toBe(true);
    });

    it('should NOT flag granular consent when no accept button', () => {
      const consent = {
        ...defaultConsent,
        hasAcceptButton: false,
        quality: { ...defaultConsent.quality, hasGranularConsent: false },
      };
      expect(ConsentAnalyzer.generateIssues(consent).some((i) => i.code === 'NO_GRANULAR_CONSENT')).toBe(false);
    });
  });
});
