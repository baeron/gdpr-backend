import { EmailTranslations } from '../types';

export const en: EmailTranslations = {
  common: {
    greeting: 'Hello',
    thankYou: 'Thank you for choosing PolicyTracker!',
    bestRegards: 'Best regards',
    team: 'The PolicyTracker Team',
    questionsContact:
      'Have questions? Reply to this email or contact us at hello@policytracker.eu',
    automatedMessage:
      'This is an automated message. Please do not reply directly.',
    viewOnline: 'View in browser',
    unsubscribe: 'Unsubscribe',
  },

  auditConfirmation: {
    subject: 'Your GDPR Audit Request Received',
    preheader: "We're scanning your website for GDPR compliance issues",
    title: '🎯 Your audit request is confirmed!',
    intro:
      "Thank you for submitting your website for a GDPR compliance audit. We take privacy seriously, and we're here to help you do the same.",
    websiteLabel: 'Website',
    auditIdLabel: 'Audit ID',
    whatHappensNext: 'What happens next?',
    step1: '🔍 Our AI scans your website for 50+ compliance checkpoints',
    step2:
      '📊 We analyze cookies, trackers, consent banners, and privacy policies',
    step3: '📧 You receive your detailed compliance report via email',
    estimatedTime: 'Estimated time: 5-15 minutes',
    tipTitle: '💡 Pro Tip',
    tipContent:
      'While you wait, review your current privacy policy. Is it up to date? Does it clearly explain how you collect and use personal data?',
  },

  auditResults: {
    subject: 'Your GDPR Audit Report is Ready',
    preheader: 'Your website compliance score and recommendations are ready',
    title: '📊 Your GDPR Compliance Report',
    intro:
      "Great news! Your website audit is complete. Here's a summary of your GDPR compliance status.",
    scoreLabel: 'Compliance Score',
    scoreExcellent: 'Excellent',
    scoreGood: 'Good',
    scoreNeedsImprovement: 'Needs Improvement',
    scoreCritical: 'Critical',
    summaryTitle: 'Summary',
    issuesFound: 'Issues Found',
    passedChecks: 'Passed Checks',
    viewFullReport: 'View Full Report',
    topIssuesTitle: 'Top Priority Issues',
    upgradeTitle: '🚀 Unlock Your Full Report',
    upgradeDescription:
      'Get detailed remediation steps, code snippets, and priority-based action plan to become fully GDPR compliant.',
    upgradeButton: 'Get Full Report',
    freeReportNote:
      'This is your free summary report. Upgrade to access the complete analysis with actionable recommendations.',
  },

  paymentConfirmation: {
    subject: 'Payment Confirmed - Full GDPR Report Unlocked',
    preheader: 'Your payment was successful. Access your full report now.',
    title: '✅ Payment Successful!',
    intro:
      'Thank you for your purchase! Your full GDPR compliance report is now unlocked and ready to view.',
    orderDetails: 'Order Details',
    productLabel: 'Product',
    productName: 'Full GDPR Compliance Report',
    amountLabel: 'Amount',
    dateLabel: 'Date',
    invoiceNote: 'A receipt has been sent to your email address.',
    accessReport: 'Access Your Full Report',
    supportNote:
      'Need help understanding your report? Our team is here to assist you.',
  },

  adminNotification: {
    subject: 'New Audit Request',
    newRequest: 'New Audit Request Received',
    details: 'Request Details',
    marketingOptIn: 'Marketing Opt-in',
    yes: 'Yes',
    no: 'No',
  },
};
