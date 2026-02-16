import {
  Controller,
  Post,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request } from 'express';
import { AnalyticsService } from './analytics.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { TrackEventsDto } from './dto/track-events.dto';

@Controller('analytics')
export class AnalyticsController {
  private readonly logger = new Logger(AnalyticsController.name);

  constructor(private readonly analyticsService: AnalyticsService) {}

  /**
   * POST /analytics/session
   * Create a new analytics session. Called once per visitor session.
   */
  @Post('session')
  @HttpCode(HttpStatus.CREATED)
  async createSession(
    @Body() dto: CreateSessionDto,
    @Req() req: Request,
  ) {
    const ip = this.extractIp(req);
    const userAgent = req.headers['user-agent'] || '';

    return this.analyticsService.createSession(dto, ip, userAgent);
  }

  /**
   * POST /analytics/events
   * Track a batch of events for an existing session.
   * Supports both JSON body and sendBeacon (which sends as text/plain).
   */
  @Post('events')
  @HttpCode(HttpStatus.OK)
  async trackEvents(
    @Body() dto: TrackEventsDto,
    @Req() req: Request,
  ) {
    const ip = this.extractIp(req);
    const userAgent = req.headers['user-agent'] || '';

    return this.analyticsService.trackEvents(dto, ip, userAgent);
  }

  /**
   * Extract real client IP from request.
   * Handles proxies (X-Forwarded-For, X-Real-IP) and direct connections.
   */
  private extractIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      // X-Forwarded-For can contain multiple IPs: client, proxy1, proxy2
      const ips = Array.isArray(forwarded)
        ? forwarded[0]
        : forwarded.split(',')[0];
      return ips.trim();
    }

    const realIp = req.headers['x-real-ip'];
    if (realIp) {
      return Array.isArray(realIp) ? realIp[0] : realIp;
    }

    return req.ip || req.socket?.remoteAddress || '';
  }
}
