import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import {
  ClaimsService,
  OpsClaimsQueryDto,
  GetOpsClaimsResponseDto,
  GetOpsClaimDetailResponseDto,
  ReviewClaimDto,
  ReviewClaimResponseDto,
} from 'src/modules/claims';
import { CurrentUser } from 'src/common';
import { JwtAuthGuard, RolesGuard, Roles } from 'src/common';
import { User, UserRole } from 'src/modules/users/users.interface';

@ApiTags('Ops Claims')
@Controller('ops/claims')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OpsClaimsController {
  constructor(private readonly claimsService: ClaimsService) {}

  @Get()
  @Roles(UserRole.OPS_REVIEWER, UserRole.OPS_ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List all claims for review' })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search by claim id, case id, hospital name, user name, or user email',
  })
  @ApiResponse({
    status: 200,
    description: 'Claims retrieved successfully',
    type: GetOpsClaimsResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - ops users only' })
  async getClaims(@Query() query: OpsClaimsQueryDto): Promise<GetOpsClaimsResponseDto> {
    const { page = 1, limit = 20, status, search } = query;

    const result = await this.claimsService.findAllForOps({
      page,
      limit,
      status,
      keyword: search?.trim() || undefined,
    });

    return {
      data: result.claims.map((claim) => ({
        id: claim.id,
        case: {
          id: claim.case.id,
          hospitalName: claim.case.hospitalName,
          approvedAmount: claim.case.approvedAmount,
        },
        user: {
          id: claim.user.id,
          name: claim.user.name,
          email: claim.user.email,
        },
        billAmount: claim.billAmount,
        billDate: claim.billDate.toISOString().split('T')[0],
        status: claim.status,
        submittedAt: claim.submittedAt,
      })),
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    };
  }

  @Get(':id')
  @Roles(UserRole.OPS_REVIEWER, UserRole.OPS_ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get full claim details with transactions' })
  @ApiResponse({
    status: 200,
    description: 'Claim detail retrieved successfully',
    type: GetOpsClaimDetailResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - ops users only' })
  @ApiResponse({ status: 404, description: 'Claim not found' })
  async getClaimDetail(@Param('id') id: string): Promise<GetOpsClaimDetailResponseDto> {
    const result = await this.claimsService.findByIdForOps(id);

    return {
      data: {
        id: result.claim.id,
        case: {
          id: result.case.id,
          hospitalName: result.case.hospitalName,
          approvedAmount: result.case.approvedAmount,
          approvedCurrency: result.case.approvedCurrency,
        },
        user: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
        },
        billAmount: result.claim.billAmount,
        billCurrency: result.claim.billCurrency,
        billDate: result.claim.billDate.toISOString().split('T')[0],
        outOfPocketAmount: result.claim.outOfPocketAmount ?? null,
        reviewedBillAmount: result.claim.reviewedBillAmount ?? null,
        isValid: result.claim.isValid ?? null,
        reviewNotes: result.claim.reviewNotes ?? null,
        status: result.claim.status,
        documents: result.documents.map((doc) => ({
          id: doc.id,
          fileUrl: doc.fileUrl,
          fileName: doc.fileName,
          documentType: doc.documentType,
          fileSize: doc.fileSize,
        })),
        transactions: result.transactions.map((txn) => ({
          id: txn.id,
          amount: txn.amount,
          currency: txn.currency,
          merchantName: txn.merchantName,
          merchantCategory: txn.merchantCategory,
          status: txn.status,
          transactionAt: txn.transactionAt,
        })),
        settlementPreview: result.settlementPreview,
        submittedAt: result.claim.submittedAt ?? null,
      },
    };
  }

  @Post(':id/review')
  @Roles(UserRole.OPS_REVIEWER, UserRole.OPS_ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Review and validate a claim' })
  @ApiResponse({
    status: 200,
    description: 'Claim reviewed successfully',
    type: ReviewClaimResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request - reviewed amount exceeds bill amount' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - ops users only' })
  @ApiResponse({ status: 404, description: 'Claim not found' })
  async reviewClaim(
    @Param('id') id: string,
    @Body() dto: ReviewClaimDto,
    @CurrentUser() user: User,
  ): Promise<ReviewClaimResponseDto> {
    const result = await this.claimsService.reviewClaim(id, user.id, user.role, dto);

    return {
      data: {
        id: result.id,
        reviewedBillAmount: result.reviewedBillAmount,
        isValid: result.isValid,
        status: result.status,
        reviewedAt: result.reviewedAt,
      },
    };
  }
}
