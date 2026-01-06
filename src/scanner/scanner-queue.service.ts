import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ScannerService } from './scanner.service';
import { ScannerReportService } from './scanner-report.service';

// Maximum concurrent scans (1 for low-resource servers)
const MAX_CONCURRENT_SCANS = 1;

// How often to check for new jobs (ms)
const POLL_INTERVAL = 5000;

export interface QueuedScanRequest {
  websiteUrl: string;
  auditRequestId?: string;
  userEmail?: string;
  locale?: string;
  priority?: number;
}

export interface ScanJobStatus {
  id: string;
  websiteUrl: string;
  status: string;
  progress: number;
  currentStep: string | null;
  position: number | null;  // Position in queue (null if not queued)
  reportId: string | null;
  error: string | null;
  queuedAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  estimatedWaitMinutes: number | null;
}

@Injectable()
export class ScannerQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ScannerQueueService.name);
  private isProcessing = false;
  private pollInterval: NodeJS.Timeout | null = null;
  private currentJobId: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly scannerService: ScannerService,
    private readonly reportService: ScannerReportService,
  ) {}

  onModuleInit() {
    this.logger.log('Starting scan queue worker...');
    this.startWorker();
  }

  onModuleDestroy() {
    this.logger.log('Stopping scan queue worker...');
    this.stopWorker();
  }

  private startWorker() {
    // Poll for new jobs periodically
    this.pollInterval = setInterval(() => {
      this.processNextJob();
    }, POLL_INTERVAL);

    // Also try to process immediately on startup
    this.processNextJob();
  }

  private stopWorker() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  async queueScan(request: QueuedScanRequest): Promise<ScanJobStatus> {
    this.logger.log(`Queueing scan for: ${request.websiteUrl}`);

    // Create job in queue
    const job = await (this.prisma as any).scanJob.create({
      data: {
        websiteUrl: request.websiteUrl,
        auditRequestId: request.auditRequestId,
        userEmail: request.userEmail,
        locale: request.locale || 'en',
        priority: request.priority || 0,
        status: 'QUEUED',
        progress: 0,
      },
    });

    // Get position in queue
    const position = await this.getQueuePosition(job.id);

    // Trigger worker to check for new jobs
    setImmediate(() => this.processNextJob());

    return this.formatJobStatus(job, position);
  }

  async getJobStatus(jobId: string): Promise<ScanJobStatus | null> {
    const job = await (this.prisma as any).scanJob.findUnique({
      where: { id: jobId },
    });

    if (!job) return null;

    const position = job.status === 'QUEUED' ? await this.getQueuePosition(jobId) : null;
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

  async getQueueStats() {
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
      estimatedWaitPerJob: 60, // seconds
    };
  }

  private async getQueuePosition(jobId: string): Promise<number> {
    const job = await (this.prisma as any).scanJob.findUnique({
      where: { id: jobId },
    });

    if (!job || job.status !== 'QUEUED') return 0;

    // Count jobs ahead in queue (higher priority or earlier queued)
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
    // Skip if already processing max concurrent jobs
    if (this.isProcessing) {
      return;
    }

    // Check how many jobs are currently processing
    const processingCount = await (this.prisma as any).scanJob.count({
      where: { status: 'PROCESSING' },
    });

    if (processingCount >= MAX_CONCURRENT_SCANS) {
      return;
    }

    // Get next job from queue (highest priority, oldest first)
    const nextJob = await (this.prisma as any).scanJob.findFirst({
      where: { status: 'QUEUED' },
      orderBy: [
        { priority: 'desc' },
        { queuedAt: 'asc' },
      ],
    });

    if (!nextJob) {
      return;
    }

    this.isProcessing = true;
    this.currentJobId = nextJob.id;

    try {
      await this.executeJob(nextJob);
    } catch (error) {
      this.logger.error(`Job ${nextJob.id} failed: ${error.message}`);
    } finally {
      this.isProcessing = false;
      this.currentJobId = null;
    }
  }

  private async executeJob(job: any) {
    this.logger.log(`Starting job ${job.id} for ${job.websiteUrl}`);

    // Mark as processing
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
      // Update progress during scan
      await this.updateJobProgress(job.id, 10, 'Loading website...');

      // Execute the scan
      const result = await this.scannerService.scanWebsite(job.websiteUrl);

      await this.updateJobProgress(job.id, 90, 'Saving results...');

      // Save to database
      const reportId = await this.reportService.saveScanResult(result, job.auditRequestId);

      // Mark as completed
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

      this.logger.log(`Job ${job.id} completed successfully. Report: ${reportId}`);

    } catch (error) {
      this.logger.error(`Job ${job.id} failed: ${error.message}`);

      // Mark as failed
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

  private async updateJobProgress(jobId: string, progress: number, step: string) {
    await (this.prisma as any).scanJob.update({
      where: { id: jobId },
      data: { progress, currentStep: step },
    });
  }

  private formatJobStatus(job: any, position: number | null): ScanJobStatus {
    const estimatedWaitMinutes = position && position > 0 
      ? Math.ceil(position * 1) // ~1 minute per scan
      : null;

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
      estimatedWaitMinutes,
    };
  }
}
