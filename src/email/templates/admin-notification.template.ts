/**
 * Admin Notification Email Template
 *
 * Sent to admin when a new audit request is submitted.
 * Goal: Quick overview, actionable information.
 *
 * Design: Simple, data-focused, easy to scan.
 */

import { baseTemplate, BRAND_COLORS } from './base.template';
import { getTranslations } from '../i18n';

export interface AdminNotificationParams {
  auditId: string;
  websiteUrl: string;
  email: string;
  agreeMarketing: boolean;
  locale: string;
  timestamp: Date;
  userAgent?: string;
  ipCountry?: string;
}

function formatTimestamp(date: Date): string {
  return date.toISOString().replace('T', ' ').split('.')[0] + ' UTC';
}

export function generateAdminNotificationEmail(
  params: AdminNotificationParams,
): {
  subject: string;
  html: string;
} {
  const {
    auditId,
    websiteUrl,
    email,
    agreeMarketing,
    locale,
    timestamp,
    userAgent,
    ipCountry,
  } = params;
  const t = getTranslations('en'); // Admin emails always in English

  const subject = `${t.adminNotification.subject}: ${websiteUrl}`;

  const content = `
    <!-- Header -->
    <h1 style="margin: 0 0 24px 0; font-size: 20px; font-weight: 700; color: ${BRAND_COLORS.textPrimary};">
      🔔 ${t.adminNotification.newRequest}
    </h1>
    
    <!-- Request Details -->
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse;">
      <tr>
        <td style="padding: 12px; border: 1px solid ${BRAND_COLORS.border}; background-color: #f8fafc; font-weight: 600; width: 140px;">
          Audit ID
        </td>
        <td style="padding: 12px; border: 1px solid ${BRAND_COLORS.border}; font-family: 'SF Mono', Monaco, monospace; font-size: 14px;">
          ${auditId}
        </td>
      </tr>
      <tr>
        <td style="padding: 12px; border: 1px solid ${BRAND_COLORS.border}; background-color: #f8fafc; font-weight: 600;">
          Website URL
        </td>
        <td style="padding: 12px; border: 1px solid ${BRAND_COLORS.border};">
          <a href="${websiteUrl}" style="color: ${BRAND_COLORS.primary}; text-decoration: none;">
            ${websiteUrl}
          </a>
        </td>
      </tr>
      <tr>
        <td style="padding: 12px; border: 1px solid ${BRAND_COLORS.border}; background-color: #f8fafc; font-weight: 600;">
          Email
        </td>
        <td style="padding: 12px; border: 1px solid ${BRAND_COLORS.border};">
          <a href="mailto:${email}" style="color: ${BRAND_COLORS.primary}; text-decoration: none;">
            ${email}
          </a>
        </td>
      </tr>
      <tr>
        <td style="padding: 12px; border: 1px solid ${BRAND_COLORS.border}; background-color: #f8fafc; font-weight: 600;">
          ${t.adminNotification.marketingOptIn}
        </td>
        <td style="padding: 12px; border: 1px solid ${BRAND_COLORS.border};">
          <span style="display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 13px; font-weight: 500; background-color: ${agreeMarketing ? '#ecfdf5' : '#fef2f2'}; color: ${agreeMarketing ? BRAND_COLORS.success : BRAND_COLORS.danger};">
            ${agreeMarketing ? t.adminNotification.yes : t.adminNotification.no}
          </span>
        </td>
      </tr>
      <tr>
        <td style="padding: 12px; border: 1px solid ${BRAND_COLORS.border}; background-color: #f8fafc; font-weight: 600;">
          Locale
        </td>
        <td style="padding: 12px; border: 1px solid ${BRAND_COLORS.border};">
          ${locale.toUpperCase()}
        </td>
      </tr>
      <tr>
        <td style="padding: 12px; border: 1px solid ${BRAND_COLORS.border}; background-color: #f8fafc; font-weight: 600;">
          Timestamp
        </td>
        <td style="padding: 12px; border: 1px solid ${BRAND_COLORS.border}; font-family: 'SF Mono', Monaco, monospace; font-size: 13px;">
          ${formatTimestamp(timestamp)}
        </td>
      </tr>
      ${
        ipCountry
          ? `
      <tr>
        <td style="padding: 12px; border: 1px solid ${BRAND_COLORS.border}; background-color: #f8fafc; font-weight: 600;">
          Country
        </td>
        <td style="padding: 12px; border: 1px solid ${BRAND_COLORS.border};">
          ${ipCountry}
        </td>
      </tr>
      `
          : ''
      }
      ${
        userAgent
          ? `
      <tr>
        <td style="padding: 12px; border: 1px solid ${BRAND_COLORS.border}; background-color: #f8fafc; font-weight: 600;">
          User Agent
        </td>
        <td style="padding: 12px; border: 1px solid ${BRAND_COLORS.border}; font-size: 12px; color: ${BRAND_COLORS.textMuted}; word-break: break-all;">
          ${userAgent}
        </td>
      </tr>
      `
          : ''
      }
    </table>
    
    <!-- Quick Actions -->
    <div style="margin-top: 24px; padding: 16px; background-color: #f8fafc; border-radius: 8px;">
      <p style="margin: 0 0 8px 0; font-size: 13px; font-weight: 600; color: ${BRAND_COLORS.textMuted}; text-transform: uppercase;">
        Quick Actions
      </p>
      <a href="https://policytracker.eu/admin/audits/${auditId}" style="color: ${BRAND_COLORS.primary}; text-decoration: none; font-size: 14px; margin-right: 16px;">
        View in Dashboard →
      </a>
    </div>
  `;

  return {
    subject,
    html: baseTemplate(content, {
      locale: 'en',
      showFooterLinks: false,
    }),
  };
}
