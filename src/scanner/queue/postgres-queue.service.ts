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

    const created = await (this.prisma as any).scanJob.create({
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

    const nextJob = await (this.prisma as any).scanJob.findFirst({
      where: { status: 'QUEUED' },
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
    this.logger.log(`Starting job ${job.id} for ${job.websiteUrl}`);

    await (this.prisma as any).scanJob.update({
      where: { id: job.id },
      data: {
        status: 'PROCESSING',
        startedAt: new Date(),
        currentStep: 'Initializing browser...',
        progress: 5,
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
      this.logger.error(`Job ${job.id} failed: ${error.message}`);

      await (this.prisma as any).scanJob.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          error: error.message,
          currentStep: 'Failed',
        },
      });
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
