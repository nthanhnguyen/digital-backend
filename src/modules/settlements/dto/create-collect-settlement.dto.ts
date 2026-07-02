import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, IsObject, Min, IsOptional } from 'class-validator';

export class CreateCollectSettlementDto {
  @ApiProperty({ description: 'Amount to collect from the customer', example: 500.0 })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ description: 'Currency code', example: 'VND', default: 'VND' })
  @IsString()
  currency: string;

  @ApiProperty({
    description: 'Breakdown of how the amount was calculated (e.g. overage, deductible)',
    example: { overage: 400, deductible: 100 },
  })
  @IsObject()
  calculationDetails: Record<string, unknown>;

  @ApiProperty({ required: false, description: 'Optional title for the payment link' })
  @IsOptional()
  @IsString()
  paymentLinkTitle?: string;
}
