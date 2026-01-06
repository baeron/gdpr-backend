import { Controller, Post, Body, Logger, Get, Param, Query, Patch } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiProperty, ApiQuery } from '@nestjs/swagger';
import { IsString, IsUrl, IsOptional, IsBoolean } from 'class-validator';
import { ScannerService } from './scanner.service';
import { ScannerReportService } from './scanner-report.service';
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

@ApiTags('scanner')
@Controller('scanner')
export class ScannerController {
  private readonly logger = new Logger(ScannerController.name);

  constructor(
    private readonly scannerService: ScannerService,
    private readonly reportService: ScannerReportService,
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
}
