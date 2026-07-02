import {
  IsString,
  IsEmail,
  IsOptional,
  IsEnum,
  IsDateString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CardholderType } from '../interfaces/cardholder.interface';

export class AddressDto {
  @ApiProperty({ description: 'Street address line 1' })
  @IsString()
  streetAddress: string;

  @ApiPropertyOptional({ description: 'Street address line 2' })
  @IsString()
  @IsOptional()
  streetAddress2?: string;

  @ApiProperty({ description: 'City' })
  @IsString()
  city: string;

  @ApiProperty({ description: 'State or province' })
  @IsString()
  state: string;

  @ApiProperty({ description: 'Postal code' })
  @IsString()
  postalCode: string;

  @ApiProperty({ description: 'Country code (ISO 3166-1 alpha-2)' })
  @IsString()
  countryCode: string;
}

export class CreateCardholderDto {
  @ApiProperty({ description: 'First name of the cardholder' })
  @IsString()
  firstName: string;

  @ApiProperty({ description: 'Last name of the cardholder' })
  @IsString()
  lastName: string;

  @ApiProperty({ description: 'Email address of the cardholder' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Phone number (E.164 format)' })
  @IsString()
  phoneNumber: string;

  @ApiProperty({ description: 'Date of birth (ISO 8601 format)' })
  @IsDateString()
  dateOfBirth: string;

  @ApiProperty({ description: 'Cardholder address', type: AddressDto })
  @ValidateNested()
  @Type(() => AddressDto)
  address: AddressDto;

  @ApiPropertyOptional({
    description: 'Type of cardholder',
    enum: CardholderType,
    default: CardholderType.INDIVIDUAL,
  })
  @IsEnum(CardholderType)
  @IsOptional()
  type?: CardholderType;
}
