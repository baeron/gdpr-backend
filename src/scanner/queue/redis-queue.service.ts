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
  // BullMQ not installed - this service won't work without it
}

const QUEUE_NAME = 'gdpr-scanner';

@Injectable()
export class RedisQueueService implements IQueueService {
  private readonly logger = new Logger(RedisQueueService.name);
  private queue: any;
  private worker: any;
  private readonly redisUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly scannerService: ScannerService,
    private readonly reportService: ScannerReportService,
  ) {
    this.redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  }

  startWorker(): void {
    if (!Queue || !Worker) {
      this.logger.error('BullMQ not installed. Run: npm install bullmq');
      return;
    }

    const connection = this.parseRedisUrl(this.redisUrl);

    this.logger.log(`Starting Redis queue worker... (${this.redisUrl})`);

    // Create queue
    this.queue = new Queue(QUEUE_NAME, { connection });

    // Create worker (only if WORKER_ENABLED)
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

  async addJob(job: QueuedJob): Promise<JobStatus> {
    this.logger.log(`Queueing scan for: ${job.websiteUrl}`);

    // Create DB record first
    const dbJob = await (this.prisma as any).scanJob.create({
      data: {
        websiteUrl: job.websiteUrl,
        auditRequestId: job.auditRequestId,
        userEmail: job.userEmail,
        locale: job.locale || 'en',
        priority: job.priority || 0,
        status: 'QUEUED',
        progress: 0,
      },
    });

    // Add to Bull queue
    await this.queue.add(
      'scan',
      { jobId: dbJob.id, websiteUrl: job.websiteUrl },
      {
        priority: -(job.priority || 0), // Bull uses lower = higher priority
        jobId: dbJob.id,
      },
    );

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

    if (!job || job.status !== 'QUEUED') {
      return false;
    }

    // Remove from Bull queue
    const bullJob = await this.queue.getJob(jobId);
    if (bullJob) {
      await bullJob.remove();
    }

    // Update DB
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

    const concurrency = parseInt(process.env.WORKER_CONCURRENCY || '1', 10);

    return {
      queued,
      processing,
      completed,
      failed,
      maxConcurrent: concurrency,
      estimatedWaitPerJob: 60,
    };
  }

  private async processJob(bullJob: any) {
    const { jobId, websiteUrl } = bullJob.data;
    this.logger.log(`Processing job ${jobId} for ${websiteUrl}`);

    // Update DB status
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
      this.logger.error(`Job ${jobId} failed: ${error.message}`);

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
