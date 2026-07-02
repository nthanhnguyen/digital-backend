import { Controller, Get, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, RolesGuard, Roles } from 'src/common';
import { UserRole } from 'src/modules/users/users.interface';
import { CoverageTiersService, GetCoverageTiersResponseDto } from 'src/modules/coverage-tiers';

@ApiTags('Ops Config')
@Controller('ops/config')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OpsConfigController {
  constructor(private readonly coverageTiersService: CoverageTiersService) {}

  @Get('tiers')
  @Roles(UserRole.OPS_REVIEWER, UserRole.OPS_ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List coverage tiers' })
  @ApiResponse({
    status: 200,
    description: 'Coverage tiers retrieved successfully',
    type: GetCoverageTiersResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - requires OPS role' })
  async getCoverageTiers(): Promise<GetCoverageTiersResponseDto> {
    const tiers = await this.coverageTiersService.findAll();

    return {
      data: tiers.map((tier) => ({
        id: tier.id,
        label: tier.label,
        amount: tier.amount,
        currency: tier.currency,
        isActive: tier.isActive,
        sortOrder: tier.sortOrder,
      })),
    };
  }
}
