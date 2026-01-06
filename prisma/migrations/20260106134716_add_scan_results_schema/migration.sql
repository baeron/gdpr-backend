/*
  Warnings:

  - You are about to drop the column `cookiesFound` on the `AuditReport` table. All the data in the column will be lost.
  - You are about to drop the column `httpsEnabled` on the `AuditReport` table. All the data in the column will be lost.
  - You are about to drop the column `recommendations` on the `AuditReport` table. All the data in the column will be lost.
  - You are about to drop the column `summary` on the `AuditReport` table. All the data in the column will be lost.
  - You are about to drop the column `trackersFound` on the `AuditReport` table. All the data in the column will be lost.
  - The `consentBanner` column on the `AuditReport` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `privacyPolicy` column on the `AuditReport` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `websiteUrl` to the `AuditReport` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "IssueCategory" AS ENUM ('COOKIES', 'TRACKERS', 'CONSENT', 'PRIVACY_POLICY', 'SECURITY', 'FORMS', 'DATA_TRANSFER', 'TECHNOLOGY', 'OTHER');

-- CreateEnum
CREATE TYPE "IssueStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'WONT_FIX');

-- AlterTable
ALTER TABLE "AuditReport" DROP COLUMN "cookiesFound",
DROP COLUMN "httpsEnabled",
DROP COLUMN "recommendations",
DROP COLUMN "summary",
DROP COLUMN "trackersFound",
ADD COLUMN     "cookies" JSONB,
ADD COLUMN     "dataTransfers" JSONB,
ADD COLUMN     "forms" JSONB,
ADD COLUMN     "scanDurationMs" INTEGER,
ADD COLUMN     "security" JSONB,
ADD COLUMN     "technologies" JSONB,
ADD COLUMN     "thirdPartyRequests" JSONB,
ADD COLUMN     "trackers" JSONB,
ADD COLUMN     "websiteUrl" TEXT NOT NULL,
ALTER COLUMN "auditRequestId" DROP NOT NULL,
DROP COLUMN "consentBanner",
ADD COLUMN     "consentBanner" JSONB,
DROP COLUMN "privacyPolicy",
ADD COLUMN     "privacyPolicy" JSONB;

-- CreateTable
CREATE TABLE "ScanIssue" (
    "id" TEXT NOT NULL,
    "auditReportId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "category" "IssueCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "riskLevel" "RiskLevel" NOT NULL,
    "evidence" TEXT,
    "recommendation" TEXT NOT NULL,
    "codeExample" TEXT,
    "effortHours" TEXT,
    "estimatedCost" TEXT,
    "status" "IssueStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScanIssue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScanIssue_auditReportId_idx" ON "ScanIssue"("auditReportId");

-- CreateIndex
CREATE INDEX "ScanIssue_category_idx" ON "ScanIssue"("category");

-- CreateIndex
CREATE INDEX "ScanIssue_riskLevel_idx" ON "ScanIssue"("riskLevel");

-- CreateIndex
CREATE INDEX "ScanIssue_status_idx" ON "ScanIssue"("status");

-- CreateIndex
CREATE INDEX "AuditReport_websiteUrl_idx" ON "AuditReport"("websiteUrl");

-- CreateIndex
CREATE INDEX "AuditReport_scannedAt_idx" ON "AuditReport"("scannedAt");

-- AddForeignKey
ALTER TABLE "ScanIssue" ADD CONSTRAINT "ScanIssue_auditReportId_fkey" FOREIGN KEY ("auditReportId") REFERENCES "AuditReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
