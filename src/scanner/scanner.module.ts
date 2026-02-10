import { Module, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { ScannerController } from './scanner.controller';
import { ScannerService } from './scanner.service';
import { ScannerReportService } from './scanner-report.service';
import { BrowserManagerService } from './browser-manager.service';
import { IssueGeneratorService } from './issue-generator.service';
import { ScoreCalculatorService } from './score-calculator.service';
import { UrlUtilsService } from './url-utils.service';
import { CookieAnalyzer } from './analyzers/cookie.analyzer';
import { TrackerAnalyzer } from './analyzers/tracker.analyzer';
import { ConsentAnalyzer } from './analyzers/consent.analyzer';
import { PrivacyPolicyAnalyzer } from './analyzers/privacy-policy.analyzer';
import { SecurityAnalyzer } from './analyzers/security.analyzer';
import { FormAnalyzer } from './analyzers/form.analyzer';
import { DataTransferAnalyzer } from './analyzers/data-transfer.analyzer';
import { TechnologyAnalyzer } from './analyzers/technology.analyzer';
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
    CookieAnalyzer,
    TrackerAnalyzer,
    ConsentAnalyzer,
    PrivacyPolicyAnalyzer,
    SecurityAnalyzer,
    FormAnalyzer,
    DataTransferAnalyzer,
    TechnologyAnalyzer,
    BrowserManagerService,
    IssueGeneratorService,
    ScoreCalculatorService,
    UrlUtilsService,
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
