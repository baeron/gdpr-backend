/**
 * GDPR Scanner Worker — Standalone HTTP server for Cloud Run
 *
 * This worker runs independently from the main NestJS API.
 * It receives scan job IDs via HTTP, executes Playwright scans,
 * and writes results directly to PostgreSQL.
 *
 * Architecture:
 *   API Server (NestJS) → HTTP trigger → This Worker → PostgreSQL
 */

import { Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ScannerService } from '../scanner/scanner.service';
import { ScannerReportService } from '../scanner/scanner-report.service';
import { PrismaService } from '../prisma/prisma.service';
import http from 'node:http';

// ─── Configuration ───────────────────────────────────────────
const PORT = parseInt(
  process.env.WORKER_PORT || process.env.PORT || '8080',
  10,
);
const AUTH_TOKEN = process.env.WORKER_AUTH_TOKEN || '';
const MAX_CONCURRENT = parseInt(process.env.WORKER_MAX_CONCURRENT || '1', 10);
const SHUTDOWN_TIMEOUT_MS = 10_000;

// ─── State ───────────────────────────────────────────────────
let activeJobs = 0;
let shuttingDown = false;
const prisma = new PrismaClient();

// Wrap PrismaClient as PrismaService-compatible object for ScannerReportService
const prismaService = prisma as unknown as PrismaService;
const scannerService = new ScannerService();
const reportService = new ScannerReportService(prismaService);

// ─── Helpers ─────────────────────────────────────────────────

function parseBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString()));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function respond(res: http.ServerResponse, status: number, body: object) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

// Use Nest's Logger so the standalone worker writes to the same
// structured stream as the API (consistent prefixes, level, timestamp).
const logger = new Logger('Worker');

function log(msg: string) {
  logger.log(msg);
}

function logError(msg: string) {
  logger.error(msg);
}

// ─── Auth ────────────────────────────────────────────────────

function isAuthorized(req: http.IncomingMessage): boolean {
  if (!AUTH_TOKEN) return true; // No token configured = open (dev mode)
  const header = req.headers['authorization'] || '';
  return header === `Bearer ${AUTH_TOKEN}`;
}

// ─── Scan Execution ──────────────────────────────────────────

async function executeScan(jobId: string): Promise<void> {
  log(`Processing job ${jobId}`);

  // 1. Fetch job from DB
  const job = await prisma.scanJob.findUnique({
    where: { id: jobId },
  });

  if (!job) {
    logError(`Job ${jobId} not found`);
    return;
  }

  if (job.status !== 'QUEUED' && job.status !== 'PROCESSING') {
    log(`Job ${jobId} has status ${job.status}, skipping`);
    return;
  }

  // 2. Mark as PROCESSING
  await prisma.scanJob.update({
    where: { id: jobId },
    data: {
      status: 'PROCESSING',
      startedAt: new Date(),
      currentStep: 'Initializing browser...',
      progress: 5,
    },
  });

  activeJobs++;

  try {
    // 3. Update progress: Loading website
    await prisma.scanJob.update({
      where: { id: jobId },
      data: { progress: 10, currentStep: 'Loading website...' },
    });

    // 4. Execute scan
    const result = await scannerService.scanWebsite(job.websiteUrl);

    // 5. Update progress: Saving results
    await prisma.scanJob.update({
      where: { id: jobId },
      data: { progress: 90, currentStep: 'Saving results...' },
    });

    // 6. Save report to database
    const reportId = await reportService.saveScanResult(
      result,
      job.auditRequestId || undefined,
    );

    // 7. Mark as COMPLETED
    await prisma.scanJob.update({
      where: { id: jobId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        reportId,
        progress: 100,
        currentStep: 'Completed',
      },
    });

    log(`Job ${jobId} completed. Report: ${reportId}`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logError(`Job ${jobId} failed: ${message}`);

    await prisma.scanJob.update({
      where: { id: jobId },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        error: message,
        currentStep: 'Failed',
      },
    });
  } finally {
    activeJobs--;
  }
}

// ─── HTTP Server ─────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-misused-promises -- http.createServer signature accepts only sync handlers; the Promise we return is intentionally fire-and-forget (we always end the response before awaiting).
const server = http.createServer(async (req, res) => {
  const url = req.url || '';
  const method = req.method || '';

  // Health check — no auth required
  if (url === '/health' && method === 'GET') {
    return respond(res, 200, {
      status: 'ok',
      activeJobs,
      maxConcurrent: MAX_CONCURRENT,
      shuttingDown,
      uptime: process.uptime(),
    });
  }

  // Readiness check
  if (url === '/ready' && method === 'GET') {
    if (shuttingDown || activeJobs >= MAX_CONCURRENT) {
      return respond(res, 503, { status: 'busy', activeJobs });
    }
    return respond(res, 200, { status: 'ready', activeJobs });
  }

  // Auth check for all other endpoints
  if (!isAuthorized(req)) {
    return respond(res, 401, { error: 'Unauthorized' });
  }

  // POST /scan — trigger a scan job
  if (url === '/scan' && method === 'POST') {
    if (shuttingDown) {
      return respond(res, 503, { error: 'Worker is shutting down' });
    }

    if (activeJobs >= MAX_CONCURRENT) {
      return respond(res, 429, {
        error: 'Worker at capacity',
        activeJobs,
        maxConcurrent: MAX_CONCURRENT,
      });
    }

    let body: unknown;
    try {
      body = await parseBody(req);
    } catch {
      return respond(res, 400, { error: 'Invalid JSON body' });
    }

    const jobId =
      typeof body === 'object' && body !== null
        ? (body as { jobId?: unknown }).jobId
        : undefined;
    if (!jobId || typeof jobId !== 'string') {
      return respond(res, 400, { error: 'Missing or invalid jobId' });
    }

    // Respond immediately — scan runs in background
    respond(res, 202, { status: 'accepted', jobId });

    // Execute scan asynchronously
    executeScan(jobId).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      logError(`Unhandled error in executeScan: ${msg}`);
    });

    return;
  }

  // 404 for everything else
  respond(res, 404, { error: 'Not found' });
});

// ─── Graceful Shutdown ───────────────────────────────────────

async function shutdown(signal: string) {
  log(`Received ${signal}, starting graceful shutdown...`);
  shuttingDown = true;

  // Stop accepting new connections
  server.close();

  // Wait for active jobs to finish
  const deadline = Date.now() + SHUTDOWN_TIMEOUT_MS;
  while (activeJobs > 0 && Date.now() < deadline) {
    log(`Waiting for ${activeJobs} active job(s) to finish...`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  if (activeJobs > 0) {
    logError(`Forced shutdown with ${activeJobs} active job(s)`);
  }

  // Cleanup
  await prisma.$disconnect();
  log('Worker shut down cleanly');
  process.exit(0);
}

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

// ─── Start ───────────────────────────────────────────────────

server.listen(PORT, () => {
  log(`GDPR Scanner Worker listening on port ${PORT}`);
  log(`Max concurrent scans: ${MAX_CONCURRENT}`);
  log(`Auth: ${AUTH_TOKEN ? 'enabled' : 'disabled (dev mode)'}`);
});
