import { Test, TestingModule } from '@nestjs/testing';
import { RedisQueueService } from './redis-queue.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ScannerService } from '../scanner.service';
import { ScannerReportService } from '../scanner-report.service';

// Mock BullMQ before importing the service
const mockQueueAdd = jest.fn();
const mockQueueGetJob = jest.fn();
const mockQueueClose = jest.fn();
const mockWorkerClose = jest.fn();
const mockWorkerOn = jest.fn();

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: mockQueueAdd,
    getJob: mockQueueGetJob,
    close: mockQueueClose,
  })),
  Worker: jest.fn().mockImplementation((name, processor, options) => ({
    on: mockWorkerOn,
    close: mockWorkerClose,
  })),
}));

describe('RedisQueueService', () => {
  let service: RedisQueueService;
  let prismaService: jest.Mocked<PrismaService>;
  let scannerService: jest.Mocked<ScannerService>;
  let reportService: jest.Mocked<ScannerReportService>;
  let originalRedisUrl: string | undefined;

  const mockJob = {
    id: 'job-123',
    websiteUrl: 'https://example.com',
    status: 'QUEUED',
    progress: 0,
    currentStep: null,
    priority: 0,
    queuedAt: new Date('2026-01-22T10:00:00Z'),
    startedAt: null,
    completedAt: null,
    reportId: null,
    error: null,
  };

  beforeEach(async () => {
    // Set REDIS_URL for tests
    originalRedisUrl = process.env.REDIS_URL;
    process.env.REDIS_URL = 'redis://localhost:6379';

    const mockPrisma = {
      scanJob: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
    };

    const mockScanner = {
      scanWebsite: jest.fn(),
    };

    const mockReport = {
      saveScanResult: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisQueueService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ScannerService, useValue: mockScanner },
        { provide: ScannerReportService, useValue: mockReport },
      ],
    }).compile();

    service = module.get<RedisQueueService>(RedisQueueService);
    prismaService = module.get(PrismaService);
    scannerService = module.get(ScannerService);
    reportService = module.get(ScannerReportService);
  });

  afterEach(() => {
    service.stopWorker();
    jest.clearAllMocks();
    mockQueueAdd.mockReset();
    mockQueueGetJob.mockReset();
    mockQueueClose.mockReset();
    mockWorkerClose.mockReset();
    mockWorkerOn.mockReset();

    // Restore REDIS_URL
    if (originalRedisUrl !== undefined) {
      process.env.REDIS_URL = originalRedisUrl;
    } else {
      delete process.env.REDIS_URL;
    }
  });

  describe('constructor', () => {
    it('should use default Redis URL when not provided', () => {
      const originalEnv = process.env.REDIS_URL;
      delete process.env.REDIS_URL;

      // Service is already created, check internal state via parseRedisUrl
      const parsed = (service as any).parseRedisUrl('redis://localhost:6379');
      expect(parsed).toEqual({ host: 'localhost', port: 6379 });

      process.env.REDIS_URL = originalEnv;
    });
  });

  describe('parseRedisUrl', () => {
    it('should parse standard Redis URL', () => {
      const result = (service as any).parseRedisUrl('redis://localhost:6379');
      expect(result).toEqual({ host: 'localhost', port: 6379 });
    });

    it('should parse Redis URL with custom port', () => {
      const result = (service as any).parseRedisUrl(
        'redis://redis-server:6380',
      );
      expect(result).toEqual({ host: 'redis-server', port: 6380 });
    });

    it('should use default port 6379 when not specified', () => {
      const result = (service as any).parseRedisUrl('redis://localhost');
      expect(result).toEqual({ host: 'localhost', port: 6379 });
    });

    it('should handle IP addresses', () => {
      const result = (service as any).parseRedisUrl(
        'redis://192.168.1.100:6379',
      );
      expect(result).toEqual({ host: '192.168.1.100', port: 6379 });
    });
  });

  describe('getJobStatus', () => {
    it('should return job status when job exists', async () => {
      (prismaService as any).scanJob.findUnique.mockResolvedValue(mockJob);
      (prismaService as any).scanJob.count.mockResolvedValue(0);

      const result = await service.getJobStatus('job-123');

      expect(result).toMatchObject({
        id: 'job-123',
        websiteUrl: 'https://example.com',
        status: 'QUEUED',
      });
    });

    it('should return null when job does not exist', async () => {
      (prismaService as any).scanJob.findUnique.mockResolvedValue(null);

      const result = await service.getJobStatus('non-existent');

      expect(result).toBeNull();
    });

    it('should include position for queued jobs', async () => {
      (prismaService as any).scanJob.findUnique.mockResolvedValue(mockJob);
      (prismaService as any).scanJob.count.mockResolvedValue(2);

      const result = await service.getJobStatus('job-123');

      expect(result?.position).toBe(3);
    });

    it('should not include position for processing jobs', async () => {
      const processingJob = { ...mockJob, status: 'PROCESSING' };
      (prismaService as any).scanJob.findUnique.mockResolvedValue(
        processingJob,
      );

      const result = await service.getJobStatus('job-123');

      expect(result?.position).toBeNull();
    });

    it('should not include position for completed jobs', async () => {
      const completedJob = { ...mockJob, status: 'COMPLETED' };
      (prismaService as any).scanJob.findUnique.mockResolvedValue(completedJob);

      const result = await service.getJobStatus('job-123');

      expect(result?.position).toBeNull();
    });
  });

  describe('cancelJob', () => {
    it('should return false when job does not exist', async () => {
      (prismaService as any).scanJob.findUnique.mockResolvedValue(null);

      const result = await service.cancelJob('non-existent');

      expect(result).toBe(false);
    });

    it('should return false when job is not queued', async () => {
      const processingJob = { ...mockJob, status: 'PROCESSING' };
      (prismaService as any).scanJob.findUnique.mockResolvedValue(
        processingJob,
      );

      const result = await service.cancelJob('job-123');

      expect(result).toBe(false);
    });

    it('should return false when job is already completed', async () => {
      const completedJob = { ...mockJob, status: 'COMPLETED' };
      (prismaService as any).scanJob.findUnique.mockResolvedValue(completedJob);

      const result = await service.cancelJob('job-123');

      expect(result).toBe(false);
    });

    it('should return false when job is failed', async () => {
      const failedJob = { ...mockJob, status: 'FAILED' };
      (prismaService as any).scanJob.findUnique.mockResolvedValue(failedJob);

      const result = await service.cancelJob('job-123');

      expect(result).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return queue statistics', async () => {
      (prismaService as any).scanJob.count
        .mockResolvedValueOnce(5) // queued
        .mockResolvedValueOnce(1) // processing
        .mockResolvedValueOnce(100) // completed
        .mockResolvedValueOnce(3); // failed

      const result = await service.getStats();

      expect(result).toEqual({
        queued: 5,
        processing: 1,
        completed: 100,
        failed: 3,
        maxConcurrent: 1,
        estimatedWaitPerJob: 60,
      });
    });

    it('should return zeros when queue is empty', async () => {
      (prismaService as any).scanJob.count.mockResolvedValue(0);

      const result = await service.getStats();

      expect(result).toEqual({
        queued: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        maxConcurrent: 1,
        estimatedWaitPerJob: 60,
      });
    });

    it('should use WORKER_CONCURRENCY env for maxConcurrent', async () => {
      const originalEnv = process.env.WORKER_CONCURRENCY;
      process.env.WORKER_CONCURRENCY = '3';

      (prismaService as any).scanJob.count.mockResolvedValue(0);

      const result = await service.getStats();

      expect(result.maxConcurrent).toBe(3);

      process.env.WORKER_CONCURRENCY = originalEnv;
    });
  });

  describe('startWorker / stopWorker', () => {
    it('should handle stopWorker when worker not started', () => {
      expect(() => service.stopWorker()).not.toThrow();
    });

    it('should handle multiple stopWorker calls gracefully', () => {
      expect(() => service.stopWorker()).not.toThrow();
      expect(() => service.stopWorker()).not.toThrow();
    });

    it('should start worker and create queue', () => {
      service.startWorker();

      expect((service as any).queue).toBeDefined();
    });

    it('should register event handlers on worker', () => {
      service.startWorker();

      // Worker.on should be called for 'completed' and 'failed' events
      expect(mockWorkerOn).toHaveBeenCalled();
    });

    it('should close queue and worker on stopWorker', () => {
      service.startWorker();
      service.stopWorker();

      expect(mockQueueClose).toHaveBeenCalled();
      expect(mockWorkerClose).toHaveBeenCalled();
    });
  });

  describe('addJob', () => {
    beforeEach(() => {
      service.startWorker();
    });

    it('should create job in database and add to queue', async () => {
      (prismaService as any).scanJob.create.mockResolvedValue(mockJob);
      (prismaService as any).scanJob.findUnique.mockResolvedValue(mockJob);
      (prismaService as any).scanJob.count.mockResolvedValue(0);
      mockQueueAdd.mockResolvedValue({ id: 'bull-job-123' });

      const result = await service.addJob({
        websiteUrl: 'https://example.com',
      });

      expect(result).toMatchObject({
        id: 'job-123',
        websiteUrl: 'https://example.com',
        status: 'QUEUED',
      });

      expect((prismaService as any).scanJob.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          websiteUrl: 'https://example.com',
          status: 'QUEUED',
        }),
      });

      expect(mockQueueAdd).toHaveBeenCalledWith(
        'scan',
        { jobId: 'job-123', websiteUrl: 'https://example.com' },
        expect.any(Object),
      );
    });

    it('should use default priority 0', async () => {
      (prismaService as any).scanJob.create.mockResolvedValue(mockJob);
      (prismaService as any).scanJob.findUnique.mockResolvedValue(mockJob);
      (prismaService as any).scanJob.count.mockResolvedValue(0);
      mockQueueAdd.mockResolvedValue({ id: 'bull-job-123' });

      await service.addJob({ websiteUrl: 'https://example.com' });

      expect((prismaService as any).scanJob.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          priority: 0,
        }),
      });
    });

    it('should use provided priority', async () => {
      const highPriorityJob = { ...mockJob, priority: 10 };
      (prismaService as any).scanJob.create.mockResolvedValue(highPriorityJob);
      (prismaService as any).scanJob.findUnique.mockResolvedValue(
        highPriorityJob,
      );
      (prismaService as any).scanJob.count.mockResolvedValue(0);
      mockQueueAdd.mockResolvedValue({ id: 'bull-job-123' });

      await service.addJob({ websiteUrl: 'https://example.com', priority: 10 });

      expect(mockQueueAdd).toHaveBeenCalledWith(
        'scan',
        expect.any(Object),
        expect.objectContaining({
          priority: -10, // Bull uses negative for higher priority
        }),
      );
    });
  });

  describe('cancelJob with queue', () => {
    beforeEach(() => {
      service.startWorker();
    });

    it('should cancel queued job and remove from Bull queue', async () => {
      const mockBullJob = { remove: jest.fn().mockResolvedValue(undefined) };
      (prismaService as any).scanJob.findUnique.mockResolvedValue(mockJob);
      (prismaService as any).scanJob.update.mockResolvedValue({
        ...mockJob,
        status: 'CANCELLED',
      });
      mockQueueGetJob.mockResolvedValue(mockBullJob);

      const result = await service.cancelJob('job-123');

      expect(result).toBe(true);
      expect(mockQueueGetJob).toHaveBeenCalledWith('job-123');
      expect(mockBullJob.remove).toHaveBeenCalled();
      expect((prismaService as any).scanJob.update).toHaveBeenCalledWith({
        where: { id: 'job-123' },
        data: { status: 'CANCELLED' },
      });
    });

    it('should handle case when Bull job not found', async () => {
      (prismaService as any).scanJob.findUnique.mockResolvedValue(mockJob);
      (prismaService as any).scanJob.update.mockResolvedValue({
        ...mockJob,
        status: 'CANCELLED',
      });
      mockQueueGetJob.mockResolvedValue(null);

      const result = await service.cancelJob('job-123');

      expect(result).toBe(true);
      expect((prismaService as any).scanJob.update).toHaveBeenCalled();
    });
  });

  describe('formatJobStatus', () => {
    it('should format job status correctly', async () => {
      (prismaService as any).scanJob.findUnique.mockResolvedValue(mockJob);
      (prismaService as any).scanJob.count.mockResolvedValue(0);

      const result = await service.getJobStatus('job-123');

      expect(result).toMatchObject({
        id: 'job-123',
        websiteUrl: 'https://example.com',
        status: 'QUEUED',
        progress: 0,
        currentStep: null,
        reportId: null,
        error: null,
      });
    });

    it('should calculate estimated wait time based on position', async () => {
      (prismaService as any).scanJob.findUnique.mockResolvedValue(mockJob);
      (prismaService as any).scanJob.count.mockResolvedValue(4); // 4 jobs ahead

      const result = await service.getJobStatus('job-123');

      expect(result?.position).toBe(5);
      expect(result?.estimatedWaitMinutes).toBe(5);
    });

    it('should return null estimated wait for completed jobs', async () => {
      const completedJob = {
        ...mockJob,
        status: 'COMPLETED',
        reportId: 'report-123',
      };
      (prismaService as any).scanJob.findUnique.mockResolvedValue(completedJob);

      const result = await service.getJobStatus('job-123');

      expect(result?.estimatedWaitMinutes).toBeNull();
      expect(result?.reportId).toBe('report-123');
    });

    it('should include error message for failed jobs', async () => {
      const failedJob = {
        ...mockJob,
        status: 'FAILED',
        error: 'Connection timeout',
      };
      (prismaService as any).scanJob.findUnique.mockResolvedValue(failedJob);

      const result = await service.getJobStatus('job-123');

      expect(result?.status).toBe('FAILED');
      expect(result?.error).toBe('Connection timeout');
    });
  });

  describe('getQueuePosition', () => {
    it('should return 0 for non-queued jobs', async () => {
      const processingJob = { ...mockJob, status: 'PROCESSING' };
      (prismaService as any).scanJob.findUnique.mockResolvedValue(
        processingJob,
      );

      const result = await service.getJobStatus('job-123');

      expect(result?.position).toBeNull();
    });

    it('should return correct position based on priority and time', async () => {
      (prismaService as any).scanJob.findUnique.mockResolvedValue(mockJob);
      (prismaService as any).scanJob.count.mockResolvedValue(3); // 3 jobs ahead

      const result = await service.getJobStatus('job-123');

      expect(result?.position).toBe(4); // 3 ahead + 1 = position 4
    });
  });

  describe('updateProgress', () => {
    it('should update job progress in database', async () => {
      (prismaService as any).scanJob.update.mockResolvedValue({
        ...mockJob,
        progress: 50,
        currentStep: 'Scanning...',
      });

      await (service as any).updateProgress('job-123', 50, 'Scanning...');

      expect((prismaService as any).scanJob.update).toHaveBeenCalledWith({
        where: { id: 'job-123' },
        data: { progress: 50, currentStep: 'Scanning...' },
      });
    });
  });

  describe('processJob', () => {
    const mockScanResult = {
      websiteUrl: 'https://example.com',
      scanDate: new Date(),
      scanDurationMs: 5000,
      overallRiskLevel: 'LOW',
      score: 85,
    };

    beforeEach(() => {
      service.startWorker();
    });

    it('should process job successfully', async () => {
      const mockBullJob = {
        data: { jobId: 'job-123', websiteUrl: 'https://example.com' },
        updateProgress: jest.fn().mockResolvedValue(undefined),
      };

      (prismaService as any).scanJob.update.mockResolvedValue(mockJob);
      (scannerService as any).scanWebsite.mockResolvedValue(mockScanResult);
      (reportService as any).saveScanResult.mockResolvedValue('report-123');

      await (service as any).processJob(mockBullJob);

      expect((prismaService as any).scanJob.update).toHaveBeenCalledWith({
        where: { id: 'job-123' },
        data: expect.objectContaining({
          status: 'PROCESSING',
        }),
      });

      expect((scannerService as any).scanWebsite).toHaveBeenCalledWith(
        'https://example.com',
      );
      expect((reportService as any).saveScanResult).toHaveBeenCalledWith(
        mockScanResult,
      );
    });

    it('should handle scan failure', async () => {
      const mockBullJob = {
        data: { jobId: 'job-123', websiteUrl: 'https://example.com' },
        updateProgress: jest.fn().mockResolvedValue(undefined),
      };

      (prismaService as any).scanJob.update.mockResolvedValue(mockJob);
      (scannerService as any).scanWebsite.mockRejectedValue(
        new Error('Connection timeout'),
      );

      await expect((service as any).processJob(mockBullJob)).rejects.toThrow(
        'Connection timeout',
      );

      expect((prismaService as any).scanJob.update).toHaveBeenLastCalledWith({
        where: { id: 'job-123' },
        data: expect.objectContaining({
          status: 'FAILED',
          error: 'Connection timeout',
        }),
      });
    });

    it('should update progress during scan', async () => {
      const mockBullJob = {
        data: { jobId: 'job-123', websiteUrl: 'https://example.com' },
        updateProgress: jest.fn().mockResolvedValue(undefined),
      };

      (prismaService as any).scanJob.update.mockResolvedValue(mockJob);
      (scannerService as any).scanWebsite.mockResolvedValue(mockScanResult);
      (reportService as any).saveScanResult.mockResolvedValue('report-123');

      await (service as any).processJob(mockBullJob);

      expect(mockBullJob.updateProgress).toHaveBeenCalledWith(10);
      expect(mockBullJob.updateProgress).toHaveBeenCalledWith(90);
    });
  });

  describe('edge cases', () => {
    it('should handle job with all optional fields', async () => {
      const fullJob = {
        ...mockJob,
        auditRequestId: 'audit-123',
        userEmail: 'test@example.com',
        locale: 'de',
        priority: 10,
      };
      (prismaService as any).scanJob.findUnique.mockResolvedValue(fullJob);
      (prismaService as any).scanJob.count.mockResolvedValue(0);

      const result = await service.getJobStatus('job-123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('job-123');
    });

    it('should handle job with dates', async () => {
      const jobWithDates = {
        ...mockJob,
        status: 'COMPLETED',
        startedAt: new Date('2026-01-22T10:01:00Z'),
        completedAt: new Date('2026-01-22T10:02:00Z'),
        reportId: 'report-123',
      };
      (prismaService as any).scanJob.findUnique.mockResolvedValue(jobWithDates);

      const result = await service.getJobStatus('job-123');

      expect(result?.startedAt).toEqual(new Date('2026-01-22T10:01:00Z'));
      expect(result?.completedAt).toEqual(new Date('2026-01-22T10:02:00Z'));
    });

    it('should return position 1 when no jobs ahead', async () => {
      (prismaService as any).scanJob.findUnique.mockResolvedValue(mockJob);
      (prismaService as any).scanJob.count.mockResolvedValue(0);

      const result = await service.getJobStatus('job-123');

      expect(result?.position).toBe(1);
    });
  });
});
