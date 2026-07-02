import { IsNumber, IsDateString, IsOptional, Min, IsUUID, IsArray, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CardStatusForAirwallex } from '../interfaces/card.interface';

export class UpdateCardDto {
  @ApiProperty({ description: 'Cardholder ID who will own this card' })
  @IsUUID()
  cardholderId: string;

  @ApiProperty({
    description: 'Spending limit amount',
    example: 10000.0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  limitAmount?: number;

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
  @IsOptional()
  @IsDateString()
  activeFrom?: string;

  @ApiProperty({
    description: 'Card expiration date (ISO 8601)',
    example: '2026-02-26T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  activeTo?: string;

  @ApiProperty({
    description: 'Transaction limits',
    enum: CardStatusForAirwallex,
    example: CardStatusForAirwallex.ACTIVE,
  })
  @IsOptional()
  @IsEnum(CardStatusForAirwallex)
  status?: CardStatusForAirwallex;
}
