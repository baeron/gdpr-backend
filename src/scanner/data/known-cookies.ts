import { CookieInfo } from '../dto/scan-result.dto';

type CookieCategory = CookieInfo['category'];

export interface KnownCookieEntry {
  category: CookieCategory;
  description: string;
}

/**
 * Database of 200+ known cookies categorized by purpose.
 * Sources: CookieDatabase.org, Cookiepedia, vendor documentation.
 *
 * Categories:
 *   - necessary: Session, auth, CSRF, load balancing, consent storage
 *   - analytics: Web analytics, heatmaps, A/B testing
 *   - marketing: Advertising, retargeting, social tracking
 *   - unknown: Fallback (not used here)
 */
export const KNOWN_COOKIES: Record<string, KnownCookieEntry> = {
  // ============================================================
  // NECESSARY — Session, Auth, CSRF, Infrastructure
  // ============================================================
  PHPSESSID: { category: 'necessary', description: 'PHP Session' },
  JSESSIONID: { category: 'necessary', description: 'Java Session' },
  ASP_NET_SessionId: { category: 'necessary', description: 'ASP.NET Session' },
  'ASP.NET_SessionId': { category: 'necessary', description: 'ASP.NET Session' },
  ASPSESSIONID: { category: 'necessary', description: 'ASP Session' },
  session_id: { category: 'necessary', description: 'Generic Session' },
  sid: { category: 'necessary', description: 'Session ID' },
  connect_sid: { category: 'necessary', description: 'Express.js Session' },
  'connect.sid': { category: 'necessary', description: 'Express.js Session' },
  laravel_session: { category: 'necessary', description: 'Laravel Session' },
  _rails_session: { category: 'necessary', description: 'Ruby on Rails Session' },
  rack_session: { category: 'necessary', description: 'Rack Session' },
  'rack.session': { category: 'necessary', description: 'Rack Session' },
  django_session: { category: 'necessary', description: 'Django Session' },
  sessionid: { category: 'necessary', description: 'Django Session' },
  csrftoken: { category: 'necessary', description: 'CSRF Protection' },
  _csrf: { category: 'necessary', description: 'CSRF Protection' },
  _csrf_token: { category: 'necessary', description: 'CSRF Protection' },
  XSRF_TOKEN: { category: 'necessary', description: 'CSRF Protection (Angular/Laravel)' },
  'XSRF-TOKEN': { category: 'necessary', description: 'CSRF Protection (Angular/Laravel)' },
  csrf_token: { category: 'necessary', description: 'CSRF Protection' },
  __cf_bm: { category: 'necessary', description: 'Cloudflare Bot Management' },
  cf_clearance: { category: 'necessary', description: 'Cloudflare Clearance' },
  __cflb: { category: 'necessary', description: 'Cloudflare Load Balancer' },
  __cfduid: { category: 'necessary', description: 'Cloudflare Security (deprecated)' },
  __cf_logged_in: { category: 'necessary', description: 'Cloudflare Login' },
  AWSALB: { category: 'necessary', description: 'AWS Application Load Balancer' },
  AWSALBCORS: { category: 'necessary', description: 'AWS ALB CORS' },
  AWSELB: { category: 'necessary', description: 'AWS Elastic Load Balancer' },
  SERVERID: { category: 'necessary', description: 'Server Affinity / Load Balancer' },
  ROUTEID: { category: 'necessary', description: 'Server Routing' },
  BIGipServer: { category: 'necessary', description: 'F5 BIG-IP Load Balancer' },
  incap_ses: { category: 'necessary', description: 'Imperva Incapsula Session' },
  visid_incap: { category: 'necessary', description: 'Imperva Incapsula Visitor ID' },
  nlbi_: { category: 'necessary', description: 'Imperva Incapsula Load Balancer' },
  __hssc: { category: 'necessary', description: 'HubSpot Session' },
  __hssrc: { category: 'necessary', description: 'HubSpot Session Reset' },
  CookieConsent: { category: 'necessary', description: 'Cookiebot Consent State' },
  CookieConsentPolicy: { category: 'necessary', description: 'Cookie Consent Policy' },
  cookieconsent_status: { category: 'necessary', description: 'Cookie Consent Status' },
  cookie_consent: { category: 'necessary', description: 'Cookie Consent' },
  cc_cookie: { category: 'necessary', description: 'Cookie Consent (CookieConsent.js)' },
  euconsent: { category: 'necessary', description: 'EU Consent (IAB TCF)' },
  'euconsent-v2': { category: 'necessary', description: 'EU Consent v2 (IAB TCF 2.0)' },
  OptanonConsent: { category: 'necessary', description: 'OneTrust Consent' },
  OptanonAlertBoxClosed: { category: 'necessary', description: 'OneTrust Banner Dismissed' },
  cmapi_gtm_bl: { category: 'necessary', description: 'Tealium Consent' },
  cmapi_cookie_privacy: { category: 'necessary', description: 'Tealium Cookie Privacy' },
  didomi_token: { category: 'necessary', description: 'Didomi Consent' },
  usprivacy: { category: 'necessary', description: 'US Privacy String (CCPA)' },
  gdpr: { category: 'necessary', description: 'GDPR Consent Flag' },
  wp_lang: { category: 'necessary', description: 'WordPress Language' },
  wordpress_logged_in: { category: 'necessary', description: 'WordPress Login' },
  wordpress_test_cookie: { category: 'necessary', description: 'WordPress Cookie Test' },
  wp_woocommerce_session: { category: 'necessary', description: 'WooCommerce Session' },
  woocommerce_cart_hash: { category: 'necessary', description: 'WooCommerce Cart' },
  woocommerce_items_in_cart: { category: 'necessary', description: 'WooCommerce Cart Items' },
  CART: { category: 'necessary', description: 'Shopping Cart' },
  cart: { category: 'necessary', description: 'Shopping Cart' },
  cart_id: { category: 'necessary', description: 'Shopping Cart ID' },
  __stripe_mid: { category: 'necessary', description: 'Stripe Fraud Prevention' },
  __stripe_sid: { category: 'necessary', description: 'Stripe Session' },
  _shopify_s: { category: 'necessary', description: 'Shopify Analytics Session' },
  _shopify_y: { category: 'necessary', description: 'Shopify Analytics' },
  _shopify_sa_t: { category: 'necessary', description: 'Shopify Marketing Referral' },
  _shopify_sa_p: { category: 'necessary', description: 'Shopify Marketing Referral' },
  secure_customer_sig: { category: 'necessary', description: 'Shopify Customer Login' },
  _orig_referrer: { category: 'necessary', description: 'Shopify Original Referrer' },
  _landing_page: { category: 'necessary', description: 'Shopify Landing Page' },
  locale: { category: 'necessary', description: 'Language/Locale Preference' },
  lang: { category: 'necessary', description: 'Language Preference' },
  i18n: { category: 'necessary', description: 'Internationalization' },
  currency: { category: 'necessary', description: 'Currency Preference' },

  // ============================================================
  // ANALYTICS — Web Analytics, Heatmaps, A/B Testing
  // ============================================================

  // Google Analytics
  _ga: { category: 'analytics', description: 'Google Analytics Client ID' },
  _gid: { category: 'analytics', description: 'Google Analytics Session' },
  _gat: { category: 'analytics', description: 'Google Analytics Throttle' },
  _gat_gtag: { category: 'analytics', description: 'Google Analytics (gtag)' },
  __utma: { category: 'analytics', description: 'Google Analytics (Classic)' },
  __utmb: { category: 'analytics', description: 'Google Analytics (Classic)' },
  __utmc: { category: 'analytics', description: 'Google Analytics (Classic)' },
  __utmt: { category: 'analytics', description: 'Google Analytics (Classic)' },
  __utmz: { category: 'analytics', description: 'Google Analytics (Classic)' },
  __utmv: { category: 'analytics', description: 'Google Analytics (Classic)' },
  _ga_: { category: 'analytics', description: 'Google Analytics 4' },
  _gac_: { category: 'analytics', description: 'Google Analytics Campaign' },

  // Matomo / Piwik
  _pk_id: { category: 'analytics', description: 'Matomo/Piwik Visitor ID' },
  _pk_ses: { category: 'analytics', description: 'Matomo/Piwik Session' },
  _pk_ref: { category: 'analytics', description: 'Matomo/Piwik Referrer' },
  _pk_cvar: { category: 'analytics', description: 'Matomo/Piwik Custom Variables' },
  _pk_hsr: { category: 'analytics', description: 'Matomo/Piwik Heatmap' },
  _pk_testcookie: { category: 'analytics', description: 'Matomo/Piwik Test' },
  MATOMO_SESSID: { category: 'analytics', description: 'Matomo Session' },

  // Adobe Analytics
  s_cc: { category: 'analytics', description: 'Adobe Analytics Cookie Check' },
  s_sq: { category: 'analytics', description: 'Adobe Analytics Click Map' },
  s_vi: { category: 'analytics', description: 'Adobe Analytics Visitor ID' },
  s_fid: { category: 'analytics', description: 'Adobe Analytics Fallback ID' },
  s_nr: { category: 'analytics', description: 'Adobe Analytics New/Repeat' },
  s_ppv: { category: 'analytics', description: 'Adobe Analytics Page Views' },
  s_ppvl: { category: 'analytics', description: 'Adobe Analytics Previous Page Views' },
  AMCV_: { category: 'analytics', description: 'Adobe Experience Cloud Visitor ID' },
  AMCVS_: { category: 'analytics', description: 'Adobe Experience Cloud Session' },

  // Hotjar
  _hjSessionUser: { category: 'analytics', description: 'Hotjar User Session' },
  _hjSession: { category: 'analytics', description: 'Hotjar Session' },
  _hjid: { category: 'analytics', description: 'Hotjar User ID' },
  _hjFirstSeen: { category: 'analytics', description: 'Hotjar First Visit' },
  _hjIncludedInSessionSample: { category: 'analytics', description: 'Hotjar Session Sample' },
  _hjAbsoluteSessionInProgress: { category: 'analytics', description: 'Hotjar Session Active' },
  _hjTLDTest: { category: 'analytics', description: 'Hotjar TLD Test' },
  _hjIncludedInPageviewSample: { category: 'analytics', description: 'Hotjar Pageview Sample' },
  _hjRecordingEnabled: { category: 'analytics', description: 'Hotjar Recording' },
  _hjRecordingLastActivity: { category: 'analytics', description: 'Hotjar Recording Activity' },
  _hjClosedSurveyInvites: { category: 'analytics', description: 'Hotjar Survey' },
  _hjDonePolls: { category: 'analytics', description: 'Hotjar Poll' },
  _hjMinimizedPolls: { category: 'analytics', description: 'Hotjar Poll Minimized' },

  // Microsoft Clarity
  _clck: { category: 'analytics', description: 'Microsoft Clarity User ID' },
  _clsk: { category: 'analytics', description: 'Microsoft Clarity Session' },
  CLID: { category: 'analytics', description: 'Microsoft Clarity ID' },

  // Heap Analytics
  _hp2_id: { category: 'analytics', description: 'Heap Analytics User ID' },
  _hp2_ses_props: { category: 'analytics', description: 'Heap Analytics Session' },
  _hp2_props: { category: 'analytics', description: 'Heap Analytics Properties' },

  // Mixpanel
  mp_: { category: 'analytics', description: 'Mixpanel' },
  mp_mixpanel__c: { category: 'analytics', description: 'Mixpanel Config' },

  // Amplitude
  amp_: { category: 'analytics', description: 'Amplitude Analytics' },
  AMP_TOKEN: { category: 'analytics', description: 'Amplitude Token' },
  AMP_MKTG_: { category: 'analytics', description: 'Amplitude Marketing' },

  // Segment
  ajs_anonymous_id: { category: 'analytics', description: 'Segment Anonymous ID' },
  ajs_user_id: { category: 'analytics', description: 'Segment User ID' },
  ajs_group_id: { category: 'analytics', description: 'Segment Group ID' },

  // Plausible / Simple Analytics (privacy-friendly but still analytics)
  plausible_ignore: { category: 'analytics', description: 'Plausible Opt-out' },

  // Yandex Metrica
  _ym_uid: { category: 'analytics', description: 'Yandex Metrica User ID' },
  _ym_d: { category: 'analytics', description: 'Yandex Metrica First Visit' },
  _ym_isad: { category: 'analytics', description: 'Yandex Metrica Ad Blocker' },
  _ym_visorc: { category: 'analytics', description: 'Yandex Metrica Webvisor' },
  yandexuid: { category: 'analytics', description: 'Yandex User ID' },
  ymex: { category: 'analytics', description: 'Yandex Metrica' },

  // HubSpot Analytics
  __hstc: { category: 'analytics', description: 'HubSpot Tracking' },
  hubspotutk: { category: 'analytics', description: 'HubSpot Visitor Tracking' },

  // Crazy Egg
  _ceir: { category: 'analytics', description: 'Crazy Egg Referrer' },
  is_returning: { category: 'analytics', description: 'Crazy Egg Returning Visitor' },
  _CEFT: { category: 'analytics', description: 'Crazy Egg Tracking' },
  ceg_etag: { category: 'analytics', description: 'Crazy Egg ETag' },
  ceg_store: { category: 'analytics', description: 'Crazy Egg Store' },

  // Lucky Orange
  _lo_uid: { category: 'analytics', description: 'Lucky Orange User ID' },
  _lo_v: { category: 'analytics', description: 'Lucky Orange Visit' },

  // Mouseflow
  mf_: { category: 'analytics', description: 'Mouseflow' },
  mf_user: { category: 'analytics', description: 'Mouseflow User' },

  // FullStory
  fs_uid: { category: 'analytics', description: 'FullStory User ID' },
  fs_lua: { category: 'analytics', description: 'FullStory Last User Activity' },

  // Optimizely
  optimizelyEndUserId: { category: 'analytics', description: 'Optimizely User ID' },
  optimizelySegments: { category: 'analytics', description: 'Optimizely Segments' },
  optimizelyBuckets: { category: 'analytics', description: 'Optimizely Buckets' },
  optimizelyPendingLogEvents: { category: 'analytics', description: 'Optimizely Events' },

  // VWO (Visual Website Optimizer)
  _vwo_uuid: { category: 'analytics', description: 'VWO User ID' },
  _vwo_uuid_v2: { category: 'analytics', description: 'VWO User ID v2' },
  _vwo_ds: { category: 'analytics', description: 'VWO Session' },
  _vis_opt_s: { category: 'analytics', description: 'VWO Session' },
  _vis_opt_test_cookie: { category: 'analytics', description: 'VWO Test Cookie' },
  _vis_opt_exp: { category: 'analytics', description: 'VWO Experiment' },

  // AB Tasty
  ABTasty: { category: 'analytics', description: 'AB Tasty' },
  ABTastySession: { category: 'analytics', description: 'AB Tasty Session' },

  // Google Optimize
  _gaexp: { category: 'analytics', description: 'Google Optimize Experiment' },
  _opt_awcid: { category: 'analytics', description: 'Google Optimize' },
  _opt_awmid: { category: 'analytics', description: 'Google Optimize' },
  _opt_awgid: { category: 'analytics', description: 'Google Optimize' },
  _opt_awkid: { category: 'analytics', description: 'Google Optimize' },
  _opt_utmc: { category: 'analytics', description: 'Google Optimize' },

  // Sentry
  sentryReplaySession: { category: 'analytics', description: 'Sentry Session Replay' },

  // PostHog
  ph_: { category: 'analytics', description: 'PostHog Analytics' },

  // ============================================================
  // MARKETING — Advertising, Retargeting, Social Tracking
  // ============================================================

  // Facebook / Meta
  _fbp: { category: 'marketing', description: 'Facebook Pixel' },
  _fbc: { category: 'marketing', description: 'Facebook Click ID' },
  fr: { category: 'marketing', description: 'Facebook Advertising' },
  datr: { category: 'marketing', description: 'Facebook Browser ID' },
  sb: { category: 'marketing', description: 'Facebook Browser Details' },
  wd: { category: 'marketing', description: 'Facebook Window Dimensions' },

  // Google Ads / DoubleClick
  _gcl_au: { category: 'marketing', description: 'Google Ads Conversion Linker' },
  _gcl_aw: { category: 'marketing', description: 'Google Ads Click' },
  _gcl_dc: { category: 'marketing', description: 'Google DoubleClick Click' },
  _gcl_gb: { category: 'marketing', description: 'Google Ads' },
  _gcl_gs: { category: 'marketing', description: 'Google Ads' },
  _gcl_ha: { category: 'marketing', description: 'Google Ads' },
  IDE: { category: 'marketing', description: 'Google DoubleClick' },
  DSID: { category: 'marketing', description: 'Google DoubleClick' },
  id: { category: 'marketing', description: 'Google DoubleClick' },
  test_cookie: { category: 'marketing', description: 'Google DoubleClick Test' },
  __gads: { category: 'marketing', description: 'Google AdSense' },
  __gpi: { category: 'marketing', description: 'Google Publisher Tag' },
  __gpi_optout: { category: 'marketing', description: 'Google Publisher Tag Opt-out' },
  _gac_gb_: { category: 'marketing', description: 'Google Ads Campaign' },
  ar_debug: { category: 'marketing', description: 'Google Ads Attribution Reporting' },
  NID: { category: 'marketing', description: 'Google Preferences/Ads' },
  ANID: { category: 'marketing', description: 'Google Advertising ID' },
  AID: { category: 'marketing', description: 'Google Advertising' },
  TAID: { category: 'marketing', description: 'Google Advertising' },
  '1P_JAR': { category: 'marketing', description: 'Google Advertising' },
  CONSENT: { category: 'marketing', description: 'Google Consent' },
  DV: { category: 'marketing', description: 'Google Advertising Preferences' },
  _gtag_: { category: 'marketing', description: 'Google Tag Manager / Ads' },

  // LinkedIn
  li_sugr: { category: 'marketing', description: 'LinkedIn Browser ID' },
  bcookie: { category: 'marketing', description: 'LinkedIn Browser ID' },
  bscookie: { category: 'marketing', description: 'LinkedIn Secure Browser ID' },
  lidc: { category: 'marketing', description: 'LinkedIn Data Center' },
  UserMatchHistory: { category: 'marketing', description: 'LinkedIn Ads Matching' },
  AnalyticsSyncHistory: { category: 'marketing', description: 'LinkedIn Analytics Sync' },
  li_fat_id: { category: 'marketing', description: 'LinkedIn Ads' },
  li_giant: { category: 'marketing', description: 'LinkedIn Ads' },
  ln_or: { category: 'marketing', description: 'LinkedIn Referral' },
  _lipt: { category: 'marketing', description: 'LinkedIn Insight Tag' },

  // Twitter / X
  _twitter_sess: { category: 'marketing', description: 'Twitter Session' },
  guest_id: { category: 'marketing', description: 'Twitter Guest ID' },
  guest_id_marketing: { category: 'marketing', description: 'Twitter Marketing' },
  guest_id_ads: { category: 'marketing', description: 'Twitter Ads' },
  personalization_id: { category: 'marketing', description: 'Twitter Personalization' },
  muc_ads: { category: 'marketing', description: 'Twitter Ads' },
  twid: { category: 'marketing', description: 'Twitter User ID' },

  // Microsoft / Bing Ads
  _uetsid: { category: 'marketing', description: 'Bing Ads UET Session' },
  _uetvid: { category: 'marketing', description: 'Bing Ads UET Visitor' },
  MUID: { category: 'marketing', description: 'Microsoft User ID' },
  MUIDB: { category: 'marketing', description: 'Microsoft User ID (Bing)' },
  _RwBf: { category: 'marketing', description: 'Microsoft Advertising' },
  SRCHD: { category: 'marketing', description: 'Bing Search' },
  SRCHUID: { category: 'marketing', description: 'Bing Search User ID' },
  SRCHUSR: { category: 'marketing', description: 'Bing Search User' },

  // Pinterest
  _pinterest_sess: { category: 'marketing', description: 'Pinterest Session' },
  _pinterest_ct_ua: { category: 'marketing', description: 'Pinterest Conversion Tag' },
  _pin_unauth: { category: 'marketing', description: 'Pinterest Unauthenticated' },
  _derived_epik: { category: 'marketing', description: 'Pinterest Conversion' },
  _epik: { category: 'marketing', description: 'Pinterest Conversion' },

  // TikTok
  _ttp: { category: 'marketing', description: 'TikTok Pixel' },
  _tt_enable_cookie: { category: 'marketing', description: 'TikTok Cookie Check' },
  tt_csrf_token: { category: 'marketing', description: 'TikTok CSRF' },
  tt_webid: { category: 'marketing', description: 'TikTok Web ID' },
  tt_webid_v2: { category: 'marketing', description: 'TikTok Web ID v2' },
  ttwid: { category: 'marketing', description: 'TikTok Web ID' },

  // Snapchat
  _scid: { category: 'marketing', description: 'Snapchat Pixel' },
  _sctr: { category: 'marketing', description: 'Snapchat Tracking' },
  sc_at: { category: 'marketing', description: 'Snapchat Ads' },

  // Criteo
  cto_bundle: { category: 'marketing', description: 'Criteo Advertising' },
  cto_bidid: { category: 'marketing', description: 'Criteo Bid ID' },
  cto_lwid: { category: 'marketing', description: 'Criteo Visitor ID' },
  cto_tld_test: { category: 'marketing', description: 'Criteo TLD Test' },

  // Taboola
  t_gid: { category: 'marketing', description: 'Taboola Tracking' },
  t_pt_gid: { category: 'marketing', description: 'Taboola Tracking' },
  taboola_select: { category: 'marketing', description: 'Taboola Selection' },

  // Outbrain
  obuid: { category: 'marketing', description: 'Outbrain User ID' },

  // AdRoll
  __adroll: { category: 'marketing', description: 'AdRoll Advertising' },
  __adroll_fpc: { category: 'marketing', description: 'AdRoll First-Party Cookie' },
  __ar_v4: { category: 'marketing', description: 'AdRoll Advertising' },

  // Hubspot Marketing
  __hs_opt_out: { category: 'marketing', description: 'HubSpot Opt-out' },
  __hs_do_not_track: { category: 'marketing', description: 'HubSpot Do Not Track' },
  __hs_initial_opt_in: { category: 'marketing', description: 'HubSpot Initial Opt-in' },
  hs_ab_test: { category: 'marketing', description: 'HubSpot A/B Test' },

  // Pardot (Salesforce)
  pardot: { category: 'marketing', description: 'Pardot Marketing' },
  visitor_id: { category: 'marketing', description: 'Pardot Visitor ID' },
  pi_opt_in: { category: 'marketing', description: 'Pardot Opt-in' },
  lpv: { category: 'marketing', description: 'Pardot Landing Page View' },

  // Marketo
  _mkto_trk: { category: 'marketing', description: 'Marketo Tracking' },

  // Intercom
  intercom_id: { category: 'marketing', description: 'Intercom Visitor ID' },
  'intercom-id': { category: 'marketing', description: 'Intercom Visitor ID' },
  'intercom-session': { category: 'marketing', description: 'Intercom Session' },

  // Drift
  driftt_aid: { category: 'marketing', description: 'Drift Anonymous ID' },
  DRIFT_AID: { category: 'marketing', description: 'Drift Anonymous ID' },

  // Mailchimp
  _mc: { category: 'marketing', description: 'Mailchimp' },
  MCPopupClosed: { category: 'marketing', description: 'Mailchimp Popup' },
  MCPopupSubscribed: { category: 'marketing', description: 'Mailchimp Popup Subscribed' },

  // Affiliate / Tracking
  _kla_id: { category: 'marketing', description: 'Klaviyo Tracking' },
  __zlcmid: { category: 'marketing', description: 'Zendesk Chat' },
  _omappvp: { category: 'marketing', description: 'OptinMonster' },
  _omappvs: { category: 'marketing', description: 'OptinMonster Session' },
  _rdt_uuid: { category: 'marketing', description: 'Reddit Pixel' },
  _schn: { category: 'marketing', description: 'Snapchat Ads' },
};

