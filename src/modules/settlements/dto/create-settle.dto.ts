import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export enum SettleAction {
  COLLECT = 'COLLECT',
  PAYOUT = 'PAYOUT',
  NONE = 'NONE',
}

export class CreateSettleDto {
  @ApiProperty({
    description: 'Settlement action',
    enum: SettleAction,
    example: SettleAction.COLLECT,
  })
  @IsEnum(SettleAction)
  action: SettleAction;
}

export class SettlementCalculationDetailsDto {
  @ApiProperty({ example: 8500.0 })
  reviewedBillAmount: number;

  @ApiProperty({ example: 8500.0 })
  insurerLiability: number;

  @ApiProperty({ example: 200.0 })
  deductible: number;

  @ApiProperty({ example: 830.0 })
  copayAmount: number;

  @ApiProperty({ example: 1030.0 })
  userCostShare: number;

  @ApiProperty({ example: 7470.0 })
  platformExpectedPay: number;

  @ApiProperty({ example: 8500.0 })
  cardPaidAmount: number;

  @ApiProperty({ example: 1030.0 })
  difference: number;
}

export class SettleResponseDataDto {
  @ApiProperty({ example: 'settlement-uuid' })
  id: string;

  @ApiProperty({ example: 'case-uuid' })
  caseId: string;

  @ApiProperty({ enum: SettleAction, example: SettleAction.COLLECT })
  type: string;

  @ApiProperty({ example: 1030.0 })
  amount: number;

  @ApiProperty({ example: 'VND' })
  currency: string;

  @ApiProperty({ example: 'PENDING' })
  status: string;

  @ApiProperty({ example: 'https://checkout.airwallex.com/pay/abc123', nullable: true })
  paymentLinkUrl: string | null;

  @ApiProperty({ type: SettlementCalculationDetailsDto })
  calculationDetails: SettlementCalculationDetailsDto;

  @ApiProperty({ example: '2024-01-22T11:00:00Z' })
  createdAt: Date;
}

export class CreateSettleResponseDto {
  @ApiProperty({ type: SettleResponseDataDto })
  data: SettleResponseDataDto;
}
