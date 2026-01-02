import {
  IsEmail,
  IsUrl,
  IsBoolean,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateAuditDto {
  @IsUrl({}, { message: 'Please provide a valid website URL' })
  websiteUrl: string;

  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @IsBoolean()
  agreeScan: boolean;

  @IsBoolean()
  @IsOptional()
  agreeMarketing?: boolean;

  @IsString()
  @IsOptional()
  locale?: string;
}
