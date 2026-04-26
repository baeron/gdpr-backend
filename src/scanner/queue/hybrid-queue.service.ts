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

// Bull queue imports - will be installed when Redis is enabled
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
 * HybridQueueService — Redis/BullMQ local worker + Cloud Run overflow
 *
 * Strategy:
 *   1. Every job goes into Redis/BullMQ queue first
 *   2. Local worker on VPS processes jobs (free, no extra cost)
 *   3. When queue depth or wait time exceeds thresholds,
 *      overflow jobs are ALSO sent to Cloud Run worker for parallel processing
 *   4. Cloud Run worker picks up the DB job directly (status=QUEUED)
 *      and processes it — the local worker won't re-process it because
 *      Cloud Run marks it as PROCESSING first
 *
 * Cost optimization:
 *   - 90%+ of scans processed locally (free)
 *   - Cloud Run only activated during peak loads
 *   - Cloud Run scales to zero when not needed ($0 idle)
 */
@Injectable()
export class HybridQueueService implements IQueueService {
  private readonly logger = new Logger(HybridQueueService.name);
  private queue: any;
  private worker: any;
  private overflowCheckInterval: NodeJS.Timeout | null = null;

  // ─── Configuration (from env) ────────────────────────────
  private readonly redisUrl: string;
  private readonly workerUrl: string;
  private readonly authToken: string;

  // Overflow thresholds
  private readonly queueThreshold: number;  // Trigger overflow when queue > N
  private readonly waitThreshold: number;   // Trigger overflow when oldest job waits > N seconds
  private readonly overflowCheckMs: number; // How often to check for overflow (ms)
  private readonly overflowEnabled: boolean;

  // Worker health
  private workerHealthy = true;
  private lastHealthCheck = 0;
  private readonly healthCheckInterval = 60_000; // 1 min

