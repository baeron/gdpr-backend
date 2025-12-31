-- CreateEnum
CREATE TYPE "AuditStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('UNKNOWN', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "AuditRequest" (
    "id" TEXT NOT NULL,
    "websiteUrl" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "agreeScan" BOOLEAN NOT NULL DEFAULT true,
    "agreeMarketing" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "status" "AuditStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditReport" (
    "id" TEXT NOT NULL,
    "auditRequestId" TEXT NOT NULL,
    "cookiesFound" JSONB,
    "trackersFound" JSONB,
    "consentBanner" BOOLEAN,
    "privacyPolicy" BOOLEAN,
    "httpsEnabled" BOOLEAN,
    "overallScore" INTEGER,
    "riskLevel" "RiskLevel" NOT NULL DEFAULT 'UNKNOWN',
    "summary" TEXT,
    "recommendations" JSONB,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditRequest_email_idx" ON "AuditRequest"("email");

-- CreateIndex
CREATE INDEX "AuditRequest_status_idx" ON "AuditRequest"("status");

-- CreateIndex
CREATE INDEX "AuditRequest_createdAt_idx" ON "AuditRequest"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuditReport_auditRequestId_key" ON "AuditReport"("auditRequestId");

-- CreateIndex
CREATE INDEX "AuditReport_riskLevel_idx" ON "AuditReport"("riskLevel");

-- AddForeignKey
ALTER TABLE "AuditReport" ADD CONSTRAINT "AuditReport_auditRequestId_fkey" FOREIGN KEY ("auditRequestId") REFERENCES "AuditRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
