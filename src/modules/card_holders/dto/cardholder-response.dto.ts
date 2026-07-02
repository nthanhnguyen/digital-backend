import { ApiProperty } from '@nestjs/swagger';
import { CardholderType, CardholderStatus } from '../interfaces/cardholder.interface';

export class CardholderResponseDto {
  @ApiProperty({ description: 'Cardholder ID' })
  id: string;

  @ApiProperty({ description: 'User ID' })
  userId: string;

  @ApiProperty({ description: 'Airwallex cardholder ID' })
  airwallexCardholderId: string;

  @ApiProperty({ enum: CardholderType, description: 'Cardholder type' })
  type: CardholderType;

  @ApiProperty({ enum: CardholderStatus, description: 'Cardholder status' })
  status: CardholderStatus;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;
}
