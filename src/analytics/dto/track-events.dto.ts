import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsArray,
  ValidateNested,
  IsEnum,
  IsObject,
  ArrayMaxSize,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AnalyticsEventType } from '@prisma/client';

export class TrackEventDto {
  @IsEnum(AnalyticsEventType)
  eventType: AnalyticsEventType;

  @IsString()
  @IsOptional()
  page?: string;

  @IsString()
  @IsOptional()
  elementId?: string;

  @IsString()
  @IsOptional()
  elementType?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;

  @IsDateString()
  @IsOptional()
  timestamp?: string;
}

export class TrackEventsDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TrackEventDto)
  @ArrayMaxSize(50)
  events: TrackEventDto[];
}
