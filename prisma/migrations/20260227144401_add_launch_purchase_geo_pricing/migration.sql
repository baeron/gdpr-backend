-- CreateEnum
CREATE TYPE "PricingRegion" AS ENUM ('EU', 'US', 'UK', 'ASIA', 'LATAM', 'OTHER');

-- AlterTable
ALTER TABLE "ScanJob" ADD COLUMN     "clientIp" TEXT;

-- CreateTable
CREATE TABLE "LaunchPurchase" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "stripeSessionId" TEXT,
    "stripePaymentIntentId" TEXT,
    "region" "PricingRegion" NOT NULL,
    "slotNumber" INTEGER NOT NULL,
    "priceEur" INTEGER NOT NULL,
    "country" TEXT,
    "city" TEXT,
    "ipHash" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "userEmail" TEXT,
    "campaignId" TEXT NOT NULL DEFAULT 'launch-2026',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LaunchPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LaunchPurchase_stripeSessionId_key" ON "LaunchPurchase"("stripeSessionId");

-- CreateIndex
CREATE INDEX "LaunchPurchase_reportId_idx" ON "LaunchPurchase"("reportId");

-- CreateIndex
CREATE INDEX "LaunchPurchase_region_idx" ON "LaunchPurchase"("region");

-- CreateIndex
CREATE INDEX "LaunchPurchase_slotNumber_idx" ON "LaunchPurchase"("slotNumber");

-- CreateIndex
CREATE INDEX "LaunchPurchase_campaignId_idx" ON "LaunchPurchase"("campaignId");

-- CreateIndex
CREATE INDEX "LaunchPurchase_stripeSessionId_idx" ON "LaunchPurchase"("stripeSessionId");

-- CreateIndex
CREATE INDEX "LaunchPurchase_status_idx" ON "LaunchPurchase"("status");

-- CreateIndex
CREATE INDEX "LaunchPurchase_region_slotNumber_idx" ON "LaunchPurchase"("region", "slotNumber");
