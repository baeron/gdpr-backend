import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ScannerService } from '../scanner.service';
import { ScannerReportService } from '../scanner-report.service';
import { BaseQueueService, computeBackoffMs } from './base-queue.service';
import { QueuedJob } from './queue.interface';

const MAX_CONCURRENT_SCANS = 1;
const POLL_INTERVAL = 5000;

/**
 * PostgreSQL-backed queue: no external broker, the worker polls the
 * ScanJob table for the next eligible job. All cross-cutting bookkeeping
 * (rate limiting, status tracking, retry, stats) lives in
 * BaseQueueService.
 */
@Injectable()
export class PostgresQueueService extends BaseQueueService {
  protected readonly logger = new Logger(PostgresQueueService.name);
  private isProcessing = false;
  private pollInterval: NodeJS.Timeout | null = null;

  constructor(
    prisma: PrismaService,
    private readonly scannerService: ScannerService,
    private readonly reportService: ScannerReportService,
  ) {
    super(prisma);
  }

  protected maxConcurrent(): number {
    return MAX_CONCURRENT_SCANS;
  }

  /**
   * Postgres has no external transport — enqueueing is just a hint to
   * wake the polling loop immediately rather than wait up to
   * POLL_INTERVAL ms for the next tick.
   */
  protected async enqueueOnTransport(
    _jobId: string,
    _job: QueuedJob,
  ): Promise<void> {
    setImmediate(() => this.processNextJob());
  }

  protected async retryOnTransport(): Promise<void> {
    setImmediate(() => this.processNextJob());
  }

  startWorker(): void {
    this.logger.log('Starting PostgreSQL queue worker...');
    this.pollInterval = setInterval(() => {
      this.processNextJob();
    }, POLL_INTERVAL);
    this.processNextJob();
  }

  stopWorker(): void {
    this.logger.log('Stopping PostgreSQL queue worker...');
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  // ─── Worker loop ────────────────────────────────────────────────────────

  private async processNextJob() {
    if (this.isProcessing) return;

    const processingCount = await this.prisma.scanJob.count({
      where: { status: 'PROCESSING' },
    });

    if (processingCount >= MAX_CONCURRENT_SCANS) return;

    // A QUEUED job is eligible only if its nextRetryAt is null (fresh)
    // or already in the past — otherwise the backoff window for a
    // previously-failed attempt is still active.
    const nextJob = await this.prisma.scanJob.findFirst({
      where: {
        status: 'QUEUED',
        OR: [
          { nextRetryAt: null },
          { nextRetryAt: { lte: new Date() } },
        ],
      },
      orderBy: [{ priority: 'desc' }, { queuedAt: 'asc' }],
    });

    if (!nextJob) return;

    this.isProcessing = true;

    try {
      await this.executeJob(nextJob);
    } catch (error) {
      this.logger.error(
        `Job ${nextJob.id} failed: ${(error as Error).message}`,
      );
    } finally {
      this.isProcessing = false;
    }
  }

  private async executeJob(job: any) {
    const attempts = (job.attempts ?? 0) + 1;
    this.logger.log(
      `Starting job ${job.id} for ${job.websiteUrl} (attempt ${attempts}/${job.maxAttempts ?? 3})`,
    );

    await this.prisma.scanJob.update({
      where: { id: job.id },
      data: {
        status: 'PROCESSING',
        startedAt: new Date(),
        currentStep: 'Initializing browser...',
        progress: 5,
        attempts,
        nextRetryAt: null,
      },
    });

    try {
      await this.updateProgress(job.id, 10, 'Loading website...');
      const result = await this.scannerService.scanWebsite(job.websiteUrl);
      await this.updateProgress(job.id, 90, 'Saving results...');

      const reportId = await this.reportService.saveScanResult(
        result,
        job.auditRequestId,
      );

      await this.prisma.scanJob.update({
        where: { id: job.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          reportId,
          progress: 100,
          currentStep: 'Completed',
        },
      });

      this.logger.log(`Job ${job.id} completed. Report: ${reportId}`);
    } catch (error) {
      const errMessage = (error as Error).message ?? String(error);
      const maxAttempts = job.maxAttempts ?? 3;

      if (attempts < maxAttempts) {
        // Re-queue for a later retry with exponential backoff.
        const backoffMs = computeBackoffMs(attempts);
        const nextRetryAt = new Date(Date.now() + backoffMs);
        this.logger.warn(
          `Job ${job.id} attempt ${attempts}/${maxAttempts} failed: ${errMessage}. ` +
            `Re-queued for ${nextRetryAt.toISOString()} (in ${Math.round(backoffMs / 1000)}s).`,
        );
        await this.prisma.scanJob.update({
          where: { id: job.id },
          data: {
            status: 'QUEUED',
            error: errMessage,
            currentStep: `Retry scheduled (${attempts}/${maxAttempts})`,
            nextRetryAt,
            startedAt: null,
          },
        });
      } else {
        // Exhausted retries — terminal failure (DLQ entry).
        this.logger.error(
          `Job ${job.id} permanently failed after ${attempts} attempts: ${errMessage}`,
        );
        await this.prisma.scanJob.update({
          where: { id: job.id },
          data: {
            status: 'FAILED',
            completedAt: new Date(),
            error: errMessage,
            currentStep: 'Failed',
            nextRetryAt: null,
          },
        });
      }
    }
  }
}
