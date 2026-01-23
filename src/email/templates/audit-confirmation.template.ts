/**
 * Audit Confirmation Email Template
 *
 * Sent immediately after a user submits their website for audit.
 * Goal: Confirm receipt, set expectations, build trust.
 *
 * Email Marketing Best Practices Applied:
 * - Clear, personalized subject line
 * - Preheader text that complements subject
 * - Visual hierarchy with icons
 * - Clear next steps (reduces support queries)
 * - Trust signals (professional design)
 * - Mobile-optimized layout
 */

import { baseTemplate, createInfoBox, BRAND_COLORS } from './base.template';
import { getTranslations } from '../i18n';

export interface AuditConfirmationParams {
  websiteUrl: string;
  auditId: string;
  locale: string;
}

export function generateAuditConfirmationEmail(
  params: AuditConfirmationParams,
): {
  subject: string;
  preheader: string;
  html: string;
} {
  const { websiteUrl, auditId, locale } = params;
  const t = getTranslations(locale);

  const subject = `${t.auditConfirmation.subject} - ${auditId.slice(0, 8)}`;
  const preheader = t.auditConfirmation.preheader;

  const content = `
    <!-- Hero Section -->
    <h1 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 700; color: ${BRAND_COLORS.textPrimary}; line-height: 1.3;">
      ${t.auditConfirmation.title}
    </h1>
    
    <p style="margin: 0 0 24px 0; font-size: 16px; color: ${BRAND_COLORS.textSecondary}; line-height: 1.6;">
      ${t.auditConfirmation.intro}
    </p>
    
    <!-- Audit Details Card -->
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin: 24px 0; background-color: #f8fafc; border-radius: 8px; border: 1px solid ${BRAND_COLORS.border};">
      <tr>
        <td style="padding: 20px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="padding: 8px 0;">
                <span style="font-size: 13px; font-weight: 600; color: ${BRAND_COLORS.textMuted}; text-transform: uppercase; letter-spacing: 0.5px;">
                  ${t.auditConfirmation.websiteLabel}
                </span>
                <p style="margin: 4px 0 0 0; font-size: 16px; font-weight: 500; color: ${BRAND_COLORS.primary}; word-break: break-all;">
                  ${websiteUrl}
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-top: 1px solid ${BRAND_COLORS.border};">
                <span style="font-size: 13px; font-weight: 600; color: ${BRAND_COLORS.textMuted}; text-transform: uppercase; letter-spacing: 0.5px;">
                  ${t.auditConfirmation.auditIdLabel}
                </span>
                <p style="margin: 4px 0 0 0; font-size: 16px; font-weight: 500; color: ${BRAND_COLORS.textPrimary}; font-family: 'SF Mono', Monaco, monospace;">
                  ${auditId}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    
    <!-- What Happens Next Section -->
    <h2 style="margin: 32px 0 16px 0; font-size: 18px; font-weight: 600; color: ${BRAND_COLORS.textPrimary};">
      ${t.auditConfirmation.whatHappensNext}
    </h2>
    
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td style="padding: 12px 0; vertical-align: top;">
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td style="width: 36px; vertical-align: top;">
                <div style="width: 28px; height: 28px; background-color: ${BRAND_COLORS.primary}15; border-radius: 50%; text-align: center; line-height: 28px; font-size: 14px;">
                  1
                </div>
              </td>
              <td style="padding-left: 12px;">
                <p style="margin: 0; font-size: 15px; color: ${BRAND_COLORS.textPrimary}; line-height: 1.5;">
                  ${t.auditConfirmation.step1}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding: 12px 0; vertical-align: top;">
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td style="width: 36px; vertical-align: top;">
                <div style="width: 28px; height: 28px; background-color: ${BRAND_COLORS.primary}15; border-radius: 50%; text-align: center; line-height: 28px; font-size: 14px;">
                  2
                </div>
              </td>
              <td style="padding-left: 12px;">
                <p style="margin: 0; font-size: 15px; color: ${BRAND_COLORS.textPrimary}; line-height: 1.5;">
                  ${t.auditConfirmation.step2}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding: 12px 0; vertical-align: top;">
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td style="width: 36px; vertical-align: top;">
                <div style="width: 28px; height: 28px; background-color: ${BRAND_COLORS.primary}15; border-radius: 50%; text-align: center; line-height: 28px; font-size: 14px;">
                  3
                </div>
              </td>
              <td style="padding-left: 12px;">
                <p style="margin: 0; font-size: 15px; color: ${BRAND_COLORS.textPrimary}; line-height: 1.5;">
                  ${t.auditConfirmation.step3}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    
    <!-- Estimated Time -->
    <p style="margin: 16px 0 0 0; font-size: 14px; color: ${BRAND_COLORS.textMuted}; text-align: center;">
      ⏱️ ${t.auditConfirmation.estimatedTime}
    </p>
    
    <!-- Pro Tip Box -->
    ${createInfoBox(
      `<strong style="color: #1e40af;">${t.auditConfirmation.tipTitle}</strong><br><br>${t.auditConfirmation.tipContent}`,
      'info',
    )}
    
    <!-- Contact Section -->
    <p style="margin: 32px 0 0 0; font-size: 14px; color: ${BRAND_COLORS.textMuted}; text-align: center; line-height: 1.6;">
      ${t.common.questionsContact}
    </p>
  `;

  return {
    subject,
    preheader,
    html: baseTemplate(content, { locale, preheaderText: preheader }),
  };
}
