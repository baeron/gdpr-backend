import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { HealthService } from './health.service';
import type {
  HealthStatus,
  LivenessStatus,
  ReadinessStatus,
  DetailedHealthStatus,
} from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Basic health check' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  getHealth(): HealthStatus {
    return this.healthService.getHealth();
  }

  @Get('live')
  @ApiOperation({ summary: 'Liveness probe - checks if the service is running' })
  @ApiResponse({ status: 200, description: 'Service is alive' })
  getLiveness(): LivenessStatus {
    return this.healthService.getLiveness();
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe - checks if the service is ready to accept traffic' })
  @ApiResponse({ status: 200, description: 'Service is ready' })
  @ApiResponse({ status: 503, description: 'Service is not ready' })
  async getReadiness(@Res() res: Response): Promise<void> {
    const status = await this.healthService.getReadiness();

    if (status.status === 'healthy') {
      res.status(HttpStatus.OK).json(status);
    } else {
      res.status(HttpStatus.SERVICE_UNAVAILABLE).json(status);
    }
  }

  @Get('detailed')
  @ApiOperation({ summary: 'Detailed health check with all system metrics' })
  @ApiResponse({ status: 200, description: 'Detailed health status' })
  @ApiResponse({ status: 503, description: 'Service is unhealthy' })
  async getDetailedHealth(@Res() res: Response): Promise<void> {
    const status = await this.healthService.getDetailedHealth();

    if (status.status === 'healthy') {
      res.status(HttpStatus.OK).json(status);
    } else {
      res.status(HttpStatus.SERVICE_UNAVAILABLE).json(status);
    }
  }
}
