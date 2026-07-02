import { Injectable } from '@nestjs/common';
import {
  LoggerService,
  isDateInFutureVN,
  parseDateVN,
  calculateSettlementPreview,
  NotFoundError,
  BadRequestError,
  ERRORS,
} from 'src/common';
import { ClaimsRepository } from './claims.repository';
import { CasesRepository } from '../cases/cases.repository';
import { Claim, ClaimDocument, ClaimStatus } from './claims.interface';
import { SubmitClaimDto, SettlementType } from './claims.dto';
import { ReviewClaimDto } from './claims.dto';
import { BACKWARD_TRANSITIONS, CASE_STATUS_TRANSITIONS } from '../cases/cases.const';
import { CaseStatus } from '../cases/cases.interface';
import { StateMachineValidator } from 'src/common/state-machine';
import { AuditLogsService } from '../audit-logs';
import { CardsRepository } from '../cards';
import { CardTransactionsRepository, CardTransactionRecord } from '../webhooks';
import { UserRole, UsersService } from '../users';
import { CostShareRulesRepository, CostShareRule } from '../cost-share-rules';

@Injectable()
export class ClaimsService {
  private readonly stateMachine: StateMachineValidator<CaseStatus>;

  constructor(
    private readonly claimsRepository: ClaimsRepository,
    private readonly casesRepository: CasesRepository,
    private readonly auditLogsService: AuditLogsService,
    private readonly cardsRepository: CardsRepository,
    private readonly cardTransactionsRepository: CardTransactionsRepository,
    private readonly usersService: UsersService,
    private readonly costShareRulesRepository: CostShareRulesRepository,
    private readonly logger: LoggerService,
  ) {
    // Initialize state machine validator
    this.stateMachine = new StateMachineValidator<CaseStatus>({
      transitions: CASE_STATUS_TRANSITIONS,
      backwardTransitions: BACKWARD_TRANSITIONS,
      invalidTransitionErrorCode: 'CASE_001',
      unauthorizedBackwardErrorCode: 'AUTH_004',
    });
  }

  async submitClaim(
    caseId: string,
    userId: string,
    dto: SubmitClaimDto,
  ): Promise<{ claim: Claim; documents: ClaimDocument[] }> {
    this.logger.info('Submitting claim', { caseId, userId });

    // 1. Validate case exists and belongs to user
    const caseRecord = await this.casesRepository.findById(caseId);
    if (!caseRecord) {
      throw new NotFoundError(ERRORS.CASE_002, 'CASE_002');
    }

    if (caseRecord.userId !== userId) {
      throw new NotFoundError(ERRORS.CASE_002, 'CASE_002');
    }

    // 2. Check if claim already exists
    const existingClaim = await this.claimsRepository.findByCaseId(caseId);
    if (existingClaim) {
      throw new BadRequestError(ERRORS.CLAIM_001, 'CLAIM_001');
    }

    // 3. Validate case status is CARD_ISSUED or PAID
    this.stateMachine.validate(caseRecord.status, CaseStatus.CLAIM_SUBMITTED);

    // 4. Validate bill date is not in future (using Vietnam timezone)
    if (isDateInFutureVN(dto.billDate)) {
      throw new BadRequestError(ERRORS.CLAIM_004, 'CLAIM_004');
    }
    const billDate = parseDateVN(dto.billDate);

    // 5. Validate bill currency (MVP only supports VND)
    if (dto.billCurrency !== 'VND') {
      throw new BadRequestError(ERRORS.CLAIM_005, 'CLAIM_005');
    }

    // 6. Validate declaration is accepted
    if (!dto.declarationAccepted) {
      throw new BadRequestError(ERRORS.CLAIM_006, 'CLAIM_006');
    }

    // 7. Create claim
    const claim = await this.claimsRepository.create({
      caseId,
      billAmount: dto.billAmount,
      billCurrency: dto.billCurrency,
      billDate,
      outOfPocketAmount: dto.outOfPocketAmount,
      declarationAccepted: dto.declarationAccepted,
      updatedBy: userId,
    });

    // 8. Create claim documents
    const documents = await this.claimsRepository.createDocuments(
      claim.id,
      dto.documents.map((doc) => ({
        fileUrl: doc.fileUrl,
        fileName: doc.fileName,
        fileType: doc.fileType,
        fileSize: doc.fileSize,
        documentType: doc.documentType,
      })),
    );

    // 9. Update case status to CLAIM_SUBMITTED
    await this.casesRepository.updateStatus(caseId, CaseStatus.CLAIM_SUBMITTED, userId);

    // 10. Log audit trail
    await this.auditLogsService.log({
      actorId: userId,
      actorType: UserRole.USER,
      action: 'CLAIM_SUBMITTED',
      entityType: 'case',
      entityId: caseId,
      afterState: {
        caseId,
        billAmount: claim.billAmount,
        billCurrency: claim.billCurrency,
        billDate: claim.billDate.toISOString(),
        outOfPocketAmount: claim.outOfPocketAmount,
        documentsCount: documents.length,
        status: claim.status,
      },
    });

    this.logger.info('Claim submitted successfully', {
      claimId: claim.id,
      caseId,
      documentsCount: documents.length,
    });

    return { claim, documents };
  }

