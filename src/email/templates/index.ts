/**
 * Email Templates Index
 * Re-exports all email templates and utilities
 */

// Base template and utilities
export {
  baseTemplate,
  createButton,
  createInfoBox,
  createScoreBadge,
  BRAND_COLORS,
  type BaseTemplateOptions,
} from './base.template';

// Email templates
export {
  generateAuditConfirmationEmail,
  type AuditConfirmationParams,
} from './audit-confirmation.template';

export {
  generateAuditResultsEmail,
  type AuditResultsParams,
} from './audit-results.template';

export {
  generatePaymentConfirmationEmail,
  type PaymentConfirmationParams,
} from './payment-confirmation.template';

export {
  generateAdminNotificationEmail,
  type AdminNotificationParams,
} from './admin-notification.template';
