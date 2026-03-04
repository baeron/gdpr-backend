import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  IQueueService,
  QueuedJob,
  JobStatus,
  QueueStats,
} from './queue.interface';

const FALLBACK_POLL_INTERVAL = 30_000; // 30 seconds
const STALE_JOB_THRESHOLD_MS = 120_000; // 2 minutes — if QUEUED for longer, fallback picks it up

@Injectable()
export class CloudRunQueueService implements IQueueService {
  private readonly logger = new Logger(CloudRunQueueService.name);
  private readonly workerUrl: string;
  private readonly authToken: string;
  private readonly fallbackEnabled: boolean;
  private fallbackInterval: NodeJS.Timeout | null = null;
  private workerHealthy = true;

  constructor(private readonly prisma: PrismaService) {
    this.workerUrl = process.env.WORKER_URL || 'http://localhost:8080';
    this.authToken = process.env.WORKER_AUTH_TOKEN || '';
    this.fallbackEnabled = process.env.WORKER_FALLBACK_ENABLED !== 'false';
  }

  startWorker(): void {
    this.logger.log(
      `CloudRun queue initialized. Worker URL: ${this.workerUrl}`,
    );
    this.logger.log(
      `Fallback polling: ${this.fallbackEnabled ? 'enabled' : 'disabled'}`,
    );

    // Start health check + fallback polling
    if (this.fallbackEnabled) {
      this.fallbackInterval = setInterval(
        () => this.checkStaleJobs(),
        FALLBACK_POLL_INTERVAL,
      );
    }
  }

  stopWorker(): void {
    if (this.fallbackInterval) {
      clearInterval(this.fallbackInterval);
      this.fallbackInterval = null;
    }
    this.logger.log('CloudRun queue service stopped');
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
        throw new Error(
          'You have reached the maximum number of concurrent scans (3). Please wait for them to finish.',
        );
      }
    }

    // 1. Create job in PostgreSQL
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

    // 2. Trigger Cloud Run worker via HTTP
    await this.triggerWorker(created.id);

    const position = await this.getQueuePosition(created.id);
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
      maxConcurrent: 5, // Cloud Run can scale up
      estimatedWaitPerJob: 60,
    };
  }

  // ─── Private ─────────────────────────────────────────────

  private async triggerWorker(jobId: string): Promise<void> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    try {
      const response = await fetch(`${this.workerUrl}/scan`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ jobId }),
        signal: AbortSignal.timeout(10_000), // 10 sec timeout for the trigger
      });

      if (response.status === 202) {
        this.logger.log(`Worker accepted job ${jobId}`);
        this.workerHealthy = true;
      } else if (response.status === 429) {
        this.logger.warn(
          `Worker at capacity for job ${jobId}, will be picked up by fallback`,
        );
        this.workerHealthy = true; // Worker is alive, just busy
      } else {
        const body = await response.text().catch(() => '');
        this.logger.warn(
          `Worker returned ${response.status} for job ${jobId}: ${body}`,
        );
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(
        `Failed to trigger worker for job ${jobId}: ${msg}. ` +
          `Job remains QUEUED — fallback will pick it up.`,
      );
      this.workerHealthy = false;
    }
  }

  /**
   * Fallback: check for stale QUEUED jobs that Cloud Run missed.
   * This ensures no scan is ever lost even if Cloud Run is down.
   */
  private async checkStaleJobs(): Promise<void> {
    try {
      const staleThreshold = new Date(Date.now() - STALE_JOB_THRESHOLD_MS);

      const staleJobs = await (this.prisma as any).scanJob.findMany({
        where: {
          status: 'QUEUED',
          queuedAt: { lt: staleThreshold },
        },
        orderBy: [{ priority: 'desc' }, { queuedAt: 'asc' }],
        take: 5,
      });

      if (staleJobs.length === 0) return;

      this.logger.warn(
        `Found ${staleJobs.length} stale job(s), re-triggering worker...`,
      );

      for (const job of staleJobs) {
        await this.triggerWorker(job.id);
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Fallback check failed: ${msg}`);
    }
  }

  /**
   * Check if the Cloud Run worker is reachable.
   * Called periodically or on-demand.
   */
  async checkWorkerHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.workerUrl}/health`, {
        signal: AbortSignal.timeout(5_000),
      });

      if (response.ok) {
        this.workerHealthy = true;
        return true;
      }

      this.workerHealthy = false;
      return false;
    } catch {
      this.workerHealthy = false;
      return false;
    }
  }

  isWorkerHealthy(): boolean {
    return this.workerHealthy;
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