  async getClaimByCaseId(
    caseId: string,
    userId: string,
  ): Promise<{ claim: Claim; documents: ClaimDocument[] }> {
    this.logger.info('Fetching claim for case', { caseId, userId });

    // 1. Validate case exists and belongs to user
    const caseRecord = await this.casesRepository.findById(caseId);
    if (!caseRecord) {
      throw new NotFoundError(ERRORS.CASE_002, 'CASE_002');
    }

    if (caseRecord.userId !== userId) {
      throw new NotFoundError(ERRORS.CASE_002, 'CASE_002');
    }

    // 2. Get claim for case
    const claim = await this.claimsRepository.findByCaseId(caseId);
    if (!claim) {
      throw new NotFoundError(ERRORS.CLAIM_003, 'CLAIM_003');
    }

    // 3. Get claim documents
    const documents = await this.claimsRepository.findDocumentsByClaimId(claim.id);

    this.logger.info('Claim fetched successfully', {
      claimId: claim.id,
      caseId,
      documentsCount: documents.length,
    });

    return { claim, documents };
  }

  async findAllForOps(params: {
    page: number;
    limit: number;
    status?: ClaimStatus;
    keyword?: string;
  }): Promise<{
    claims: Array<{
      id: string;
      billAmount: number;
      billDate: Date;
      status: ClaimStatus;
      submittedAt: Date | null;
      case: {
        id: string;
        hospitalName: string;
        approvedAmount: number | null;
      };
      user: {
        id: string;
        name: string;
        email: string;
      };
    }>;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    this.logger.info('Fetching claims for ops', params);

    const { claims, total } = await this.claimsRepository.findAllWithPagination(params);
    const totalPages = Math.ceil(total / params.limit);

    this.logger.info('Claims fetched for ops', { total, page: params.page, totalPages });

    return {
      claims,
      total,
      page: params.page,
      limit: params.limit,
      totalPages,
    };
  }

  async findByIdForOps(claimId: string): Promise<{
    claim: Claim;
    documents: ClaimDocument[];
    case: {
      id: string;
      hospitalName: string;
      approvedAmount: number | null;
      approvedCurrency: string | null;
    };
    user: {
      id: string;
      name: string;
      email: string;
    };
    transactions: CardTransactionRecord[];
    settlementPreview: {
      reviewedBillAmount: number;
      insurerLiability: number;
      deductible: number;
      copayAmount: number;
      userCostShare: number;
      platformExpectedPay: number;
      cardPaidAmount: number;
      difference: number;
      settlementType: SettlementType;
    } | null;
  }> {
    this.logger.info('Fetching claim detail for ops', { claimId });

    // 1. Get claim by ID
    const claim = await this.claimsRepository.findById(claimId);
    if (!claim) {
      throw new NotFoundError(ERRORS.CLAIM_003, 'CLAIM_003');
    }

    // 2. Get claim documents
    const documents = await this.claimsRepository.findDocumentsByClaimId(claimId);

    // 3. Get case details
    const caseRecord = await this.casesRepository.findById(claim.caseId);
    if (!caseRecord) {
      throw new NotFoundError(ERRORS.CASE_002, 'CASE_002');
    }

    // 4. Get user details
    const user = await this.usersService.findById(caseRecord.userId);
    if (!user) {
      throw new NotFoundError(ERRORS.USER_001, 'USER_001');
    }

    // 5. Get card and transactions for the case
    const card = await this.cardsRepository.findByCaseId(claim.caseId);
    let transactions: CardTransactionRecord[] = [];
    if (card) {
      transactions = await this.cardTransactionsRepository.findByCardId(card.id);
    }

    // 6. Get cost share rules from DB
    const costShareRule = await this.costShareRulesRepository.findActive();

    // 7. Calculate settlement preview
    const settlementPreview = this.calculateSettlementPreviewWithType(
      claim,
      caseRecord.approvedAmount ?? 0,
      transactions,
      costShareRule,
    );

    this.logger.info('Claim detail fetched for ops', {
      claimId,
      caseId: claim.caseId,
      documentsCount: documents.length,
      transactionsCount: transactions.length,
    });

    return {
      claim,
      documents,
      case: {
        id: caseRecord.id,
        hospitalName: caseRecord.hospitalName,
        approvedAmount: caseRecord.approvedAmount ?? null,
        approvedCurrency: caseRecord.approvedCurrency ?? null,
      },
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      transactions,
      settlementPreview,
    };
  }

