import { Module, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { ScannerController } from './scanner.controller';
import { ScannerService } from './scanner.service';
import { ScannerReportService } from './scanner-report.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { QUEUE_SERVICE } from './queue/queue.interface';
import type { IQueueService } from './queue/queue.interface';
import { PostgresQueueService } from './queue/postgres-queue.service';
import { RedisQueueService } from './queue/redis-queue.service';

const queueProvider = {
  provide: QUEUE_SERVICE,
  useFactory: (
    prisma: PrismaService,
    scanner: ScannerService,
    report: ScannerReportService,
  ) => {
    const queueType = process.env.QUEUE_TYPE || 'postgres';
    
    if (queueType === 'redis') {
      console.log('📦 Using Redis/BullMQ queue');
      return new RedisQueueService(prisma, scanner, report);
    }
    
    console.log('📦 Using PostgreSQL queue');
    return new PostgresQueueService(prisma, scanner, report);
  },
  inject: [PrismaService, ScannerService, ScannerReportService],
};

@Module({
  imports: [PrismaModule],
  controllers: [ScannerController],
  providers: [
    ScannerService,
    ScannerReportService,
    queueProvider,
  ],
  exports: [ScannerService, ScannerReportService, QUEUE_SERVICE],
})
export class ScannerModule implements OnModuleInit, OnModuleDestroy {
  constructor(
    @Inject(QUEUE_SERVICE) private readonly queueService: IQueueService,
  ) {}

  onModuleInit() {
    // Start queue worker when module initializes
    if (process.env.WORKER_ENABLED !== 'false') {
      this.queueService.startWorker();
    }
  }

  onModuleDestroy() {
    this.queueService.stopWorker();
  }
}