/**
 * Patterns for heuristic cookie category guessing.
 * Used when a cookie is not found in KNOWN_COOKIES.
 */
export const COOKIE_CATEGORY_PATTERNS: {
  category: CookieCategory;
  patterns: RegExp[];
}[] = [
  {
    category: 'analytics',
    patterns: [
      /^_ga/i,
      /^_gid/i,
      /^_gat/i,
      /^__utm/i,
      /analytics/i,
      /^_pk_/i,
      /^_hj/i,
      /^_vis_opt/i,
      /^_vwo/i,
      /^ajs_/i,
      /^amp_/i,
      /^_hp2_/i,
      /^mp_/i,
      /^_ym_/i,
      /^s_/i,
      /^AMCV/i,
      /^_clck/i,
      /^_clsk/i,
      /^optimizely/i,
      /^fs_/i,
      /^_lo_/i,
      /^mf_/i,
      /^ph_/i,
      /^_ce/i,
      /^ceg_/i,
      /heatmap/i,
      /tracking/i,
      /pageview/i,
      /^gtm/i,
    ],
  },
  {
    category: 'marketing',
    patterns: [
      /^_fb/i,
      /^_gcl/i,
      /^_gac/i,
      /^IDE$/i,
      /^DSID$/i,
      /^__gads/i,
      /^li_/i,
      /^bcookie/i,
      /^lidc/i,
      /^_uet/i,
      /^MUID/i,
      /^_tt/i,
      /^_ttp/i,
      /^_pin/i,
      /^_epik/i,
      /^_scid/i,
      /^cto_/i,
      /^t_gid/i,
      /^__adroll/i,
      /^__ar_v/i,
      /^_mkto/i,
      /^pardot/i,
      /^_kla/i,
      /^_rdt/i,
      /^driftt/i,
      /^intercom/i,
      /advert/i,
      /campaign/i,
      /affiliate/i,
      /referr/i,
      /retarget/i,
      /pixel/i,
      /^ad[_-]/i,
      /^ads[_-]/i,
      /marketing/i,
      /promo/i,
      /sponsor/i,
    ],
  },
  {
    category: 'necessary',
    patterns: [
      /session/i,
      /^sess/i,
      /^sid$/i,
      /csrf/i,
      /xsrf/i,
      /^auth/i,
      /^token/i,
      /^jwt/i,
      /^login/i,
      /^logged/i,
      /^cart/i,
      /^checkout/i,
      /^consent/i,
      /^cookie.*consent/i,
      /^lang$/i,
      /^locale$/i,
      /^currency$/i,
      /^i18n/i,
      /^__cf/i,
      /^AWSALB/i,
      /^AWSELB/i,
      /^BIGip/i,
      /^incap/i,
      /^visid_incap/i,
      /^nlbi_/i,
      /^__stripe/i,
    ],
  },
];