  async reviewClaim(
    claimId: string,
    reviewerId: string,
    userRole: UserRole,
    dto: ReviewClaimDto,
  ): Promise<{
    id: string;
    reviewedBillAmount: number;
    isValid: boolean;
    status: ClaimStatus;
    reviewedAt: Date;
  }> {
    this.logger.info('Reviewing claim', { claimId, reviewerId, userRole });

    // 1. Get claim by ID
    const claim = await this.claimsRepository.findById(claimId);
    if (!claim) {
      throw new NotFoundError(ERRORS.CLAIM_003, 'CLAIM_003');
    }

    // 2. Get case and validate status allows transition to IN_REVIEW
    const caseRecord = await this.casesRepository.findById(claim.caseId);
    if (!caseRecord) {
      throw new NotFoundError(ERRORS.CASE_002, 'CASE_002');
    }

    // 3. Validate case status transition (CLAIM_SUBMITTED -> IN_REVIEW)
    this.stateMachine.validate(caseRecord.status, CaseStatus.IN_REVIEW);

    // 4. Validate reviewed amount does not exceed original bill amount
    if (dto.reviewedBillAmount > claim.billAmount) {
      throw new BadRequestError(ERRORS.CLAIM_007, 'CLAIM_007');
    }

    // 5. Determine claim status based on isValid
    const newStatus = dto.isValid ? ClaimStatus.APPROVED : ClaimStatus.REJECTED;

    // 6. Update claim with review data
    const updatedClaim = await this.claimsRepository.updateReview(claimId, {
      reviewedBillAmount: dto.reviewedBillAmount,
      isValid: dto.isValid,
      reviewNotes: dto.reviewNotes,
      reviewedBy: reviewerId,
      status: newStatus,
    });

    // 7. Update case status to IN_REVIEW
    await this.casesRepository.updateStatus(claim.caseId, CaseStatus.IN_REVIEW, reviewerId);

    // 8. Log audit trail
    await this.auditLogsService.log({
      actorId: reviewerId,
      actorType: userRole || UserRole.OPS_REVIEWER,
      action: dto.isValid ? 'CLAIM_APPROVED' : 'CLAIM_REJECTED',
      entityType: 'case',
      entityId: claim.caseId,
      beforeState: {
        claimStatus: claim.status,
        reviewedBillAmount: claim.reviewedBillAmount,
        isValid: claim.isValid,
        caseStatus: caseRecord.status,
      },
      afterState: {
        claimStatus: newStatus,
        reviewedBillAmount: dto.reviewedBillAmount,
        isValid: dto.isValid,
        reviewNotes: dto.reviewNotes,
        caseStatus: CaseStatus.IN_REVIEW,
      },
    });

    this.logger.info('Claim reviewed successfully', {
      claimId,
      caseId: claim.caseId,
      claimStatus: newStatus,
      caseStatus: CaseStatus.IN_REVIEW,
      reviewedBillAmount: dto.reviewedBillAmount,
    });

    return {
      id: updatedClaim.id,
      reviewedBillAmount: updatedClaim.reviewedBillAmount!,
      isValid: updatedClaim.isValid!,
      status: updatedClaim.status,
      reviewedAt: updatedClaim.reviewedAt!,
    };
  }

  /**
   * Calculate settlement preview with settlement type determination.
   * Uses shared calculateSettlementPreview utility for core calculation.
   */
  private calculateSettlementPreviewWithType(
    claim: Claim,
    approvedAmount: number,
    transactions: CardTransactionRecord[],
    costShareRule: CostShareRule | null,
  ): {
    reviewedBillAmount: number;
    insurerLiability: number;
    deductible: number;
    copayAmount: number;
    userCostShare: number;
    platformExpectedPay: number;
    cardPaidAmount: number;
    difference: number;
    settlementType: SettlementType;
  } | null {
    // Use shared utility for base calculation
    const result = calculateSettlementPreview(
      {
        billAmount: claim.billAmount,
        reviewedBillAmount: claim.reviewedBillAmount,
        submittedAt: claim.submittedAt ?? null,
      },
      approvedAmount,
      transactions.map((t) => ({ amount: t.amount, status: t.status })),
      costShareRule,
    );

    if (!result) {
      return null;
    }

    // Determine settlement type based on difference direction
    // cardPaidAmount - platformExpectedPay: Positive = COLLECT, Negative = PAYOUT
    const rawDifference = result.cardPaidAmount - result.platformExpectedPay;
    let settlementType: SettlementType;
    if (rawDifference > 0) {
      settlementType = SettlementType.COLLECT;
    } else if (rawDifference < 0) {
      settlementType = SettlementType.PAYOUT;
    } else {
      settlementType = SettlementType.NONE;
    }

    return {
      ...result,
      settlementType,
    };
  }
}
