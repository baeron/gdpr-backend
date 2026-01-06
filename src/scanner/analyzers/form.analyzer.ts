import { Page } from 'playwright';
import { SitemapAnalyzer } from './sitemap.analyzer';

export interface FormInfo {
  type: 'contact' | 'newsletter' | 'login' | 'registration' | 'search' | 'other';
  action: string | null;
  method: string;
  hasEmailField: boolean;
  hasNameField: boolean;
  hasPhoneField: boolean;
  hasMessageField: boolean;
  hasConsentCheckbox: boolean;
  hasPrivacyPolicyLink: boolean;
  hasPreCheckedMarketing: boolean;
  consentText: string | null;
}

export interface FormsAnalysisResult {
  totalForms: number;
  dataCollectionForms: number; // Forms that collect personal data
  formsWithConsent: number;
  formsWithoutConsent: number;
  formsWithPreCheckedMarketing: number;
  formsWithPrivacyLink: number;
  forms: FormInfo[];
  pagesScanned: string[];
}

const FORM_TYPE_INDICATORS = {
  contact: ['contact', 'kontakt', 'message', 'inquiry', 'support', 'feedback'],
  newsletter: ['newsletter', 'subscribe', 'subscription', 'mailing', 'signup', 'sign-up', 'email-signup'],
  login: ['login', 'signin', 'sign-in', 'logon'],
  registration: ['register', 'signup', 'sign-up', 'create-account', 'join'],
  search: ['search', 'query', 'find'],
};

const CONSENT_KEYWORDS = [
  'agree', 'consent', 'accept', 'privacy', 'terms', 'gdpr', 'data protection',
  'zgadzam', 'akceptuję', 'einverstanden', 'datenschutz', 'zustimm',
];

const MARKETING_KEYWORDS = [
  'marketing', 'newsletter', 'promotional', 'offers', 'updates', 'news',
  'subscribe', 'mailing list', 'email list',
];

const PRIVACY_LINK_PATTERNS = [
  /privacy/i, /datenschutz/i, /prywatno/i, /gdpr/i, /data.*protection/i,
];

export class FormAnalyzer {
  private readonly sitemapAnalyzer = new SitemapAnalyzer();

