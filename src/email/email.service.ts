import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

// Templates
import {
  generateAuditConfirmationEmail,
  generateAuditResultsEmail,
  generatePaymentConfirmationEmail,
  generateAdminNotificationEmail,
  type AuditConfirmationParams,
  type AuditResultsParams,
  type PaymentConfirmationParams,
  type AdminNotificationParams,
} from './templates';

// i18n
import { isValidLocale, DEFAULT_LOCALE } from './i18n';

// PDF
import { PdfReportService } from './pdf-report.service';
import { ScanResultDto } from '../scanner/dto/scan-result.dto';

/**
 * Email types for tracking and analytics
 */
export type EmailTemplateType =
  | 'audit_confirmation'
  | 'audit_results'
  | 'payment_confirmation'
  | 'admin_notification';

/**
 * Structured email log for monitoring and debugging
 */
interface EmailLog {
  timestamp: string;
  to: string;
  subject: string;
  templateType: EmailTemplateType;
  status: 'sent' | 'failed' | 'mocked';
  messageId?: string;
  error?: string;
  durationMs: number;
  locale?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Base parameters for sending emails
 */
interface EmailAttachment {
  filename: string;
  content: Buffer;
}

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  templateType: EmailTemplateType;
  locale?: string;
  metadata?: Record<string, unknown>;
  attachments?: EmailAttachment[];
}

