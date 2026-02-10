import { PrivacyPolicyAnalyzer } from './privacy-policy.analyzer';
import { PrivacyPolicyInfo, RiskLevel } from '../dto/scan-result.dto';

describe('PrivacyPolicyAnalyzer', () => {
  const defaultPrivacy: PrivacyPolicyInfo = {
    found: true,
    url: 'https://example.com/privacy',
    content: {
      analyzed: false,
      hasDataController: false,
      hasDPOContact: false,
      hasPurposeOfProcessing: false,
      hasLegalBasis: false,
      hasDataRetention: false,
      hasUserRights: false,
      hasRightToComplain: false,
      hasThirdPartySharing: false,
      hasInternationalTransfers: false,
      detectedElements: [],
      missingElements: [],
    },
  };

  describe('generateIssues', () => {
    it('should return empty when found and not analyzed', () => {
      expect(PrivacyPolicyAnalyzer.generateIssues(defaultPrivacy)).toHaveLength(0);
    });

    it('NO_PRIVACY_POLICY', () => {
      const issues = PrivacyPolicyAnalyzer.generateIssues({ ...defaultPrivacy, found: false });
      expect(issues.some((i) => i.code === 'NO_PRIVACY_POLICY')).toBe(true);
      expect(issues[0].riskLevel).toBe(RiskLevel.MEDIUM);
    });

    it('PRIVACY_POLICY_INCOMPLETE when missing elements', () => {
      const privacy: PrivacyPolicyInfo = {
        ...defaultPrivacy,
        content: { ...defaultPrivacy.content, analyzed: true, missingElements: ['DPO Contact'] },
      };
      expect(PrivacyPolicyAnalyzer.generateIssues(privacy).some((i) => i.code === 'PRIVACY_POLICY_INCOMPLETE')).toBe(true);
    });

    it('NO_DATA_RETENTION_INFO', () => {
      const privacy: PrivacyPolicyInfo = {
        ...defaultPrivacy,
        content: { ...defaultPrivacy.content, analyzed: true, hasDataRetention: false },
      };
      expect(PrivacyPolicyAnalyzer.generateIssues(privacy).some((i) => i.code === 'NO_DATA_RETENTION_INFO')).toBe(true);
    });

    it('NO_COMPLAINT_RIGHT_INFO', () => {
      const privacy: PrivacyPolicyInfo = {
        ...defaultPrivacy,
        content: { ...defaultPrivacy.content, analyzed: true, hasRightToComplain: false },
      };
      expect(PrivacyPolicyAnalyzer.generateIssues(privacy).some((i) => i.code === 'NO_COMPLAINT_RIGHT_INFO')).toBe(true);
    });

    it('should NOT flag retention/complaint when not analyzed', () => {
      expect(PrivacyPolicyAnalyzer.generateIssues(defaultPrivacy)).toHaveLength(0);
    });
  });
});
