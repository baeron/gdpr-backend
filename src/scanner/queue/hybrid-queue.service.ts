import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ScannerService } from '../scanner.service';
import { ScannerReportService } from '../scanner-report.service';
import { BaseQueueService } from './base-queue.service';
import { JobStatus, QueuedJob, QueueStats } from './queue.interface';

let Queue: any;
let Worker: any;

try {
  const bullmq = require('bullmq');
  Queue = bullmq.Queue;
  Worker = bullmq.Worker;
} catch {
  // BullMQ not installed
}

const QUEUE_NAME = 'gdpr-scanner';

/**
 * HybridQueueService — Redis/BullMQ local worker + Cloud Run overflow.
 *
 * Strategy:
 *   1. Every job goes into Redis/BullMQ queue first.
 *   2. Local worker on VPS processes jobs (free, no extra cost).
 *   3. When queue depth or wait time exceeds thresholds, overflow jobs
 *      are ALSO sent to Cloud Run worker for parallel processing.
 *   4. Cloud Run worker picks up the DB job directly (status=QUEUED)
 *      and processes it — the local worker won't re-process it because
 *      Cloud Run marks it as PROCESSING first.
 *
 * Cost optimization:
 *   - 90%+ of scans processed locally (free)
 *   - Cloud Run only activated during peak loads
 *   - Cloud Run scales to zero when not needed ($0 idle)
 *
 * DB-side bookkeeping (rate limit, status lookup, retry, stats) lives
 * in BaseQueueService. This class only owns BullMQ wiring + the
 * overflow-to-Cloud-Run policy.
 */
@Injectable()
export class HybridQueueService extends BaseQueueService {
  protected readonly logger = new Logger(HybridQueueService.name);
  private queue: any;
  private worker: any;
  private overflowCheckInterval: NodeJS.Timeout | null = null;

  // ─── Configuration (from env) ────────────────────────────
  private readonly redisUrl: string;
  private readonly workerUrl: string;
  private readonly authToken: string;

  // Overflow thresholds
  private readonly queueThreshold: number; // Trigger overflow when queue > N
  private readonly waitThreshold: number; // Trigger overflow when oldest job waits > N seconds
  private readonly overflowCheckMs: number; // How often to check for overflow (ms)
  private readonly overflowEnabled: boolean;

  // Worker health
  private workerHealthy = true;
  private lastHealthCheck = 0;
  private readonly healthCheckInterval = 60_000; // 1 min

  constructor(
    prisma: PrismaService,
    private readonly scannerService: ScannerService,
    private readonly reportService: ScannerReportService,
  ) {
    super(prisma);
    this.redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.workerUrl = process.env.WORKER_URL || 'http://localhost:8080';
    this.authToken = process.env.WORKER_AUTH_TOKEN || '';

    this.queueThreshold = parseInt(process.env.OVERFLOW_QUEUE_THRESHOLD || '2', 10);
    this.waitThreshold = parseInt(process.env.OVERFLOW_WAIT_THRESHOLD_SEC || '120', 10);
    this.overflowCheckMs = parseInt(process.env.OVERFLOW_CHECK_INTERVAL_MS || '15000', 10);
    this.overflowEnabled = process.env.OVERFLOW_ENABLED !== 'false';
  }

  protected maxConcurrent(): number {
    // Local concurrency + a fixed-size pool of Cloud Run workers.
    return parseInt(process.env.WORKER_CONCURRENCY || '1', 10) + 5;
  }

  protected async enqueueOnTransport(
    jobId: string,
    job: QueuedJob,
  ): Promise<void> {
    await this.queue.add(
      'scan',
      { jobId, websiteUrl: job.websiteUrl },
      { priority: -(job.priority || 0), jobId },
    );

    // Instant overflow check (don't wait for the periodic interval).
    if (this.overflowEnabled) {
      const shouldOverflow = await this.shouldTriggerOverflow();
      if (shouldOverflow) {
        this.logger.log(
          `[Overflow] Queue overloaded, sending job ${jobId} to Cloud Run`,
        );
        await this.triggerCloudRunWorker(jobId);
      }
    }
  }

