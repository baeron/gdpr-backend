import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppController } from './../src/app.controller';
import { AppService } from './../src/app.service';
import { HealthController } from './../src/health/health.controller';
import { HealthService } from './../src/health/health.service';
import { PrismaService } from './../src/prisma/prisma.service';
import { QUEUE_SERVICE } from './../src/scanner/queue/queue.interface';

interface HealthResponse {
  status: string;
  timestamp: string;
}

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AppController, HealthController],
      providers: [
        AppService,
        HealthService,
        {
          provide: PrismaService,
          useValue: {
            $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
          },
        },
        {
          provide: QUEUE_SERVICE,
          useValue: {
            getStats: jest.fn().mockResolvedValue({
              waiting: 0,
              active: 0,
              completed: 0,
              failed: 0,
            }),
            addJob: jest.fn(),
            getJob: jest.fn(),
            processJobs: jest.fn(),
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer()).get('/').expect(200).expect({
      name: 'PolicyTracker API',
      version: '1.0.0',
      description: 'GDPR Audit & Compliance Backend Service',
    });
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res: { body: HealthResponse }) => {
        expect(res.body.status).toBe('healthy');
        expect(res.body.timestamp).toBeDefined();
      });
  });
});
