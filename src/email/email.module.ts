import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { PdfReportService } from './pdf-report.service';

@Module({
  providers: [EmailService, PdfReportService],
  exports: [EmailService, PdfReportService],
})
export class EmailModule {}
