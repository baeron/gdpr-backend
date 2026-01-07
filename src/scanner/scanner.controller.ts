import { Controller, Post, Body, Logger, Get, Param, Query, Patch, Delete, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiProperty, ApiQuery } from '@nestjs/swagger';
import { IsString, IsUrl, IsOptional, IsBoolean, IsNumber, IsEmail } from 'class-validator';
import { ScannerService } from './scanner.service';
import { ScannerReportService } from './scanner-report.service';
import { QUEUE_SERVICE } from './queue/queue.interface';
import type { IQueueService } from './queue/queue.interface';
import { ScanResultDto } from './dto/scan-result.dto';

export class ScanRequestDto {
  @ApiProperty({
    description: 'Website URL to scan for GDPR compliance',
    example: 'https://example.com',
  })
  @IsString()
  @IsUrl({}, { message: 'Please provide a valid URL' })
  websiteUrl: string;

  @ApiProperty({
    description: 'Whether to save the scan result to database (default: true)',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  saveToDb?: boolean;

  @ApiProperty({
    description: 'Link to existing audit request ID',
    example: 'clx1234567890',
    required: false,
  })
  @IsOptional()
  @IsString()
  auditRequestId?: string;
}

export class UpdateIssueStatusDto {
  @ApiProperty({
    description: 'New status for the issue',
    enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'WONT_FIX'],
    example: 'RESOLVED',
  })
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'WONT_FIX';
}

export class QueueScanRequestDto {
  @ApiProperty({
    description: 'Website URL to scan for GDPR compliance',
    example: 'https://example.com',
  })
  @IsString()
  @IsUrl({}, { message: 'Please provide a valid URL' })
  websiteUrl: string;

  @ApiProperty({
    description: 'Link to existing audit request ID',
    required: false,
  })
  @IsOptional()
  @IsString()
  auditRequestId?: string;

  @ApiProperty({
    description: 'User email for notifications',
    required: false,
  })
  @IsOptional()
  @IsEmail()
  userEmail?: string;

