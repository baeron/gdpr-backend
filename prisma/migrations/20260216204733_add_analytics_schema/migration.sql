-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('DESKTOP', 'MOBILE', 'TABLET', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "AnalyticsEventType" AS ENUM ('PAGE_VIEW', 'SCROLL_DEPTH', 'SECTION_VIEW', 'FORM_FOCUS', 'FORM_INPUT', 'FORM_ERROR', 'FORM_SUBMIT', 'CHECKBOX_TOGGLE', 'CTA_CLICK', 'PRICING_CARD_CLICK', 'SCAN_STARTED', 'SCAN_COMPLETED', 'SCAN_FAILED', 'SCAN_PHASE_SEEN', 'CHECKOUT_STARTED', 'CHECKOUT_REDIRECT', 'PAYMENT_VERIFIED', 'REPORT_VIEW', 'REPORT_CATEGORY_EXPAND', 'REPORT_ISSUE_EXPAND', 'DOWNLOAD_PDF', 'CONSENT_ACCEPT', 'CONSENT_REJECT', 'CONSENT_CUSTOM', 'LANGUAGE_SWITCH', 'LANGUAGE_DROPDOWN_OPEN', 'FAQ_EXPAND', 'ERROR_SHOWN', 'SESSION_END');

-- CreateTable
CREATE TABLE "AnalyticsSession" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "ipHash" TEXT,
    "country" TEXT,
    "city" TEXT,
    "region" TEXT,
    "timezone" TEXT,
    "browser" TEXT,
    "browserVersion" TEXT,
    "os" TEXT,
    "osVersion" TEXT,
    "deviceType" "DeviceType" NOT NULL DEFAULT 'DESKTOP',
    "referrer" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmTerm" TEXT,
    "utmContent" TEXT,
    "landingPage" TEXT,
    "language" TEXT,
    "screenResolution" TEXT,
    "viewportSize" TEXT,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "eventType" "AnalyticsEventType" NOT NULL,
    "page" TEXT,
    "elementId" TEXT,
    "elementType" TEXT,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsSession_sessionId_key" ON "AnalyticsSession"("sessionId");

-- CreateIndex
CREATE INDEX "AnalyticsSession_sessionId_idx" ON "AnalyticsSession"("sessionId");

-- CreateIndex
CREATE INDEX "AnalyticsSession_country_idx" ON "AnalyticsSession"("country");

-- CreateIndex
CREATE INDEX "AnalyticsSession_utmSource_idx" ON "AnalyticsSession"("utmSource");

-- CreateIndex
CREATE INDEX "AnalyticsSession_utmCampaign_idx" ON "AnalyticsSession"("utmCampaign");

-- CreateIndex
CREATE INDEX "AnalyticsSession_createdAt_idx" ON "AnalyticsSession"("createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsSession_deviceType_idx" ON "AnalyticsSession"("deviceType");

-- CreateIndex
CREATE INDEX "AnalyticsSession_landingPage_idx" ON "AnalyticsSession"("landingPage");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_sessionId_idx" ON "AnalyticsEvent"("sessionId");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_eventType_idx" ON "AnalyticsEvent"("eventType");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_timestamp_idx" ON "AnalyticsEvent"("timestamp");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_eventType_timestamp_idx" ON "AnalyticsEvent"("eventType", "timestamp");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_page_idx" ON "AnalyticsEvent"("page");

-- AddForeignKey
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AnalyticsSession"("sessionId") ON DELETE CASCADE ON UPDATE CASCADE;
