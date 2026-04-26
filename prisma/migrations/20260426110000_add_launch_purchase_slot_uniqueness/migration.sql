-- Enforce one purchase per (region, campaignId, slotNumber).
-- This prevents duplicate slot reservations when the Redis-based atomic
-- counter is unavailable and the service falls back to a DB read+insert
-- pattern which is racy by nature. Combined with an application-level
-- retry on P2002, slot allocation becomes safe under concurrency.

-- CreateIndex
CREATE UNIQUE INDEX "LaunchPurchase_region_campaignId_slotNumber_key"
  ON "LaunchPurchase"("region", "campaignId", "slotNumber");