  @ApiProperty({
    description: 'Priority (higher = processed first)',
    required: false,
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  priority?: number;

  @ApiProperty({
    description: 'User locale for notifications',
    required: false,
    example: 'en',
  })
  @IsOptional()
  @IsString()
  locale?: string;
}

@ApiTags('scanner')
@Controller('scanner')
export class ScannerController {
  private readonly logger = new Logger(ScannerController.name);

  constructor(
    private readonly scannerService: ScannerService,
    private readonly reportService: ScannerReportService,
    @Inject(QUEUE_SERVICE) private readonly queueService: IQueueService,
  ) {}

  @Post('scan')
  @ApiOperation({
    summary: 'Scan website for GDPR compliance',
    description: `
Performs a comprehensive GDPR compliance scan on the specified website.

**Scan includes:**
- Cookie detection (before/after consent)
- Tracker identification
- Consent banner analysis
- Privacy policy validation
- Security checks (HTTPS, cookie flags)
- Form analysis
- Data transfer detection (US services)
- Technology stack detection

**Duration:** Typically 30-60 seconds depending on website complexity.
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Scan completed successfully',
    schema: {
      example: {
        reportId: 'clx1234567890',
        websiteUrl: 'https://example.com',
        score: 75,
        overallRiskLevel: 'MEDIUM',
        issues: [
          {
            code: 'NO_REJECT_OPTION',
            title: 'No Reject Option in Consent Banner',
            riskLevel: 'HIGH',
          },
        ],
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid URL provided' })
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
  @ApiOperation({
    summary: 'Get scan report by ID',
    description: 'Retrieves a previously saved scan report with all issues and details.',
  })
  @ApiResponse({
    status: 200,
    description: 'Report found',
    schema: {
      example: {
        id: 'clx1234567890',
        websiteUrl: 'https://example.com',
        overallScore: 75,
        riskLevel: 'MEDIUM',
        issues: [
          {
            code: 'NO_REJECT_OPTION',
            category: 'CONSENT',
            title: 'No Reject Option',
            riskLevel: 'HIGH',
            evidence: 'Cookie banner does not include a "Reject All" button.',
            effortHours: '1-2',
            estimatedCost: '€100-200',
            status: 'OPEN',
          },
        ],
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Report not found' })
  async getReport(@Param('id') id: string) {
    this.logger.log(`Fetching report: ${id}`);
    return this.reportService.getReport(id);
  }

  @Get('reports')
  @ApiOperation({
    summary: 'Get scan history for a website',
    description: 'Retrieves all scan reports for a specific website URL.',
  })
  @ApiQuery({ name: 'url', description: 'Website URL to search for', example: 'example.com' })
  @ApiQuery({ name: 'limit', description: 'Maximum number of reports to return', required: false, example: 10 })
  @ApiResponse({
    status: 200,
    description: 'List of reports',
    schema: {
      example: [
        {
          id: 'clx1234567890',
          websiteUrl: 'https://example.com',
          overallScore: 75,
          scannedAt: '2024-01-15T10:30:00Z',
        },
      ],
    },
  })
  async getReportsByWebsite(@Query('url') url: string, @Query('limit') limit?: string) {
    this.logger.log(`Fetching reports for: ${url}`);
    return this.reportService.getReportsByWebsite(url, limit ? parseInt(limit, 10) : 10);
  }

  @Patch('issue/:id/status')
  @ApiOperation({
    summary: 'Update issue status',
    description: 'Updates the status of a specific issue (e.g., mark as resolved).',
  })
  @ApiResponse({
    status: 200,
    description: 'Issue status updated',
    schema: {
      example: {
        id: 'clx1234567890',
        code: 'NO_REJECT_OPTION',
        status: 'RESOLVED',
        resolvedAt: '2024-01-15T14:30:00Z',
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Issue not found' })
  async updateIssueStatus(
    @Param('id') id: string,
    @Body() body: UpdateIssueStatusDto,
  ) {
    this.logger.log(`Updating issue ${id} status to: ${body.status}`);
    return this.reportService.updateIssueStatus(id, body.status);
  }

  // ============ ASYNC QUEUE ENDPOINTS ============

  @Post('queue')
  @ApiOperation({
    summary: 'Queue a scan (async, recommended)',
    description: `
Adds a website scan to the processing queue. Returns immediately with a job ID.

**Recommended for production use** - prevents server overload on limited resources.

Use \`GET /scanner/job/:id\` to poll for status and results.

**Flow:**
1. POST /scanner/queue → { jobId, status: "QUEUED", position: 3 }
2. Poll GET /scanner/job/:id → { status: "PROCESSING", progress: 45 }
3. Poll GET /scanner/job/:id → { status: "COMPLETED", reportId: "..." }
4. GET /scanner/report/:reportId → Full report
    `,
  })
  @ApiResponse({
    status: 201,
    description: 'Scan queued successfully',
    schema: {
      example: {
        id: 'clx1234567890',
        websiteUrl: 'https://example.com',
        status: 'QUEUED',
        position: 3,
        estimatedWaitMinutes: 3,
        progress: 0,
      },
    },
  })
  async queueScan(@Body() body: QueueScanRequestDto) {
    this.logger.log(`Queueing scan for: ${body.websiteUrl}`);
    return this.queueService.addJob(body);
  }

  @Get('job/:id')
  @ApiOperation({
    summary: 'Get scan job status',
    description: 'Check the status of a queued/processing scan job. Poll this endpoint to track progress.',
  })
  @ApiResponse({
    status: 200,
    description: 'Job status',
    schema: {
      example: {
        id: 'clx1234567890',
        websiteUrl: 'https://example.com',
        status: 'PROCESSING',
        progress: 45,
        currentStep: 'Analyzing cookies...',
        position: null,
        reportId: null,
        estimatedWaitMinutes: null,
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async getJobStatus(@Param('id') id: string) {
    this.logger.log(`Fetching job status: ${id}`);
    const status = await this.queueService.getJobStatus(id);
    if (!status) {
      return { error: 'Job not found' };
    }
    return status;
  }

  @Delete('job/:id')
  @ApiOperation({
    summary: 'Cancel a queued scan',
    description: 'Cancel a scan that is still in the queue (not yet processing).',
  })
  @ApiResponse({ status: 200, description: 'Job cancelled' })
  @ApiResponse({ status: 400, description: 'Job cannot be cancelled (already processing or completed)' })
  async cancelJob(@Param('id') id: string) {
    this.logger.log(`Cancelling job: ${id}`);
    const cancelled = await this.queueService.cancelJob(id);
    return { cancelled };
  }

  @Get('queue/stats')
  @ApiOperation({
    summary: 'Get queue statistics',
    description: 'Returns current queue status: jobs waiting, processing, completed, etc.',
  })
  @ApiResponse({
    status: 200,
    description: 'Queue statistics',
    schema: {
      example: {
        queued: 5,
        processing: 1,
        completed: 42,
        failed: 2,
        maxConcurrent: 1,
        estimatedWaitPerJob: 60,
      },
    },
  })
  async getQueueStats() {
    return this.queueService.getStats();
  }
}
