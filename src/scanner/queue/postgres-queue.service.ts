import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ScannerService } from '../scanner.service';
import { ScannerReportService } from '../scanner-report.service';
import {
  IQueueService,
  QueuedJob,
  JobStatus,
  QueueStats,
} from './queue.interface';

const MAX_CONCURRENT_SCANS = 1;
const POLL_INTERVAL = 5000;

/**
 * Exponential backoff delay (ms) before the Nth retry.
 * attempts=1 → 30s, 2 → 1m, 3 → 2m, capped at 5m.
 */
function computeBackoffMs(attempts: number): number {
  const base = 30_000;
  const cap = 5 * 60_000;
  return Math.min(base * Math.pow(2, Math.max(0, attempts - 1)), cap);
}

@Injectable()
export class PostgresQueueService implements IQueueService {
  private readonly logger = new Logger(PostgresQueueService.name);
  private isProcessing = false;
  private pollInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly scannerService: ScannerService,
    private readonly reportService: ScannerReportService,
  ) {}

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

  async addJob(job: QueuedJob): Promise<JobStatus> {
    this.logger.log(`Queueing scan for: ${job.websiteUrl}`);

    // Rate limiting check
    if (job.clientIp) {
      const activeJobsCount = await (this.prisma as any).scanJob.count({
        where: {
          clientIp: job.clientIp,
          status: { in: ['QUEUED', 'PROCESSING'] },
        },
      });

      if (activeJobsCount >= 3) {
        throw new Error('You have reached the maximum number of concurrent scans (3). Please wait for them to finish.');
      }
    }

    const created = await (this.prisma as any).scanJob.create({
      data: {
        websiteUrl: job.websiteUrl,
        auditRequestId: job.auditRequestId,
        userEmail: job.userEmail,
        clientIp: job.clientIp,
        locale: job.locale || 'en',
        priority: job.priority || 0,
        status: 'QUEUED',
        progress: 0,
      },
    });

    const position = await this.getQueuePosition(created.id);
    setImmediate(() => this.processNextJob());

    return this.formatJobStatus(created, position);
  }

  async getJobStatus(jobId: string): Promise<JobStatus | null> {
    const job = await (this.prisma as any).scanJob.findUnique({
      where: { id: jobId },
    });

    if (!job) return null;

    const position =
      job.status === 'QUEUED' ? await this.getQueuePosition(jobId) : null;
    return this.formatJobStatus(job, position);
  }

  async cancelJob(jobId: string): Promise<boolean> {
    const job = await (this.prisma as any).scanJob.findUnique({
      where: { id: jobId },
    });

    if (!job || job.status !== 'QUEUED') {
      return false;
    }

    await (this.prisma as any).scanJob.update({
      where: { id: jobId },
      data: { status: 'CANCELLED' },
    });

    return true;
  }

  async retryJob(jobId: string): Promise<boolean> {
    // Manual DLQ replay: only FAILED jobs can be retried. Reset
    // attempts so the worker gets a full retry budget again, clear
    // stale per-attempt state, and put the job back in QUEUED.
    const job = await (this.prisma as any).scanJob.findUnique({
      where: { id: jobId },
    });

    if (!job || job.status !== 'FAILED') {
      return false;
    }

    await (this.prisma as any).scanJob.update({
      where: { id: jobId },
      data: {
        status: 'QUEUED',
        attempts: 0,
        error: null,
        currentStep: 'Re-queued by operator',
        progress: 0,
        startedAt: null,
        completedAt: null,
        nextRetryAt: null,
      },
    });

    this.logger.log(`Job ${jobId} manually re-queued from FAILED`);
    setImmediate(() => this.processNextJob());
    return true;
  }

  async getStats(): Promise<QueueStats> {
    const [queued, processing, completed, failed] = await Promise.all([
      (this.prisma as any).scanJob.count({ where: { status: 'QUEUED' } }),
      (this.prisma as any).scanJob.count({ where: { status: 'PROCESSING' } }),
      (this.prisma as any).scanJob.count({ where: { status: 'COMPLETED' } }),
      (this.prisma as any).scanJob.count({ where: { status: 'FAILED' } }),
    ]);

    return {
      queued,
      processing,
      completed,
      failed,
      maxConcurrent: MAX_CONCURRENT_SCANS,
      estimatedWaitPerJob: 60,
    };
  }

  private async getQueuePosition(jobId: string): Promise<number> {
    const job = await (this.prisma as any).scanJob.findUnique({
      where: { id: jobId },
    });

    if (!job || job.status !== 'QUEUED') return 0;

    const ahead = await (this.prisma as any).scanJob.count({
      where: {
        status: 'QUEUED',
        OR: [
          { priority: { gt: job.priority } },
          {
            priority: job.priority,
            queuedAt: { lt: job.queuedAt },
          },
        ],
      },
    });

    return ahead + 1;
  }

  private async processNextJob() {
    if (this.isProcessing) return;

    const processingCount = await (this.prisma as any).scanJob.count({
      where: { status: 'PROCESSING' },
    });

    if (processingCount >= MAX_CONCURRENT_SCANS) return;

    // A QUEUED job is eligible only if its nextRetryAt is null (fresh)
    // or already in the past — otherwise the backoff window for a
    // previously-failed attempt is still active.
    const nextJob = await (this.prisma as any).scanJob.findFirst({
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
      this.logger.error(`Job ${nextJob.id} failed: ${error.message}`);
    } finally {
      this.isProcessing = false;
    }
  }

  private async executeJob(job: any) {
    const attempts = (job.attempts ?? 0) + 1;
    this.logger.log(
      `Starting job ${job.id} for ${job.websiteUrl} (attempt ${attempts}/${job.maxAttempts ?? 3})`,
    );

    await (this.prisma as any).scanJob.update({
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

      await (this.prisma as any).scanJob.update({
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
        // Re-queue for a later retry with exponential backoff. Status
        // returns to QUEUED so the worker's polling loop will pick it
        // up again — but only after nextRetryAt has elapsed.
        const backoffMs = computeBackoffMs(attempts);
        const nextRetryAt = new Date(Date.now() + backoffMs);
        this.logger.warn(
          `Job ${job.id} attempt ${attempts}/${maxAttempts} failed: ${errMessage}. ` +
            `Re-queued for ${nextRetryAt.toISOString()} (in ${Math.round(backoffMs / 1000)}s).`,
        );
        await (this.prisma as any).scanJob.update({
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
        await (this.prisma as any).scanJob.update({
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

  private async updateProgress(jobId: string, progress: number, step: string) {
    await (this.prisma as any).scanJob.update({
      where: { id: jobId },
      data: { progress, currentStep: step },
    });
  }

  private formatJobStatus(job: any, position: number | null): JobStatus {
    return {
      id: job.id,
      websiteUrl: job.websiteUrl,
      status: job.status,
      progress: job.progress,
      currentStep: job.currentStep,
      position,
      reportId: job.reportId,
      error: job.error,
      queuedAt: job.queuedAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      estimatedWaitMinutes:
        position && position > 0 ? Math.ceil(position * 1) : null,
    };
  }
}
