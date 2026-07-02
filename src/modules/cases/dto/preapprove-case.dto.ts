import { IsNumber, IsString, IsOptional, IsUUID, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PreapproveCaseDto {
  @ApiProperty({
    description: 'Approved amount for the case',
    example: 10000.0,
  })
  @IsNumber()
  @Min(0)
  approvedAmount: number;

  @ApiPropertyOptional({
    description: 'Currency code (ISO 4217)',
    default: 'VND',
    example: 'VND',
  })
  @IsString()
  @IsOptional()
  approvedCurrency?: string;

  @ApiPropertyOptional({
    description: 'Coverage tier ID',
  })
  @IsUUID()
  @IsOptional()
  coverageTierId?: string;

  @ApiPropertyOptional({
    description: 'Buffer amount for additional expenses',
    example: 500.0,
    default: 0,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  bufferAmount?: number;
}
