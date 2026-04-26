-- Idempotency cache for unsafe HTTP methods (POST). Clients send
-- `Idempotency-Key: <uuid>` and the server caches the response so
-- retries (network blips, double-clicks, mobile reconnects) don't
-- create duplicate ScanJob / AuditRequest rows.
--
-- Composite key (key, endpoint) lets the same UUID be reused across
-- different endpoints without false collisions.
CREATE TABLE "IdempotencyRecord" (
  "key"            TEXT        NOT NULL,
  "endpoint"       TEXT        NOT NULL,
  "requestHash"    TEXT        NOT NULL,
  "responseStatus" INTEGER     NOT NULL,
  "responseBody"   JSONB       NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("key", "endpoint")
);

-- Used by the periodic cleanup job to drop expired entries.
CREATE INDEX "IdempotencyRecord_expiresAt_idx"
  ON "IdempotencyRecord"("expiresAt");
