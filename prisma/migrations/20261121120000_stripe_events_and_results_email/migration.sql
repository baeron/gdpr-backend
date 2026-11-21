-- Stripe webhook idempotency: each event id is processed at most once.
CREATE TABLE "StripeWebhookEvent" (
  "id"         TEXT         NOT NULL,
  "type"       TEXT         NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StripeWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- Outbox columns for the "your scan results" e-mail.
ALTER TABLE "ScanJob" ADD COLUMN "resultsEmailSentAt" TIMESTAMP(3);
ALTER TABLE "ScanJob" ADD COLUMN "resultsEmailAttempts" INTEGER NOT NULL DEFAULT 0;

-- Backfill: jobs that finished before this migration must not receive a
-- late e-mail burst on first deploy.
UPDATE "ScanJob"
   SET "resultsEmailSentAt" = COALESCE("completedAt", "updatedAt")
 WHERE "status" IN ('COMPLETED', 'FAILED', 'CANCELLED');

CREATE INDEX "ScanJob_status_resultsEmailSentAt_idx"
  ON "ScanJob"("status", "resultsEmailSentAt");
