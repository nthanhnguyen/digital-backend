import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import {
  AuthService,
  OpsGoogleLoginDto,
  JwtPayload,
  LoginResponseDto,
  LoginType,
} from 'src/modules/auth';
import { AUTH_CONSTANTS } from 'src/modules/auth/auth.const';

@ApiTags('Ops Auth')
@Controller('ops/auth')
export class OpsAuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
  ) {}

  @Post('google')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate user with Google OAuth token for ops' })
  @ApiResponse({ status: 200, description: 'Login successful', type: LoginResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid Google token' })
  async loginGoogle(@Body() dto: OpsGoogleLoginDto): Promise<{ data: LoginResponseDto }> {
    const user = await this.authService.validateGoogleToken(dto.idToken, LoginType.PORTAL);

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      data: {
        accessToken,
        expiresIn: AUTH_CONSTANTS.JWT_EXPIRATION_SECONDS,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      },
    };
  }
}
