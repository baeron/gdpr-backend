import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { chromium, Browser, BrowserContext, Page } from 'playwright';

/**
 * Manages the Playwright browser lifecycle.
 * Handles initialization, health checks, crash recovery, and cleanup.
 */
@Injectable()
export class BrowserManagerService implements OnModuleDestroy {
  private readonly logger = new Logger(BrowserManagerService.name);
  private browser: Browser | null = null;
  private browserLock = false;

  /**
   * Initialize or reinitialize the browser instance.
   * Handles browser crashes by creating a new instance.
   */
  async ensureBrowser(): Promise<Browser> {
    // Wait if another request is initializing the browser
    while (this.browserLock) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Check if browser is healthy
    if (this.browser) {
      try {
        if (this.browser.isConnected()) {
          return this.browser;
        }
        this.logger.warn('Browser disconnected, will reinitialize');
      } catch {
        this.logger.warn('Browser check failed, will reinitialize');
      }
      await this.closeBrowser();
    }

    // Initialize new browser
    this.browserLock = true;
    try {
      this.logger.log('Initializing new browser instance...');
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      });
      this.logger.log('Browser initialized successfully');
      return this.browser;
    } finally {
      this.browserLock = false;
    }
  }

  /**
   * Create a new browser context with standard settings.
   */
  async createContext(browser: Browser): Promise<BrowserContext> {
    return browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
    });
  }

  /**
   * Safely close a browser context, ignoring errors.
   */
  async closeContext(context: BrowserContext): Promise<void> {
    try {
      await context.close();
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Error closing context: ${msg}`);
    }
  }

  /**
   * Safely close the browser instance.
   */
  async closeBrowser(): Promise<void> {
    if (this.browser) {
      try {
        await this.browser.close();
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Unknown error';
        this.logger.warn(`Error closing browser: ${message}`);
      }
      this.browser = null;
    }
  }

  /**
   * Check if an error is a browser crash error.
   */
  isBrowserCrashError(error: unknown): boolean {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    return (
      errorMessage.includes('browser has been closed') ||
      errorMessage.includes('Target page, context or browser') ||
      errorMessage.includes('Browser closed') ||
      errorMessage.includes('Protocol error')
    );
  }

  async onModuleDestroy() {
    await this.closeBrowser();
  }
}
