import { Test, TestingModule } from '@nestjs/testing';
import { HealthService } from './health.service';
import { PrismaService } from '../prisma/prisma.service';

describe('HealthService', () => {
  let service: HealthService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    $queryRaw: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getHealth', () => {
    it('should return healthy status', () => {
      const result = service.getHealth();

      expect(result.status).toBe('healthy');
      expect(result.timestamp).toBeDefined();
      expect(new Date(result.timestamp).getTime()).not.toBeNaN();
    });
  });

  describe('getLiveness', () => {
    it('should return healthy status with uptime', () => {
      const result = service.getLiveness();

      expect(result.status).toBe('healthy');
      expect(result.timestamp).toBeDefined();
      expect(result.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getReadiness', () => {
    it('should return healthy when database is connected', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      const result = await service.getReadiness();

      expect(result.status).toBe('healthy');
      expect(result.checks.database.status).toBe('healthy');
      expect(result.checks.database.responseTime).toBeDefined();
      expect(result.checks.database.responseTime).toBeGreaterThanOrEqual(0);
    });

    it('should return unhealthy when database is not connected', async () => {
      mockPrismaService.$queryRaw.mockRejectedValue(
        new Error('Connection failed'),
      );

      const result = await service.getReadiness();

      expect(result.status).toBe('unhealthy');
      expect(result.checks.database.status).toBe('unhealthy');
      expect(result.checks.database.error).toBe('Connection failed');
    });
  });

  describe('getDetailedHealth', () => {
    it('should return detailed health status when all checks pass', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      const result = await service.getDetailedHealth();

      expect(result.status).toBe('healthy');
      expect(result.timestamp).toBeDefined();
      expect(result.uptime).toBeGreaterThanOrEqual(0);
      expect(result.uptimeFormatted).toBeDefined();

      // Database check
      expect(result.checks.database.status).toBe('healthy');
      expect(result.checks.database.responseTime).toBeGreaterThanOrEqual(0);

      // Memory check
      expect(result.checks.memory.status).toBe('healthy');
      expect(result.checks.memory.heapUsed).toBeGreaterThan(0);
      expect(result.checks.memory.heapTotal).toBeGreaterThan(0);
      expect(result.checks.memory.usedPercent).toBeGreaterThanOrEqual(0);
      expect(result.checks.memory.usedPercent).toBeLessThanOrEqual(100);

      // System info
      expect(result.checks.system.platform).toBeDefined();
      expect(result.checks.system.nodeVersion).toBeDefined();
      expect(result.checks.system.pid).toBeGreaterThan(0);
    });

    it('should return unhealthy when database check fails', async () => {
      mockPrismaService.$queryRaw.mockRejectedValue(new Error('DB error'));

      const result = await service.getDetailedHealth();

      expect(result.status).toBe('unhealthy');
      expect(result.checks.database.status).toBe('unhealthy');
      expect(result.checks.database.error).toBe('DB error');
    });
  });
});
