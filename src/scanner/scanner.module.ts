import { Module } from '@nestjs/common';
import { ScannerController } from './scanner.controller';
import { ScannerService } from './scanner.service';
import { ScannerReportService } from './scanner-report.service';
import { ScannerQueueService } from './scanner-queue.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ScannerController],
  providers: [ScannerService, ScannerReportService, ScannerQueueService],
  exports: [ScannerService, ScannerReportService, ScannerQueueService],
})
export class ScannerModule {}
