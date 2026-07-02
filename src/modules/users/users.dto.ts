import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { UserRole } from './users.interface';

export class UserResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: UserRole })
  role: UserRole;
}

export class UserDetailResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ required: false })
  phone?: string;

  @ApiProperty({ enum: UserRole })
  role: UserRole;

  @ApiProperty({ required: false })
  bankAccountNumber?: string;

  @ApiProperty({ required: false })
  bankCode?: string;

  @ApiProperty({ required: false })
  bankName?: string;

  @ApiProperty()
  createdAt: Date;
}

export class UpdateUserProfileDto {
  @ApiProperty({ required: false, example: '+84 912 345 678' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ required: false, example: '123-456-789' })
  @IsOptional()
  @IsString()
  bankAccountNumber?: string;

  @ApiProperty({ required: false, example: '004' })
  @IsOptional()
  @IsString()
  bankCode?: string;

  @ApiProperty({ required: false, example: 'HSBC' })
  @IsOptional()
  @IsString()
  bankName?: string;
}
