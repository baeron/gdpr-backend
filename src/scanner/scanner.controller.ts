import { Controller, Post, Body, Logger } from '@nestjs/common';
import { IsString, IsUrl } from 'class-validator';
import { ScannerService } from './scanner.service';
import { ScanResultDto } from './dto/scan-result.dto';

export class ScanRequestDto {
  @IsString()
  @IsUrl({}, { message: 'Please provide a valid URL' })
  websiteUrl: string;
}

@Controller('scanner')
export class ScannerController {
  private readonly logger = new Logger(ScannerController.name);

  constructor(private readonly scannerService: ScannerService) {}

  @Post('scan')
  async scanWebsite(@Body() body: ScanRequestDto): Promise<ScanResultDto> {
    this.logger.log(`Received scan request for: ${body.websiteUrl}`);
    return this.scannerService.scanWebsite(body.websiteUrl);
  }
}