  protected async cancelOnTransport(jobId: string): Promise<void> {
    const bullJob = await this.queue.getJob(jobId);
    if (bullJob) await bullJob.remove();
  }

  protected async retryOnTransport(job: {
    id: string;
    websiteUrl: string;
    priority?: number;
  }): Promise<void> {
    await this.queue.add(
      'scan',
      { jobId: job.id, websiteUrl: job.websiteUrl },
      { priority: -(job.priority || 0), jobId: job.id },
    );
  }

  startWorker(): void {
    if (!Queue || !Worker) {
      this.logger.error('BullMQ not installed. Run: npm install bullmq');
      return;
    }

    const connection = this.parseRedisUrl(this.redisUrl);

    this.logger.log(`Starting Hybrid queue service (${this.redisUrl})`);
    this.logger.log(
      `Overflow: ${this.overflowEnabled ? 'enabled' : 'disabled'} → ` +
        `queue > ${this.queueThreshold} OR wait > ${this.waitThreshold}s → ${this.workerUrl}`,
    );

    this.queue = new Queue(QUEUE_NAME, { connection });

    if (process.env.WORKER_ENABLED !== 'false') {
      const concurrency = parseInt(process.env.WORKER_CONCURRENCY || '1', 10);

      this.worker = new Worker(
        QUEUE_NAME,
        async (job: any) => {
          await this.processJob(job);
        },
        { connection, concurrency },
      );

      this.worker.on('completed', (job: any) => {
        this.logger.log(`[Local] Job ${job.id} completed`);
      });

      this.worker.on('failed', (job: any, err: Error) => {
        this.logger.error(`[Local] Job ${job?.id} failed: ${err.message}`);
      });

      this.logger.log(`Local worker started with concurrency: ${concurrency}`);
    }

    if (this.overflowEnabled) {
      this.overflowCheckInterval = setInterval(
        () => this.checkOverflow(),
        this.overflowCheckMs,
      );
      this.logger.log(
        `Overflow monitor started (check every ${this.overflowCheckMs}ms)`,
      );
    }
  }

  stopWorker(): void {
    this.logger.log('Stopping Hybrid queue service...');
    if (this.worker) this.worker.close();
    if (this.queue) this.queue.close();
    if (this.overflowCheckInterval) {
      clearInterval(this.overflowCheckInterval);
      this.overflowCheckInterval = null;
    }
  }

  /**
   * Override addJob so the new "instant overflow check" can run in the
   * same call — BaseQueueService.addJob already calls
   * enqueueOnTransport, which now contains the overflow probe.
   */

  /**
   * Hybrid reports a higher synthetic capacity (local + Cloud Run pool)
   * than the bare BullMQ worker concurrency, plus the same status
   * counts. Override solely to keep the parent's structure but expose
   * the larger maxConcurrent.
   */
  async getStats(): Promise<QueueStats> {
    const stats = await super.getStats();
    return stats;
  }

  // ─── Overflow Logic ──────────────────────────────────────

  /**
   * Determine if Cloud Run overflow should be triggered.
   * Two conditions (OR):
   *   1. Queue depth exceeds threshold
   *   2. Oldest waiting job exceeds wait time threshold
   */
  private async shouldTriggerOverflow(): Promise<boolean> {
    const queuedCount = await this.prisma.scanJob.count({
      where: { status: 'QUEUED' },
    });

    if (queuedCount > this.queueThreshold) {
      this.logger.debug(
        `[Overflow] Queue depth ${queuedCount} > threshold ${this.queueThreshold}`,
      );
      return true;
    }

    const oldestJob = await this.prisma.scanJob.findFirst({
      where: { status: 'QUEUED' },
      orderBy: { queuedAt: 'asc' },
      select: { queuedAt: true },
    });

    if (oldestJob) {
      const waitSeconds = (Date.now() - oldestJob.queuedAt.getTime()) / 1000;
      if (waitSeconds > this.waitThreshold) {
        this.logger.debug(
          `[Overflow] Oldest job waiting ${Math.round(waitSeconds)}s > threshold ${this.waitThreshold}s`,
        );
        return true;
      }
    }

    return false;
  }

