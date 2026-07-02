import { Controller, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from '../../modules/auth/auth.service';
import { JwtAuthGuard, RolesGuard } from '../../common/guards';
import { Roles } from '../../common/decorators';
import { UserRole } from '../../modules/auth/auth.interface';

@ApiTags('Ops Users')
@Controller('ops/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OPS_ADMIN)
@ApiBearerAuth()
export class OpsUsersController {
  constructor(private readonly authService: AuthService) {}

  // @Get()
  // @ApiOperation({ summary: 'List all users (admin only)' })
  // @ApiResponse({ status: 200, description: 'List of users', type: [UserResponseDto] })
  // @ApiResponse({ status: 403, description: 'Forbidden - admin only' })
  // async listUsers(@Query('status') status?: UserStatus): Promise<UserResponseDto[]> {
  //   const users = await this.authService.listUsers(status);
  //   return users.map((user) => this.toDto(user));
  // }

  // @Patch(':id')
  // @ApiOperation({ summary: 'Update user status (admin only)' })
  // @ApiResponse({ status: 200, description: 'User status updated', type: UserResponseDto })
  // @ApiResponse({ status: 400, description: 'User not found' })
  // @ApiResponse({ status: 403, description: 'Forbidden - admin only' })
  // async updateUserStatus(
  //   @Param('id') id: string,
  //   @Body() dto: UpdateUserStatusDto,
  // ): Promise<UserResponseDto> {
  //   const user = await this.authService.updateUserStatus(id, dto.status);
  //   return this.toDto(user);
  // }

  // private toDto(user: User): UserResponseDto {
  //   return {
  //     id: user.id,
  //     email: user.email,
  //     fullName: user.fullName,
  //     role: user.role,
  //     status: user.status,
  //     createdAt: user.createdAt,
  //   };
  // }
}
