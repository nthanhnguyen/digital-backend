import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Param,
  Get,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import {
  CasesService,
  CreateCaseDto,
  CaseResponseDto,
  SubmitCaseResponseDto,
  GetCasesQueryDto,
  GetCasesResponseDto,
  GetCaseDetailResponseDto,
  CaseStatus,
  CardDetailsResponseDto,
} from 'src/modules/cases';
import { JwtAuthGuard, CurrentUser, NotFoundError } from 'src/common';
import {
  Card,
  CardsService,
  CardStatusForAirwallex,
  GetCardDetailsResponseDto,
} from 'src/modules/cards';
import { User } from 'src/modules/users/users.interface';
import {
  ClaimsService,
  SubmitClaimDto,
  SubmitClaimDataResponseDto,
  GetClaimDetailResponseDto,
} from 'src/modules/claims';
import { Cardholder } from 'src/modules/card_holders/interfaces/cardholder.interface';
import { CardholdersService } from 'src/modules/card_holders/services/cardholders.service';
import { AuditLogsService } from 'src/modules/audit-logs';

@ApiTags('Mobile Cases')
@Controller('mobile/cases')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MobileCasesController {
  constructor(
    private readonly casesService: CasesService,
    private readonly cardsService: CardsService,
    private readonly cardholdersService: CardholdersService,
    private readonly claimsService: ClaimsService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "List current user's cases" })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: CaseStatus,
  })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @ApiResponse({
    status: 200,
    description: 'Cases retrieved successfully',
    type: GetCasesResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getCases(
    @CurrentUser() user: User,
    @Query() query: GetCasesQueryDto,
  ): Promise<GetCasesResponseDto> {
    const { cases, total } = await this.casesService.findByUserId(user.id, {
      page: query.page || 1,
      limit: query.limit || 20,
      status: query.status,
      sortBy: query.sortBy || 'createdAt',
      sortOrder: query.sortOrder || 'desc',
    });

    const totalPages = Math.ceil(total / (query.limit || 20));

    return {
      data: cases.map((caseRecord) => ({
        id: caseRecord.id,
        hospitalName: caseRecord.hospitalName,
        plannedVisitAt: caseRecord.plannedVisitAt,
        reasonCategory: caseRecord.reasonCategory,
        status: caseRecord.status,
        approvedAmount: caseRecord.approvedAmount ?? null,
        approvedCurrency: caseRecord.approvedCurrency,
        createdAt: caseRecord.createdAt,
        updatedAt: caseRecord.updatedAt,
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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get case details' })
  @ApiResponse({
    status: 200,
    description: 'Case details retrieved successfully',
    type: GetCaseDetailResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Case not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getCaseDetail(
    @CurrentUser() user: User,
    @Param('id') caseId: string,
  ): Promise<GetCaseDetailResponseDto> {
    const [result, auditLogs] = await Promise.all([
      this.casesService.findByIdWithRelations(caseId, user.id),
      this.auditLogsService.findByEntity('case', caseId),
    ]);

    const { case: caseRecord, coverageTier, card, claim, settlement } = result;

    return {
      data: {
        id: caseRecord.id,
        hospitalName: caseRecord.hospitalName,
        plannedVisitAt: caseRecord.plannedVisitAt,
        reasonCategory: caseRecord.reasonCategory,
        contactPhone: caseRecord.contactPhone,
        notes: caseRecord.notes,
        status: caseRecord.status,
        approvedAmount: caseRecord.approvedAmount ?? null,
        approvedCurrency: caseRecord.approvedCurrency,
        bufferAmount: caseRecord.bufferAmount ?? null,
        coverageTier: coverageTier
          ? {
              id: coverageTier.id as string,
              label: coverageTier.label as string,
              amount: coverageTier.amount as number,
            }
          : undefined,
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
          : undefined,
        claim: claim
          ? {
              id: claim.id as string,
              billAmount: claim.billAmount as number,
              status: claim.status as string,
              createdAt: claim.createdAt as Date,
            }
          : undefined,
        settlement: settlement
          ? {
              id: settlement.id as string,
              type: settlement.type as string,
              amount: settlement.amount as number,
              status: settlement.status as string,
              paymentLinkUrl: (settlement.paymentLinkUrl as string | null) ?? null,
            }
          : null,
        createdAt: caseRecord.createdAt,
        submittedAt: caseRecord.submittedAt ?? null,
        approvedAt: caseRecord.approvedAt ?? null,
        timeline: auditLogs.map((log) => ({
          id: log.id,
          actorType: log.actorType,
          action: log.action,
          createdAt: log.createdAt,
        })),
      },
    };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new pre-hospital case' })
  @ApiResponse({ status: 201, description: 'Case created successfully', type: CaseResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createCase(
    @CurrentUser() user: User,
    @Body() dto: CreateCaseDto,
  ): Promise<{ data: CaseResponseDto }> {
    const caseRecord = await this.casesService.create({
      userId: user.id,
      hospitalName: dto.hospitalName,
      plannedVisitAt: new Date(dto.plannedVisitAt),
      reasonCategory: dto.reasonCategory,
      contactPhone: dto.contactPhone,
      notes: dto.notes,
    });

    return {
      data: {
        id: caseRecord.id,
        hospitalName: caseRecord.hospitalName,
        plannedVisitAt: caseRecord.plannedVisitAt,
        reasonCategory: caseRecord.reasonCategory,
        contactPhone: caseRecord.contactPhone,
        notes: caseRecord.notes,
        status: caseRecord.status,
        createdAt: caseRecord.createdAt,
        approvedAmount: caseRecord.approvedAmount ?? null,
        approvedCurrency: caseRecord.approvedCurrency,
      },
    };
  }

  @Post(':id/submit')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit a draft case for review' })
  @ApiResponse({
    status: 200,
    description: 'Case submitted successfully',
    type: SubmitCaseResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Case is not in DRAFT status' })
  @ApiResponse({ status: 404, description: 'Case not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async submitCase(
    @CurrentUser() user: User,
    @Param('id') caseId: string,
  ): Promise<{ data: SubmitCaseResponseDto }> {
    const caseRecord = await this.casesService.submitCase(caseId, user.id);

    return {
      data: {
        id: caseRecord.id,
        status: caseRecord.status,
        submittedAt: caseRecord.submittedAt!,
      },
    };
  }

  @Get(':id/card/iframe')
  @ApiOperation({
    summary: 'Get secure iframe configuration for displaying card details',
    description:
      'Returns a secure iframe URL using Airwallex PAN delegation. The iframe displays card number, expiry, and CVV in a PCI-compliant manner.',
  })
  @ApiQuery({
    name: 'lang',
    required: false,
    enum: ['en', 'zh', 'zh-Hant'],
    description: 'Language for the iframe (default: en)',
    example: 'en',
  })
  @ApiResponse({
    status: 200,
    description: 'Card iframe configuration retrieved successfully',
    type: CardDetailsResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Case or card not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - case does not belong to user' })
  async getCardIframe(
    @Param('id') caseId: string,
    @CurrentUser() user: User,
    @Query('lang') lang?: 'en' | 'zh' | 'zh-Hant',
  ): Promise<{ data: CardDetailsResponseDto }> {
    // Get the case
    const case_ = await this.casesService.getCaseById(caseId);

    // Verify the case belongs to the user
    if (case_.userId !== user.id) {
      throw new NotFoundError('Case not found', 'CASE_NOT_FOUND');
    }

    // Get card for the case
    const card = await this.cardsService.getCardByCaseId(caseId);

    // Get card iframe configuration using PAN delegation
    // This creates a secure token and returns the iframe URL
    const cardDetails = await this.cardsService.getCardIframe(card.id, {
      langKey: lang || 'en',
      // Optional: Add styling rules here if needed
      rules: {
        '.details': {
          backgroundColor: 'transparent',
          color: '#64748B',
          fontFamily: 'Inter',
          fontSize: '16px',
          lineHeight: '24px',
          fontWeight: '400',
          marginTop: '8px',
          marginBottom: '-8px',
        },
        '.details__row': {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#F8FAFC',
          borderRadius: '10px',
          padding: '18px 20px',
          marginBottom: '8px',
        },
        '.details__content': { display: 'flex', flexDirection: 'column', marginLeft: '-24px' },
        '.details__label': {
          width: '100px',
          fontWeight: '400',
          marginLeft: '32px',
          marginTop: '-8px',
        },
        '.details__value': {
          color: '#0F172A',
          fontWeight: '500',
          fontSize: '16px',
          lineHeight: '20px',
          marginLeft: '32px',
          marginTop: '4px',
        },
        '.details__button': {
          width: '100%',
        },
        '.details__button svg': {
          color: '#64748B',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        },
      },
    });

    return {
      data: cardDetails,
    };
  }

  @Post(':id/claim')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit a claim for a case' })
  @ApiResponse({
    status: 201,
    description: 'Claim submitted successfully',
    type: SubmitClaimDataResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Case is not in CARD_ISSUED or PAID status' })
  @ApiResponse({ status: 400, description: 'Claim already exists for this case' })
  @ApiResponse({ status: 404, description: 'Case not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async submitClaim(
    @CurrentUser() user: User,
    @Param('id') caseId: string,
    @Body() dto: SubmitClaimDto,
  ): Promise<SubmitClaimDataResponseDto> {
    const card: Card = await this.cardsService.getCardByCaseId(caseId);
    const airwallexCard = await this.cardsService.getAirwallexCardById(card.airwallexCardId);
    const cardholder: Cardholder = await this.cardholdersService.getCardholderByUserId(user.id);
    let response: SubmitClaimDataResponseDto;

    try {
      const { claim, documents } = await this.claimsService.submitClaim(caseId, user.id, dto);
      await this.cardsService.updateAirwallexCard(card.airwallexCardId, {
        cardholderId: cardholder.airwallexCardholderId,
        status: CardStatusForAirwallex.INACTIVE,
      });

      response = {
        data: {
          id: claim.id,
          caseId: claim.caseId,
          billAmount: claim.billAmount,
          billCurrency: claim.billCurrency,
          billDate: claim.billDate.toISOString().split('T')[0],
          status: claim.status,
          documents: documents.map((doc) => ({
            id: doc.id,
            fileName: doc.fileName,
            documentType: doc.documentType,
          })),
          submittedAt: claim.submittedAt!,
        },
      };
    } catch (error) {
      await this.cardsService.updateAirwallexCard(card.airwallexCardId, {
        cardholderId: cardholder.airwallexCardholderId,
        status: airwallexCard.card_status as unknown as CardStatusForAirwallex,
      });
      throw error;
    }

    try {
      await this.cardsService.updateCard(card.id, {
        cardholderId: cardholder.id,
        status: CardStatusForAirwallex.INACTIVE,
      });
    } catch (error) {
      await this.cardsService.updateCard(card.id, {
        cardholderId: cardholder.id,
        status: card.status as unknown as CardStatusForAirwallex,
      });
      throw error;
    }

    return response;
  }

  @Get(':id/claim')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get claim details for a case' })
  @ApiResponse({
    status: 200,
    description: 'Claim details retrieved successfully',
    type: GetClaimDetailResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Case or claim not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getClaimDetail(
    @CurrentUser() user: User,
    @Param('id') caseId: string,
  ): Promise<GetClaimDetailResponseDto> {
    const { claim, documents } = await this.claimsService.getClaimByCaseId(caseId, user.id);

    return {
      data: {
        id: claim.id,
        caseId: claim.caseId,
        billAmount: claim.billAmount,
        billCurrency: claim.billCurrency,
        billDate: claim.billDate.toISOString().split('T')[0],
        outOfPocketAmount: claim.outOfPocketAmount ?? null,
        reviewedBillAmount: claim.reviewedBillAmount ?? null,
        isValid: claim.isValid ?? null,
        status: claim.status,
        documents: documents.map((doc) => ({
          id: doc.id,
          fileUrl: doc.fileUrl,
          fileName: doc.fileName,
          documentType: doc.documentType,
          fileSize: doc.fileSize,
        })),
        submittedAt: claim.submittedAt ?? null,
        reviewedAt: claim.reviewedAt ?? null,
      },
    };
  }

  @Get(':caseId/card')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get card details (name, last 4 digits, expiry, limit, available balance)',
  })
  @ApiResponse({
    status: 200,
    description: 'Card details retrieved',
    type: GetCardDetailsResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Card not found' })
  async getCardDetails(@Param('caseId') caseId: string): Promise<GetCardDetailsResponseDto> {
    const card = await this.cardsService.getCardByCaseId(caseId);
    return await this.cardsService.getCardDetails(card.id);
  }
}
