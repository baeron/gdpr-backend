import { Controller, Post, Body, Logger, Get, Param, Query, Patch } from '@nestjs/common';
import { IsString, IsUrl, IsOptional, IsBoolean } from 'class-validator';
import { ScannerService } from './scanner.service';
import { ScannerReportService } from './scanner-report.service';
import { ScanResultDto } from './dto/scan-result.dto';

export class ScanRequestDto {
  @IsString()
  @IsUrl({}, { message: 'Please provide a valid URL' })
  websiteUrl: string;

  @IsOptional()
  @IsBoolean()
  saveToDb?: boolean;

  @IsOptional()
  @IsString()
  auditRequestId?: string;
}

@Controller('scanner')
export class ScannerController {
  private readonly logger = new Logger(ScannerController.name);

  constructor(
    private readonly scannerService: ScannerService,
    private readonly reportService: ScannerReportService,
  ) {}

  @Post('scan')
  async scanWebsite(@Body() body: ScanRequestDto): Promise<ScanResultDto & { reportId?: string }> {
    this.logger.log(`Received scan request for: ${body.websiteUrl}`);
    
    const result = await this.scannerService.scanWebsite(body.websiteUrl);
    
    // Optionally save to database
    if (body.saveToDb !== false) {
      const reportId = await this.reportService.saveScanResult(result, body.auditRequestId);
      return { ...result, reportId };
    }
    
    return result;
  }

  @Get('report/:id')
  async getReport(@Param('id') id: string) {
    this.logger.log(`Fetching report: ${id}`);
    return this.reportService.getReport(id);
  }

  @Get('reports')
  async getReportsByWebsite(@Query('url') url: string, @Query('limit') limit?: string) {
    this.logger.log(`Fetching reports for: ${url}`);
    return this.reportService.getReportsByWebsite(url, limit ? parseInt(limit, 10) : 10);
  }

  @Patch('issue/:id/status')
  async updateIssueStatus(
    @Param('id') id: string,
    @Body('status') status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'WONT_FIX',
  ) {
    this.logger.log(`Updating issue ${id} status to: ${status}`);
    return this.reportService.updateIssueStatus(id, status);
  }
}
