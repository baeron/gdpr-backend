import { TrackerInfo } from '../dto/scan-result.dto';

export interface TrackerPattern {
  name: string;
  type: TrackerInfo['type'];
  patterns: RegExp[];
}

/**
 * Database of 100+ known tracking scripts categorized by purpose.
 * Sources: Disconnect.me, EasyPrivacy, vendor documentation.
 *
 * Types:
 *   - analytics: Web analytics, heatmaps, session replay, A/B testing
 *   - advertising: Ad networks, retargeting, conversion tracking
 *   - social: Social media widgets, share buttons, embeds
 *   - other: Fingerprinting, tag managers, misc tracking
 */
export const TRACKER_PATTERNS: TrackerPattern[] = [
  // ============================================================
  // ANALYTICS — Web Analytics, Heatmaps, Session Replay, A/B
  // ============================================================

  // Google Analytics / GTM
  {
    name: 'Google Analytics',
    type: 'analytics',
    patterns: [
      /google-analytics\.com/i,
      /googletagmanager\.com/i,
      /analytics\.google\.com/i,
      /www\.googletagmanager\.com\/gtag/i,
    ],
  },
  // Hotjar
  {
    name: 'Hotjar',
    type: 'analytics',
    patterns: [/hotjar\.com/i, /static\.hotjar\.com/i, /script\.hotjar\.com/i],
  },
  // Mixpanel
  {
    name: 'Mixpanel',
    type: 'analytics',
    patterns: [/mixpanel\.com/i, /cdn\.mxpnl\.com/i, /api\.mixpanel\.com/i],
  },
  // Amplitude
  {
    name: 'Amplitude',
    type: 'analytics',
    patterns: [/amplitude\.com/i, /cdn\.amplitude\.com/i, /api\.amplitude\.com/i, /api2\.amplitude\.com/i],
  },
  // Heap Analytics
  {
    name: 'Heap Analytics',
    type: 'analytics',
    patterns: [/heap\.io/i, /heapanalytics\.com/i, /cdn\.heapanalytics\.com/i],
  },
  // Segment
  {
    name: 'Segment',
    type: 'analytics',
    patterns: [/segment\.com/i, /cdn\.segment\.com/i, /api\.segment\.io/i],
  },
  // Matomo / Piwik
  {
    name: 'Matomo',
    type: 'analytics',
    patterns: [/matomo\.cloud/i, /cdn\.matomo\.cloud/i, /piwik\.pro/i, /matomo\.org/i],
  },
  // Adobe Analytics
  {
    name: 'Adobe Analytics',
    type: 'analytics',
    patterns: [/omtrdc\.net/i, /2o7\.net/i, /demdex\.net/i, /everesttech\.net/i, /adobedtm\.com/i],
  },
  // Microsoft Clarity
  {
    name: 'Microsoft Clarity',
    type: 'analytics',
    patterns: [/clarity\.ms/i, /www\.clarity\.ms/i],
  },
  // Yandex Metrica
  {
    name: 'Yandex Metrica',
    type: 'analytics',
    patterns: [/mc\.yandex\.ru/i, /mc\.yandex\.com/i, /metrika\.yandex\.ru/i],
  },
  // Plausible
  {
    name: 'Plausible Analytics',
    type: 'analytics',
    patterns: [/plausible\.io/i],
  },
  // Fathom
  {
    name: 'Fathom Analytics',
    type: 'analytics',
    patterns: [/usefathom\.com/i, /cdn\.usefathom\.com/i],
  },
  // PostHog
  {
    name: 'PostHog',
    type: 'analytics',
    patterns: [/posthog\.com/i, /app\.posthog\.com/i, /us\.posthog\.com/i, /eu\.posthog\.com/i],
  },
  // FullStory
  {
    name: 'FullStory',
    type: 'analytics',
    patterns: [/fullstory\.com/i, /rs\.fullstory\.com/i, /edge\.fullstory\.com/i],
  },
  // LogRocket
  {
    name: 'LogRocket',
    type: 'analytics',
    patterns: [/logrocket\.com/i, /cdn\.logrocket\.io/i, /r\.lr-ingest\.io/i, /r\.lr-in\.com/i],
  },
  // Mouseflow
  {
    name: 'Mouseflow',
    type: 'analytics',
    patterns: [/mouseflow\.com/i, /cdn\.mouseflow\.com/i, /o2\.mouseflow\.com/i],
  },
  // Lucky Orange
  {
    name: 'Lucky Orange',
    type: 'analytics',
    patterns: [/luckyorange\.com/i, /cdn\.luckyorange\.com/i],
  },
  // Crazy Egg
  {
    name: 'Crazy Egg',
    type: 'analytics',
    patterns: [/crazyegg\.com/i, /script\.crazyegg\.com/i, /dnn506yrbagrg\.cloudfront\.net/i],
  },
  // Smartlook
  {
    name: 'Smartlook',
    type: 'analytics',
    patterns: [/smartlook\.com/i, /rec\.smartlook\.com/i, /web-sdk\.smartlook\.com/i],
  },
  // Inspectlet
  {
    name: 'Inspectlet',
    type: 'analytics',
    patterns: [/inspectlet\.com/i, /cdn\.inspectlet\.com/i],
  },
  // Pendo
  {
    name: 'Pendo',
    type: 'analytics',
    patterns: [/pendo\.io/i, /cdn\.pendo\.io/i, /app\.pendo\.io/i],
  },
  // Kissmetrics
  {
    name: 'Kissmetrics',
    type: 'analytics',
    patterns: [/kissmetrics\.com/i, /i\.kissmetrics\.com/i],
  },
  // Chartbeat
  {
    name: 'Chartbeat',
    type: 'analytics',
    patterns: [/chartbeat\.com/i, /static\.chartbeat\.com/i],
  },
  // New Relic Browser
  {
    name: 'New Relic',
    type: 'analytics',
    patterns: [/newrelic\.com/i, /js-agent\.newrelic\.com/i, /bam\.nr-data\.net/i, /bam-cell\.nr-data\.net/i],
  },
  // Datadog RUM
  {
    name: 'Datadog RUM',
    type: 'analytics',
    patterns: [/datadoghq\.com/i, /browser-intake-datadoghq\.com/i, /rum\.browser-intake-datadoghq\.com/i],
  },
  // Sentry
  {
    name: 'Sentry',
    type: 'analytics',
    patterns: [/sentry\.io/i, /browser\.sentry-cdn\.com/i],
  },
  // Optimizely
  {
    name: 'Optimizely',
    type: 'analytics',
    patterns: [/optimizely\.com/i, /cdn\.optimizely\.com/i, /logx\.optimizely\.com/i],
  },
  // VWO (Visual Website Optimizer)
  {
    name: 'VWO',
    type: 'analytics',
    patterns: [/visualwebsiteoptimizer\.com/i, /dev\.visualwebsiteoptimizer\.com/i],
  },
  // AB Tasty
  {
    name: 'AB Tasty',
    type: 'analytics',
    patterns: [/abtasty\.com/i, /try\.abtasty\.com/i],
  },
  // Google Optimize
  {
    name: 'Google Optimize',
    type: 'analytics',
    patterns: [/optimize\.google\.com/i],
  },
  // Contentsquare
  {
    name: 'Contentsquare',
    type: 'analytics',
    patterns: [/contentsquare\.net/i, /c\.contentsquare\.net/i, /t\.contentsquare\.net/i],
  },
  // Quantum Metric
  {
    name: 'Quantum Metric',
    type: 'analytics',
    patterns: [/quantummetric\.com/i],
  },
  // Dynatrace
  {
    name: 'Dynatrace',
    type: 'analytics',
    patterns: [/dynatrace\.com/i, /js-cdn\.dynatrace\.com/i],
  },
  // SpeedCurve
  {
    name: 'SpeedCurve',
    type: 'analytics',
    patterns: [/speedcurve\.com/i, /cdn\.speedcurve\.com/i],
  },
  // Clicky
  {
    name: 'Clicky',
    type: 'analytics',
    patterns: [/getclicky\.com/i, /static\.getclicky\.com/i, /in\.getclicky\.com/i],
  },
  // Woopra
  {
    name: 'Woopra',
    type: 'analytics',
    patterns: [/woopra\.com/i, /static\.woopra\.com/i],
  },
  // Countly
  {
    name: 'Countly',
    type: 'analytics',
    patterns: [/count\.ly/i],
  },
  // Simple Analytics
  {
    name: 'Simple Analytics',
    type: 'analytics',
    patterns: [/simpleanalytics\.com/i, /scripts\.simpleanalyticscdn\.com/i],
  },
  // Umami
  {
    name: 'Umami',
    type: 'analytics',
    patterns: [/umami\.is/i, /analytics\.umami\.is/i],
  },

  // ============================================================
  // ADVERTISING — Ad Networks, Retargeting, Conversion Tracking
  // ============================================================

  // Facebook / Meta Pixel
  {
    name: 'Facebook Pixel',
    type: 'advertising',
    patterns: [/connect\.facebook\.net/i, /facebook\.com\/tr/i, /www\.facebook\.com\/tr/i],
  },
  // Google Ads
  {
    name: 'Google Ads',
    type: 'advertising',
    patterns: [
      /googleadservices\.com/i,
      /googlesyndication\.com/i,
      /doubleclick\.net/i,
      /googleads\.g\.doubleclick\.net/i,
      /pagead2\.googlesyndication\.com/i,
      /adservice\.google\.com/i,
    ],
  },
  // LinkedIn Insight Tag
  {
    name: 'LinkedIn Insight',
    type: 'advertising',
    patterns: [/snap\.licdn\.com/i, /linkedin\.com\/px/i, /dc\.ads\.linkedin\.com/i],
  },
  // Twitter / X Pixel
  {
    name: 'Twitter Pixel',
    type: 'advertising',
    patterns: [/static\.ads-twitter\.com/i, /t\.co\/i\/adsct/i, /analytics\.twitter\.com/i],
  },
  // TikTok Pixel
  {
    name: 'TikTok Pixel',
    type: 'advertising',
    patterns: [/analytics\.tiktok\.com/i, /business-api\.tiktok\.com/i],
  },
  // Criteo
  {
    name: 'Criteo',
    type: 'advertising',
    patterns: [/criteo\.com/i, /criteo\.net/i, /static\.criteo\.net/i],
  },
  // Pinterest Tag
  {
    name: 'Pinterest Tag',
    type: 'advertising',
    patterns: [/ct\.pinterest\.com/i, /pinimg\.com\/ct/i, /s\.pinimg\.com/i],
  },
  // Snapchat Pixel
  {
    name: 'Snapchat Pixel',
    type: 'advertising',
    patterns: [/sc-static\.net/i, /tr\.snapchat\.com/i],
  },
  // Reddit Pixel
  {
    name: 'Reddit Pixel',
    type: 'advertising',
    patterns: [/redditmedia\.com/i, /alb\.reddit\.com/i, /events\.reddit\.com/i],
  },
  // Bing Ads / Microsoft Advertising
  {
    name: 'Bing Ads',
    type: 'advertising',
    patterns: [/bat\.bing\.com/i, /bing\.com\/action/i, /clarity\.ms/i],
  },
  // Taboola
  {
    name: 'Taboola',
    type: 'advertising',
    patterns: [/taboola\.com/i, /cdn\.taboola\.com/i, /trc\.taboola\.com/i],
  },
  // Outbrain
  {
    name: 'Outbrain',
    type: 'advertising',
    patterns: [/outbrain\.com/i, /widgets\.outbrain\.com/i, /tr\.outbrain\.com/i],
  },
  // AdRoll
  {
    name: 'AdRoll',
    type: 'advertising',
    patterns: [/adroll\.com/i, /d\.adroll\.com/i, /s\.adroll\.com/i],
  },
  // Amazon Ads
  {
    name: 'Amazon Ads',
    type: 'advertising',
    patterns: [/amazon-adsystem\.com/i, /aax\.amazon-adsystem\.com/i, /z-na\.amazon-adsystem\.com/i],
  },
  // Quora Pixel
  {
    name: 'Quora Pixel',
    type: 'advertising',
    patterns: [/quora\.com\/_\/ad/i, /q\.quora\.com/i],
  },
  // Yahoo / Verizon Media
  {
    name: 'Yahoo Ads',
    type: 'advertising',
    patterns: [/ads\.yahoo\.com/i, /analytics\.yahoo\.com/i, /sp\.analytics\.yahoo\.com/i],
  },
  // The Trade Desk
  {
    name: 'The Trade Desk',
    type: 'advertising',
    patterns: [/thetradedesk\.com/i, /match\.adsrvr\.org/i, /insight\.adsrvr\.org/i, /js\.adsrvr\.org/i],
  },
  // MediaMath
  {
    name: 'MediaMath',
    type: 'advertising',
    patterns: [/mediamath\.com/i, /pixel\.mathtag\.com/i, /sync\.mathtag\.com/i],
  },
  // AppNexus / Xandr
  {
    name: 'AppNexus',
    type: 'advertising',
    patterns: [/adnxs\.com/i, /ib\.adnxs\.com/i, /secure\.adnxs\.com/i],
  },
  // Rubicon Project / Magnite
  {
    name: 'Rubicon Project',
    type: 'advertising',
    patterns: [/rubiconproject\.com/i, /fastlane\.rubiconproject\.com/i, /pixel\.rubiconproject\.com/i],
  },
  // Index Exchange
  {
    name: 'Index Exchange',
    type: 'advertising',
    patterns: [/casalemedia\.com/i, /indexexchange\.com/i],
  },
  // PubMatic
  {
    name: 'PubMatic',
    type: 'advertising',
    patterns: [/pubmatic\.com/i, /ads\.pubmatic\.com/i, /image2\.pubmatic\.com/i],
  },
  // OpenX
  {
    name: 'OpenX',
    type: 'advertising',
    patterns: [/openx\.net/i, /servedbyopenx\.com/i],
  },
  // Teads
  {
    name: 'Teads',
    type: 'advertising',
    patterns: [/teads\.tv/i, /a\.teads\.tv/i, /t\.teads\.tv/i],
  },
  // Smart AdServer
  {
    name: 'Smart AdServer',
    type: 'advertising',
    patterns: [/smartadserver\.com/i, /ww\d+\.smartadserver\.com/i],
  },
  // Quantcast
  {
    name: 'Quantcast',
    type: 'advertising',
    patterns: [/quantserve\.com/i, /quantcast\.com/i, /pixel\.quantserve\.com/i],
  },
  // Lotame
  {
    name: 'Lotame',
    type: 'advertising',
    patterns: [/crwdcntrl\.net/i, /tags\.crwdcntrl\.net/i, /bcp\.crwdcntrl\.net/i],
  },
  // ShareASale
  {
    name: 'ShareASale',
    type: 'advertising',
    patterns: [/shareasale\.com/i, /shareasale-analytics\.com/i],
  },
  // Commission Junction
  {
    name: 'Commission Junction',
    type: 'advertising',
    patterns: [/emjcd\.com/i, /www\.emjcd\.com/i],
  },
  // Impact
  {
    name: 'Impact',
    type: 'advertising',
    patterns: [/impact\.com/i, /d\.impactradius-event\.com/i],
  },
  // Awin
  {
    name: 'Awin',
    type: 'advertising',
    patterns: [/awin1\.com/i, /dwin1\.com/i],
  },

  // ============================================================
  // SOCIAL — Social Media Widgets, Share Buttons, Embeds
  // ============================================================

  // Facebook SDK
  {
    name: 'Facebook SDK',
    type: 'social',
    patterns: [/connect\.facebook\.net\/.*\/sdk\.js/i, /connect\.facebook\.net\/.*\/all\.js/i],
  },
  // Twitter Widgets
  {
    name: 'Twitter Widgets',
    type: 'social',
    patterns: [/platform\.twitter\.com/i, /syndication\.twitter\.com/i],
  },
  // LinkedIn SDK
  {
    name: 'LinkedIn SDK',
    type: 'social',
    patterns: [/platform\.linkedin\.com/i],
  },
  // Instagram Embed
  {
    name: 'Instagram Embed',
    type: 'social',
    patterns: [/instagram\.com\/embed/i, /www\.instagram\.com\/embed/i],
  },
  // YouTube Embed
  {
    name: 'YouTube Embed',
    type: 'social',
    patterns: [/youtube\.com\/iframe_api/i, /youtube\.com\/embed/i, /youtube-nocookie\.com\/embed/i],
  },
  // Vimeo Embed
  {
    name: 'Vimeo Embed',
    type: 'social',
    patterns: [/player\.vimeo\.com/i, /vimeo\.com\/api/i],
  },
  // Pinterest Widget
  {
    name: 'Pinterest Widget',
    type: 'social',
    patterns: [/assets\.pinterest\.com/i, /widgets\.pinterest\.com/i],
  },
  // TikTok Embed
  {
    name: 'TikTok Embed',
    type: 'social',
    patterns: [/tiktok\.com\/embed/i, /www\.tiktok\.com\/embed/i],
  },
  // Reddit Embed
  {
    name: 'Reddit Embed',
    type: 'social',
    patterns: [/embed\.reddit\.com/i, /www\.redditmedia\.com\/widgets/i],
  },
  // Disqus
  {
    name: 'Disqus',
    type: 'social',
    patterns: [/disqus\.com/i, /disquscdn\.com/i, /c\.disquscdn\.com/i],
  },
  // AddThis
  {
    name: 'AddThis',
    type: 'social',
    patterns: [/addthis\.com/i, /s7\.addthis\.com/i, /addthisedge\.com/i],
  },
  // ShareThis
  {
    name: 'ShareThis',
    type: 'social',
    patterns: [/sharethis\.com/i, /platform-api\.sharethis\.com/i],
  },
  // Google reCAPTCHA (social/other — loads tracking)
  {
    name: 'Google reCAPTCHA',
    type: 'social',
    patterns: [/google\.com\/recaptcha/i, /gstatic\.com\/recaptcha/i],
  },
  // Google Maps
  {
    name: 'Google Maps',
    type: 'social',
    patterns: [/maps\.googleapis\.com/i, /maps\.google\.com/i],
  },

  // ============================================================
  // OTHER — Fingerprinting, Tag Managers, Misc
  // ============================================================

  // FingerprintJS
  {
    name: 'FingerprintJS',
    type: 'other',
    patterns: [/fingerprintjs\.com/i, /fpjs\.io/i, /api\.fpjs\.io/i],
  },
  // Tealium
  {
    name: 'Tealium',
    type: 'other',
    patterns: [/tealiumiq\.com/i, /tags\.tiqcdn\.com/i, /collect\.tealiumiq\.com/i],
  },
  // Ensighten
  {
    name: 'Ensighten',
    type: 'other',
    patterns: [/ensighten\.com/i, /nexus\.ensighten\.com/i],
  },
  // Signal (BrightTag)
  {
    name: 'Signal',
    type: 'other',
    patterns: [/thebrighttag\.com/i, /s\.btstatic\.com/i],
  },
  // HubSpot Tracking
  {
    name: 'HubSpot Tracking',
    type: 'other',
    patterns: [/js\.hs-scripts\.com/i, /js\.hs-analytics\.net/i, /js\.hscollectedforms\.net/i, /js\.hsadspixel\.net/i],
  },
  // Intercom
  {
    name: 'Intercom',
    type: 'other',
    patterns: [/intercom\.io/i, /widget\.intercom\.io/i, /api-iam\.intercom\.io/i],
  },
  // Drift
  {
    name: 'Drift',
    type: 'other',
    patterns: [/drift\.com/i, /js\.driftt\.com/i],
  },
  // Zendesk
  {
    name: 'Zendesk',
    type: 'other',
    patterns: [/zdassets\.com/i, /static\.zdassets\.com/i, /ekr\.zdassets\.com/i],
  },
  // Freshdesk / Freshchat
  {
    name: 'Freshworks',
    type: 'other',
    patterns: [/freshdesk\.com/i, /wchat\.freshchat\.com/i],
  },
  // Olark
  {
    name: 'Olark',
    type: 'other',
    patterns: [/olark\.com/i, /static\.olark\.com/i],
  },
  // LiveChat
  {
    name: 'LiveChat',
    type: 'other',
    patterns: [/livechatinc\.com/i, /cdn\.livechatinc\.com/i],
  },
  // Crisp
  {
    name: 'Crisp',
    type: 'other',
    patterns: [/crisp\.chat/i, /client\.crisp\.chat/i],
  },
  // Tidio
  {
    name: 'Tidio',
    type: 'other',
    patterns: [/tidio\.co/i, /code\.tidio\.co/i],
  },
  // Cookiebot
  {
    name: 'Cookiebot',
    type: 'other',
    patterns: [/cookiebot\.com/i, /consent\.cookiebot\.com/i],
  },
  // OneTrust
  {
    name: 'OneTrust',
    type: 'other',
    patterns: [/onetrust\.com/i, /cdn\.cookielaw\.org/i, /optanon\.blob\.core\.windows\.net/i],
  },
  // TrustArc
  {
    name: 'TrustArc',
    type: 'other',
    patterns: [/trustarc\.com/i, /consent\.trustarc\.com/i],
  },
  // Usercentrics
  {
    name: 'Usercentrics',
    type: 'other',
    patterns: [/usercentrics\.eu/i, /app\.usercentrics\.eu/i],
  },
  // Didomi
  {
    name: 'Didomi',
    type: 'other',
    patterns: [/didomi\.io/i, /sdk\.privacy-center\.org/i],
  },
  // Salesforce / Pardot
  {
    name: 'Salesforce Tracking',
    type: 'other',
    patterns: [/pardot\.com/i, /pi\.pardot\.com/i, /go\.pardot\.com/i],
  },
  // Marketo
  {
    name: 'Marketo',
    type: 'other',
    patterns: [/marketo\.net/i, /munchkin\.marketo\.net/i, /marketo\.com/i],
  },
  // Klaviyo
  {
    name: 'Klaviyo',
    type: 'other',
    patterns: [/klaviyo\.com/i, /static\.klaviyo\.com/i, /a\.klaviyo\.com/i],
  },
  // Mailchimp
  {
    name: 'Mailchimp',
    type: 'other',
    patterns: [/chimpstatic\.com/i, /list-manage\.com/i, /mailchimp\.com/i],
  },
  // Sumo
  {
    name: 'Sumo',
    type: 'other',
    patterns: [/sumo\.com/i, /load\.sumo\.com/i, /load\.sumome\.com/i],
  },
  // OptinMonster
  {
    name: 'OptinMonster',
    type: 'other',
    patterns: [/optinmonster\.com/i, /a\.optinmonster\.com/i, /api\.opmnstr\.com/i],
  },
];
