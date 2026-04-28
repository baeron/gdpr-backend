import {
  ScannerController,
  ScanRequestDto,
  QueueScanRequestDto,
} from './scanner.controller';
import { ScannerService } from './scanner.service';
import { ScannerReportService } from './scanner-report.service';
import { IQueueService } from './queue/queue.interface';
import { AuditService } from '../audit/audit.service';

import { UrlUtilsService } from './url-utils.service';

describe('ScannerController', () => {
  let controller: ScannerController;
  let mockScannerService: Partial<ScannerService>;
  let mockReportService: Partial<ScannerReportService>;
  let mockQueueService: Partial<IQueueService>;
  let mockUrlUtils: Partial<UrlUtilsService>;
  let mockAuditService: Partial<AuditService>;

  beforeEach(() => {
    mockScannerService = {
      scanWebsite: jest.fn().mockResolvedValue({ score: 85, issues: [] }),
    };
    mockReportService = {
      saveScanResult: jest.fn().mockResolvedValue('report-123'),
      getReport: jest.fn().mockResolvedValue({
        id: 'report-123',
        websiteUrl: 'https://example.com',
      }),
      getReportsByWebsite: jest.fn().mockResolvedValue([]),
      updateIssueStatus: jest
        .fn()
        .mockResolvedValue({ id: 'issue-1', status: 'RESOLVED' }),
    };
    mockQueueService = {
      addJob: jest
        .fn()
        .mockResolvedValue({ id: 'job-1', status: 'QUEUED', position: 1 }),
      getJobStatus: jest
        .fn()
        .mockResolvedValue({ id: 'job-1', status: 'PROCESSING', progress: 50 }),
      cancelJob: jest.fn().mockResolvedValue(true),
      retryJob: jest.fn().mockResolvedValue(true),
      getStats: jest.fn().mockResolvedValue({
        queued: 2,
        processing: 1,
        completed: 10,
        failed: 0,
      }),
    };
    mockUrlUtils = {
      validateAndCheckUrl: jest
        .fn()
        .mockImplementation((url: string) =>
          Promise.resolve({ isValid: true, normalizedUrl: url }),
        ) as UrlUtilsService['validateAndCheckUrl'],
    };
    mockAuditService = {
      createAuditRequest: jest.fn().mockResolvedValue({
        success: true,
        message: 'Audit request submitted successfully.',
        auditId: 'audit-from-queue',
      }),
    };
    controller = new ScannerController(
      mockScannerService as ScannerService,
      mockReportService as ScannerReportService,
      mockUrlUtils as UrlUtilsService,
      mockQueueService as IQueueService,
      mockAuditService as AuditService,
    );
  });

  describe('scanWebsite', () => {
    it('should scan and save to DB by default', async () => {
      const body: ScanRequestDto = { websiteUrl: 'https://example.com' };
      const result = await controller.scanWebsite(body);
      expect(mockScannerService.scanWebsite).toHaveBeenCalledWith(
        'https://example.com',
      );
      expect(mockReportService.saveScanResult).toHaveBeenCalled();
      expect(result).toHaveProperty('reportId', 'report-123');
    });

    it('should skip DB save when saveToDb is false', async () => {
      const body: ScanRequestDto = {
        websiteUrl: 'https://example.com',
        saveToDb: false,
      };
      const result = await controller.scanWebsite(body);
      expect(mockReportService.saveScanResult).not.toHaveBeenCalled();
      expect(result).not.toHaveProperty('reportId');
    });

    it('should pass auditRequestId to saveScanResult', async () => {
      const body: ScanRequestDto = {
        websiteUrl: 'https://example.com',
        auditRequestId: 'audit-1',
      };
      await controller.scanWebsite(body);
      expect(mockReportService.saveScanResult).toHaveBeenCalledWith(
        expect.anything(),
        'audit-1',
      );
    });
  });

  describe('getReport', () => {
    it('should return report by ID', async () => {
      const result = await controller.getReport('report-123');
      expect(mockReportService.getReport).toHaveBeenCalledWith('report-123');
      expect(result).toHaveProperty('id', 'report-123');
    });
  });

  describe('getReportsByWebsite', () => {
    it('should fetch reports with default limit', async () => {
      await controller.getReportsByWebsite('example.com');
      expect(mockReportService.getReportsByWebsite).toHaveBeenCalledWith(
        'example.com',
        10,
      );
    });

    it('should parse custom limit', async () => {
      await controller.getReportsByWebsite('example.com', '5');
      expect(mockReportService.getReportsByWebsite).toHaveBeenCalledWith(
        'example.com',
        5,
      );
    });
  });

  describe('updateIssueStatus', () => {
    it('should update issue status', async () => {
      const result = await controller.updateIssueStatus('issue-1', {
        status: 'RESOLVED',
      });
      expect(mockReportService.updateIssueStatus).toHaveBeenCalledWith(
        'issue-1',
        'RESOLVED',
      );
      expect(result).toHaveProperty('status', 'RESOLVED');
    });
  });

  describe('queueScan', () => {
    const requestMock = { ip: '127.0.0.1' } as unknown as Parameters<
      ScannerController['queueScan']
    >[1];

    it('queues a job without creating an AuditRequest when no email/consent is supplied', async () => {
      const body: QueueScanRequestDto = { websiteUrl: 'https://example.com' };

      const result = await controller.queueScan(body, requestMock);

      expect(mockAuditService.createAuditRequest).not.toHaveBeenCalled();
      expect(mockQueueService.addJob).toHaveBeenCalledWith({
        websiteUrl: 'https://example.com',
        auditRequestId: undefined,
        userEmail: undefined,
        locale: undefined,
        priority: undefined,
        clientIp: '127.0.0.1',
      });
      expect(result).toHaveProperty('status', 'QUEUED');
    });

    it('creates an AuditRequest and links it to the queue job when email + agreeScan present', async () => {
      const body: QueueScanRequestDto = {
        websiteUrl: 'https://example.com',
        userEmail: 'user@example.com',
        agreeScan: true,
        agreeMarketing: true,
        locale: 'en',
      };

      await controller.queueScan(body, requestMock);

      expect(mockAuditService.createAuditRequest).toHaveBeenCalledWith({
        websiteUrl: 'https://example.com',
        email: 'user@example.com',
        agreeScan: true,
        agreeMarketing: true,
        locale: 'en',
      });
      expect(mockQueueService.addJob).toHaveBeenCalledWith(
        expect.objectContaining({
          auditRequestId: 'audit-from-queue',
          userEmail: 'user@example.com',
        }),
      );
    });

    it('defaults agreeMarketing to false when omitted', async () => {
      const body: QueueScanRequestDto = {
        websiteUrl: 'https://example.com',
        userEmail: 'user@example.com',
        agreeScan: true,
      };

      await controller.queueScan(body, requestMock);

      expect(mockAuditService.createAuditRequest).toHaveBeenCalledWith(
        expect.objectContaining({ agreeMarketing: false }),
      );
    });

    it('reuses caller-supplied auditRequestId without creating a new AuditRequest', async () => {
      const body: QueueScanRequestDto = {
        websiteUrl: 'https://example.com',
        userEmail: 'user@example.com',
        agreeScan: true,
        auditRequestId: 'pre-existing-audit',
      };

      await controller.queueScan(body, requestMock);

      expect(mockAuditService.createAuditRequest).not.toHaveBeenCalled();
      expect(mockQueueService.addJob).toHaveBeenCalledWith(
        expect.objectContaining({ auditRequestId: 'pre-existing-audit' }),
      );
    });

    it('skips AuditRequest creation when email is provided but agreeScan is missing', async () => {
      // Validation layer (class-validator @Equals(true)) normally rejects this
      // shape before it reaches the handler; this guards against direct calls
      // bypassing the pipe (e.g. internal callers).
      const body: QueueScanRequestDto = {
        websiteUrl: 'https://example.com',
        userEmail: 'user@example.com',
      };

      await controller.queueScan(body, requestMock);

      expect(mockAuditService.createAuditRequest).not.toHaveBeenCalled();
      expect(mockQueueService.addJob).toHaveBeenCalledWith(
        expect.objectContaining({ auditRequestId: undefined }),
      );
    });
  });

  describe('getJobStatus', () => {
    it('should return job status', async () => {
      const result = await controller.getJobStatus('job-1');
      expect(mockQueueService.getJobStatus).toHaveBeenCalledWith('job-1');
      expect(result).toHaveProperty('status', 'PROCESSING');
    });

    it('should return error when job not found', async () => {
      (mockQueueService.getJobStatus as jest.Mock).mockResolvedValue(null);
      const result = await controller.getJobStatus('nonexistent');
      expect(result).toEqual({ error: 'Job not found' });
    });
  });

  describe('cancelJob', () => {
    it('should cancel a job', async () => {
      const result = await controller.cancelJob('job-1');
      expect(mockQueueService.cancelJob).toHaveBeenCalledWith('job-1');
      expect(result).toEqual({ cancelled: true });
    });
  });

  describe('retryJob', () => {
    it('replays a FAILED job from the DLQ', async () => {
      const result = await controller.retryJob('job-1');
      expect(mockQueueService.retryJob).toHaveBeenCalledWith('job-1');
      expect(result).toEqual({ retried: true });
    });

    it('returns retried=false when the job is not in FAILED state', async () => {
      mockQueueService.retryJob = jest.fn().mockResolvedValue(false);
      const result = await controller.retryJob('not-failed');
      expect(result).toEqual({ retried: false });
    });
  });

  describe('getQueueStats', () => {
    it('should return queue statistics', async () => {
      const result = await controller.getQueueStats();
      expect(mockQueueService.getStats).toHaveBeenCalled();
      expect(result).toHaveProperty('queued', 2);
    });
  });
});
