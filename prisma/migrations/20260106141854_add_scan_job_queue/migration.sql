-- CreateEnum
CREATE TYPE "ScanJobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "ScanJob" (
    "id" TEXT NOT NULL,
    "websiteUrl" TEXT NOT NULL,
    "auditRequestId" TEXT,
    "status" "ScanJobStatus" NOT NULL DEFAULT 'QUEUED',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "currentStep" TEXT,
    "reportId" TEXT,
    "error" TEXT,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "userEmail" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScanJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScanJob_status_idx" ON "ScanJob"("status");

-- CreateIndex
CREATE INDEX "ScanJob_queuedAt_idx" ON "ScanJob"("queuedAt");

-- CreateIndex
CREATE INDEX "ScanJob_priority_queuedAt_idx" ON "ScanJob"("priority", "queuedAt");
