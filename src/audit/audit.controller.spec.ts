import { BadRequestException } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

describe('AuditController', () => {
  let controller: AuditController;
  let mockAuditService: Partial<AuditService>;

  beforeEach(() => {
    mockAuditService = {
      createAuditRequest: jest.fn().mockResolvedValue({
        success: true,
        message: 'Audit request submitted successfully.',
        auditId: 'audit-1',
      }),
      getAuditRequest: jest.fn().mockResolvedValue({
        id: 'audit-1',
        websiteUrl: 'https://example.com',
        email: 'test@example.com',
      }),
    };
    controller = new AuditController(mockAuditService as AuditService);
  });

  describe('createAudit', () => {
    it('should create audit when agreeScan is true', async () => {
      const result = await controller.createAudit({
        websiteUrl: 'https://example.com',
        email: 'test@example.com',
        agreeScan: true,
      });
      expect(result.success).toBe(true);
      expect(result.auditId).toBe('audit-1');
    });

    it('should throw BadRequestException when agreeScan is false', async () => {
      await expect(
        controller.createAudit({
          websiteUrl: 'https://example.com',
          email: 'test@example.com',
          agreeScan: false,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getAudit', () => {
    it('should return audit by id', async () => {
      const result = await controller.getAudit('audit-1');
      expect(result).toHaveProperty('id', 'audit-1');
    });

    it('should throw BadRequestException when audit not found', async () => {
      (mockAuditService.getAuditRequest as jest.Mock).mockResolvedValue(null);
      await expect(controller.getAudit('nonexistent')).rejects.toThrow(BadRequestException);
    });
  });
});
