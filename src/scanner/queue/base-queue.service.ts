import { Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  IQueueService,
  JobStatus,
  QueuedJob,
  QueueStats,
} from './queue.interface';

const MAX_CONCURRENT_PER_CLIENT_IP = 3;

/**
 * Exponential backoff (ms) before the Nth retry of a failed scan.
 * attempts=1 → 30s, 2 → 1m, 3 → 2m, capped at 5m.
 *
 * Exported so concrete queue services can use the same schedule and the
 * unit tests can assert against a single source of truth.
 */
export function computeBackoffMs(attempts: number): number {
  const base = 30_000;
  const cap = 5 * 60_000;
  return Math.min(base * Math.pow(2, Math.max(0, attempts - 1)), cap);
}

/**
 * BaseQueueService centralises the DB-side bookkeeping that every
 * concrete IQueueService implementation needs:
 *
 *  - per-client-IP rate limiting on enqueue
 *  - ScanJob row creation
 *  - getJobStatus / getQueuePosition / formatJobStatus
 *  - cancelJob / retryJob lifecycle (with transport-specific hooks)
 *  - getStats (status counts)
 *  - updateProgress
 *
 * Concrete services (postgres, redis, hybrid, cloudrun) only have to
 * implement the transport-side push/cancel hooks and their own worker
 * lifecycle (startWorker / stopWorker / executeJob).
 *
 * The Prisma client is intentionally typed `any` for ScanJob access:
 * the rest of the codebase already does so and a typed model would
 * leak across all four subclasses.
 */
export abstract class BaseQueueService implements IQueueService {
  protected abstract readonly logger: Logger;

  constructor(protected readonly prisma: PrismaService) {}

  // ─── Transport hooks (subclasses customise) ──────────────────────────────

  /**
   * Push a freshly-created job onto the underlying transport. For
   * polling-based queues (postgres) this is typically a no-op or a
   * setImmediate-style nudge; for Redis it's queue.add(); for Cloud Run
   * it's an HTTP trigger.
   */
  protected abstract enqueueOnTransport(
    jobId: string,
    job: QueuedJob,
  ): Promise<void>;

  /**
   * Remove a still-queued job from the underlying transport. Default
   * is a no-op (postgres polling — nothing to remove).
   */
  protected async cancelOnTransport(_jobId: string): Promise<void> {
    return;
  }

  /**
   * Re-push a job onto the transport during DLQ replay. Default falls
   * back to enqueueOnTransport; subclasses that need extra metadata
   * (priority, websiteUrl) override.
   */
  protected async retryOnTransport(job: {
    id: string;
    websiteUrl: string;
    priority?: number;
  }): Promise<void> {
    return this.enqueueOnTransport(job.id, {
      websiteUrl: job.websiteUrl,
      priority: job.priority,
    });
  }

  /**
   * Reported in getStats(). Defaults to 1 — subclasses with parallel
   * workers (Redis, Hybrid, Cloud Run) override.
   */
  protected maxConcurrent(): number {
    return 1;
  }

  // ─── IQueueService implementation ────────────────────────────────────────

  async addJob(job: QueuedJob): Promise<JobStatus> {
    this.logger.log(`Queueing scan for: ${job.websiteUrl}`);

    await this.assertWithinClientRateLimit(job.clientIp);

    const created = await this.prisma.scanJob.create({
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

    await this.enqueueOnTransport(created.id, job);

    const position = await this.getQueuePosition(created.id);
    return this.formatJobStatus(created, position);
  }

  async getJobStatus(jobId: string): Promise<JobStatus | null> {
    const job = await this.prisma.scanJob.findUnique({
      where: { id: jobId },
    });
    if (!job) return null;

    const position =
      job.status === 'QUEUED' ? await this.getQueuePosition(jobId) : null;
    return this.formatJobStatus(job, position);
  }

  async cancelJob(jobId: string): Promise<boolean> {
    const job = await this.prisma.scanJob.findUnique({
      where: { id: jobId },
    });
    if (!job || job.status !== 'QUEUED') return false;

    await this.cancelOnTransport(jobId);

    await this.prisma.scanJob.update({
      where: { id: jobId },
      data: { status: 'CANCELLED' },
    });

    return true;
  }

  async retryJob(jobId: string): Promise<boolean> {
    // Manual DLQ replay: only FAILED jobs are eligible. Reset the
    // attempt counter so the worker has a fresh retry budget, clear
    // any per-attempt state, and put the job back in QUEUED before
    // pushing it onto the transport.
    const job = await this.prisma.scanJob.findUnique({
      where: { id: jobId },
    });
    if (!job || job.status !== 'FAILED') return false;

    await this.prisma.scanJob.update({
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

    await this.retryOnTransport({
      id: jobId,
      websiteUrl: job.websiteUrl,
      priority: job.priority,
    });

    this.logger.log(`Job ${jobId} manually re-queued from FAILED`);
    return true;
  }

  async getStats(): Promise<QueueStats> {
    const [queued, processing, completed, failed] = await Promise.all([
      this.prisma.scanJob.count({ where: { status: 'QUEUED' } }),
      this.prisma.scanJob.count({ where: { status: 'PROCESSING' } }),
      this.prisma.scanJob.count({ where: { status: 'COMPLETED' } }),
      this.prisma.scanJob.count({ where: { status: 'FAILED' } }),
    ]);

    return {
      queued,
      processing,
      completed,
      failed,
      maxConcurrent: this.maxConcurrent(),
      estimatedWaitPerJob: 60,
    };
  }

  abstract startWorker(): void;
  abstract stopWorker(): void;

  // ─── Shared internals ────────────────────────────────────────────────────

  protected async assertWithinClientRateLimit(
    clientIp: string | undefined,
  ): Promise<void> {
    if (!clientIp) return;

    const activeJobsCount = await this.prisma.scanJob.count({
      where: {
        clientIp,
        status: { in: ['QUEUED', 'PROCESSING'] },
      },
    });

    if (activeJobsCount >= MAX_CONCURRENT_PER_CLIENT_IP) {
      throw new Error(
        `You have reached the maximum number of concurrent scans ` +
          `(${MAX_CONCURRENT_PER_CLIENT_IP}). Please wait for them to finish.`,
      );
    }
  }

  protected async getQueuePosition(jobId: string): Promise<number> {
    const job = await this.prisma.scanJob.findUnique({
      where: { id: jobId },
    });
    if (!job || job.status !== 'QUEUED') return 0;

    const ahead = await this.prisma.scanJob.count({
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

  protected async updateProgress(
    jobId: string,
    progress: number,
    step: string,
  ): Promise<void> {
    await this.prisma.scanJob.update({
      where: { id: jobId },
      data: { progress, currentStep: step },
    });
  }

  protected formatJobStatus(
    job: any,
    position: number | null,
  ): JobStatus {
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
