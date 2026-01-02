import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

interface AuditConfirmationParams {
  to: string;
  websiteUrl: string;
  auditId: string;
  locale: string;
}

interface AdminNotificationParams {
  auditId: string;
  websiteUrl: string;
  email: string;
  agreeMarketing: boolean;
  locale: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null;
  private readonly fromEmail = 'GDPR Audit <onboarding@resend.dev>';

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    this.resend = apiKey ? new Resend(apiKey) : null;

    if (!this.resend) {
      this.logger.warn('RESEND_API_KEY not configured, emails will be logged only');
    }
  }

  async sendAuditConfirmation(params: AuditConfirmationParams): Promise<boolean> {
    const { to, websiteUrl, auditId, locale } = params;

    const subject = locale === 'de'
      ? `Ihre GDPR-Audit-Anfrage - ${auditId}`
      : `Your GDPR Audit Request - ${auditId}`;

    const html = this.generateConfirmationEmail(websiteUrl, auditId, locale);

    return this.sendEmail({ to, subject, html });
  }

  async sendAdminNotification(params: AdminNotificationParams): Promise<boolean> {
    const adminEmail = this.configService.get<string>('ADMIN_EMAIL');
    if (!adminEmail) {
      this.logger.warn('ADMIN_EMAIL not configured, skipping admin notification');
      return false;
    }

    const html = this.generateAdminNotificationEmail(params);

    return this.sendEmail({
      to: adminEmail,
      subject: `New Audit Request: ${params.websiteUrl}`,
      html,
    });
  }

  private async sendEmail(params: { to: string; subject: string; html: string }): Promise<boolean> {
    const { to, subject, html } = params;

    if (!this.resend) {
      this.logger.log(`[EMAIL MOCK] To: ${to}, Subject: ${subject}`);
      return true;
    }

    try {
      const { error } = await this.resend.emails.send({
        from: this.fromEmail,
        to,
        subject,
        html,
      });

      if (error) {
        this.logger.error(`Failed to send email to ${to}: ${error.message}`);
        return false;
      }

      this.logger.log(`Email sent to ${to}: ${subject}`);
      return true;
    } catch (error) {
      this.logger.error(`Email send error: ${error.message}`, error.stack);
      return false;
    }
  }

  private generateConfirmationEmail(websiteUrl: string, auditId: string, locale: string): string {
    const isGerman = locale === 'de';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #2563eb; margin: 0;">🛡️ GDPR Audit</h1>
        </div>
        
        <h2 style="color: #1f2937;">
          ${isGerman ? 'Ihre Audit-Anfrage wurde empfangen!' : 'Your audit request has been received!'}
        </h2>
        
        <p>${isGerman ? 'Vielen Dank für die Einreichung Ihrer Website zur GDPR-Compliance-Prüfung.' : 'Thank you for submitting your website for a GDPR compliance audit.'}</p>
        
        <div style="background: #f3f4f6; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0;"><strong>Website:</strong> ${websiteUrl}</p>
          <p style="margin: 0;"><strong>Audit ID:</strong> ${auditId}</p>
        </div>
        
        <h3 style="color: #1f2937;">${isGerman ? 'Was passiert als nächstes?' : 'What happens next?'}</h3>
        <ol style="padding-left: 20px;">
          <li>${isGerman ? 'Unser System scannt Ihre Website auf GDPR-Compliance-Probleme' : 'Our system will scan your website for GDPR compliance issues'}</li>
          <li>${isGerman ? 'Wir analysieren Cookies, Tracking-Skripte, Formulare und Datenschutzrichtlinien' : "We'll analyze cookies, tracking scripts, forms, and privacy policies"}</li>
          <li>${isGerman ? 'Sie erhalten Ihren detaillierten Bericht innerhalb von 24 Stunden' : "You'll receive your detailed report within 24 hours"}</li>
        </ol>
        
        <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
          ${isGerman ? 'Bei Fragen antworten Sie auf diese E-Mail oder kontaktieren Sie uns unter' : 'If you have any questions, reply to this email or contact us at'} hello@gdpraudit.eu
        </p>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        
        <p style="color: #9ca3af; font-size: 12px; text-align: center;">
          © ${new Date().getFullYear()} GDPR Audit. All rights reserved.<br>
          ${isGerman ? 'Dies ist eine automatische Nachricht.' : 'This is an automated message.'}
        </p>
      </body>
      </html>
    `;
  }

  private generateAdminNotificationEmail(params: AdminNotificationParams): string {
    return `
      <!DOCTYPE html>
      <html>
      <body style="font-family: sans-serif; padding: 20px;">
        <h2>New Audit Request</h2>
        <table style="border-collapse: collapse; width: 100%;">
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>Audit ID</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${params.auditId}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>Website URL</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${params.websiteUrl}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>Email</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${params.email}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>Marketing Opt-in</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${params.agreeMarketing ? 'Yes' : 'No'}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>Locale</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${params.locale}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>Timestamp</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${new Date().toISOString()}</td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }
}
