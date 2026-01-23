/**
 * Base email template with professional design
 * Optimized for all major email clients (Gmail, Outlook, Apple Mail, Yahoo)
 *
 * Design principles:
 * - Mobile-first responsive design
 * - Maximum width 600px for readability
 * - Table-based layout for email client compatibility
 * - Inline CSS for maximum support
 * - System fonts for fast loading
 * - High contrast for accessibility (WCAG AA)
 */

export interface BaseTemplateOptions {
  locale: string;
  preheaderText?: string;
  showFooterLinks?: boolean;
}

const BRAND_COLORS = {
  primary: '#2563eb', // Blue-600
  primaryDark: '#1d4ed8', // Blue-700
  success: '#059669', // Emerald-600
  warning: '#d97706', // Amber-600
  danger: '#dc2626', // Red-600
  background: '#f4f4f5', // Zinc-100
  cardBackground: '#ffffff',
  textPrimary: '#18181b', // Zinc-900
  textSecondary: '#52525b', // Zinc-600
  textMuted: '#a1a1aa', // Zinc-400
  border: '#e4e4e7', // Zinc-200
} as const;

export function baseTemplate(
  content: string,
  options: BaseTemplateOptions,
): string {
  const { locale, preheaderText = '', showFooterLinks = true } = options;
  const currentYear = new Date().getFullYear();

  return `
<!DOCTYPE html>
<html lang="${locale}" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
  <title>GDPR Audit</title>
  
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:AllowPNG/>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  
  <style>
    /* Reset */
    body, table, td, p, a, li, blockquote {
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    table, td {
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    img {
      -ms-interpolation-mode: bicubic;
      border: 0;
      height: auto;
      line-height: 100%;
      outline: none;
      text-decoration: none;
    }
    
    /* iOS blue links */
    a[x-apple-data-detectors] {
      color: inherit !important;
      text-decoration: none !important;
      font-size: inherit !important;
      font-family: inherit !important;
      font-weight: inherit !important;
      line-height: inherit !important;
    }
    
    /* Gmail blue links */
    u + #body a {
      color: inherit;
      text-decoration: none;
    }
    
    /* Samsung Mail */
    #MessageViewBody a {
      color: inherit;
      text-decoration: none;
    }
    
    /* Button hover effect */
    .button:hover {
      background-color: ${BRAND_COLORS.primaryDark} !important;
    }
    
    /* Responsive */
    @media only screen and (max-width: 620px) {
      .container {
        width: 100% !important;
        padding: 0 16px !important;
      }
      .content {
        padding: 24px 20px !important;
      }
      .header {
        padding: 20px !important;
      }
      .footer {
        padding: 20px !important;
      }
      .button {
        width: 100% !important;
        display: block !important;
      }
      .stats-table td {
        display: block !important;
        width: 100% !important;
        padding: 8px 0 !important;
      }
    }
    
    /* Dark mode support */
    @media (prefers-color-scheme: dark) {
      .dark-mode-bg {
        background-color: #18181b !important;
      }
      .dark-mode-card {
        background-color: #27272a !important;
      }
      .dark-mode-text {
        color: #fafafa !important;
      }
      .dark-mode-text-secondary {
        color: #a1a1aa !important;
      }
    }
  </style>
</head>
<body id="body" style="margin: 0; padding: 0; background-color: ${BRAND_COLORS.background}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  
  <!-- Preheader text (hidden preview text) -->
  <div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">
    ${preheaderText}
    ${'&nbsp;'.repeat(100)}
  </div>
  
  <!-- Email wrapper -->
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: ${BRAND_COLORS.background};" class="dark-mode-bg">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        
        <!-- Main container -->
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" class="container" style="max-width: 600px; width: 100%;">
          
          <!-- Logo/Header -->
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size: 28px; font-weight: 700; color: ${BRAND_COLORS.primary}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                    🛡️ PolicyTracker
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Card -->
          <tr>
            <td>
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: ${BRAND_COLORS.cardBackground}; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);" class="dark-mode-card">
                
                <!-- Content -->
                <tr>
                  <td class="content" style="padding: 40px;">
                    ${content}
                  </td>
                </tr>
                
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td class="footer" style="padding: 32px 20px; text-align: center;">
              ${
                showFooterLinks
                  ? `
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="padding-bottom: 16px;">
                    <a href="https://policytracker.eu" style="color: ${BRAND_COLORS.textMuted}; text-decoration: none; font-size: 13px; margin: 0 12px;">Website</a>
                    <span style="color: ${BRAND_COLORS.textMuted};">•</span>
                    <a href="https://policytracker.eu/privacy-policy" style="color: ${BRAND_COLORS.textMuted}; text-decoration: none; font-size: 13px; margin: 0 12px;">Privacy Policy</a>
                    <span style="color: ${BRAND_COLORS.textMuted};">•</span>
                    <a href="mailto:hello@policytracker.eu" style="color: ${BRAND_COLORS.textMuted}; text-decoration: none; font-size: 13px; margin: 0 12px;">Contact</a>
                  </td>
                </tr>
              </table>
              `
                  : ''
              }
              
              <p style="margin: 0; font-size: 12px; color: ${BRAND_COLORS.textMuted}; line-height: 1.5;" class="dark-mode-text-secondary">
                © ${currentYear} PolicyTracker. All rights reserved.<br>
                GDPR Compliance Audit Service
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();
}

/**
 * Helper function to create a CTA button
 */
export function createButton(
  text: string,
  url: string,
  variant: 'primary' | 'success' | 'outline' = 'primary',
): string {
  const bgColor =
    variant === 'primary'
      ? BRAND_COLORS.primary
      : variant === 'success'
        ? BRAND_COLORS.success
        : 'transparent';
  const textColor = variant === 'outline' ? BRAND_COLORS.primary : '#ffffff';
  const border =
    variant === 'outline' ? `2px solid ${BRAND_COLORS.primary}` : 'none';

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
      <tr>
        <td align="center" style="border-radius: 8px; background-color: ${bgColor}; border: ${border};">
          <a href="${url}" target="_blank" class="button" style="display: inline-block; padding: 14px 32px; font-size: 16px; font-weight: 600; color: ${textColor}; text-decoration: none; border-radius: 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
            ${text}
          </a>
        </td>
      </tr>
    </table>
  `;
}

