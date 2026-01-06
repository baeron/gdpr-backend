import { Page } from 'playwright';

export interface SitemapInfo {
  found: boolean;
  source: 'sitemap.xml' | 'robots.txt' | 'crawled' | null;
  totalUrls: number;
  relevantUrls: string[]; // URLs relevant for GDPR (contact, newsletter, forms, etc.)
  allUrls: string[];
}

// Keywords to identify pages that likely contain forms or privacy-related content
const RELEVANT_PAGE_KEYWORDS = [
  'contact', 'kontakt', 'kontaktieren',
  'newsletter', 'subscribe', 'signup', 'sign-up', 'anmelden',
  'register', 'registration', 'registrieren',
  'login', 'signin', 'sign-in', 'anmeldung',
  'privacy', 'datenschutz', 'prywatnosc',
  'terms', 'agb', 'nutzungsbedingungen',
  'cookie', 'cookies',
  'gdpr', 'dsgvo', 'rodo',
  'imprint', 'impressum',
  'support', 'help', 'hilfe',
  'feedback',
  'account', 'konto', 'profile', 'profil',
  'checkout', 'cart', 'warenkorb', 'koszyk',
  'order', 'bestellung', 'zamowienie',
];

export class SitemapAnalyzer {
  async discoverPages(page: Page, baseUrl: string): Promise<SitemapInfo> {
    const result: SitemapInfo = {
      found: false,
      source: null,
      totalUrls: 0,
      relevantUrls: [],
      allUrls: [],
    };

    const origin = new URL(baseUrl).origin;

    // Try sitemap.xml first (most comprehensive)
    const sitemapUrls = await this.parseSitemap(page, origin);
    if (sitemapUrls.length > 0) {
      result.found = true;
      result.source = 'sitemap.xml';
      result.allUrls = sitemapUrls;
    }

    // If no sitemap, try robots.txt
    if (!result.found) {
      const robotsUrls = await this.parseRobotsTxt(page, origin);
      if (robotsUrls.length > 0) {
        result.found = true;
        result.source = 'robots.txt';
        result.allUrls = robotsUrls;
      }
    }

    // If still nothing, crawl links from homepage
    if (!result.found) {
      const crawledUrls = await this.crawlHomepageLinks(page, origin);
      if (crawledUrls.length > 0) {
        result.found = true;
        result.source = 'crawled';
        result.allUrls = crawledUrls;
      }
    }

    // Filter to relevant URLs
    result.relevantUrls = this.filterRelevantUrls(result.allUrls);
    result.totalUrls = result.allUrls.length;

    return result;
  }

  private async parseSitemap(page: Page, origin: string): Promise<string[]> {
    const urls: string[] = [];
    const sitemapUrls = [
      `${origin}/sitemap.xml`,
      `${origin}/sitemap_index.xml`,
      `${origin}/sitemap/sitemap.xml`,
    ];

    for (const sitemapUrl of sitemapUrls) {
      try {
        const response = await page.goto(sitemapUrl, { 
          waitUntil: 'domcontentloaded', 
          timeout: 10000 
        });
        
        if (response && response.ok()) {
          const content = await page.content();
          
          // Parse XML sitemap
          const locMatches = content.match(/<loc>([^<]+)<\/loc>/gi);
          if (locMatches) {
            for (const match of locMatches) {
              const url = match.replace(/<\/?loc>/gi, '').trim();
              if (url.startsWith(origin) && !urls.includes(url)) {
                urls.push(url);
              }
            }
          }

          // Check for sitemap index (contains links to other sitemaps)
          const sitemapMatches = content.match(/<sitemap>[\s\S]*?<loc>([^<]+)<\/loc>[\s\S]*?<\/sitemap>/gi);
          if (sitemapMatches && sitemapMatches.length > 0) {
            // Parse first 3 sub-sitemaps
            for (const match of sitemapMatches.slice(0, 3)) {
              const subSitemapUrl = match.match(/<loc>([^<]+)<\/loc>/i)?.[1];
              if (subSitemapUrl) {
                const subUrls = await this.parseSubSitemap(page, subSitemapUrl, origin);
                urls.push(...subUrls.filter(u => !urls.includes(u)));
              }
            }
          }

          if (urls.length > 0) break;
        }
      } catch {
        // Sitemap not found or error, continue
      }
    }

    return urls.slice(0, 500); // Limit to 500 URLs
  }

