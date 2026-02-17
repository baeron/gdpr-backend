import { ScannerQueueService } from './scanner-queue.service';
import { ScannerService } from './scanner.service';
import { ScannerReportService } from './scanner-report.service';

describe('ScannerQueueService', () => {
  let service: ScannerQueueService;
  let mockPrisma: any;
  let mockScannerService: Partial<ScannerService>;
  let mockReportService: Partial<ScannerReportService>;

  const mockJob = {
    id: 'job-1',
    websiteUrl: 'https://example.com',
    auditRequestId: null,
    userEmail: null,
    locale: 'en',
    priority: 0,
    status: 'QUEUED',
    progress: 0,
    currentStep: null,
    reportId: null,
    error: null,
    queuedAt: new Date(),
    startedAt: null,
    completedAt: null,
  };

  beforeEach(() => {
    mockPrisma = {
      scanJob: {
        create: jest.fn().mockResolvedValue(mockJob),
        findUnique: jest.fn().mockResolvedValue(mockJob),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue(mockJob),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    mockScannerService = {
      scanWebsite: jest.fn().mockResolvedValue({ websiteUrl: 'https://example.com', issues: [] }),
    };
    mockReportService = {
      saveScanResult: jest.fn().mockResolvedValue('report-123'),
    };
    service = new ScannerQueueService(
      mockPrisma,
      mockScannerService as ScannerService,
      mockReportService as ScannerReportService,
    );
    // Stop the worker so it doesn't interfere with tests
    service.onModuleDestroy();
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  describe('queueScan', () => {
    it('should create a job and return status', async () => {
      mockPrisma.scanJob.count.mockResolvedValue(0);
      const result = await service.queueScan({ websiteUrl: 'https://example.com' });
      expect(mockPrisma.scanJob.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            websiteUrl: 'https://example.com',
            status: 'QUEUED',
          }),
        }),
      );
      expect(result.id).toBe('job-1');
      expect(result.status).toBe('QUEUED');
    });

    it('should use default locale and priority', async () => {
      await service.queueScan({ websiteUrl: 'https://example.com' });
      const createCall = mockPrisma.scanJob.create.mock.calls[0][0];
      expect(createCall.data.locale).toBe('en');
      expect(createCall.data.priority).toBe(0);
    });

    it('should pass custom locale and priority', async () => {
      await service.queueScan({
        websiteUrl: 'https://example.com',
        locale: 'de',
        priority: 5,
        userEmail: 'test@example.com',
        auditRequestId: 'audit-1',
      });
      const createCall = mockPrisma.scanJob.create.mock.calls[0][0];
      expect(createCall.data.locale).toBe('de');
      expect(createCall.data.priority).toBe(5);
      expect(createCall.data.userEmail).toBe('test@example.com');
    });
  });

  describe('getJobStatus', () => {
    it('should return job status when found', async () => {
      const result = await service.getJobStatus('job-1');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('job-1');
      expect(result!.websiteUrl).toBe('https://example.com');
    });

    it('should return null when job not found', async () => {
      mockPrisma.scanJob.findUnique.mockResolvedValue(null);
      const result = await service.getJobStatus('nonexistent');
      expect(result).toBeNull();
    });

    it('should include queue position for QUEUED jobs', async () => {
      mockPrisma.scanJob.count.mockResolvedValue(2);
      const result = await service.getJobStatus('job-1');
      expect(result!.position).toBe(3); // 2 ahead + 1
    });

    it('should not include position for non-QUEUED jobs', async () => {
      mockPrisma.scanJob.findUnique.mockResolvedValue({ ...mockJob, status: 'PROCESSING' });
      const result = await service.getJobStatus('job-1');
      expect(result!.position).toBeNull();
    });
  });

  describe('cancelJob', () => {
    it('should cancel a QUEUED job', async () => {
      const result = await service.cancelJob('job-1');
      expect(result).toBe(true);
      expect(mockPrisma.scanJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'CANCELLED' },
        }),
      );
    });

    it('should return false for non-QUEUED job', async () => {
      mockPrisma.scanJob.findUnique.mockResolvedValue({ ...mockJob, status: 'PROCESSING' });
      const result = await service.cancelJob('job-1');
      expect(result).toBe(false);
    });

    it('should return false for non-existent job', async () => {
      mockPrisma.scanJob.findUnique.mockResolvedValue(null);
      const result = await service.cancelJob('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('getQueueStats', () => {
    it('should return queue statistics', async () => {
      mockPrisma.scanJob.count
        .mockResolvedValueOnce(5)  // queued
        .mockResolvedValueOnce(1)  // processing
        .mockResolvedValueOnce(42) // completed
        .mockResolvedValueOnce(2); // failed

      const stats = await service.getQueueStats();
      expect(stats.queued).toBe(5);
      expect(stats.processing).toBe(1);
      expect(stats.completed).toBe(42);
      expect(stats.failed).toBe(2);
      expect(stats.maxConcurrent).toBe(1);
      expect(stats.estimatedWaitPerJob).toBe(60);
    });
  });

  describe('onModuleInit / onModuleDestroy', () => {
    it('should start and stop worker without errors', () => {
      expect(() => service.onModuleInit()).not.toThrow();
      expect(() => service.onModuleDestroy()).not.toThrow();
    });
  });

  describe('processNextJob (via queueScan trigger)', () => {
    it('should process a queued job successfully', async () => {
      const processingJob = {
        ...mockJob,
        id: 'job-2',
        status: 'QUEUED',
        websiteUrl: 'https://test.com',
        auditRequestId: 'audit-1',
      };

      // First call: count processing = 0
      // Second call: findFirst returns a job
      mockPrisma.scanJob.count
        .mockResolvedValueOnce(0) // getQueuePosition for queueScan
        .mockResolvedValueOnce(0); // processingCount in processNextJob
      mockPrisma.scanJob.findFirst.mockResolvedValueOnce(processingJob);
      mockPrisma.scanJob.findUnique.mockResolvedValue(processingJob);

      // Trigger processNextJob indirectly via queueScan
      await service.queueScan({ websiteUrl: 'https://test.com', auditRequestId: 'audit-1' });

      // Wait for setImmediate to fire
      await new Promise((resolve) => setTimeout(resolve, 50));

      // The scannerService.scanWebsite should have been called
      expect(mockScannerService.scanWebsite).toHaveBeenCalledWith('https://test.com');
    });

    it('should handle scan failure gracefully', async () => {
      const failingJob = { ...mockJob, id: 'job-fail', status: 'QUEUED' };

      mockPrisma.scanJob.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      mockPrisma.scanJob.findFirst.mockResolvedValueOnce(failingJob);
      mockPrisma.scanJob.findUnique.mockResolvedValue(failingJob);
      (mockScannerService.scanWebsite as jest.Mock).mockRejectedValueOnce(new Error('Scan failed'));

      await service.queueScan({ websiteUrl: 'https://fail.com' });
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should have attempted to update job as FAILED
      const updateCalls = mockPrisma.scanJob.update.mock.calls;
      const failedUpdate = updateCalls.find((c: any) => c[0]?.data?.status === 'FAILED');
      expect(failedUpdate).toBeDefined();
    });
  });
});
