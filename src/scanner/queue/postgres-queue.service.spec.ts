import { Test, TestingModule } from '@nestjs/testing';
import { PostgresQueueService } from './postgres-queue.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ScannerService } from '../scanner.service';
import { ScannerReportService } from '../scanner-report.service';

describe('PostgresQueueService', () => {
  let service: PostgresQueueService;
  let prismaService: jest.Mocked<PrismaService>;
  let scannerService: jest.Mocked<ScannerService>;
  let reportService: jest.Mocked<ScannerReportService>;

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

  const mockScanResult = {
    websiteUrl: 'https://example.com',
    scanDate: new Date(),
    scanDurationMs: 5000,
    overallRiskLevel: 'LOW',
    score: 85,
  };

  beforeEach(async () => {
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
        PostgresQueueService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ScannerService, useValue: mockScanner },
        { provide: ScannerReportService, useValue: mockReport },
      ],
    }).compile();

    service = module.get<PostgresQueueService>(PostgresQueueService);
    prismaService = module.get(PrismaService);
    scannerService = module.get(ScannerService);
    reportService = module.get(ScannerReportService);
  });

  afterEach(() => {
    service.stopWorker();
    jest.clearAllMocks();
  });

  describe('addJob', () => {
    it('should create a new job and return status', async () => {
      (prismaService as any).scanJob.create.mockResolvedValue(mockJob);
      (prismaService as any).scanJob.findUnique.mockResolvedValue(mockJob);
      (prismaService as any).scanJob.count.mockResolvedValue(0);

      const result = await service.addJob({
        websiteUrl: 'https://example.com',
      });

      expect(result).toMatchObject({
        id: 'job-123',
        websiteUrl: 'https://example.com',
        status: 'QUEUED',
        progress: 0,
        position: 1,
      });

      expect((prismaService as any).scanJob.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          websiteUrl: 'https://example.com',
          status: 'QUEUED',
          progress: 0,
        }),
      });
    });

    it('should set default locale to "en"', async () => {
      (prismaService as any).scanJob.create.mockResolvedValue(mockJob);
      (prismaService as any).scanJob.findUnique.mockResolvedValue(mockJob);
      (prismaService as any).scanJob.count.mockResolvedValue(0);

      await service.addJob({ websiteUrl: 'https://example.com' });

      expect((prismaService as any).scanJob.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          locale: 'en',
        }),
      });
    });

    it('should set default priority to 0', async () => {
      (prismaService as any).scanJob.create.mockResolvedValue(mockJob);
      (prismaService as any).scanJob.findUnique.mockResolvedValue(mockJob);
      (prismaService as any).scanJob.count.mockResolvedValue(0);

      await service.addJob({ websiteUrl: 'https://example.com' });

      expect((prismaService as any).scanJob.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          priority: 0,
        }),
      });
    });

    it('should use provided priority', async () => {
      (prismaService as any).scanJob.create.mockResolvedValue({ ...mockJob, priority: 5 });
      (prismaService as any).scanJob.findUnique.mockResolvedValue({ ...mockJob, priority: 5 });
      (prismaService as any).scanJob.count.mockResolvedValue(0);

      await service.addJob({ websiteUrl: 'https://example.com', priority: 5 });

      expect((prismaService as any).scanJob.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          priority: 5,
        }),
      });
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

    it('should not include position for completed jobs', async () => {
      const completedJob = { ...mockJob, status: 'COMPLETED' };
      (prismaService as any).scanJob.findUnique.mockResolvedValue(completedJob);

      const result = await service.getJobStatus('job-123');

      expect(result?.position).toBeNull();
    });
  });

  describe('cancelJob', () => {
    it('should cancel a queued job', async () => {
      (prismaService as any).scanJob.findUnique.mockResolvedValue(mockJob);
      (prismaService as any).scanJob.update.mockResolvedValue({ ...mockJob, status: 'CANCELLED' });

      const result = await service.cancelJob('job-123');

      expect(result).toBe(true);
      expect((prismaService as any).scanJob.update).toHaveBeenCalledWith({
        where: { id: 'job-123' },
        data: { status: 'CANCELLED' },
      });
    });

    it('should return false when job does not exist', async () => {
      (prismaService as any).scanJob.findUnique.mockResolvedValue(null);

      const result = await service.cancelJob('non-existent');

      expect(result).toBe(false);
      expect((prismaService as any).scanJob.update).not.toHaveBeenCalled();
    });

    it('should return false when job is not queued', async () => {
      const processingJob = { ...mockJob, status: 'PROCESSING' };
      (prismaService as any).scanJob.findUnique.mockResolvedValue(processingJob);

      const result = await service.cancelJob('job-123');

      expect(result).toBe(false);
      expect((prismaService as any).scanJob.update).not.toHaveBeenCalled();
    });

    it('should return false when job is already completed', async () => {
      const completedJob = { ...mockJob, status: 'COMPLETED' };
      (prismaService as any).scanJob.findUnique.mockResolvedValue(completedJob);

      const result = await service.cancelJob('job-123');

      expect(result).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return queue statistics', async () => {
      (prismaService as any).scanJob.count
        .mockResolvedValueOnce(5)  // queued
        .mockResolvedValueOnce(1)  // processing
        .mockResolvedValueOnce(100) // completed
        .mockResolvedValueOnce(3);  // failed

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
  });

  describe('startWorker / stopWorker', () => {
    it('should start and stop worker without errors', () => {
      expect(() => service.startWorker()).not.toThrow();
      expect(() => service.stopWorker()).not.toThrow();
    });

    it('should handle multiple stop calls gracefully', () => {
      service.startWorker();
      expect(() => service.stopWorker()).not.toThrow();
      expect(() => service.stopWorker()).not.toThrow();
    });
  });

  describe('formatJobStatus', () => {
    it('should calculate estimated wait time based on position', async () => {
      (prismaService as any).scanJob.findUnique.mockResolvedValue(mockJob);
      (prismaService as any).scanJob.count.mockResolvedValue(4); // 4 jobs ahead

      const result = await service.getJobStatus('job-123');

      expect(result?.position).toBe(5);
      expect(result?.estimatedWaitMinutes).toBe(5);
    });

    it('should return null estimated wait for non-queued jobs', async () => {
      const completedJob = { ...mockJob, status: 'COMPLETED', reportId: 'report-123' };
      (prismaService as any).scanJob.findUnique.mockResolvedValue(completedJob);

      const result = await service.getJobStatus('job-123');

      expect(result?.estimatedWaitMinutes).toBeNull();
    });
  });
});