  private async parseSubSitemap(page: Page, sitemapUrl: string, origin: string): Promise<string[]> {
    const urls: string[] = [];
    
    try {
      const response = await page.goto(sitemapUrl, { 
        waitUntil: 'domcontentloaded', 
        timeout: 10000 
      });
      
      if (response && response.ok()) {
        const content = await page.content();
        const locMatches = content.match(/<loc>([^<]+)<\/loc>/gi);
        
        if (locMatches) {
          for (const match of locMatches.slice(0, 200)) { // Limit per sub-sitemap
            const url = match.replace(/<\/?loc>/gi, '').trim();
            if (url.startsWith(origin)) {
              urls.push(url);
            }
          }
        }
      }
    } catch {
      // Sub-sitemap error, skip
    }

    return urls;
  }

  private async parseRobotsTxt(page: Page, origin: string): Promise<string[]> {
    const urls: string[] = [];
    
    try {
      const response = await page.goto(`${origin}/robots.txt`, { 
        waitUntil: 'domcontentloaded', 
        timeout: 10000 
      });
      
      if (response && response.ok()) {
        const content = await page.evaluate(() => document.body?.innerText || '');
        
        // Look for Sitemap directive in robots.txt
        const sitemapMatches = content.match(/Sitemap:\s*(\S+)/gi);
        if (sitemapMatches) {
          for (const match of sitemapMatches) {
            const sitemapUrl = match.replace(/Sitemap:\s*/i, '').trim();
            const sitemapUrls = await this.parseSitemap(page, origin);
            urls.push(...sitemapUrls);
            if (urls.length > 0) break;
          }
        }

        // Extract allowed paths from robots.txt
        const allowMatches = content.match(/Allow:\s*(\S+)/gi);
        if (allowMatches) {
          for (const match of allowMatches) {
            const path = match.replace(/Allow:\s*/i, '').trim();
            if (path && path !== '/' && !path.includes('*')) {
              const fullUrl = `${origin}${path}`;
              if (!urls.includes(fullUrl)) {
                urls.push(fullUrl);
              }
            }
          }
        }
      }
    } catch {
      // robots.txt not found or error
    }

    return urls;
  }

  private async crawlHomepageLinks(page: Page, origin: string): Promise<string[]> {
    const urls: string[] = [];
    
    try {
      // Go back to homepage
      await page.goto(origin, { waitUntil: 'networkidle', timeout: 15000 });
      
      // Get all internal links
      const links = await page.$$eval('a[href]', (elements, originUrl) => {
        return elements
          .map(el => (el as HTMLAnchorElement).href)
          .filter(href => href.startsWith(originUrl))
          .filter((href, index, self) => self.indexOf(href) === index);
      }, origin);

      urls.push(...links);
    } catch {
      // Crawling failed
    }

    return urls.slice(0, 100); // Limit crawled URLs
  }

  private filterRelevantUrls(urls: string[]): string[] {
    const relevant: string[] = [];
    
    for (const url of urls) {
      const lowerUrl = url.toLowerCase();
      const isRelevant = RELEVANT_PAGE_KEYWORDS.some(keyword => 
        lowerUrl.includes(keyword)
      );
      
      if (isRelevant && !relevant.includes(url)) {
        relevant.push(url);
      }
    }

    // Limit to 20 most relevant URLs for scanning
    return relevant.slice(0, 20);
  }

  getFormPageUrls(sitemapInfo: SitemapInfo): string[] {
    // Return URLs most likely to contain forms
    const formKeywords = ['contact', 'newsletter', 'subscribe', 'register', 'signup', 'feedback', 'support'];
    
    return sitemapInfo.relevantUrls
      .filter(url => formKeywords.some(kw => url.toLowerCase().includes(kw)))
      .slice(0, 5); // Limit to 5 form pages
  }
}
