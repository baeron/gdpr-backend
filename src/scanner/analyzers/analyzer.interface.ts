import { Page, Request } from 'playwright';
import { ScanIssue } from '../dto/scan-result.dto';

/**
 * Scan context shared between analyzers during a scan.
 * Analyzers can read from and write to this context.
 */
export interface ScanContext {
  url: string;
  baseDomain: string;
  isHttps: boolean;
  consentGiven: boolean;
}

/**
 * Common interface for all GDPR compliance analyzers.
 *
 * Analyzers can implement any combination of lifecycle methods:
 * - onRequest(): called for every network request (background analyzers)
 * - onBeforeConsent(): called during Phase 1 (before consent click)
 * - onAfterConsent(): called during Phase 2 (after consent click)
 * - onAnalyze(): called during the analyzer's dedicated phase
 * - generateIssues(): produces ScanIssue[] from analysis results
 * - reset(): clears state between scans
 *
 * This design allows adding new analyzers without modifying ScannerService (OCP).
 */
export interface IAnalyzer<TResult = unknown> {
  /** Unique name for this analyzer */
  readonly name: string;

  /**
   * Handle a network request (for background/request-based analyzers).
   * Called for every request during the scan.
   */
  onRequest?(request: Request, context: ScanContext): void;

  /**
   * Run analysis before consent is given (Phase 1).
   */
  onBeforeConsent?(page: Page, context: ScanContext): Promise<void>;

  /**
   * Run analysis after consent is given (Phase 2).
   */
  onAfterConsent?(page: Page, context: ScanContext): Promise<void>;

  /**
   * Run the main analysis phase.
   * Called during the analyzer's dedicated phase.
   */
  onAnalyze?(page: Page, context: ScanContext): Promise<void>;

  /**
   * Get the analysis result.
   */
  getResult(): TResult;

  /**
   * Generate GDPR compliance issues from the analysis result.
   * Each analyzer is responsible for its own issue generation (OCP).
   */
  generateIssues(context: ScanContext): ScanIssue[];

  /**
   * Reset analyzer state between scans.
   */
  reset?(): void;
}
