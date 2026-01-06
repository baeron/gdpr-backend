import { Module } from '@nestjs/common';
import { ScannerController } from './scanner.controller';
import { ScannerService } from './scanner.service';
import { ScannerReportService } from './scanner-report.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ScannerController],
  providers: [ScannerService, ScannerReportService],
  exports: [ScannerService, ScannerReportService],
})
export class ScannerModule {}