  constructor(
    private readonly prisma: PrismaService,
    private readonly scannerService: ScannerService,
    private readonly reportService: ScannerReportService,
  ) {
    this.redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.workerUrl = process.env.WORKER_URL || 'http://localhost:8080';
    this.authToken = process.env.WORKER_AUTH_TOKEN || '';

    this.queueThreshold = parseInt(process.env.OVERFLOW_QUEUE_THRESHOLD || '2', 10);
    this.waitThreshold = parseInt(process.env.OVERFLOW_WAIT_THRESHOLD_SEC || '120', 10);
    this.overflowCheckMs = parseInt(process.env.OVERFLOW_CHECK_INTERVAL_MS || '15000', 10);
    this.overflowEnabled = process.env.OVERFLOW_ENABLED !== 'false';
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

    // Create BullMQ queue
    this.queue = new Queue(QUEUE_NAME, { connection });

    // Create local worker (processes jobs on VPS)
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

    // Start overflow monitor
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

    // 1. Create DB record
    const dbJob = await (this.prisma as any).scanJob.create({
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

    // 2. Add to BullMQ queue (local worker will pick it up)
    await this.queue.add(
      'scan',
      { jobId: dbJob.id, websiteUrl: job.websiteUrl },
      {
        priority: -(job.priority || 0),
        jobId: dbJob.id,
      },
    );

    // 3. Check if overflow is needed RIGHT NOW
    //    (don't wait for the interval — instant check on addJob)
    if (this.overflowEnabled) {
      const shouldOverflow = await this.shouldTriggerOverflow();
      if (shouldOverflow) {
        this.logger.log(
          `[Overflow] Queue overloaded, sending job ${dbJob.id} to Cloud Run`,
        );
        await this.triggerCloudRunWorker(dbJob.id);
      }
    }

    const position = await this.getQueuePosition(dbJob.id);
    return this.formatJobStatus(dbJob, position);
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
    if (!job || job.status !== 'QUEUED') return false;

    const bullJob = await this.queue.getJob(jobId);
    if (bullJob) await bullJob.remove();

    await (this.prisma as any).scanJob.update({
      where: { id: jobId },
      data: { status: 'CANCELLED' },
    });
    return true;
  }

  async retryJob(jobId: string): Promise<boolean> {
    // Manual DLQ replay: reset retry counters and re-add to BullMQ.
    // The local worker will pick it up; if backlog is high the overflow
    // monitor may forward to Cloud Run on the next tick — that path is
    // already idempotent (status=QUEUED check before processing).
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

    await this.queue.add(
      'scan',
      { jobId, websiteUrl: job.websiteUrl },
      { priority: -(job.priority || 0), jobId },
    );

    this.logger.log(`Job ${jobId} manually re-queued from FAILED`);
    return true;
  }

  async getStats(): Promise<QueueStats> {
    const [queued, processing, completed, failed] = await Promise.all([
      (this.prisma as any).scanJob.count({ where: { status: 'QUEUED' } }),
      (this.prisma as any).scanJob.count({ where: { status: 'PROCESSING' } }),
      (this.prisma as any).scanJob.count({ where: { status: 'COMPLETED' } }),
      (this.prisma as any).scanJob.count({ where: { status: 'FAILED' } }),
    ]);

    const concurrency = parseInt(process.env.WORKER_CONCURRENCY || '1', 10);

    return {
      queued,
      processing,
      completed,
      failed,
      maxConcurrent: concurrency + 5, // local + Cloud Run
      estimatedWaitPerJob: 60,
    };
  }

  // ─── Overflow Logic ──────────────────────────────────────

  /**
   * Determine if Cloud Run overflow should be triggered.
   * Two conditions (OR):
   *   1. Queue depth exceeds threshold
   *   2. Oldest waiting job exceeds wait time threshold
   */
  private async shouldTriggerOverflow(): Promise<boolean> {
    // Check queue depth
    const queuedCount = await (this.prisma as any).scanJob.count({
      where: { status: 'QUEUED' },
    });

    if (queuedCount > this.queueThreshold) {
      this.logger.debug(
        `[Overflow] Queue depth ${queuedCount} > threshold ${this.queueThreshold}`,
      );
      return true;
    }

    // Check oldest job wait time
    const oldestJob = await (this.prisma as any).scanJob.findFirst({
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

      // Check worker health before sending jobs
      if (Date.now() - this.lastHealthCheck > this.healthCheckInterval) {
        await this.checkWorkerHealth();
      }

      if (!this.workerHealthy) {
        this.logger.warn('[Overflow] Cloud Run worker unhealthy, skipping overflow');
        return;
      }

      // Find QUEUED jobs that need overflow (oldest first)
      const overflowJobs = await (this.prisma as any).scanJob.findMany({
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
   * The worker will:
   *   1. Read the job from PostgreSQL
   *   2. Check if status is still QUEUED (not already picked up locally)
   *   3. Mark as PROCESSING and execute scan
   *   4. Save result to DB
   *
   * Race condition handling:
   *   - Cloud Run worker checks job.status === QUEUED before processing
   *   - If local worker already picked it up → status is PROCESSING → Cloud Run skips
   *   - If Cloud Run picks it up first → status becomes PROCESSING → local worker's
   *     BullMQ job will fail gracefully (job already processed)
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

  // ─── Local Job Processing (same as RedisQueueService) ────

  private async processJob(bullJob: any) {
    const { jobId, websiteUrl } = bullJob.data;

    // Check if Cloud Run already picked this up
    const currentJob = await (this.prisma as any).scanJob.findUnique({
      where: { id: jobId },
    });

    if (!currentJob || currentJob.status !== 'QUEUED') {
      this.logger.log(
        `[Local] Job ${jobId} already ${currentJob?.status || 'gone'}, skipping`,
      );
      return;
    }

    this.logger.log(`[Local] Processing job ${jobId} for ${websiteUrl}`);

    await (this.prisma as any).scanJob.update({
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

      await (this.prisma as any).scanJob.update({
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
      this.logger.error(`[Local] Job ${jobId} failed: ${error.message}`);

      await (this.prisma as any).scanJob.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          error: error.message,
          currentStep: 'Failed',
        },
      });

      throw error;
    }
  }

  // ─── Helpers ─────────────────────────────────────────────

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
          { priority: job.priority, queuedAt: { lt: job.queuedAt } },
        ],
      },
    });
    return ahead + 1;
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

  private parseRedisUrl(url: string): { host: string; port: number } {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port || '6379', 10),
    };
  }
}
