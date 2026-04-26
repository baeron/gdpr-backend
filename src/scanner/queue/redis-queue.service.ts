import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ScannerService } from '../scanner.service';
import { ScannerReportService } from '../scanner-report.service';
import { BaseQueueService } from './base-queue.service';
import { QueuedJob } from './queue.interface';

// BullMQ is loaded lazily so the module compiles even when the optional
// dep isn't installed (e.g. QUEUE_TYPE=postgres deployments).
let Queue: any;
let Worker: any;

try {
  const bullmq = require('bullmq');
  Queue = bullmq.Queue;
  Worker = bullmq.Worker;
} catch {
  // BullMQ not installed - this service won't work without it
}

const QUEUE_NAME = 'gdpr-scanner';

/**
 * Redis/BullMQ-backed queue. The BullMQ broker handles delivery and the
 * worker processes jobs in-process. Cross-cutting bookkeeping (rate
 * limit, status, retry, stats) lives in BaseQueueService.
 */
@Injectable()
export class RedisQueueService extends BaseQueueService {
  protected readonly logger = new Logger(RedisQueueService.name);
  private queue: any;
  private worker: any;
  private readonly redisUrl: string;

  constructor(
    prisma: PrismaService,
    private readonly scannerService: ScannerService,
    private readonly reportService: ScannerReportService,
  ) {
    super(prisma);
    this.redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  }

  protected maxConcurrent(): number {
    return parseInt(process.env.WORKER_CONCURRENCY || '1', 10);
  }

  protected async enqueueOnTransport(
    jobId: string,
    job: QueuedJob,
  ): Promise<void> {
    await this.queue.add(
      'scan',
      { jobId, websiteUrl: job.websiteUrl },
      {
        priority: -(job.priority || 0),
        jobId,
      },
    );
  }

  protected async cancelOnTransport(jobId: string): Promise<void> {
    const bullJob = await this.queue.getJob(jobId);
    if (bullJob) {
      await bullJob.remove();
    }
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

    this.logger.log(`Starting Redis queue worker... (${this.redisUrl})`);

    this.queue = new Queue(QUEUE_NAME, { connection });

    if (process.env.WORKER_ENABLED !== 'false') {
      const concurrency = this.maxConcurrent();

      this.worker = new Worker(
        QUEUE_NAME,
        async (job: any) => {
          await this.processJob(job);
        },
        { connection, concurrency },
      );

      this.worker.on('completed', (job: any) => {
        this.logger.log(`Job ${job.id} completed`);
      });

      this.worker.on('failed', (job: any, err: Error) => {
        this.logger.error(`Job ${job?.id} failed: ${err.message}`);
      });

      this.logger.log(`Worker started with concurrency: ${concurrency}`);
    }
  }

  stopWorker(): void {
    this.logger.log('Stopping Redis queue worker...');
    if (this.worker) {
      this.worker.close();
    }
    if (this.queue) {
      this.queue.close();
    }
  }

  // ─── Worker job processor ───────────────────────────────────────────────

  private async processJob(bullJob: any) {
    const { jobId, websiteUrl } = bullJob.data;
    this.logger.log(`Processing job ${jobId} for ${websiteUrl}`);

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
      this.logger.error(`Job ${jobId} failed: ${errMessage}`);

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
