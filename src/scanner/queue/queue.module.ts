import { Module, DynamicModule, Logger } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PrismaService } from '../../prisma/prisma.service';
import { ScannerService } from '../scanner.service';
import { ScannerReportService } from '../scanner-report.service';
import { PostgresQueueService } from './postgres-queue.service';
import { RedisQueueService } from './redis-queue.service';
import { QUEUE_SERVICE } from './queue.interface';

@Module({})
export class QueueModule {
  private static readonly logger = new Logger(QueueModule.name);

  static register(): DynamicModule {
    const queueType = process.env.QUEUE_TYPE || 'postgres';
    
    this.logger.log(`Registering queue module with type: ${queueType}`);

    const queueProvider = {
      provide: QUEUE_SERVICE,
      useFactory: (
        prisma: PrismaService,
        scanner: ScannerService,
        report: ScannerReportService,
      ) => {
        if (queueType === 'redis') {
          this.logger.log('Using Redis/BullMQ queue');
          return new RedisQueueService(prisma, scanner, report);
        }
        
        this.logger.log('Using PostgreSQL queue');
        return new PostgresQueueService(prisma, scanner, report);
      },
      inject: [PrismaService, ScannerService, ScannerReportService],
    };

    return {
      module: QueueModule,
      imports: [PrismaModule],
      providers: [queueProvider],
      exports: [QUEUE_SERVICE],
    };
  }
}
