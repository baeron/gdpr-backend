import { AuditService } from './audit.service';

describe('AuditService', () => {
  let service: AuditService;
  let mockPrisma: any;
  let mockEmailService: any;

  beforeEach(() => {
    mockPrisma = {
      auditRequest: {
        create: jest.fn().mockResolvedValue({
          id: 'audit-1',
          websiteUrl: 'https://example.com',
          email: 'test@example.com',
          agreeScan: true,
          agreeMarketing: false,
          locale: 'en',
        }),
        findUnique: jest.fn().mockResolvedValue({ id: 'audit-1' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    mockEmailService = {
      sendAuditConfirmationTo: jest.fn().mockResolvedValue(undefined),
      sendAdminNotification: jest.fn().mockResolvedValue(undefined),
    };
    service = new AuditService(mockPrisma, mockEmailService);
  });

  describe('createAuditRequest', () => {
    it('should create audit request and send emails', async () => {
      const result = await service.createAuditRequest({
        websiteUrl: 'https://example.com',
        email: 'Test@Example.com',
        agreeScan: true,
      });
      expect(result.success).toBe(true);
      expect(result.auditId).toBe('audit-1');
      expect(mockPrisma.auditRequest.create).toHaveBeenCalled();
      expect(mockEmailService.sendAuditConfirmationTo).toHaveBeenCalled();
      expect(mockEmailService.sendAdminNotification).toHaveBeenCalled();
    });

    it('should normalize URL without protocol', async () => {
      await service.createAuditRequest({
        websiteUrl: 'example.com',
        email: 'test@example.com',
        agreeScan: true,
      });
      const createCall = mockPrisma.auditRequest.create.mock.calls[0][0];
      expect(createCall.data.websiteUrl).toBe('https://example.com');
    });

    it('should lowercase and trim email', async () => {
      await service.createAuditRequest({
        websiteUrl: 'https://example.com',
        email: '  Test@Example.COM  ',
        agreeScan: true,
      });
      const createCall = mockPrisma.auditRequest.create.mock.calls[0][0];
      expect(createCall.data.email).toBe('test@example.com');
    });

    it('should default agreeMarketing to false', async () => {
      await service.createAuditRequest({
        websiteUrl: 'https://example.com',
        email: 'test@example.com',
        agreeScan: true,
      });
      const createCall = mockPrisma.auditRequest.create.mock.calls[0][0];
      expect(createCall.data.agreeMarketing).toBe(false);
    });

    it('should default locale to en', async () => {
      await service.createAuditRequest({
        websiteUrl: 'https://example.com',
        email: 'test@example.com',
        agreeScan: true,
      });
      const createCall = mockPrisma.auditRequest.create.mock.calls[0][0];
      expect(createCall.data.locale).toBe('en');
    });

    it('should pass custom locale and agreeMarketing', async () => {
      await service.createAuditRequest({
        websiteUrl: 'https://example.com',
        email: 'test@example.com',
        agreeScan: true,
        agreeMarketing: true,
        locale: 'de',
      });
      const createCall = mockPrisma.auditRequest.create.mock.calls[0][0];
      expect(createCall.data.agreeMarketing).toBe(true);
      expect(createCall.data.locale).toBe('de');
    });

    it('should rethrow on database error', async () => {
      mockPrisma.auditRequest.create.mockRejectedValue(new Error('DB error'));
      await expect(
        service.createAuditRequest({
          websiteUrl: 'https://example.com',
          email: 'test@example.com',
          agreeScan: true,
        }),
      ).rejects.toThrow('DB error');
    });
  });

  describe('getAuditRequest', () => {
    it('should find audit by id', async () => {
      const result = await service.getAuditRequest('audit-1');
      expect(mockPrisma.auditRequest.findUnique).toHaveBeenCalledWith({
        where: { id: 'audit-1' },
        include: { auditReport: true },
      });
      expect(result).toHaveProperty('id', 'audit-1');
    });
  });

  describe('getAuditsByEmail', () => {
    it('should find audits by lowercase email', async () => {
      await service.getAuditsByEmail('Test@Example.COM');
      expect(mockPrisma.auditRequest.findMany).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });
});
