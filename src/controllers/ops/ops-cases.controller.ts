import {
  Controller,
  Get,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Body,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import {
  CasesService,
  GetOpsCasesQueryDto,
  GetOpsCasesResponseDto,
  GetOpsCaseDetailResponseDto,
  CaseStatus,
  PreapproveCaseDto,
  RejectCaseDto,
  Case,
} from 'src/modules/cases';
import { SettlementsService, CreateSettleDto, Settlement } from 'src/modules/settlements';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser } from 'src/common';
import { User, UserRole } from 'src/modules/users/users.interface';

@ApiTags('Ops Cases')
@Controller('ops/cases')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OpsCasesController {
  constructor(
    private readonly casesService: CasesService,
    private readonly settlementsService: SettlementsService,
  ) {}

  @Post(':id/preapprove')
  @Roles(UserRole.OPS_ADMIN, UserRole.OPS_REVIEWER)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Preapprove a case and issue a card' })
  @ApiResponse({
    status: 200,
    description: 'Case preapproved and card issued successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid case status or card creation failed',
  })
  @ApiResponse({ status: 404, description: 'Case not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - admin only' })
  async preapproveCase(
    @Param('id') caseId: string,
    @CurrentUser() user: User,
    @Body() dto: PreapproveCaseDto,
  ): Promise<{ data: Case }> {
    const case_ = await this.casesService.preapproveCase(caseId, user.id, dto, user.role);
    return { data: case_ };
  }

  @Post(':id/reject')
  @Roles(UserRole.OPS_REVIEWER, UserRole.OPS_ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject a submitted case' })
  @ApiResponse({
    status: 200,
    description: 'Case rejected successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid case status for rejection',
  })
  @ApiResponse({ status: 404, description: 'Case not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - requires OPS or ADMIN role' })
  async rejectCase(
    @Param('id') caseId: string,
    @CurrentUser() user: User,
    @Body() dto: RejectCaseDto,
  ): Promise<{ data: Case }> {
    const case_ = await this.casesService.rejectCase(caseId, user.id, dto);
    return { data: case_ };
  }

  @Get()
  @Roles(UserRole.OPS_REVIEWER, UserRole.OPS_ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List all cases for ops review' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Comma-separated case statuses',
    type: String,
  })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiQuery({
    name: 'fromDate',
    required: false,
    type: String,
    description: 'Filter by created date (from)',
  })
  @ApiQuery({
    name: 'toDate',
    required: false,
    type: String,
    description: 'Filter by created date (to)',
  })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search by case id, hospital name, user name, or user email',
  })
  @ApiResponse({
    status: 200,
    description: 'Cases retrieved successfully',
    type: GetOpsCasesResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - requires OPS or ADMIN role' })
  async getCases(@Query() query: GetOpsCasesQueryDto): Promise<GetOpsCasesResponseDto> {
    // Parse comma-separated statuses
    const statuses = query.status
      ? query.status.split(',').map((s) => s.trim() as CaseStatus)
      : undefined;

    // Parse dates
    const fromDate = query.fromDate ? new Date(query.fromDate) : undefined;
    const toDate = query.toDate ? new Date(query.toDate) : undefined;

    const { cases, total } = await this.casesService.findAllForOps({
      page: query.page || 1,
      limit: query.limit || 20,
      statuses,
      userId: query.userId,
      fromDate,
      toDate,
      sortBy: query.sortBy || 'createdAt',
      sortOrder: query.sortOrder || 'desc',
      keyword: query.search?.trim() || undefined,
    });

    const totalPages = Math.ceil(total / (query.limit || 20));

    return {
      data: cases.map((caseRecord) => ({
        id: caseRecord.id,
        user: {
          id: caseRecord.userId,
          name: caseRecord.userName,
          email: caseRecord.userEmail,
        },
        hospitalName: caseRecord.hospitalName,
        plannedVisitAt: caseRecord.plannedVisitAt,
        reasonCategory: caseRecord.reasonCategory,
        status: caseRecord.status,
        createdAt: caseRecord.createdAt,
        submittedAt: caseRecord.submittedAt ?? null,
      })),
      meta: {
        total,
        page: query.page || 1,
        limit: query.limit || 20,
        totalPages,
      },
    };
  }

  @Get(':id')
  @Roles(UserRole.OPS_REVIEWER, UserRole.OPS_ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get full case details for ops' })
  @ApiResponse({
    status: 200,
    description: 'Case details retrieved successfully',
    type: GetOpsCaseDetailResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - requires OPS or ADMIN role' })
  @ApiResponse({ status: 404, description: 'Case not found' })
  async getCaseDetail(@Param('id') caseId: string): Promise<GetOpsCaseDetailResponseDto> {
    const result = await this.casesService.findByIdForOps(caseId);

    const {
      case: caseRecord,
      user,
      limits,
      coverageTier,
      card,
      claim,
      settlement,
      auditLogs,
    } = result;

    return {
      data: {
        id: caseRecord.id,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone ?? null,
          bankAccountNumber: user.bankAccountNumber ?? null,
          bankCode: user.bankCode ?? null,
        },
        hospitalName: caseRecord.hospitalName,
        plannedVisitAt: caseRecord.plannedVisitAt,
        reasonCategory: caseRecord.reasonCategory,
        contactPhone: caseRecord.contactPhone ?? null,
        notes: caseRecord.notes ?? null,
        status: caseRecord.status,
        approvedAmount: caseRecord.approvedAmount ?? null,
        approvedCurrency: caseRecord.approvedCurrency ?? null,
        bufferAmount: caseRecord.bufferAmount ?? null,
        userLimits: {
          perCase: limits.perCase,
          remainingToday: limits.remainingToday,
          remainingThisYear: limits.remainingThisYear,
        },
        coverageTier: coverageTier
          ? {
              id: coverageTier.id as string,
              label: coverageTier.label as string,
              amount: coverageTier.amount as number,
            }
          : null,
        card: card
          ? {
              id: card.id as string,
              status: card.status as string,
              limitAmount: card.limitAmount as number,
              limitCurrency: card.limitCurrency as string,
              usedAmount: card.usedAmount as number,
              activeFrom: card.activeFrom as Date,
              activeTo: card.activeTo as Date,
            }
          : null,
        claim: claim
          ? {
              id: claim.id as string,
              billAmount: claim.billAmount as number,
              status: claim.status as string,
              createdAt: claim.createdAt as Date,
            }
          : null,
        settlement: settlement
          ? {
              id: settlement.id as string,
              type: settlement.type as string,
              amount: settlement.amount as number,
              status: settlement.status as string,
              paymentLinkUrl: (settlement.paymentLinkUrl as string | null) ?? null,
            }
          : null,
        auditLogs: auditLogs.map((log) => ({
          action: log.action,
          actor: log.actor,
          timestamp: log.timestamp,
        })),
        createdAt: caseRecord.createdAt,
        submittedAt: caseRecord.submittedAt ?? null,
        approvedAt: caseRecord.approvedAt ?? null,
      },
    };
  }

  @Post(':id/settle')
  @Roles(UserRole.OPS_REVIEWER, UserRole.OPS_ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create settlement for a case' })
  @ApiResponse({
    status: 201,
    description: 'Settlement created successfully',
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad request - invalid case status, settlement already exists, or missing bank details for payout',
  })
  @ApiResponse({ status: 404, description: 'Case, claim, or user not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - OPS admin only' })
  async settle(
    @Param('id') caseId: string,
    @CurrentUser() user: User,
    @Body() dto: CreateSettleDto,
  ): Promise<{ data: Settlement }> {
    const settlement = await this.settlementsService.settle(caseId, user.id, user.role, dto.action);
    return { data: settlement };
  }
}
