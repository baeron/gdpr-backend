import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { AuditService } from './audit.service';
import { CreateAuditDto } from './dto/create-audit.dto';
import { AuditResponseDto } from './dto/audit-response.dto';

@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async createAudit(@Body() dto: CreateAuditDto): Promise<AuditResponseDto> {
    if (!dto.agreeScan) {
      throw new BadRequestException(
        'You must agree to have your website scanned',
      );
    }

    return this.auditService.createAuditRequest(dto);
  }

  @Get(':id')
  async getAudit(@Param('id') id: string) {
    const audit = await this.auditService.getAuditRequest(id);
    if (!audit) {
      throw new BadRequestException('Audit request not found');
    }
    return audit;
  }
}
