import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import {
  Logger,
  ValidationPipe,
  VersioningType,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { TimeoutInterceptor } from './common/interceptors/timeout.interceptor';

// package.json version is the canonical release identifier — passed
// as a build-time constant so we don't need a runtime require() and
// can keep tsconfig.resolveJsonModule untouched.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { version: APP_VERSION } = require('../package.json') as {
  version: string;
};

async function bootstrap() {
  const dsn = process.env.SENTRY_DSN;
  const env = process.env.NODE_ENV || 'development';
  const isProd = env === 'production';

  // Sentry.init() is a no-op when DSN is undefined, but we still want
  // an explicit warning in production so a misconfigured deploy is
  // visible in startup logs instead of silently losing all errors.
  if (!dsn && isProd) {
    console.warn(
      '[Sentry] SENTRY_DSN is unset in production — error tracking disabled.',
    );
  }

  Sentry.init({
    dsn,
    environment: env,
    release: `gdpr-backend@${APP_VERSION}`,
    integrations: [nodeProfilingIntegration()],
    // Free-tier-friendly defaults. Override via env on hot endpoints
    // if we need higher resolution; full sampling only in dev.
    tracesSampleRate: isProd
      ? Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1)
      : 1.0,
    profilesSampleRate: isProd
      ? Number(process.env.SENTRY_PROFILES_SAMPLE_RATE ?? 0.1)
      : 1.0,
    // Known noise — these aren't actionable bugs, they're either
    // expected client behaviour (aborts, timeouts) or third-party
    // hiccups we already handle elsewhere.
    ignoreErrors: [
      'ECONNRESET',
      'ECONNABORTED',
      'ETIMEDOUT',
      'EPIPE',
      'Request aborted',
      'aborted',
      // Prisma "record not found" — surfaced as a 404 to clients,
      // never a server-side bug.
      'P2025',
    ],
    // Last-line-of-defence filter: HttpException subclasses (4xx +
    // some 5xx like ServiceUnavailable) are intentionally raised
    // business errors. They never indicate a code bug, so dropping
    // them keeps the Sentry quota for things we can actually fix.
    beforeSend(event, hint) {
      const err = hint.originalException;
      if (err && typeof err === 'object' && 'getStatus' in err) {
        const status = (err as { getStatus: () => number }).getStatus();
        if (status < 500) return null;
      }
      return event;
    },
  });

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Trust proxy is required for correct IP detection behind load balancers/reverse proxies
  // This is critical for ThrottlerGuard (rate limiting) to work per-IP rather than globally
  app.set('trust proxy', 1);

  // Swagger/OpenAPI documentation
  const config = new DocumentBuilder()
    .setTitle('GDPR Audit API')
    .setDescription(
      `
## GDPR Website Scanner API

This API provides comprehensive GDPR compliance scanning for websites.

### Features
- **Cookie Analysis**: Detects cookies set before/after consent
- **Tracker Detection**: Identifies known trackers (Google Analytics, Facebook, etc.)
- **Consent Banner Analysis**: Checks for reject option, equal prominence, granular consent
- **Privacy Policy Analysis**: Validates GDPR Art. 13-14 requirements
- **Security Checks**: HTTPS, cookie flags, mixed content
- **Form Analysis**: Consent checkboxes, pre-checked marketing
- **Data Transfer Detection**: US-based services (Schrems II compliance)
- **Technology Detection**: CMS, frameworks, analytics, advertising platforms

### Risk Levels
- **CRITICAL**: Immediate action required (e.g., no consent banner)
- **HIGH**: Significant compliance risk
- **MEDIUM**: Should be addressed
- **LOW**: Minor improvements recommended

### Scoring
Score is calculated 0-100 based on issues found. Higher score = better compliance.
    `,
    )
    .setVersion('1.0')
    .addTag('scanner', 'GDPR website scanning endpoints')
    .addTag('health', 'Health check endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Security: Helmet middleware (removes X-Powered-By, adds security headers)
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"], // needed for Swagger UI
          styleSrc: ["'self'", "'unsafe-inline'"], // needed for Swagger UI
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
      crossOriginEmbedderPolicy: false, // allow Swagger UI assets
    }),
  );

  // Enable CORS for frontend
  const allowedOrigins = [
    'http://localhost:4200',
    'https://policytracker.eu',
    'https://www.policytracker.eu',
    'https://dev.policytracker.eu',
    'https://www.dev.policytracker.eu',
    'https://api.policytracker.eu',
    'https://api.dev.policytracker.eu',
  ];

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // Enable validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global exception filter (structured error responses + logging)
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Global request timeout interceptor (30s)
  app.useGlobalInterceptors(new TimeoutInterceptor());

  // Global prefix for API
  app.setGlobalPrefix('api');

  // URI versioning with back-compat: every controller is reachable at
  // BOTH `/api/v1/...` (the new canonical form clients should adopt)
  // and `/api/...` (the historical form, kept alive via VERSION_NEUTRAL
  // so the existing frontend keeps working unchanged). When a real v2
  // breaking change appears, the v1 mount stays frozen and v2 ships
  // alongside it via @Version('2') on the relevant handlers.
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: ['1', VERSION_NEUTRAL],
    prefix: 'v',
  });

  // Enable Nest shutdown hooks so SIGTERM / SIGINT propagate to
  // onModuleDestroy in services that own external resources:
  //   - PrismaService.$disconnect()
  //   - ScannerModule → IQueueService.stopWorker() (clears polling intervals,
  //     closes BullMQ workers, stops Cloud Run overflow monitor)
  //   - ScannerService → BrowserManagerService.closeBrowser()
  // Without this, container restarts leak DB connections and Playwright
  // processes, and in-flight scans are killed mid-step.
  app.enableShutdownHooks();

  // Make sure Sentry events get flushed during graceful shutdown.
  // Nest's hooks await onModuleDestroy on every provider but know
  // nothing about Sentry's transport queue.
  for (const sig of ['SIGTERM', 'SIGINT'] as const) {
    process.once(sig, () => {
      void Sentry.close(2000);
    });
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  // Use Nest's Logger so the startup line lands in the same structured
  // stream as everything else (consistent prefixes, color, future
  // pino/Sentry redirection).
  new Logger('Bootstrap').log(
    `Server running on http://localhost:${port}/api  (versioned: /api/v1)`,
  );
}
void bootstrap();