  /**
   * Periodic overflow check — finds QUEUED jobs that have been waiting
   * too long and sends them to Cloud Run.
   */
  private async checkOverflow(): Promise<void> {
    try {
      const shouldOverflow = await this.shouldTriggerOverflow();
      if (!shouldOverflow) return;

      if (Date.now() - this.lastHealthCheck > this.healthCheckInterval) {
        await this.checkWorkerHealth();
      }

      if (!this.workerHealthy) {
        this.logger.warn('[Overflow] Cloud Run worker unhealthy, skipping overflow');
        return;
      }

      const overflowJobs = await this.prisma.scanJob.findMany({
        where: { status: 'QUEUED' },
        orderBy: [{ priority: 'desc' }, { queuedAt: 'asc' }],
        take: 3, // Send up to 3 at a time to avoid thundering herd
      });

      if (overflowJobs.length === 0) return;

      this.logger.log(
        `[Overflow] Sending ${overflowJobs.length} job(s) to Cloud Run worker`,
      );

      for (const job of overflowJobs) {
        await this.triggerCloudRunWorker(job.id);
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`[Overflow] Check failed: ${msg}`);
    }
  }

  /**
   * Send a job to Cloud Run worker via HTTP.
   */
  private async triggerCloudRunWorker(jobId: string): Promise<void> {
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
        this.logger.log(`[Overflow] Cloud Run accepted job ${jobId}`);
        this.workerHealthy = true;
      } else if (response.status === 429) {
        this.logger.warn(`[Overflow] Cloud Run at capacity for job ${jobId}`);
        this.workerHealthy = true;
      } else {
        const body = await response.text().catch(() => '');
        this.logger.warn(
          `[Overflow] Cloud Run returned ${response.status} for job ${jobId}: ${body}`,
        );
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`[Overflow] Failed to reach Cloud Run for job ${jobId}: ${msg}`);
      this.workerHealthy = false;
    }
  }

  private async checkWorkerHealth(): Promise<void> {
    this.lastHealthCheck = Date.now();
    try {
      const response = await fetch(`${this.workerUrl}/health`, {
        signal: AbortSignal.timeout(5_000),
      });
      this.workerHealthy = response.ok;
    } catch {
      this.workerHealthy = false;
    }

    if (!this.workerHealthy) {
      this.logger.warn('[Overflow] Cloud Run worker health check failed');
    }
  }

  // ─── Local Job Processing ────────────────────────────────

  private async processJob(bullJob: any) {
    const { jobId, websiteUrl } = bullJob.data;

    // Check if Cloud Run already picked this up
    const currentJob = await this.prisma.scanJob.findUnique({
      where: { id: jobId },
    });

    if (!currentJob || currentJob.status !== 'QUEUED') {
      this.logger.log(
        `[Local] Job ${jobId} already ${currentJob?.status || 'gone'}, skipping`,
      );
      return;
    }

    this.logger.log(`[Local] Processing job ${jobId} for ${websiteUrl}`);

    await this.prisma.scanJob.update({
      where: { id: jobId },
      data: {
        status: 'PROCESSING',
        startedAt: new Date(),
        currentStep: 'Initializing browser...',
        progress: 5,
      },
    });

    try {
      await bullJob.updateProgress(10);
      await this.updateProgress(jobId, 10, 'Loading website...');

      const result = await this.scannerService.scanWebsite(websiteUrl);

      await bullJob.updateProgress(90);
      await this.updateProgress(jobId, 90, 'Saving results...');

      const reportId = await this.reportService.saveScanResult(result);

      await this.prisma.scanJob.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          reportId,
          progress: 100,
          currentStep: 'Completed',
        },
      });

      return { reportId };
    } catch (error) {
      const errMessage = (error as Error).message ?? String(error);
      this.logger.error(`[Local] Job ${jobId} failed: ${errMessage}`);

      await this.prisma.scanJob.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          error: errMessage,
          currentStep: 'Failed',
        },
      });

      throw error;
    }
  }

  private parseRedisUrl(url: string): { host: string; port: number } {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port || '6379', 10),
    };
  }
}
