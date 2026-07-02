import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, IsObject, Min } from 'class-validator';

export class CreatePayoutSettlementDto {
  @ApiProperty({ description: 'Amount to reimburse the customer', example: 500.0 })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ description: 'Currency code', example: 'VND', default: 'VND' })
  @IsString()
  currency: string;

  @ApiProperty({
    description:
      'Breakdown of how the amount was calculated (e.g. covered portion paid out-of-pocket)',
    example: { coveredOutOfPocket: 500 },
  })
  @IsObject()
  calculationDetails: Record<string, unknown>;
}
