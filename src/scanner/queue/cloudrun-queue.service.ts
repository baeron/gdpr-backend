import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BaseQueueService } from './base-queue.service';
import { QueuedJob } from './queue.interface';

const FALLBACK_POLL_INTERVAL = 30_000; // 30 seconds
const STALE_JOB_THRESHOLD_MS = 120_000; // 2 minutes — if QUEUED for longer, fallback picks it up

/**
 * CloudRunQueueService — single-instance, serverless variant. Jobs live
 * in PostgreSQL (no broker), and a Cloud Run worker is invoked over HTTP
 * for each new job. A fallback poller re-triggers stale QUEUED jobs in
 * case the HTTP trigger was missed (Cloud Run cold start, transient
 * network failure).
 *
 * DB-side bookkeeping (rate limit, status, retry, stats) is inherited
 * from BaseQueueService.
 */
@Injectable()
export class CloudRunQueueService extends BaseQueueService {
  protected readonly logger = new Logger(CloudRunQueueService.name);
  private readonly workerUrl: string;
  private readonly authToken: string;
  private readonly fallbackEnabled: boolean;
  private fallbackInterval: NodeJS.Timeout | null = null;
  private workerHealthy = true;

  constructor(prisma: PrismaService) {
    super(prisma);
    this.workerUrl = process.env.WORKER_URL || 'http://localhost:8080';
    this.authToken = process.env.WORKER_AUTH_TOKEN || '';
    this.fallbackEnabled = process.env.WORKER_FALLBACK_ENABLED !== 'false';
  }

  protected maxConcurrent(): number {
    return 5; // Cloud Run can scale up
  }

  protected async enqueueOnTransport(
    jobId: string,
    _job: QueuedJob,
  ): Promise<void> {
    await this.triggerWorker(jobId);
  }

  protected async retryOnTransport(job: { id: string }): Promise<void> {
    await this.triggerWorker(job.id);
  }

  startWorker(): void {
    this.logger.log(
      `CloudRun queue initialized. Worker URL: ${this.workerUrl}`,
    );
    this.logger.log(
      `Fallback polling: ${this.fallbackEnabled ? 'enabled' : 'disabled'}`,
    );

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

  // ─── Cloud Run integration ───────────────────────────────────

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
        signal: AbortSignal.timeout(10_000),
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

      const staleJobs = await this.prisma.scanJob.findMany({
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
   * Public health check used by /health endpoint and tests.
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
}