/**
 * Email Service with multi-language support (24 EU languages)
 *
 * Features:
 * - Resend API integration
 * - Professional HTML templates
 * - Structured logging with metrics
 * - Fallback to English for unsupported locales
 * - Mock mode for development/testing
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null;
  private readonly fromEmail: string;
  private readonly adminEmail: string | null;

  // Metrics tracking
  private sentCount = 0;
  private failedCount = 0;

  constructor(
    private readonly configService: ConfigService,
    @Optional() private readonly pdfReportService?: PdfReportService,
  ) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    this.resend = apiKey ? new Resend(apiKey) : null;

    // Configure sender email
    this.fromEmail =
      this.configService.get<string>('EMAIL_FROM') ||
      'PolicyTracker <noreply@policytracker.eu>';

    // Admin email for notifications
    this.adminEmail = this.configService.get<string>('ADMIN_EMAIL') || null;

    if (!this.resend) {
      this.logger.warn(
        'RESEND_API_KEY not configured - emails will be logged only (mock mode)',
      );
    } else {
      this.logger.log('Email service initialized with Resend API');
    }
  }

  /**
   * Normalize locale to supported value or fallback to default
   */
  private normalizeLocale(locale?: string): string {
    if (!locale) return DEFAULT_LOCALE;
    const normalized = locale.toLowerCase().split('-')[0]; // Handle 'en-US' -> 'en'
    return isValidLocale(normalized) ? normalized : DEFAULT_LOCALE;
  }

  /**
   * Log email event with structured format
   */
  private logEmail(log: EmailLog): void {
    const logData = JSON.stringify({
      ...log,
      to: this.maskEmail(log.to), // Privacy: mask email in logs
    });

    if (log.status === 'failed') {
      this.failedCount++;
      this.logger.error(`📧 Email FAILED: ${logData}`);
    } else {
      this.sentCount++;
      this.logger.log(`📧 Email ${log.status.toUpperCase()}: ${logData}`);
    }
  }

  /**
   * Mask email for privacy in logs (show only first 3 chars and domain)
   */
  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!domain) return email;
    const masked = local.length > 3 ? local.slice(0, 3) + '***' : local + '***';
    return `${masked}@${domain}`;
  }

  /**
   * Core email sending method with logging and error handling
   */
  private async sendEmail(params: SendEmailParams): Promise<boolean> {
    const { to, subject, html, templateType, locale, metadata } = params;
    const startTime = Date.now();

    // Mock mode - log without sending
    if (!this.resend) {
      const durationMs = Date.now() - startTime;
      this.logEmail({
        timestamp: new Date().toISOString(),
        to,
        subject,
        templateType,
        status: 'mocked',
        durationMs,
        locale,
        metadata,
      });
      return true;
    }

    try {
      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to,
        subject,
        html,
        ...(params.attachments?.length && {
          attachments: params.attachments.map((a) => ({
            filename: a.filename,
            content: a.content,
          })),
        }),
      });

      const durationMs = Date.now() - startTime;

      if (error) {
        this.logEmail({
          timestamp: new Date().toISOString(),
          to,
          subject,
          templateType,
          status: 'failed',
          error: error.message,
          durationMs,
          locale,
          metadata,
        });
        return false;
      }

      this.logEmail({
        timestamp: new Date().toISOString(),
        to,
        subject,
        templateType,
        status: 'sent',
        messageId: data?.id,
        durationMs,
        locale,
        metadata,
      });

      return true;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const err = error instanceof Error ? error : new Error(String(error));

      this.logEmail({
        timestamp: new Date().toISOString(),
        to,
        subject,
        templateType,
        status: 'failed',
        error: err.message,
        durationMs,
        locale,
        metadata,
      });

      this.logger.error(`Email send exception: ${err.message}`, err.stack);
      return false;
    }
  }

  /**
   * Send audit confirmation email
   * Triggered when user submits website for audit
   */
  async sendAuditConfirmation(
    params: Omit<AuditConfirmationParams, 'locale'> & { locale?: string },
  ): Promise<boolean> {
    const locale = this.normalizeLocale(params.locale);
    const { subject, html } = generateAuditConfirmationEmail({
      ...params,
      locale,
    });

    return this.sendEmail({
      to: params.websiteUrl.includes('@') ? params.websiteUrl : '', // This was a bug - should be email
      subject,
      html,
      templateType: 'audit_confirmation',
      locale,
      metadata: { auditId: params.auditId, websiteUrl: params.websiteUrl },
    });
  }

  /**
   * Send audit confirmation to a specific email
   */
  async sendAuditConfirmationTo(
    to: string,
    params: Omit<AuditConfirmationParams, 'locale'> & { locale?: string },
  ): Promise<boolean> {
    const locale = this.normalizeLocale(params.locale);
    const { subject, html } = generateAuditConfirmationEmail({
      ...params,
      locale,
    });

    return this.sendEmail({
      to,
      subject,
      html,
      templateType: 'audit_confirmation',
      locale,
      metadata: { auditId: params.auditId, websiteUrl: params.websiteUrl },
    });
  }

  /**
   * Send audit results email
   * Triggered when scan is complete
   */
  async sendAuditResults(
    to: string,
    params: Omit<AuditResultsParams, 'locale'> & {
      locale?: string;
      scanResult?: ScanResultDto;
    },
  ): Promise<boolean> {
    const locale = this.normalizeLocale(params.locale);
    const { subject, html } = generateAuditResultsEmail({
      ...params,
      locale,
    });

    // Generate free PDF report attachment if scan result is provided
    let attachments: EmailAttachment[] | undefined;
    if (params.scanResult && this.pdfReportService) {
      try {
        const upgradeUrl = `https://policytracker.eu/report/${params.reportId}?upgrade=true`;
        const pdfBuffer = await this.pdfReportService.generateReport(
          params.scanResult,
          { mode: 'free', upgradeUrl, reportId: params.reportId },
        );
        attachments = [
          {
            filename: `gdpr-report-${params.reportId}.pdf`,
            content: pdfBuffer,
          },
        ];
        this.logger.log(
          `PDF attachment generated for report ${params.reportId} (${(pdfBuffer.length / 1024).toFixed(1)} KB)`,
        );
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        this.logger.error(
          `Failed to generate PDF attachment for report ${params.reportId}: ${err.message}`,
        );
        // Continue sending email without attachment
      }
    }

    return this.sendEmail({
      to,
      subject,
      html,
      templateType: 'audit_results',
      locale,
      metadata: {
        auditId: params.auditId,
        reportId: params.reportId,
        score: params.score,
        hasPdfAttachment: !!attachments,
      },
      attachments,
    });
  }

  /**
   * Send payment confirmation email
   * Triggered after successful payment
   */
  async sendPaymentConfirmation(
    to: string,
    params: Omit<PaymentConfirmationParams, 'locale'> & { locale?: string },
  ): Promise<boolean> {
    const locale = this.normalizeLocale(params.locale);
    const { subject, html } = generatePaymentConfirmationEmail({
      ...params,
      locale,
    });

    return this.sendEmail({
      to,
      subject,
      html,
      templateType: 'payment_confirmation',
      locale,
      metadata: {
        reportId: params.reportId,
        amount: params.amount,
        currency: params.currency,
      },
    });
  }

  /**
   * Send admin notification for new audit requests
   */
  async sendAdminNotification(
    params: Omit<AdminNotificationParams, 'timestamp'> & { timestamp?: Date },
  ): Promise<boolean> {
    if (!this.adminEmail) {
      this.logger.warn(
        'ADMIN_EMAIL not configured, skipping admin notification',
      );
      return false;
    }

    const { subject, html } = generateAdminNotificationEmail({
      ...params,
      timestamp: params.timestamp || new Date(),
    });

    return this.sendEmail({
      to: this.adminEmail,
      subject,
      html,
      templateType: 'admin_notification',
      locale: 'en',
      metadata: {
        auditId: params.auditId,
        websiteUrl: params.websiteUrl,
        userEmail: params.email,
      },
    });
  }

  /**
   * Get email service stats
   */
  getStats(): { sent: number; failed: number; total: number } {
    return {
      sent: this.sentCount,
      failed: this.failedCount,
      total: this.sentCount + this.failedCount,
    };
  }

  /**
   * Check if email service is configured (not in mock mode)
   */
  isConfigured(): boolean {
    return this.resend !== null;
  }
}
