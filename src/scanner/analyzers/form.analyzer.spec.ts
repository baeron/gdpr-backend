import { FormAnalyzer } from './form.analyzer';
import { RiskLevel } from '../dto/scan-result.dto';

describe('FormAnalyzer', () => {
  describe('generateIssues', () => {
    it('should return empty for compliant forms', () => {
      expect(FormAnalyzer.generateIssues({
        formsWithoutConsent: 0,
        formsWithPreCheckedMarketing: 0,
        dataCollectionForms: 0,
        formsWithPrivacyLink: 0,
      })).toHaveLength(0);
    });

    it('FORMS_WITHOUT_CONSENT', () => {
      const issues = FormAnalyzer.generateIssues({
        formsWithoutConsent: 2,
        formsWithPreCheckedMarketing: 0,
        dataCollectionForms: 2,
        formsWithPrivacyLink: 2,
      });
      expect(issues.some((i) => i.code === 'FORMS_WITHOUT_CONSENT')).toBe(true);
      expect(issues[0].riskLevel).toBe(RiskLevel.HIGH);
    });

    it('FORMS_PRECHECKED_MARKETING', () => {
      const issues = FormAnalyzer.generateIssues({
        formsWithoutConsent: 0,
        formsWithPreCheckedMarketing: 1,
        dataCollectionForms: 1,
        formsWithPrivacyLink: 1,
      });
      expect(issues.some((i) => i.code === 'FORMS_PRECHECKED_MARKETING')).toBe(true);
    });

    it('FORMS_NO_PRIVACY_LINK', () => {
      const issues = FormAnalyzer.generateIssues({
        formsWithoutConsent: 0,
        formsWithPreCheckedMarketing: 0,
        dataCollectionForms: 3,
        formsWithPrivacyLink: 1,
      });
      expect(issues.some((i) => i.code === 'FORMS_NO_PRIVACY_LINK')).toBe(true);
      expect(issues[0].description).toContain('2 data collection');
    });

    it('should NOT flag privacy link when no data forms', () => {
      const issues = FormAnalyzer.generateIssues({
        formsWithoutConsent: 0,
        formsWithPreCheckedMarketing: 0,
        dataCollectionForms: 0,
        formsWithPrivacyLink: 0,
      });
      expect(issues.some((i) => i.code === 'FORMS_NO_PRIVACY_LINK')).toBe(false);
    });
  });
});
