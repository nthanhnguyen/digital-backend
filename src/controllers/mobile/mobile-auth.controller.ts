import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import {
  AuthService,
  GoogleLoginDto,
  MobilePlatform,
  JwtPayload,
  LoginResponseDto,
  UserDetailResponseDto,
  User,
  UpdateUserProfileDto,
  LoginType,
} from 'src/modules/auth';
import { AUTH_CONSTANTS } from 'src/modules/auth/auth.const';
import { JwtAuthGuard, CurrentUser } from 'src/common';
import { UsersService } from 'src/modules/users';

@ApiTags('Mobile Auth')
@Controller('mobile/auth')
export class MobileAuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) {}

  @Post('google')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate user with Google OAuth token' })
  @ApiResponse({ status: 200, description: 'Login successful', type: LoginResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid Google token' })
  async loginGoogle(@Body() dto: GoogleLoginDto): Promise<{ data: LoginResponseDto }> {
    const loginType =
      dto.platform === MobilePlatform.IOS ? LoginType.MOBILE_IOS : LoginType.MOBILE_ANDROID;
    const user = await this.authService.validateGoogleToken(dto.idToken, loginType);

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

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user' })
  @ApiResponse({ status: 200, description: 'User profile', type: UserDetailResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getProfile(@CurrentUser() user: User): Promise<{ data: UserDetailResponseDto }> {
    return {
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role,
        bankAccountNumber: user.bankAccountNumber,
        bankCode: user.bankCode,
        bankName: user.bankName,
        createdAt: user.createdAt,
      },
    };
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({
    status: 200,
    description: 'Profile updated successfully',
    type: UserDetailResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateProfile(
    @CurrentUser() user: User,
    @Body() dto: UpdateUserProfileDto,
  ): Promise<{ data: UserDetailResponseDto }> {
    const updatedUser = await this.usersService.updateProfile(user.id, {
      phone: dto.phone,
      bankAccountNumber: dto.bankAccountNumber,
      bankCode: dto.bankCode,
      bankName: dto.bankName,
    });

    return {
      data: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        phone: updatedUser.phone,
        role: updatedUser.role,
        bankAccountNumber: updatedUser.bankAccountNumber,
        bankCode: updatedUser.bankCode,
        bankName: updatedUser.bankName,
        createdAt: updatedUser.createdAt,
      },
    };
  }
}
