import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GeoIpService } from './services/geoip.service';
import { UserAgentService } from './services/user-agent.service';
import { IpAnonymizerService } from './services/ip-anonymizer.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { TrackEventsDto } from './dto/track-events.dto';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly geoIp: GeoIpService,
    private readonly userAgent: UserAgentService,
    private readonly ipAnonymizer: IpAnonymizerService,
  ) {}

  /**
   * Create a new analytics session.
   * Enriches with GeoIP and User-Agent data from the request.
   */
  async createSession(
    dto: CreateSessionDto,
    ip: string,
    userAgentString: string,
  ) {
    const ipHash = this.ipAnonymizer.hash(ip);
    const geo = this.geoIp.lookup(ip);
    const ua = this.userAgent.parse(userAgentString);

    // Upsert: if session already exists (e.g., page reload), update lastActivityAt
    const session = await this.prisma.analyticsSession.upsert({
      where: { sessionId: dto.sessionId },
      update: {
        lastActivityAt: new Date(),
      },
      create: {
        sessionId: dto.sessionId,
        ipHash,
        country: geo.country,
        city: geo.city,
        region: geo.region,
        timezone: geo.timezone,
        browser: ua.browser,
        browserVersion: ua.browserVersion,
        os: ua.os,
        osVersion: ua.osVersion,
        deviceType: ua.deviceType,
        referrer: dto.referrer || null,
        utmSource: dto.utmSource || null,
        utmMedium: dto.utmMedium || null,
        utmCampaign: dto.utmCampaign || null,
        utmTerm: dto.utmTerm || null,
        utmContent: dto.utmContent || null,
        landingPage: dto.landingPage || null,
        language: dto.language || null,
        screenResolution: dto.screenResolution || null,
        viewportSize: dto.viewportSize || null,
      },
    });

    return { sessionId: session.sessionId };
  }

  /**
   * Track a batch of events for an existing session.
   * Creates the session on-the-fly if it doesn't exist yet (fire-and-forget from frontend).
   */
  async trackEvents(
    dto: TrackEventsDto,
    ip: string,
    userAgentString: string,
  ) {
    // Ensure session exists (auto-create if needed)
    const existingSession = await this.prisma.analyticsSession.findUnique({
      where: { sessionId: dto.sessionId },
    });

    if (!existingSession) {
      const ipHash = this.ipAnonymizer.hash(ip);
      const geo = this.geoIp.lookup(ip);
      const ua = this.userAgent.parse(userAgentString);

      await this.prisma.analyticsSession.create({
        data: {
          sessionId: dto.sessionId,
          ipHash,
          country: geo.country,
          city: geo.city,
          region: geo.region,
          timezone: geo.timezone,
          browser: ua.browser,
          browserVersion: ua.browserVersion,
          os: ua.os,
          osVersion: ua.osVersion,
          deviceType: ua.deviceType,
        },
      });
    } else {
      // Update last activity
      await this.prisma.analyticsSession.update({
        where: { sessionId: dto.sessionId },
        data: { lastActivityAt: new Date() },
      });
    }

    // Batch insert events
    const eventsData = dto.events.map((event) => ({
      sessionId: dto.sessionId,
      eventType: event.eventType,
      page: event.page || null,
      elementId: event.elementId || null,
      elementType: event.elementType || null,
      metadata: event.metadata || undefined,
      timestamp: event.timestamp ? new Date(event.timestamp) : new Date(),
    }));

    const result = await this.prisma.analyticsEvent.createMany({
      data: eventsData,
    });

    this.logger.debug(
      `Tracked ${result.count} events for session ${dto.sessionId}`,
    );

    return { tracked: result.count };
  }
}
