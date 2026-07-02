import { IsString, MaxLength, IsNotEmpty } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RejectCaseDto {
  @ApiPropertyOptional({
    description: 'Reason for rejecting the case',
    example: 'Insufficient documentation',
    maxLength: 2000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  rejectionReason?: string;
}
