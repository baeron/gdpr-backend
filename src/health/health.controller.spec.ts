import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  let controller: HealthController;
  let healthService: HealthService;

  const mockHealthService = {
    getHealth: jest.fn(),
    getLiveness: jest.fn(),
    getReadiness: jest.fn(),
    getDetailedHealth: jest.fn(),
  };

  const mockResponse = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthService,
          useValue: mockHealthService,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    healthService = module.get<HealthService>(HealthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getHealth', () => {
    it('should return basic health status', () => {
      const expectedResult = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
      };
      mockHealthService.getHealth.mockReturnValue(expectedResult);

      const result = controller.getHealth();

      expect(result).toEqual(expectedResult);
      expect(mockHealthService.getHealth).toHaveBeenCalled();
    });
  });

  describe('getLiveness', () => {
    it('should return liveness status', () => {
      const expectedResult = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: 100,
      };
      mockHealthService.getLiveness.mockReturnValue(expectedResult);

      const result = controller.getLiveness();

      expect(result).toEqual(expectedResult);
      expect(mockHealthService.getLiveness).toHaveBeenCalled();
    });
  });

  describe('getReadiness', () => {
    it('should return 200 when service is ready', async () => {
      const expectedResult = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        checks: {
          database: { status: 'healthy', responseTime: 5 },
        },
      };
      mockHealthService.getReadiness.mockResolvedValue(expectedResult);

      await controller.getReadiness(mockResponse as any);

      expect(mockHealthService.getReadiness).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(mockResponse.json).toHaveBeenCalledWith(expectedResult);
    });

    it('should return 503 when service is not ready', async () => {
      const expectedResult = {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        checks: {
          database: { status: 'unhealthy', error: 'Connection failed' },
        },
      };
      mockHealthService.getReadiness.mockResolvedValue(expectedResult);

      await controller.getReadiness(mockResponse as any);

      expect(mockHealthService.getReadiness).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
      expect(mockResponse.json).toHaveBeenCalledWith(expectedResult);
    });
  });

  describe('getDetailedHealth', () => {
    it('should return 200 with detailed health when healthy', async () => {
      const expectedResult = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: 100,
        uptimeFormatted: '1m 40s',
        checks: {
          database: { status: 'healthy', responseTime: 5 },
          memory: { status: 'healthy', heapUsed: 50, heapTotal: 100, usedPercent: 50 },
          system: { platform: 'darwin', nodeVersion: 'v18.0.0', pid: 1234 },
        },
      };
      mockHealthService.getDetailedHealth.mockResolvedValue(expectedResult);

      await controller.getDetailedHealth(mockResponse as any);

      expect(mockHealthService.getDetailedHealth).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(mockResponse.json).toHaveBeenCalledWith(expectedResult);
    });

    it('should return 503 when unhealthy', async () => {
      const expectedResult = {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: 100,
        uptimeFormatted: '1m 40s',
        checks: {
          database: { status: 'unhealthy', error: 'DB error' },
          memory: { status: 'healthy', heapUsed: 50, heapTotal: 100, usedPercent: 50 },
          system: { platform: 'darwin', nodeVersion: 'v18.0.0', pid: 1234 },
        },
      };
      mockHealthService.getDetailedHealth.mockResolvedValue(expectedResult);

      await controller.getDetailedHealth(mockResponse as any);

      expect(mockHealthService.getDetailedHealth).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
      expect(mockResponse.json).toHaveBeenCalledWith(expectedResult);
    });
  });
});
