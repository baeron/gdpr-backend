import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAuditDto } from './dto/create-audit.dto';
import { AuditResponseDto } from './dto/audit-response.dto';
import { EmailService } from '../email/email.service';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  async createAuditRequest(dto: CreateAuditDto): Promise<AuditResponseDto> {
    try {
      // Normalize URL
      let websiteUrl = dto.websiteUrl.trim();
      if (!websiteUrl.startsWith('http')) {
        websiteUrl = `https://${websiteUrl}`;
      }

      // Create audit request in database
      const auditRequest = await this.prisma.auditRequest.create({
        data: {
          websiteUrl,
          email: dto.email.toLowerCase().trim(),
          agreeScan: dto.agreeScan,
          agreeMarketing: dto.agreeMarketing ?? false,
          locale: dto.locale ?? 'en',
        },
      });

      this.logger.log(
        `Audit request created: ${auditRequest.id} for ${websiteUrl}`,
      );

      // Send confirmation email to user (using new template system)
      await this.emailService.sendAuditConfirmationTo(auditRequest.email, {
        websiteUrl: auditRequest.websiteUrl,
        auditId: auditRequest.id,
        locale: auditRequest.locale,
      });

      // Send notification to admin (with additional metadata)
      await this.emailService.sendAdminNotification({
        auditId: auditRequest.id,
        websiteUrl: auditRequest.websiteUrl,
        email: auditRequest.email,
        agreeMarketing: auditRequest.agreeMarketing,
        locale: auditRequest.locale,
      });

      return {
        success: true,
        message:
          'Audit request submitted successfully. Check your email for confirmation.',
        auditId: auditRequest.id,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Failed to create audit request: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  async getAuditRequest(id: string) {
    return this.prisma.auditRequest.findUnique({
      where: { id },
      include: { auditReport: true },
    });
  }

  async getAuditsByEmail(email: string) {
    return this.prisma.auditRequest.findMany({
      where: { email: email.toLowerCase() },
      orderBy: { createdAt: 'desc' },
    });
  }
}
