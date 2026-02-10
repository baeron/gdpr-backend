import { Injectable } from '@nestjs/common';
import { Page } from 'playwright';
import { PrivacyPolicyInfo, RiskLevel, ScanIssue } from '../dto/scan-result.dto';

const PRIVACY_LINK_PATTERNS = [
  /privacy/i,
  /datenschutz/i,
  /polityka.*prywatno/i,
  /gdpr/i,
  /data.*protection/i,
  /personal.*data/i,
];

const PRIVACY_LINK_SELECTORS = [
  'a[href*="privacy"]',
  'a[href*="datenschutz"]',
  'a[href*="prywatno"]',
  'a[href*="gdpr"]',
  'a:has-text("Privacy")',
  'a:has-text("Privacy Policy")',
  'a:has-text("Datenschutz")',
  'a:has-text("Polityka prywatności")',
  'a:has-text("GDPR")',
];

// GDPR Art. 13-14 required elements patterns (multilingual)
const CONTENT_PATTERNS = {
  dataController: [
    /data\s*controller/i,
    /controller.*data/i,
    /verantwortlich/i,
    /datenverantwortlich/i,
    /administrator\s*danych/i,
    /who\s*we\s*are/i,
    /about\s*us/i,
    /company\s*name/i,
    /registered\s*address/i,
    /contact\s*us/i,
    /our\s*contact/i,
  ],
  dpoContact: [
    /data\s*protection\s*officer/i,
    /dpo/i,
    /datenschutzbeauftragt/i,
    /inspektor\s*ochrony\s*danych/i,
    /iod/i,
  ],
  purposeOfProcessing: [
    /purpose.*process/i,
    /why\s*we\s*collect/i,
    /how\s*we\s*use/i,
    /we\s*use\s*your\s*data/i,
    /we\s*collect.*for/i,
    /zweck.*verarbeitung/i,
    /wir\s*verwenden/i,
    /cel.*przetwarzania/i,
    /wykorzystujemy/i,
  ],
  legalBasis: [
    /legal\s*basis/i,
    /lawful\s*basis/i,
    /legitimate\s*interest/i,
    /consent/i,
    /contract/i,
    /legal\s*obligation/i,
    /rechtsgrundlage/i,
    /berechtigtes\s*interesse/i,
    /podstawa\s*prawna/i,
    /uzasadniony\s*interes/i,
  ],
  dataRetention: [
    /retention/i,
    /how\s*long/i,
    /store.*data/i,
    /keep.*data/i,
    /delete.*data/i,
    /data.*deleted/i,
    /aufbewahrung/i,
    /speicherdauer/i,
    /okres\s*przechowywania/i,
    /jak\s*długo/i,
  ],
  userRights: [
    /your\s*rights/i,
    /rights.*data/i,
    /subject\s*rights/i,
    /right\s*to\s*access/i,
    /right\s*to\s*erasure/i,
    /right\s*to\s*rectification/i,
    /right\s*to\s*portability/i,
    /right\s*to\s*object/i,
    /ihre\s*rechte/i,
    /betroffenenrechte/i,
    /twoje\s*prawa/i,
    /prawa\s*osoby/i,
  ],
  rightToComplain: [
    /supervisory\s*authority/i,
    /data\s*protection\s*authority/i,
    /lodge\s*a\s*complaint/i,
    /file\s*a\s*complaint/i,
    /aufsichtsbehörde/i,
    /beschwerde/i,
    /urząd\s*ochrony\s*danych/i,
    /uodo/i,
    /skarga/i,
    /ico/i,
    /cnil/i,
    /bfdi/i,
  ],
  thirdPartySharing: [
    /third\s*part/i,
    /share.*data/i,
    /disclose/i,
    /service\s*provider/i,
    /partner/i,
    /dritte/i,
    /weitergabe/i,
    /podmioty\s*trzecie/i,
    /udostępniamy/i,
  ],
  internationalTransfers: [
    /international\s*transfer/i,
    /transfer.*outside/i,
    /eea/i,
    /european\s*economic\s*area/i,
    /third\s*countr/i,
    /adequate/i,
    /drittland/i,
    /übermittlung/i,
    /przekazywanie.*poza/i,
    /państwa\s*trzecie/i,
  ],
};

@Injectable()
export class PrivacyPolicyAnalyzer {
  async analyzePrivacyPolicy(page: Page): Promise<PrivacyPolicyInfo> {
    const defaultContent = {
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
      detectedElements: [] as string[],
      missingElements: [] as string[],
    };

    const result: PrivacyPolicyInfo = {
      found: false,
      url: null,
      content: defaultContent,
    };

    // Try to find privacy policy link
    for (const selector of PRIVACY_LINK_SELECTORS) {
      try {
        const element = await page.$(selector);
        if (element) {
          const href = await element.getAttribute('href');
          if (href) {
            result.found = true;
            result.url = this.resolveUrl(href, page.url());
            return result;
          }
        }
      } catch {
        // Continue to next selector
      }
    }

    // Fallback: search all links for privacy-related text
    try {
      const links = await page.$$('a');
      for (const link of links) {
        const text = await link.textContent();
        const href = await link.getAttribute('href');

        if (text && href) {
          for (const pattern of PRIVACY_LINK_PATTERNS) {
            if (pattern.test(text) || pattern.test(href)) {
              result.found = true;
              result.url = this.resolveUrl(href, page.url());
              return result;
            }
          }
        }
      }
    } catch {
      // Failed to analyze links
    }

    return result;
  }

