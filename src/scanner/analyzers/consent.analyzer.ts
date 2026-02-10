import { Injectable } from '@nestjs/common';
import { Page } from 'playwright';
import { ConsentBannerInfo, RiskLevel, ScanIssue } from '../dto/scan-result.dto';

const CONSENT_SELECTORS = {
  // Common consent banner selectors
  banners: [
    '[class*="cookie"]',
    '[class*="consent"]',
    '[class*="gdpr"]',
    '[class*="privacy"]',
    '[id*="cookie"]',
    '[id*="consent"]',
    '[id*="gdpr"]',
    '[id*="privacy"]',
    '[data-testid*="cookie"]',
    '[data-testid*="consent"]',
    // Popular CMP selectors
    '#onetrust-banner-sdk',
    '#CybotCookiebotDialog',
    '.cc-window',
    '#cookie-law-info-bar',
    '.qc-cmp2-container',
    '#sp-cc',
    '.evidon-banner',
    '#truste-consent-track',
    '.optanon-alert-box-wrapper',
  ],

  // Accept button selectors
  acceptButtons: [
    '[class*="accept"]',
    '[class*="agree"]',
    '[class*="allow"]',
    '[id*="accept"]',
    '[id*="agree"]',
    'button:has-text("Accept")',
    'button:has-text("I agree")',
    'button:has-text("Allow")',
    'button:has-text("OK")',
    'button:has-text("Got it")',
    'button:has-text("Akzeptieren")',
    'button:has-text("Zgadzam się")',
    '#onetrust-accept-btn-handler',
    '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
    '.cc-btn.cc-allow',
  ],

  // Reject button selectors
  rejectButtons: [
    '[class*="reject"]',
    '[class*="decline"]',
    '[class*="deny"]',
    '[id*="reject"]',
    '[id*="decline"]',
    'button:has-text("Reject")',
    'button:has-text("Decline")',
    'button:has-text("Deny")',
    'button:has-text("Refuse")',
    'button:has-text("Ablehnen")',
    'button:has-text("Odrzuć")',
    '#onetrust-reject-all-handler',
    '#CybotCookiebotDialogBodyButtonDecline',
    '.cc-btn.cc-deny',
  ],

  // Settings/customize button selectors
  settingsButtons: [
    '[class*="settings"]',
    '[class*="customize"]',
    '[class*="preferences"]',
    '[class*="manage"]',
    'button:has-text("Settings")',
    'button:has-text("Customize")',
    'button:has-text("Preferences")',
    'button:has-text("Manage")',
    'button:has-text("More options")',
    'button:has-text("Einstellungen")',
    'button:has-text("Ustawienia")',
    '#onetrust-pc-btn-handler',
    '.cc-btn.cc-settings',
  ],
};

@Injectable()
export class ConsentAnalyzer {
  async analyzeConsentBanner(page: Page): Promise<ConsentBannerInfo> {
    const defaultQuality = {
      hasPreCheckedBoxes: false,
      preCheckedCategories: [] as string[],
      hasEqualProminence: true,
      acceptButtonSize: null as { width: number; height: number } | null,
      rejectButtonSize: null as { width: number; height: number } | null,
      isCookieWall: false,
      hasGranularConsent: false,
      categoryCount: 0,
      closeButtonRejects: null as boolean | null,
    };

    const result: ConsentBannerInfo = {
      found: false,
      hasRejectButton: false,
      hasAcceptButton: false,
      hasSettingsOption: false,
      isBlocking: false,
      quality: defaultQuality,
    };

    // Wait a bit for consent banner to appear
    await page.waitForTimeout(2000);

    // Check for consent banner
    for (const selector of CONSENT_SELECTORS.banners) {
      try {
        const element = await page.$(selector);
        if (element) {
          const isVisible = await element.isVisible();
          if (isVisible) {
            result.found = true;

            // Check if banner is blocking (modal/overlay)
            const boundingBox = await element.boundingBox();
            if (boundingBox) {
              const viewport = page.viewportSize();
              if (viewport) {
                // If banner covers significant portion of viewport, it's blocking
                const coverageRatio =
                  (boundingBox.width * boundingBox.height) /
                  (viewport.width * viewport.height);
                result.isBlocking = coverageRatio > 0.3;
              }
            }
            break;
          }
        }
      } catch {
        // Selector not found, continue
      }
    }

    if (!result.found) {
      return result;
    }

    // Check for accept button and get its size
    const acceptButtonInfo = await this.findButtonWithSize(
      page,
      CONSENT_SELECTORS.acceptButtons,
    );
    result.hasAcceptButton = acceptButtonInfo.found;
    result.quality.acceptButtonSize = acceptButtonInfo.size;

    // Check for reject button and get its size
    const rejectButtonInfo = await this.findButtonWithSize(
      page,
      CONSENT_SELECTORS.rejectButtons,
    );
    result.hasRejectButton = rejectButtonInfo.found;
    result.quality.rejectButtonSize = rejectButtonInfo.size;

    // Check for settings option
    result.hasSettingsOption = await this.hasAnyElement(
      page,
      CONSENT_SELECTORS.settingsButtons,
    );

    // Analyze consent quality
    await this.analyzeConsentQuality(page, result);

    return result;
  }

