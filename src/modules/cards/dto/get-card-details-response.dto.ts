import { ApiProperty } from '@nestjs/swagger';

export class GetCardDetailsResponseDto {
  @ApiProperty({
    description: 'Name on card (cardholder name)',
    example: 'John Smith',
  })
  cardholderName: string;

  @ApiProperty({
    description: 'Last 4 digits of the card number',
    example: '4111',
  })
  last4Digits: string;

  @ApiProperty({
    description:
      'Card expiry date (MM/YY). Null if card is not active (sensitive details not available).',
    example: '12/25',
    nullable: true,
  })
  expiryDate: string | null;

  @ApiProperty({
    description: 'Credit card spending limit amount',
    example: 10000,
  })
  limitAmount: number;

  @ApiProperty({
    description: 'Currency code for limit and available balance (ISO 4217)',
    example: 'VND',
  })
  limitCurrency: string;

  @ApiProperty({
    description: 'Available balance (limit amount minus used amount)',
    example: 7500,
  })
  availableBalance: number;
}
