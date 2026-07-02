import {
  IsString,
  IsNumber,
  IsDateString,
  IsOptional,
  Min,
  IsUUID,
  IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCardDto {
  @ApiProperty({ description: 'Case ID this card is associated with' })
  @IsUUID()
  caseId: string;

  @ApiProperty({ description: 'Cardholder ID who will own this card' })
  @IsUUID()
  cardholderId: string;

  @ApiProperty({
    description: 'Spending limit amount',
    example: 10000.0,
  })
  @IsNumber()
  @Min(0)
  limitAmount: number;

  @ApiPropertyOptional({
    description: 'Currency code (ISO 4217)',
    default: ['VND'],
    example: ['VND'],
  })
  @IsArray()
  @IsOptional()
  limitCurrency?: string[];

  @ApiProperty({
    description: 'Card activation start date (ISO 8601)',
    example: '2026-01-26T00:00:00Z',
  })
  @IsDateString()
  activeFrom: string;

  @ApiProperty({
    description: 'Card expiration date (ISO 8601)',
    example: '2026-02-26T23:59:59Z',
  })
  @IsDateString()
  activeTo: string;

  @ApiPropertyOptional({
    description: 'Transaction limits',
    example: 'MULTIPLE',
  })
  @IsString()
  @IsOptional()
  transactionCount?: 'SINGLE' | 'MULTIPLE';
}
