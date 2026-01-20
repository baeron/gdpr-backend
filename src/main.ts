import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Swagger/OpenAPI documentation
  const config = new DocumentBuilder()
    .setTitle('GDPR Audit API')
    .setDescription(`
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
    `)
    .setVersion('1.0')
    .addTag('scanner', 'GDPR website scanning endpoints')
    .addTag('health', 'Health check endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

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

  // Global prefix for API
  app.setGlobalPrefix('api');

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`🚀 Server running on http://localhost:${port}/api`);
}
void bootstrap();
