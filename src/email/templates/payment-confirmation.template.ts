/**
 * Payment Confirmation Email Template
 *
 * Sent after successful payment for full report.
 * Goal: Confirm purchase, provide access, build relationship.
 *
 * Email Marketing Best Practices Applied:
 * - Clear confirmation in subject
 * - Order details for records
 * - Immediate access CTA
 * - Support availability mention
 * - Professional receipt-like design
 */

import {
  baseTemplate,
  createButton,
  createInfoBox,
  BRAND_COLORS,
} from './base.template';
import { getTranslations } from '../i18n';

export interface PaymentConfirmationParams {
  reportId: string;
  websiteUrl: string;
  amount: string;
  currency: string;
  paymentDate: Date;
  locale: string;
}

function formatDate(date: Date, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return date.toISOString().split('T')[0];
  }
}

function formatCurrency(
  amount: string,
  currency: string,
  locale: string,
): string {
  try {
    const numAmount = parseFloat(amount);
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(numAmount);
  } catch {
    return `${currency} ${amount}`;
  }
}

export function generatePaymentConfirmationEmail(
  params: PaymentConfirmationParams,
): {
  subject: string;
  preheader: string;
  html: string;
} {
  const { reportId, websiteUrl, amount, currency, paymentDate, locale } =
    params;
  const t = getTranslations(locale);

  const subject = t.paymentConfirmation.subject;
  const preheader = t.paymentConfirmation.preheader;

  const reportUrl = `https://policytracker.eu/report/${reportId}`;
  const formattedAmount = formatCurrency(amount, currency, locale);
  const formattedDate = formatDate(paymentDate, locale);

  const content = `
    <!-- Success Icon -->
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="width: 80px; height: 80px; background-color: #ecfdf5; border-radius: 50%; display: inline-block; line-height: 80px;">
        <span style="font-size: 40px;">✅</span>
      </div>
    </div>
    
    <!-- Hero Section -->
    <h1 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 700; color: ${BRAND_COLORS.textPrimary}; line-height: 1.3; text-align: center;">
      ${t.paymentConfirmation.title}
    </h1>
    
    <p style="margin: 0 0 32px 0; font-size: 16px; color: ${BRAND_COLORS.textSecondary}; line-height: 1.6; text-align: center;">
      ${t.paymentConfirmation.intro}
    </p>
    
    <!-- Order Details Card -->
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin: 24px 0; background-color: #f8fafc; border-radius: 8px; border: 1px solid ${BRAND_COLORS.border};">
      <tr>
        <td style="padding: 24px;">
          <h3 style="margin: 0 0 16px 0; font-size: 14px; font-weight: 600; color: ${BRAND_COLORS.textMuted}; text-transform: uppercase; letter-spacing: 0.5px;">
            ${t.paymentConfirmation.orderDetails}
          </h3>
          
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="padding: 12px 0; border-bottom: 1px solid ${BRAND_COLORS.border};">
                <span style="font-size: 14px; color: ${BRAND_COLORS.textMuted};">
                  ${t.paymentConfirmation.productLabel}
                </span>
              </td>
              <td style="padding: 12px 0; border-bottom: 1px solid ${BRAND_COLORS.border}; text-align: right;">
                <span style="font-size: 14px; font-weight: 500; color: ${BRAND_COLORS.textPrimary};">
                  ${t.paymentConfirmation.productName}
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 0; border-bottom: 1px solid ${BRAND_COLORS.border};">
                <span style="font-size: 14px; color: ${BRAND_COLORS.textMuted};">
                  Website
                </span>
              </td>
              <td style="padding: 12px 0; border-bottom: 1px solid ${BRAND_COLORS.border}; text-align: right;">
                <span style="font-size: 14px; font-weight: 500; color: ${BRAND_COLORS.primary}; word-break: break-all;">
                  ${websiteUrl}
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 0; border-bottom: 1px solid ${BRAND_COLORS.border};">
                <span style="font-size: 14px; color: ${BRAND_COLORS.textMuted};">
                  ${t.paymentConfirmation.dateLabel}
                </span>
              </td>
              <td style="padding: 12px 0; border-bottom: 1px solid ${BRAND_COLORS.border}; text-align: right;">
                <span style="font-size: 14px; font-weight: 500; color: ${BRAND_COLORS.textPrimary};">
                  ${formattedDate}
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding: 16px 0 0 0;">
                <span style="font-size: 16px; font-weight: 600; color: ${BRAND_COLORS.textPrimary};">
                  ${t.paymentConfirmation.amountLabel}
                </span>
              </td>
              <td style="padding: 16px 0 0 0; text-align: right;">
                <span style="font-size: 20px; font-weight: 700; color: ${BRAND_COLORS.success};">
                  ${formattedAmount}
                </span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    
    <!-- Invoice Note -->
    <p style="margin: 0 0 24px 0; font-size: 13px; color: ${BRAND_COLORS.textMuted}; text-align: center;">
      📧 ${t.paymentConfirmation.invoiceNote}
    </p>
    
    <!-- CTA Button -->
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center">
          ${createButton(t.paymentConfirmation.accessReport, reportUrl, 'success')}
        </td>
      </tr>
    </table>
    
    <!-- Support Note -->
    ${createInfoBox(`💬 ${t.paymentConfirmation.supportNote}`, 'info')}
    
    <!-- Thank You -->
    <p style="margin: 32px 0 0 0; font-size: 16px; color: ${BRAND_COLORS.textPrimary}; text-align: center; line-height: 1.6;">
      ${t.common.thankYou}
    </p>
    
    <p style="margin: 8px 0 0 0; font-size: 14px; color: ${BRAND_COLORS.textMuted}; text-align: center;">
      ${t.common.team}
    </p>
  `;

  return {
    subject,
    preheader,
    html: baseTemplate(content, { locale, preheaderText: preheader }),
  };
}
