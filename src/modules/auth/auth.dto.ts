import { IsString, IsNotEmpty, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from '../users/users.dto';

export enum MobilePlatform {
  IOS = 'ios',
  ANDROID = 'android',
}

export class GoogleLoginDto {
  @ApiProperty({ example: 'eyJhbGciOiJSUzI1NiIsInR5cCI6...' })
  @IsString()
  @IsNotEmpty()
  idToken: string;

  @ApiProperty({ enum: MobilePlatform, example: MobilePlatform.IOS })
  @IsEnum(MobilePlatform)
  platform: MobilePlatform;
}

export class OpsGoogleLoginDto {
  @ApiProperty({ example: 'eyJhbGciOiJSUzI1NiIsInR5cCI6...' })
  @IsString()
  @IsNotEmpty()
  idToken: string;
}

export class LoginResponseDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty({ example: 604800 })
  expiresIn: number;

  @ApiProperty({ type: UserResponseDto })
  user: UserResponseDto;
}