  private resolveUrl(href: string, baseUrl: string): string {
    try {
      return new URL(href, baseUrl).toString();
    } catch {
      return href;
    }
  }

  async analyzePrivacyPolicyContent(
    page: Page,
    policyUrl: string,
  ): Promise<PrivacyPolicyInfo['content']> {
    const content: PrivacyPolicyInfo['content'] = {
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
    };

    try {
      // Navigate to privacy policy page
      await page.goto(policyUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 15000,
      });
      await page.waitForTimeout(1000);

      // Get page text content
      const pageText = await page.evaluate(
        () => document.body?.innerText || '',
      );

      if (!pageText || pageText.length < 100) {
        return content;
      }

      content.analyzed = true;

      // Check for each required element
      const elementChecks: Array<{
        key: keyof typeof CONTENT_PATTERNS;
        field: keyof PrivacyPolicyInfo['content'];
        label: string;
      }> = [
        {
          key: 'dataController',
          field: 'hasDataController',
          label: 'Data Controller',
        },
        { key: 'dpoContact', field: 'hasDPOContact', label: 'DPO Contact' },
        {
          key: 'purposeOfProcessing',
          field: 'hasPurposeOfProcessing',
          label: 'Purpose of Processing',
        },
        { key: 'legalBasis', field: 'hasLegalBasis', label: 'Legal Basis' },
        {
          key: 'dataRetention',
          field: 'hasDataRetention',
          label: 'Data Retention',
        },
        { key: 'userRights', field: 'hasUserRights', label: 'User Rights' },
        {
          key: 'rightToComplain',
          field: 'hasRightToComplain',
          label: 'Right to Complain',
        },
        {
          key: 'thirdPartySharing',
          field: 'hasThirdPartySharing',
          label: 'Third Party Sharing',
        },
        {
          key: 'internationalTransfers',
          field: 'hasInternationalTransfers',
          label: 'International Transfers',
        },
      ];

      for (const check of elementChecks) {
        const patterns = CONTENT_PATTERNS[check.key];
        const found = patterns.some((pattern) => pattern.test(pageText));

        if (found) {
          (content[check.field] as boolean) = true;
          content.detectedElements.push(check.label);
        } else {
          // Only add to missing if it's a required element (not optional like DPO or international transfers)
          const requiredElements = [
            'Data Controller',
            'Purpose of Processing',
            'Legal Basis',
            'User Rights',
          ];
          if (requiredElements.includes(check.label)) {
            content.missingElements.push(check.label);
          }
        }
      }
    } catch {
      // Failed to analyze privacy policy content
    }

    return content;
  }

  static generateIssues(privacyPolicy: PrivacyPolicyInfo): ScanIssue[] {
    const issues: ScanIssue[] = [];

    if (!privacyPolicy.found) {
      issues.push({
        code: 'NO_PRIVACY_POLICY',
        title: 'No privacy policy link found',
        description: 'No link to a privacy policy was detected on the website.',
        riskLevel: RiskLevel.MEDIUM,
        recommendation:
          'Add a clearly visible link to your privacy policy in the footer and consent banner.',
      });
    }

    if (privacyPolicy.found && privacyPolicy.content.analyzed) {
      if (privacyPolicy.content.missingElements.length > 0) {
        issues.push({
          code: 'PRIVACY_POLICY_INCOMPLETE',
          title: 'Privacy policy missing required information',
          description: `The privacy policy is missing: ${privacyPolicy.content.missingElements.join(', ')}.`,
          riskLevel: RiskLevel.HIGH,
          recommendation:
            'Update your privacy policy to include all required GDPR Art. 13-14 elements.',
        });
      }

      if (!privacyPolicy.content.hasDataRetention) {
        issues.push({
          code: 'NO_DATA_RETENTION_INFO',
          title: 'No data retention period specified',
          description:
            'The privacy policy does not specify how long personal data is retained.',
          riskLevel: RiskLevel.MEDIUM,
          recommendation:
            'Add clear information about data retention periods for each type of data processing.',
        });
      }

      if (!privacyPolicy.content.hasRightToComplain) {
        issues.push({
          code: 'NO_COMPLAINT_RIGHT_INFO',
          title: 'No information about right to complain',
          description:
            'The privacy policy does not mention the right to lodge a complaint with a supervisory authority.',
          riskLevel: RiskLevel.MEDIUM,
          recommendation:
            'Add information about the right to complain to the relevant data protection authority.',
        });
      }
    }

    return issues;
  }
}