  private async analyzeConsentQuality(
    page: Page,
    result: ConsentBannerInfo,
  ): Promise<void> {
    // 1. Check for pre-checked boxes (non-essential categories)
    const preCheckedInfo = await this.detectPreCheckedBoxes(page);
    result.quality.hasPreCheckedBoxes = preCheckedInfo.hasPreChecked;
    result.quality.preCheckedCategories = preCheckedInfo.categories;

    // 2. Check equal prominence (Accept vs Reject button sizes)
    if (result.quality.acceptButtonSize && result.quality.rejectButtonSize) {
      const acceptArea =
        result.quality.acceptButtonSize.width *
        result.quality.acceptButtonSize.height;
      const rejectArea =
        result.quality.rejectButtonSize.width *
        result.quality.rejectButtonSize.height;
      // Reject button should be at least 50% the size of Accept button
      result.quality.hasEqualProminence = rejectArea >= acceptArea * 0.5;
    } else if (result.hasAcceptButton && !result.hasRejectButton) {
      result.quality.hasEqualProminence = false;
    }

    // 3. Check for cookie wall (blocking + no way to dismiss without accepting)
    result.quality.isCookieWall =
      result.isBlocking && !result.hasRejectButton && !result.hasSettingsOption;

    // 4. Check for granular consent (category toggles)
    const granularInfo = await this.detectGranularConsent(page);
    result.quality.hasGranularConsent = granularInfo.hasGranular;
    result.quality.categoryCount = granularInfo.categoryCount;

    // 5. Check if close button rejects cookies
    result.quality.closeButtonRejects =
      await this.checkCloseButtonBehavior(page);
  }

  private async detectPreCheckedBoxes(
    page: Page,
  ): Promise<{ hasPreChecked: boolean; categories: string[] }> {
    const preCheckedCategories: string[] = [];

    // Common selectors for cookie category checkboxes
    const checkboxSelectors = [
      'input[type="checkbox"][checked]',
      'input[type="checkbox"]:checked',
      '[role="checkbox"][aria-checked="true"]',
      '.toggle-switch.active',
      '.switch.on',
    ];

    // Category keywords to identify non-essential categories
    const nonEssentialKeywords = [
      'analytics',
      'analytic',
      'statistic',
      'performance',
      'marketing',
      'advertising',
      'ads',
      'targeting',
      'social',
      'preference',
      'functional',
    ];

    const essentialKeywords = [
      'necessary',
      'essential',
      'required',
      'strictly',
    ];

    for (const selector of checkboxSelectors) {
      try {
        const checkboxes = await page.$$(selector);
        for (const checkbox of checkboxes) {
          // Get parent or label text to identify category
          const parentText = await checkbox.evaluate((el) => {
            const parent = el.closest('label, div, li, tr');
            return parent ? parent.textContent?.toLowerCase() || '' : '';
          });

          // Check if this is a non-essential category
          const isNonEssential = nonEssentialKeywords.some((kw) =>
            parentText.includes(kw),
          );
          const isEssential = essentialKeywords.some((kw) =>
            parentText.includes(kw),
          );

          if (isNonEssential && !isEssential) {
            // Extract category name
            const categoryMatch = nonEssentialKeywords.find((kw) =>
              parentText.includes(kw),
            );
            if (
              categoryMatch &&
              !preCheckedCategories.includes(categoryMatch)
            ) {
              preCheckedCategories.push(categoryMatch);
            }
          }
        }
      } catch {
        // Continue
      }
    }

    return {
      hasPreChecked: preCheckedCategories.length > 0,
      categories: preCheckedCategories,
    };
  }

  private async detectGranularConsent(
    page: Page,
  ): Promise<{ hasGranular: boolean; categoryCount: number }> {
    // Look for category toggles/checkboxes
    const categorySelectors = [
      '[class*="category"] input[type="checkbox"]',
      '[class*="purpose"] input[type="checkbox"]',
      '[class*="toggle"]',
      '.cookie-category',
      '#onetrust-consent-sdk input[type="checkbox"]',
      '#CybotCookiebotDialog input[type="checkbox"]',
    ];

    let categoryCount = 0;

    for (const selector of categorySelectors) {
      try {
        const elements = await page.$$(selector);
        if (elements.length > 0) {
          categoryCount = Math.max(categoryCount, elements.length);
        }
      } catch {
        // Continue
      }
    }

    // Also check for category sections/tabs
    const categorySectionSelectors = [
      '[class*="category-item"]',
      '[class*="purpose-item"]',
      '.consent-category',
      '[data-category]',
    ];

    for (const selector of categorySectionSelectors) {
      try {
        const elements = await page.$$(selector);
        if (elements.length > 0) {
          categoryCount = Math.max(categoryCount, elements.length);
        }
      } catch {
        // Continue
      }
    }

    return {
      hasGranular: categoryCount >= 2, // At least 2 categories means granular
      categoryCount,
    };
  }