  async analyzeForms(page: Page): Promise<FormsAnalysisResult> {
    const result: FormsAnalysisResult = {
      totalForms: 0,
      dataCollectionForms: 0,
      formsWithConsent: 0,
      formsWithoutConsent: 0,
      formsWithPreCheckedMarketing: 0,
      formsWithPrivacyLink: 0,
      forms: [],
      pagesScanned: [page.url()],
    };

    const baseUrl = page.url();
    const origin = new URL(baseUrl).origin;

    // IMPORTANT: Analyze forms on current page FIRST (before any navigation)
    const formsOnPage = await this.analyzeFormsOnPage(page);
    result.forms.push(...formsOnPage);

    // Collect links from current page before navigating away
    const linksFromHomepage = await this.findFormPages(page);

    // Try to discover pages from sitemap/robots.txt
    // Note: This will navigate away from current page
    const sitemapInfo = await this.sitemapAnalyzer.discoverPages(page, baseUrl);
    
    // Get form-relevant pages from sitemap
    let additionalPages = this.sitemapAnalyzer.getFormPageUrls(sitemapInfo);
    
    // Merge with links from homepage (deduplicate)
    for (const link of linksFromHomepage) {
      if (!additionalPages.includes(link)) {
        additionalPages.push(link);
      }
    }
    
    // Scan additional pages for forms (limit to 5)
    for (const pageUrl of additionalPages.slice(0, 5)) {
      // Skip if already scanned or same as base
      if (result.pagesScanned.includes(pageUrl)) continue;
      if (pageUrl === baseUrl || pageUrl === origin || pageUrl === origin + '/') continue;
      
      try {
        await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 15000 });
        result.pagesScanned.push(pageUrl);
        
        const additionalForms = await this.analyzeFormsOnPage(page);
        result.forms.push(...additionalForms);
      } catch {
        // Failed to navigate, skip
      }
    }

    // Calculate statistics
    result.totalForms = result.forms.length;
    result.dataCollectionForms = result.forms.filter(f => 
      f.hasEmailField || f.hasNameField || f.hasPhoneField
    ).length;
    result.formsWithConsent = result.forms.filter(f => 
      f.hasConsentCheckbox && (f.hasEmailField || f.hasNameField)
    ).length;
    result.formsWithoutConsent = result.forms.filter(f => 
      (f.hasEmailField || f.hasNameField) && !f.hasConsentCheckbox
    ).length;
    result.formsWithPreCheckedMarketing = result.forms.filter(f => 
      f.hasPreCheckedMarketing
    ).length;
    result.formsWithPrivacyLink = result.forms.filter(f => 
      f.hasPrivacyPolicyLink && (f.hasEmailField || f.hasNameField)
    ).length;

    return result;
  }

  private async analyzeFormsOnPage(page: Page): Promise<FormInfo[]> {
    const forms: FormInfo[] = [];

    try {
      // Wait for JS to render forms (important for SPA/dynamic sites)
      await page.waitForTimeout(2000);
      
      // Try to wait for common form elements to appear
      try {
        await page.waitForSelector('form, input[type="email"], input[type="text"]', { timeout: 3000 });
      } catch {
        // No forms found after waiting, continue anyway
      }

      // First, try standard form elements
      const formElements = await page.$$('form');

      for (const form of formElements) {
        const formInfo = await this.analyzeForm(form, page);
        if (formInfo) {
          forms.push(formInfo);
        }
      }

      // If no forms found, look for form-like structures (common in React/Vue/Angular)
      if (forms.length === 0) {
        const jsFormsInfo = await this.detectJSRenderedForms(page);
        forms.push(...jsFormsInfo);
      }
    } catch {
      // Failed to analyze forms
    }

    return forms;
  }

  private async analyzeForm(form: any, page: Page): Promise<FormInfo | null> {
    try {
      const formData = await form.evaluate((el: HTMLFormElement) => {
        const action = el.action || null;
        const method = el.method?.toUpperCase() || 'GET';
        const formHtml = el.innerHTML.toLowerCase();
        const formText = el.textContent?.toLowerCase() || '';

        // Check for input fields
        const inputs = el.querySelectorAll('input, textarea');
        let hasEmailField = false;
        let hasNameField = false;
        let hasPhoneField = false;
        let hasMessageField = false;

        inputs.forEach((input: HTMLInputElement | HTMLTextAreaElement) => {
          const type = input.type?.toLowerCase() || '';
          const name = input.name?.toLowerCase() || '';
          const id = input.id?.toLowerCase() || '';
          const placeholder = input.placeholder?.toLowerCase() || '';

          if (type === 'email' || name.includes('email') || id.includes('email') || placeholder.includes('email')) {
            hasEmailField = true;
          }
          if (name.includes('name') || id.includes('name') || placeholder.includes('name')) {
            hasNameField = true;
          }
          if (type === 'tel' || name.includes('phone') || name.includes('tel') || id.includes('phone')) {
            hasPhoneField = true;
          }
          if (input.tagName === 'TEXTAREA' || name.includes('message') || id.includes('message')) {
            hasMessageField = true;
          }
        });

        // Check for checkboxes
        const checkboxes = el.querySelectorAll('input[type="checkbox"]');
        let hasConsentCheckbox = false;
        let hasPreCheckedMarketing = false;
        let consentText: string | null = null;

        checkboxes.forEach((checkbox: HTMLInputElement) => {
          const label = checkbox.closest('label')?.textContent?.toLowerCase() || '';
          const nextLabel = checkbox.nextElementSibling?.textContent?.toLowerCase() || '';
          const parentText = checkbox.parentElement?.textContent?.toLowerCase() || '';
          const checkboxText = label || nextLabel || parentText;

          // Check if this is a consent checkbox
          const isConsent = ['agree', 'consent', 'accept', 'privacy', 'terms', 'gdpr'].some(
            kw => checkboxText.includes(kw)
          );
          
          if (isConsent) {
            hasConsentCheckbox = true;
            consentText = checkboxText.slice(0, 200);
          }

          // Check for pre-checked marketing
          const isMarketing = ['marketing', 'newsletter', 'promotional', 'offers', 'subscribe'].some(
            kw => checkboxText.includes(kw)
          );
          
          if (isMarketing && checkbox.checked) {
            hasPreCheckedMarketing = true;
          }
        });

        // Check for privacy policy link
        const links = el.querySelectorAll('a');
        let hasPrivacyPolicyLink = false;
        links.forEach((link: HTMLAnchorElement) => {
          const href = link.href?.toLowerCase() || '';
          const text = link.textContent?.toLowerCase() || '';
          if (href.includes('privacy') || href.includes('datenschutz') || 
              text.includes('privacy') || text.includes('datenschutz')) {
            hasPrivacyPolicyLink = true;
          }
        });

        return {
          action,
          method,
          hasEmailField,
          hasNameField,
          hasPhoneField,
          hasMessageField,
          hasConsentCheckbox,
          hasPrivacyPolicyLink,
          hasPreCheckedMarketing,
          consentText,
          formHtml: formHtml.slice(0, 500),
          formText: formText.slice(0, 200),
        };
      });

      // Determine form type
      const type = this.determineFormType(formData);

      // Skip search forms and forms without data collection
      if (type === 'search') {
        return null;
      }

      return {
        type,
        action: formData.action,
        method: formData.method,
        hasEmailField: formData.hasEmailField,
        hasNameField: formData.hasNameField,
        hasPhoneField: formData.hasPhoneField,
        hasMessageField: formData.hasMessageField,
        hasConsentCheckbox: formData.hasConsentCheckbox,
        hasPrivacyPolicyLink: formData.hasPrivacyPolicyLink,
        hasPreCheckedMarketing: formData.hasPreCheckedMarketing,
        consentText: formData.consentText,
      };
    } catch {
      return null;
    }
  }

  private determineFormType(formData: any): FormInfo['type'] {
    const text = (formData.formText + ' ' + formData.formHtml).toLowerCase();
    const action = (formData.action || '').toLowerCase();

    for (const [type, indicators] of Object.entries(FORM_TYPE_INDICATORS)) {
      for (const indicator of indicators) {
        if (text.includes(indicator) || action.includes(indicator)) {
          return type as FormInfo['type'];
        }
      }
    }

    // Determine by fields
    if (formData.hasMessageField && formData.hasEmailField) {
      return 'contact';
    }
    if (formData.hasEmailField && !formData.hasNameField && !formData.hasMessageField) {
      return 'newsletter';
    }

    return 'other';
  }

  private async detectJSRenderedForms(page: Page): Promise<FormInfo[]> {
    const forms: FormInfo[] = [];

    try {
      // Look for form-like structures without <form> tag
      // Common patterns: div with email input, newsletter sections, contact sections
      const formLikeData = await page.evaluate(() => {
        const results: Array<{
          hasEmailField: boolean;
          hasNameField: boolean;
          hasPhoneField: boolean;
          hasMessageField: boolean;
          hasConsentCheckbox: boolean;
          hasPrivacyPolicyLink: boolean;
          hasPreCheckedMarketing: boolean;
          containerText: string;
        }> = [];

        // Find containers with email inputs that are NOT inside a <form>
        const emailInputs = document.querySelectorAll('input[type="email"]:not(form input)');
        
        emailInputs.forEach((input) => {
          // Find the closest container (div, section, etc.)
          const container = input.closest('div, section, article') as HTMLElement;
          if (!container) return;

          const containerText = container.textContent?.toLowerCase() || '';

          // Check for other fields in the same container
          const hasNameField = container.querySelector('input[name*="name"], input[placeholder*="name"]') !== null;
          const hasPhoneField = container.querySelector('input[type="tel"], input[name*="phone"]') !== null;
          const hasMessageField = container.querySelector('textarea') !== null;

          // Check for checkboxes
          const checkboxes = container.querySelectorAll('input[type="checkbox"]');
          let hasConsentCheckbox = false;
          let hasPreCheckedMarketing = false;

          checkboxes.forEach((cb: Element) => {
            const checkbox = cb as HTMLInputElement;
            const label = checkbox.closest('label')?.textContent?.toLowerCase() || '';
            const parentText = checkbox.parentElement?.textContent?.toLowerCase() || '';
            const text = label || parentText;

            if (text.includes('agree') || text.includes('consent') || text.includes('privacy') || text.includes('terms')) {
              hasConsentCheckbox = true;
            }
            if ((text.includes('newsletter') || text.includes('marketing') || text.includes('subscribe')) && checkbox.checked) {
              hasPreCheckedMarketing = true;
            }
          });

          // Check for privacy policy link
          const links = container.querySelectorAll('a');
          let hasPrivacyPolicyLink = false;
          links.forEach((link: Element) => {
            const anchor = link as HTMLAnchorElement;
            const href = anchor.href?.toLowerCase() || '';
            const linkText = anchor.textContent?.toLowerCase() || '';
            if (href.includes('privacy') || linkText.includes('privacy')) {
              hasPrivacyPolicyLink = true;
            }
          });

          results.push({
            hasEmailField: true,
            hasNameField,
            hasPhoneField,
            hasMessageField,
            hasConsentCheckbox,
            hasPrivacyPolicyLink,
            hasPreCheckedMarketing,
            containerText: containerText.slice(0, 200),
          });
        });

        return results;
      });

      // Convert to FormInfo
      for (const data of formLikeData) {
        const type = this.determineFormTypeFromText(data.containerText);
        if (type === 'search') continue;

        forms.push({
          type,
          action: null,
          method: 'POST',
          hasEmailField: data.hasEmailField,
          hasNameField: data.hasNameField,
          hasPhoneField: data.hasPhoneField,
          hasMessageField: data.hasMessageField,
          hasConsentCheckbox: data.hasConsentCheckbox,
          hasPrivacyPolicyLink: data.hasPrivacyPolicyLink,
          hasPreCheckedMarketing: data.hasPreCheckedMarketing,
          consentText: null,
        });
      }
    } catch {
      // Failed to detect JS forms
    }

    return forms;
  }

  private determineFormTypeFromText(text: string): FormInfo['type'] {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('newsletter') || lowerText.includes('subscribe') || lowerText.includes('sign up for')) {
      return 'newsletter';
    }
    if (lowerText.includes('contact') || lowerText.includes('message') || lowerText.includes('get in touch')) {
      return 'contact';
    }
    if (lowerText.includes('login') || lowerText.includes('sign in')) {
      return 'login';
    }
    if (lowerText.includes('register') || lowerText.includes('create account')) {
      return 'registration';
    }
    if (lowerText.includes('search')) {
      return 'search';
    }
    
    return 'other';
  }

  private async findFormPages(page: Page): Promise<string[]> {
    const formPageUrls: string[] = [];
    const baseUrl = new URL(page.url()).origin;

    try {
      const links = await page.$$eval('a[href]', (elements) => 
        elements.map(el => ({
          href: (el as HTMLAnchorElement).href,
          text: el.textContent?.toLowerCase() || '',
        }))
      );

      const formPageKeywords = [
        'contact', 'kontakt', 'newsletter', 'subscribe', 'signup', 'register',
        'feedback', 'support', 'get-in-touch', 'reach-us',
      ];

      for (const link of links) {
        const href = link.href.toLowerCase();
        const text = link.text;

        // Check if link points to a form page
        const isFormPage = formPageKeywords.some(kw => 
          href.includes(kw) || text.includes(kw)
        );

        if (isFormPage && link.href.startsWith(baseUrl)) {
          if (!formPageUrls.includes(link.href)) {
            formPageUrls.push(link.href);
          }
        }
      }
    } catch {
      // Failed to find form pages
    }

    return formPageUrls;
  }
}
