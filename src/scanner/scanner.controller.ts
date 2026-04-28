import {
  Controller,
  Post,
  Body,
  Logger,
  Get,
  Param,
  Query,
  Patch,
  Delete,
  Inject,
  BadRequestException,
  Req,
  UseGuards,
} from '@nestjs/common';
import { TurnstileGuard } from '../common/turnstile/turnstile.guard';
import { Idempotent } from '../common/idempotency/idempotency.interceptor';
import type { Request } from 'express';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { SCAN_RATE_LIMITS } from './scanner.config';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiProperty,
  ApiQuery,
} from '@nestjs/swagger';
import {
  IsString,
  IsUrl,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsEmail,
  Equals,
} from 'class-validator';
import { ScannerService } from './scanner.service';
import { ScannerReportService } from './scanner-report.service';
import { UrlUtilsService } from './url-utils.service';
import { QUEUE_SERVICE } from './queue/queue.interface';
import type { IQueueService } from './queue/queue.interface';
import { ScanResultDto } from './dto/scan-result.dto';
import { AuditService } from '../audit/audit.service';

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

  @ApiProperty({
    description:
      'Cloudflare Turnstile token (verified server-side via siteverify)',
    required: false,
  })
  @IsOptional()
  @IsString()
  turnstileToken?: string;
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
    description:
      'Link to a pre-existing AuditRequest row. When provided, the queue\n' +
      'handler skips its own AuditRequest creation and just attaches the\n' +
      'job to that row. Used by flows that already created the audit\n' +
      'request via POST /audit (deprecated for hero-form, kept for\n' +
      'standalone audit submissions).',
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

  @ApiProperty({
    description:
      'GDPR consent: user agrees that their website may be scanned.\n' +
      'Required to be `true` when `userEmail` is supplied — the queue\n' +
      'handler creates an AuditRequest row carrying this consent flag,\n' +
      'which is the GDPR-compliant proof of permission.',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  @Equals(true, {
    message: 'You must agree to have your website scanned (agreeScan=true).',
  })
  agreeScan?: boolean;

  @ApiProperty({
    description:
      'Optional opt-in for marketing emails. Stored on the AuditRequest\n' +
      'row alongside `agreeScan`. Defaults to false when omitted.',
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  agreeMarketing?: boolean;

  @ApiProperty({
    description:
      'Cloudflare Turnstile token (verified server-side via siteverify)',
    required: false,
  })
  @IsOptional()
  @IsString()
  turnstileToken?: string;
}

@ApiTags('scanner')
@Controller('scanner')
export class ScannerController {
  private readonly logger = new Logger(ScannerController.name);

  constructor(
    private readonly scannerService: ScannerService,
    private readonly reportService: ScannerReportService,
    private readonly urlUtils: UrlUtilsService,
    @Inject(QUEUE_SERVICE) private readonly queueService: IQueueService,
    private readonly auditService: AuditService,
  ) {}

  // Limits configurable via SCAN_RATE_* env vars (see scanner.config.ts).
  // Defaults: 3 / minute, 20 / hour per IP — synchronous scan is
  // expensive (Playwright + network), so the cap is intentionally low.
  @Throttle({
    short: {
      ttl: SCAN_RATE_LIMITS.scan.shortTtl,
      limit: SCAN_RATE_LIMITS.scan.shortLimit,
    },
    medium: {
      ttl: SCAN_RATE_LIMITS.scan.mediumTtl,
      limit: SCAN_RATE_LIMITS.scan.mediumLimit,
    },
  })
  @UseGuards(TurnstileGuard)
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
  async scanWebsite(
    @Body() body: ScanRequestDto,
  ): Promise<ScanResultDto & { reportId?: string }> {
    this.logger.log(`Received scan request for: ${body.websiteUrl}`);

    const validation = await this.urlUtils.validateAndCheckUrl(body.websiteUrl);
    if (!validation.isValid) {
      throw new BadRequestException(
        validation.error || 'Invalid URL provided.',
      );
    }

    const result = await this.scannerService.scanWebsite(
      validation.normalizedUrl,
    );

    // Optionally save to database
    if (body.saveToDb !== false) {
      const reportId = await this.reportService.saveScanResult(
        result,
        body.auditRequestId,
      );
      return { ...result, reportId };
    }

    return result;
  }

  @Get('report/:id')
  @ApiOperation({
    summary: 'Get scan report by ID',
    description:
      'Retrieves a previously saved scan report with all issues and details.',
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
  @ApiQuery({
    name: 'url',
    description: 'Website URL to search for',
    example: 'example.com',
  })
  @ApiQuery({
    name: 'limit',
    description: 'Maximum number of reports to return',
    required: false,
    example: 10,
  })
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
  async getReportsByWebsite(
    @Query('url') url: string,
    @Query('limit') limit?: string,
  ) {
    this.logger.log(`Fetching reports for: ${url}`);
    return this.reportService.getReportsByWebsite(
      url,
      limit ? parseInt(limit, 10) : 10,
    );
  }

  @Patch('issue/:id/status')
  @ApiOperation({
    summary: 'Update issue status',
    description:
      'Updates the status of a specific issue (e.g., mark as resolved).',
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

  // Limits configurable via SCAN_QUEUE_* env vars. Defaults:
  // 5 / minute, 30 / hour — slightly higher than the sync /scan
  // endpoint because enqueueing is cheap (just a DB insert).
  @Throttle({
    short: {
      ttl: SCAN_RATE_LIMITS.queue.shortTtl,
      limit: SCAN_RATE_LIMITS.queue.shortLimit,
    },
    medium: {
      ttl: SCAN_RATE_LIMITS.queue.mediumTtl,
      limit: SCAN_RATE_LIMITS.queue.mediumLimit,
    },
  })
  @UseGuards(TurnstileGuard)
  @Idempotent()
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
  async queueScan(@Body() body: QueueScanRequestDto, @Req() request: Request) {
    this.logger.log(`Queueing scan for: ${body.websiteUrl}`);

    const validation = await this.urlUtils.validateAndCheckUrl(body.websiteUrl);
    if (!validation.isValid) {
      throw new BadRequestException(
        validation.error || 'Invalid URL provided.',
      );
    }

    body.websiteUrl = validation.normalizedUrl;

    // GDPR consent flow:
    //
    // The hero-form on the frontend collects email + agreeScan + agreeMarketing
    // and submits everything to /scanner/queue in a single request. We record
    // the AuditRequest row here so the consent flags land in the database
    // BEFORE the scan starts.
    //
    // Why not let the frontend POST /audit separately first?
    //   - Single-use Turnstile tokens: one captcha solve = one siteverify = one
    //     POST. A second call to /audit would either need a second captcha
    //     (bad UX, second widget on the page) or would be sent without one
    //     (rejected by TurnstileGuard with 403). The old two-call pattern was
    //     silently failing in production until we caught it via the deploy
    //     to Contabo.
    //   - Atomicity: consent + scan request are conceptually one user action.
    //     Splitting them across two endpoints leaves room for half-recorded
    //     state if the second call fails.
    //
    // Backwards-compat: callers that still want the old two-call flow can
    // pre-create the AuditRequest via POST /audit and pass `auditRequestId`
    // here. In that case we trust the existing row and don't create a new one.
    let auditRequestId = body.auditRequestId;
    if (!auditRequestId && body.userEmail && body.agreeScan) {
      const audit = await this.auditService.createAuditRequest({
        websiteUrl: body.websiteUrl,
        email: body.userEmail,
        agreeScan: body.agreeScan,
        agreeMarketing: body.agreeMarketing ?? false,
        locale: body.locale,
      });
      auditRequestId = audit.auditId;
      this.logger.log(
        `Created AuditRequest ${auditRequestId} for queued scan ` +
          `(email=${body.userEmail}, agreeMarketing=${
            body.agreeMarketing ?? false
          })`,
      );
    }

    return this.queueService.addJob({
      websiteUrl: body.websiteUrl,
      auditRequestId,
      userEmail: body.userEmail,
      locale: body.locale,
      priority: body.priority,
      clientIp: request.ip,
    });
  }

  @Get('job/:id')
  @ApiOperation({
    summary: 'Get scan job status',
    description:
      'Check the status of a queued/processing scan job. Poll this endpoint to track progress.',
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
    description:
      'Cancel a scan that is still in the queue (not yet processing).',
  })
  @ApiResponse({ status: 200, description: 'Job cancelled' })
  @ApiResponse({
    status: 400,
    description: 'Job cannot be cancelled (already processing or completed)',
  })
  async cancelJob(@Param('id') id: string) {
    this.logger.log(`Cancelling job: ${id}`);
    const cancelled = await this.queueService.cancelJob(id);
    return { cancelled };
  }

  @Post('job/:id/retry')
  @ApiOperation({
    summary: 'Retry a permanently failed scan (DLQ replay)',
    description: `
Manually re-queues a job that has reached terminal FAILED status after
exhausting its automatic retry budget. Resets the attempt counter so
the worker gets a full retry budget again.

Returns \`{ retried: false }\` if the job is missing or not in FAILED
state (idempotent — safe to call repeatedly).
    `,
  })
  @ApiResponse({ status: 201, description: 'Job re-queued from FAILED' })
  @ApiResponse({
    status: 200,
    description:
      'Job not eligible for retry (not found or not in FAILED state)',
  })
  async retryJob(@Param('id') id: string) {
    this.logger.log(`Retrying job from DLQ: ${id}`);
    const retried = await this.queueService.retryJob(id);
    return { retried };
  }

  @SkipThrottle()
  @Get('queue/stats')
  @ApiOperation({
    summary: 'Get queue statistics',
    description:
      'Returns current queue status: jobs waiting, processing, completed, etc.',
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
