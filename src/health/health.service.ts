import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
}

export interface LivenessStatus extends HealthStatus {
  uptime: number;
}

export interface ReadinessStatus extends HealthStatus {
  checks: {
    database: {
      status: 'healthy' | 'unhealthy';
      responseTime?: number;
      error?: string;
    };
  };
}

export interface DetailedHealthStatus extends HealthStatus {
  uptime: number;
  uptimeFormatted: string;
  checks: {
    database: {
      status: 'healthy' | 'unhealthy';
      responseTime?: number;
      error?: string;
    };
    memory: {
      status: 'healthy' | 'unhealthy';
      heapUsed: number;
      heapTotal: number;
      usedPercent: number;
    };
    system: {
      platform: string;
      nodeVersion: string;
      pid: number;
    };
  };
}

@Injectable()
export class HealthService {
  private readonly startTime: number;

  constructor(private readonly prisma: PrismaService) {
    this.startTime = Date.now();
  }

  getHealth(): HealthStatus {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    };
  }

  getLiveness(): LivenessStatus {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: this.getUptimeSeconds(),
    };
  }

  async getReadiness(): Promise<ReadinessStatus> {
    const dbCheck = await this.checkDatabase();

    const isHealthy = dbCheck.status === 'healthy';

    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      checks: {
        database: dbCheck,
      },
    };
  }

  async getDetailedHealth(): Promise<DetailedHealthStatus> {
    const dbCheck = await this.checkDatabase();
    const memoryCheck = this.checkMemory();

    const isHealthy = dbCheck.status === 'healthy' && memoryCheck.status === 'healthy';

    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: this.getUptimeSeconds(),
      uptimeFormatted: this.formatUptime(this.getUptimeSeconds()),
      checks: {
        database: dbCheck,
        memory: memoryCheck,
        system: {
          platform: process.platform,
          nodeVersion: process.version,
          pid: process.pid,
        },
      },
    };
  }

  private async checkDatabase(): Promise<{
    status: 'healthy' | 'unhealthy';
    responseTime?: number;
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const responseTime = Date.now() - startTime;

      return {
        status: 'healthy',
        responseTime,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown database error',
      };
    }
  }

  private checkMemory(): {
    status: 'healthy' | 'unhealthy';
    heapUsed: number;
    heapTotal: number;
    usedPercent: number;
  } {
    const memoryUsage = process.memoryUsage();
    const heapUsed = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    const heapTotal = Math.round(memoryUsage.heapTotal / 1024 / 1024);
    const usedPercent = Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100);

    return {
      status: usedPercent < 90 ? 'healthy' : 'unhealthy',
      heapUsed,
      heapTotal,
      usedPercent,
    };
  }

  private getUptimeSeconds(): number {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

    return parts.join(' ');
  }
}