/**
 * Helper function to create an info box
 */
export function createInfoBox(
  content: string,
  variant: 'info' | 'success' | 'warning' = 'info',
): string {
  const colors = {
    info: { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af' },
    success: { bg: '#ecfdf5', border: '#a7f3d0', text: '#065f46' },
    warning: { bg: '#fffbeb', border: '#fde68a', text: '#92400e' },
  };

  const style = colors[variant];

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin: 20px 0;">
      <tr>
        <td style="background-color: ${style.bg}; border: 1px solid ${style.border}; border-radius: 8px; padding: 16px;">
          <p style="margin: 0; font-size: 14px; color: ${style.text}; line-height: 1.5;">
            ${content}
          </p>
        </td>
      </tr>
    </table>
  `;
}

/**
 * Helper function to create a score badge
 */
export function createScoreBadge(score: number): string {
  let color: string;
  let label: string;

  if (score >= 80) {
    color = BRAND_COLORS.success;
    label = 'Excellent';
  } else if (score >= 60) {
    color = '#eab308'; // Yellow
    label = 'Good';
  } else if (score >= 40) {
    color = BRAND_COLORS.warning;
    label = 'Needs Improvement';
  } else {
    color = BRAND_COLORS.danger;
    label = 'Critical';
  }

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 20px auto;">
      <tr>
        <td align="center">
          <div style="width: 120px; height: 120px; border-radius: 50%; background: linear-gradient(135deg, ${color}20, ${color}40); display: inline-block; text-align: center; line-height: 120px;">
            <span style="font-size: 36px; font-weight: 700; color: ${color}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              ${score}
            </span>
          </div>
          <p style="margin: 12px 0 0 0; font-size: 14px; font-weight: 600; color: ${color}; text-transform: uppercase; letter-spacing: 0.5px;">
            ${label}
          </p>
        </td>
      </tr>
    </table>
  `;
}

export { BRAND_COLORS };
