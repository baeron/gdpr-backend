/**
 * Audit Results Email Template
 *
 * Sent when the website scan is complete.
 * Goal: Deliver value, highlight key findings, encourage upgrade.
 *
 * Email Marketing Best Practices Applied:
 * - Compelling subject with score
 * - Visual score indicator (gamification)
 * - Clear summary of findings
 * - Strong CTA for upgrade (upsell opportunity)
 * - Social proof through professional design
 * - Mobile-optimized tables
 */

import {
  baseTemplate,
  createButton,
  createInfoBox,
  createScoreBadge,
  BRAND_COLORS,
} from './base.template';
import { getTranslations } from '../i18n';

export interface AuditResultsParams {
  websiteUrl: string;
  auditId: string;
  reportId: string;
  score: number;
  issuesCount: number;
  passedCount: number;
  topIssues: Array<{
    title: string;
    severity: 'critical' | 'warning' | 'info';
  }>;
  locale: string;
  isFullReport: boolean;
}

function getScoreLabel(
  score: number,
  t: ReturnType<typeof getTranslations>,
): string {
  if (score >= 80) return t.auditResults.scoreExcellent;
  if (score >= 60) return t.auditResults.scoreGood;
  if (score >= 40) return t.auditResults.scoreNeedsImprovement;
  return t.auditResults.scoreCritical;
}

function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'critical':
      return BRAND_COLORS.danger;
    case 'warning':
      return BRAND_COLORS.warning;
    default:
      return BRAND_COLORS.primary;
  }
}

function getSeverityIcon(severity: string): string {
  switch (severity) {
    case 'critical':
      return '🔴';
    case 'warning':
      return '🟡';
    default:
      return '🔵';
  }
}

export function generateAuditResultsEmail(params: AuditResultsParams): {
  subject: string;
  preheader: string;
  html: string;
} {
  const {
    websiteUrl,
    reportId,
    score,
    issuesCount,
    passedCount,
    topIssues,
    locale,
    isFullReport,
  } = params;
  const t = getTranslations(locale);

  const scoreLabel = getScoreLabel(score, t);
  const subject = `${t.auditResults.subject} - ${scoreLabel}: ${score}/100`;
  const preheader = t.auditResults.preheader;

  const reportUrl = `https://policytracker.eu/report/${reportId}`;

  // Generate top issues list
  const issuesHtml =
    topIssues.length > 0
      ? topIssues
          .slice(0, 5)
          .map(
            (issue) => `
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid ${BRAND_COLORS.border};">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="width: 30px; vertical-align: top;">
                <span style="font-size: 16px;">${getSeverityIcon(issue.severity)}</span>
              </td>
              <td style="padding-left: 8px;">
                <p style="margin: 0; font-size: 14px; color: ${BRAND_COLORS.textPrimary}; line-height: 1.4;">
                  ${issue.title}
                </p>
                <span style="font-size: 12px; color: ${getSeverityColor(issue.severity)}; font-weight: 500; text-transform: uppercase;">
                  ${issue.severity}
                </span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `,
          )
          .join('')
      : '';

  const content = `
    <!-- Hero Section -->
    <h1 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 700; color: ${BRAND_COLORS.textPrimary}; line-height: 1.3; text-align: center;">
      ${t.auditResults.title}
    </h1>
    
    <p style="margin: 0 0 8px 0; font-size: 14px; color: ${BRAND_COLORS.textMuted}; text-align: center;">
      ${websiteUrl}
    </p>
    
    <p style="margin: 0 0 24px 0; font-size: 16px; color: ${BRAND_COLORS.textSecondary}; line-height: 1.6; text-align: center;">
      ${t.auditResults.intro}
    </p>
    
    <!-- Score Badge -->
    ${createScoreBadge(score)}
    
    <!-- Summary Stats -->
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" class="stats-table" style="margin: 24px 0;">
      <tr>
        <td width="50%" style="padding: 16px; text-align: center; background-color: #fef2f2; border-radius: 8px 0 0 8px;">
          <p style="margin: 0; font-size: 28px; font-weight: 700; color: ${BRAND_COLORS.danger};">
            ${issuesCount}
          </p>
          <p style="margin: 4px 0 0 0; font-size: 13px; color: ${BRAND_COLORS.textMuted}; text-transform: uppercase; letter-spacing: 0.5px;">
            ${t.auditResults.issuesFound}
          </p>
        </td>
        <td width="50%" style="padding: 16px; text-align: center; background-color: #ecfdf5; border-radius: 0 8px 8px 0;">
          <p style="margin: 0; font-size: 28px; font-weight: 700; color: ${BRAND_COLORS.success};">
            ${passedCount}
          </p>
          <p style="margin: 4px 0 0 0; font-size: 13px; color: ${BRAND_COLORS.textMuted}; text-transform: uppercase; letter-spacing: 0.5px;">
            ${t.auditResults.passedChecks}
          </p>
        </td>
      </tr>
    </table>
    
    <!-- View Report Button -->
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center">
          ${createButton(t.auditResults.viewFullReport, reportUrl, 'primary')}
        </td>
      </tr>
    </table>
    
    ${
      topIssues.length > 0
        ? `
    <!-- Top Issues Section -->
    <h2 style="margin: 32px 0 16px 0; font-size: 18px; font-weight: 600; color: ${BRAND_COLORS.textPrimary};">
      ${t.auditResults.topIssuesTitle}
    </h2>
    
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px;">
      ${issuesHtml}
    </table>
    `
        : ''
    }
    
    ${
      !isFullReport
        ? `
    <!-- Upgrade CTA Section -->
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin: 32px 0; background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-radius: 12px; border: 1px solid #bfdbfe;">
      <tr>
        <td style="padding: 28px;">
          <h3 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: ${BRAND_COLORS.primary};">
            ${t.auditResults.upgradeTitle}
          </h3>
          <p style="margin: 0 0 20px 0; font-size: 15px; color: ${BRAND_COLORS.textSecondary}; line-height: 1.6;">
            ${t.auditResults.upgradeDescription}
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                ${createButton(t.auditResults.upgradeButton, `${reportUrl}?upgrade=true`, 'success')}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    
    ${createInfoBox(t.auditResults.freeReportNote, 'info')}
    `
        : ''
    }
    
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