  private async checkCloseButtonBehavior(page: Page): Promise<boolean | null> {
    // Look for close button in consent banner
    const closeSelectors = [
      '[class*="close"]',
      '[aria-label*="close"]',
      '[aria-label*="Close"]',
      'button:has-text("×")',
      'button:has-text("X")',
      '.modal-close',
    ];

    for (const selector of closeSelectors) {
      try {
        const element = await page.$(selector);
        if (element && (await element.isVisible())) {
          // Check if close button has aria-label or title indicating rejection
          const ariaLabel = await element.getAttribute('aria-label');
          const title = await element.getAttribute('title');
          const text = (ariaLabel || title || '').toLowerCase();

          if (
            text.includes('reject') ||
            text.includes('decline') ||
            text.includes('refuse')
          ) {
            return true;
          }
          // Close button exists but doesn't clearly reject
          return false;
        }
      } catch {
        // Continue
      }
    }

    return null; // No close button found
  }

  private async findButtonWithSize(
    page: Page,
    selectors: string[],
  ): Promise<{
    found: boolean;
    size: { width: number; height: number } | null;
  }> {
    for (const selector of selectors) {
      try {
        const element = await page.$(selector);
        if (element && (await element.isVisible())) {
          const box = await element.boundingBox();
          if (box) {
            return {
              found: true,
              size: { width: box.width, height: box.height },
            };
          }
          return { found: true, size: null };
        }
      } catch {
        // Continue
      }
    }
    return { found: false, size: null };
  }

  private async hasAnyElement(
    page: Page,
    selectors: string[],
  ): Promise<boolean> {
    for (const selector of selectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          const isVisible = await element.isVisible();
          if (isVisible) {
            return true;
          }
        }
      } catch {
        // Continue to next selector
      }
    }
    return false;
  }

  async clickAcceptButton(page: Page): Promise<boolean> {
    for (const selector of CONSENT_SELECTORS.acceptButtons) {
      try {
        const element = await page.$(selector);
        if (element && (await element.isVisible())) {
          await element.click();
          await page.waitForTimeout(1000);
          return true;
        }
      } catch {
        // Continue to next selector
      }
    }
    return false;
  }

  static generateIssues(consentBanner: ConsentBannerInfo): ScanIssue[] {
    const issues: ScanIssue[] = [];

    if (!consentBanner.found) {
      issues.push({
        code: 'NO_CONSENT_BANNER',
        title: 'No cookie consent banner detected',
        description: 'No cookie consent mechanism was detected on the website.',
        riskLevel: RiskLevel.CRITICAL,
        recommendation:
          'Implement a GDPR-compliant cookie consent banner that appears before any non-essential cookies are set.',
      });
    }

    if (consentBanner.found && !consentBanner.hasRejectButton) {
      issues.push({
        code: 'NO_REJECT_OPTION',
        title: 'No option to reject cookies',
        description:
          'The consent banner does not provide an easy way to reject non-essential cookies.',
        riskLevel: RiskLevel.HIGH,
        recommendation:
          'Add a clearly visible "Reject" or "Decline" button to the consent banner.',
      });
    }

    if (consentBanner.found && consentBanner.quality.hasPreCheckedBoxes) {
      issues.push({
        code: 'PRE_CHECKED_BOXES',
        title: 'Non-essential cookies pre-selected',
        description: `Non-essential cookie categories are pre-checked: ${consentBanner.quality.preCheckedCategories.join(', ')}.`,
        riskLevel: RiskLevel.HIGH,
        recommendation:
          'All non-essential cookie categories must be unchecked by default. Only "necessary" cookies can be pre-selected.',
      });
    }

    if (consentBanner.found && !consentBanner.quality.hasEqualProminence) {
      issues.push({
        code: 'UNEQUAL_BUTTON_PROMINENCE',
        title: 'Accept and Reject buttons have unequal prominence',
        description:
          'The "Accept" button is significantly more prominent than the "Reject" option, which may manipulate user choice.',
        riskLevel: RiskLevel.HIGH,
        recommendation:
          'Make the "Reject" button equally visible and accessible as the "Accept" button (similar size, color, and position).',
      });
    }

    if (consentBanner.found && consentBanner.quality.isCookieWall) {
      issues.push({
        code: 'COOKIE_WALL',
        title: 'Cookie wall detected',
        description:
          'The website blocks access to content until cookies are accepted, with no option to reject or customize.',
        riskLevel: RiskLevel.CRITICAL,
        recommendation:
          'Remove the cookie wall. Users must be able to access the website without accepting non-essential cookies.',
      });
    }

    if (
      consentBanner.found &&
      !consentBanner.quality.hasGranularConsent &&
      consentBanner.hasAcceptButton
    ) {
      issues.push({
        code: 'NO_GRANULAR_CONSENT',
        title: 'No granular cookie consent options',
        description:
          'The consent banner does not allow users to choose which cookie categories to accept.',
        riskLevel: RiskLevel.MEDIUM,
        recommendation:
          'Provide options to accept/reject different cookie categories (e.g., Analytics, Marketing, Functional).',
      });
    }

    return issues;
  }
}
