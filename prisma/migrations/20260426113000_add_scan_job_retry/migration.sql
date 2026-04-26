-- Add retry tracking to ScanJob so failed scans can be retried with
-- exponential backoff (auto) or by an operator (manual via API), instead
-- of being silently lost on the first failure.

ALTER TABLE "ScanJob"
  ADD COLUMN "attempts"     INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN "maxAttempts"  INTEGER     NOT NULL DEFAULT 3,
  ADD COLUMN "nextRetryAt"  TIMESTAMP(3);

-- Used by the worker's polling query: pick the next QUEUED job whose
-- nextRetryAt is either null (fresh) or already in the past.
CREATE INDEX "ScanJob_status_nextRetryAt_idx"
  ON "ScanJob"("status", "nextRetryAt");
