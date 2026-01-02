import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): { name: string; version: string; description: string } {
    return {
      name: 'PolicyTracker API',
      version: '1.0.0',
      description: 'GDPR Audit & Compliance Backend Service',
    };
  }
}
