import { ApiProperty } from '@nestjs/swagger';
import { CardStatus, AuthorizationControls } from '../interfaces/card.interface';

export class CardResponseDto {
  @ApiProperty({ description: 'Card ID' })
  id: string;

  @ApiProperty({ description: 'Case ID' })
  caseId: string;

  @ApiProperty({ description: 'Cardholder ID' })
  cardholderId: string;

  @ApiProperty({ description: 'Airwallex card ID' })
  airwallexCardId: string;

  @ApiProperty({ enum: CardStatus, description: 'Card status' })
  status: CardStatus;

  @ApiProperty({ description: 'Spending limit amount' })
  limitAmount: number;

  @ApiProperty({ description: 'Currency code (ISO 4217)' })
  limitCurrency: string;

  @ApiProperty({ description: 'Amount already used' })
  usedAmount: number;

  @ApiProperty({ description: 'Card activation start date' })
  activeFrom: Date;

  @ApiProperty({ description: 'Card expiration date' })
  activeTo: Date;

  @ApiProperty({
    description: 'Authorization controls (JSON object with flexible schema)',
    type: Object,
    additionalProperties: true,
  })
  authorizationControls: AuthorizationControls;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;
}
