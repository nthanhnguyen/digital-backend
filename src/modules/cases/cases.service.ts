import { Injectable } from '@nestjs/common';
import {
  LoggerService,
  NotFoundError,
  BadRequestError,
  UnprocessableEntityError,
  ERRORS,
} from 'src/common';
import { StateMachineValidator } from 'src/common/state-machine';
import { CasesRepository } from './cases.repository';
import { Case, CaseStatus, CaseStatusTransition, ReasonCategory } from './cases.interface';
import { CASE_STATUS_TRANSITIONS, BACKWARD_TRANSITIONS } from './cases.const';
import { UserRole } from '../users/users.interface';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { UsersService } from '../users';
import { CardholdersService, CreateCardholderDto } from '../card_holders';
import { CardsService, CreateCardDto } from '../cards';

@Injectable()
export class CasesService {
  private readonly stateMachine: StateMachineValidator<CaseStatus>;

  constructor(
    private readonly casesRepository: CasesRepository,
    private readonly auditLogsService: AuditLogsService,
    private readonly logger: LoggerService,
    private readonly cardholdersService: CardholdersService,
    private readonly cardsService: CardsService,
    private readonly usersService: UsersService,
  ) {
    // Initialize state machine validator
    this.stateMachine = new StateMachineValidator<CaseStatus>({
      transitions: CASE_STATUS_TRANSITIONS,
      backwardTransitions: BACKWARD_TRANSITIONS,
      invalidTransitionErrorCode: 'CASE_001',
      unauthorizedBackwardErrorCode: 'AUTH_004',
    });
  }

  async create(data: {
    userId: string;
    hospitalName: string;
    plannedVisitAt: Date;
    reasonCategory: ReasonCategory;
    contactPhone?: string;
    notes?: string;
  }): Promise<Case> {
    // Validate plannedVisitAt is in the future
    if (data.plannedVisitAt <= new Date()) {
      throw new BadRequestError(ERRORS.CASE_004, 'CASE_004');
    }

    // Always create cases with DRAFT status
    const caseRecord = await this.casesRepository.create({
      ...data,
      status: CaseStatus.DRAFT,
    });

    // Log audit
    await this.auditLogsService.log({
      actorId: data.userId,
      actorType: UserRole.USER,
      action: 'CASE_CREATED',
      entityType: 'case',
      entityId: caseRecord.id,
      beforeState: null,
      afterState: { status: CaseStatus.DRAFT },
    });

    this.logger.info('Case created', {
      caseId: caseRecord.id,
      userId: data.userId,
      status: CaseStatus.DRAFT,
    });

    return caseRecord;
  }

  async findById(id: string): Promise<Case> {
    const caseRecord = await this.casesRepository.findById(id);

    if (!caseRecord) {
      throw new NotFoundError(ERRORS.CASE_002, 'CASE_002');
    }

    return caseRecord;
  }

  async findByIdWithRelations(
    caseId: string,
    userId: string,
  ): Promise<{
    case: Case;
    coverageTier?: Record<string, unknown>;
    card?: Record<string, unknown>;
    claim?: Record<string, unknown>;
    settlement?: Record<string, unknown>;
  }> {
    const result = await this.casesRepository.findByIdWithRelations(caseId);

    if (!result) {
      throw new NotFoundError(ERRORS.CASE_002, 'CASE_002');
    }

    // Verify ownership
    if (result.case.userId !== userId) {
      throw new NotFoundError(ERRORS.CASE_002, 'CASE_002');
    }

    return result;
  }

  async findByUserId(
    userId: string,
    options: {
      page: number;
      limit: number;
      status?: CaseStatus;
      sortBy: string;
      sortOrder: 'asc' | 'desc';
    },
  ): Promise<{ cases: Case[]; total: number }> {
    return this.casesRepository.findByUserId(userId, options);
  }

  async findAllForOps(options: {
    page: number;
    limit: number;
    statuses?: CaseStatus[];
    userId?: string;
    fromDate?: Date;
    toDate?: Date;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
    keyword?: string;
  }): Promise<{
    cases: Array<
      Case & {
        userName: string;
        userEmail: string;
      }
    >;
    total: number;
  }> {
    return this.casesRepository.findAllForOps(options);
  }

  async findByIdForOps(id: string): Promise<{
    case: Case;
    user: {
      id: string;
      name: string;
      email: string;
      phone: string;
      bankAccountNumber: string;
      bankCode: string;
    };
    limits: {
      perCase: number;
      remainingToday: number;
      remainingThisYear: number;
    };
    coverageTier?: Record<string, unknown>;
    card?: Record<string, unknown>;
    claim?: Record<string, unknown>;
    settlement?: Record<string, unknown>;
    auditLogs: Array<{
      action: string;
      actor: string;
      timestamp: Date;
    }>;
  }> {
    const result = await this.casesRepository.findByIdForOps(id);

    if (!result) {
      throw new NotFoundError(ERRORS.CASE_002, 'CASE_002');
    }

    return result;
  }

  async submitCase(caseId: string, userId: string): Promise<Case> {
    // Find case and verify ownership
    const caseRecord = await this.findById(caseId);

    if (caseRecord.userId !== userId) {
      throw new NotFoundError(ERRORS.CASE_002, 'CASE_002');
    }

    // Verify case is in DRAFT status
    if (caseRecord.status !== CaseStatus.DRAFT) {
      throw new BadRequestError(ERRORS.CASE_005, 'CASE_005');
    }

    // Validate transition is allowed (DRAFT -> SUBMITTED)
    this.stateMachine.validate(caseRecord.status, CaseStatus.SUBMITTED);

    // Validate business rules for SUBMITTED status
    await this.validateTransitionRules(caseRecord, CaseStatus.SUBMITTED);

    // Transition to SUBMITTED
    const updatedCase = await this.casesRepository.updateStatus(
      caseId,
      CaseStatus.SUBMITTED,
      userId,
    );

    // Create audit log
    await this.auditLogsService.log({
      actorId: userId,
      actorType: UserRole.USER,
      action: 'CASE_SUBMITTED',
      entityType: 'case',
      entityId: caseId,
      beforeState: { status: CaseStatus.DRAFT },
      afterState: { status: CaseStatus.SUBMITTED },
    });

    this.logger.info('Case submitted', {
      caseId,
      userId,
      status: CaseStatus.SUBMITTED,
    });

    return updatedCase;
  }

  async transitionStatus(transition: CaseStatusTransition, userRole?: UserRole): Promise<Case> {
    const caseRecord = await this.findById(transition.from.toString());

    // Validate transition is allowed
    this.stateMachine.validate(transition.from, transition.to, userRole);

    // Validate business rules for the transition
    await this.validateTransitionRules(caseRecord, transition.to, transition);

    // Perform the update in a transaction
    const updatedCase = await this.casesRepository.updateStatus(
      caseRecord.id,
      transition.to,
      transition.actorId,
      transition.metadata,
    );

    // Create audit log
    await this.auditLogsService.log({
      actorId: transition.actorId,
      actorType: userRole || UserRole.USER,
      action: 'STATUS_CHANGED',
      entityType: 'case',
      entityId: caseRecord.id,
      beforeState: { status: caseRecord.status },
      afterState: { status: transition.to },
    });

    this.logger.info('Case status transitioned', {
      caseId: caseRecord.id,
      from: caseRecord.status,
      to: transition.to,
      actorId: transition.actorId,
    });

    return updatedCase;
  }

  private async validateTransitionRules(
    caseRecord: Case,
    newStatus: CaseStatus,
    transition?: CaseStatusTransition,
  ): Promise<void> {
    switch (newStatus) {
      case CaseStatus.SUBMITTED: {
        // Validate required fields are filled
        if (!caseRecord.hospitalName || !caseRecord.plannedVisitAt || !caseRecord.reasonCategory) {
          throw new BadRequestError(ERRORS.CASE_006, 'CASE_006');
        }
        break;
      }

      case CaseStatus.PREAPPROVED: {
        const amount = transition?.metadata?.approvedAmount;
        if (amount == null || typeof amount !== 'number' || !Number.isFinite(amount)) {
          throw new BadRequestError(ERRORS.CASE_007, 'CASE_007');
        }
        break;
      }

      case CaseStatus.CARD_ISSUED: {
        // Validate card exists
        const hasCard = await this.casesRepository.hasCard(caseRecord.id);
        if (!hasCard) {
          throw new BadRequestError(ERRORS.CASE_008, 'CASE_008');
        }
        break;
      }

      case CaseStatus.CLAIM_SUBMITTED: {
        // Validate claim documents exist
        const hasDocuments = await this.casesRepository.hasClaimDocuments(caseRecord.id);
        if (!hasDocuments) {
          throw new BadRequestError(ERRORS.CASE_009, 'CASE_009');
        }
        break;
      }

      case CaseStatus.SETTLED: {
        // Validate settlement record exists
        const hasSettlement = await this.casesRepository.hasSettlement(caseRecord.id);
        if (!hasSettlement) {
          throw new BadRequestError(ERRORS.CASE_010, 'CASE_010');
        }
        break;
      }

      default:
        // No specific validation required
        break;
    }
  }

  /**
   * Get case by ID
   */
  async getCaseById(id: string): Promise<Case> {
    const case_ = await this.casesRepository.findById(id);
    if (!case_) {
      throw new NotFoundError(ERRORS.CASE_002, 'CASE_002');
    }
    return case_;
  }

  /**
   * Preapprove a case and issue a card
   * This will:
   * 1. Update case status to PREAPPROVED
   * 2. Create cardholder if not exists
   * 3. Create card for the case
   * 4. Update case status to CARD_ISSUED
   */
  async preapproveCase(
    caseId: string,
    approvedBy: string,
    dto: {
      approvedAmount: number;
      approvedCurrency?: string;
      coverageTierId?: string;
      bufferAmount?: number;
    },
    userRole: UserRole,
  ): Promise<Case> {
    this.logger.info('Preapproving case', { caseId, approvedBy });

    // Get the case
    const case_ = await this.getCaseById(caseId);

    // Validate transition is allowed (SUBMITTED -> PREAPPROVED)
    this.stateMachine.validate(case_.status, CaseStatus.PREAPPROVED);

    // Validate business rules for PREAPPROVED status (transition supplies approvedAmount etc.)
    const preapproveTransition = {
      from: case_.status,
      to: CaseStatus.PREAPPROVED,
      actorId: approvedBy,
      metadata: {
        approvedAmount: dto.approvedAmount,
        approvedCurrency: dto.approvedCurrency ?? 'VND',
        coverageTierId: dto.coverageTierId,
        bufferAmount: dto.bufferAmount ?? 0,
      },
    };
    await this.validateTransitionRules(case_, CaseStatus.PREAPPROVED, preapproveTransition);

    // Get user to get their details for cardholder creation
    const user = await this.usersService.findById(case_.userId);
    if (!user) {
      throw new NotFoundError(ERRORS.USER_001, 'USER_001');
    }

    // Preapprove the case
    const preapprovedCase = await this.casesRepository.preapprove(caseId, {
      approvedBy,
      approvedAmount: dto.approvedAmount,
      approvedCurrency: dto.approvedCurrency || 'VND',
      coverageTierId: dto.coverageTierId,
      bufferAmount: dto.bufferAmount || 0,
      updatedBy: approvedBy,
    });

    await this.auditLogsService.log({
      actorId: approvedBy,
      actorType: userRole || UserRole.OPS_REVIEWER,
      action: 'CASE_PREAPPROVED',
      entityType: 'case',
      entityId: caseId,
      beforeState: { status: CaseStatus.SUBMITTED },
      afterState: {
        status: CaseStatus.PREAPPROVED,
        approvedAmount: preapprovedCase.approvedAmount,
        approvedCurrency: preapprovedCase.approvedCurrency,
        coverageTierId: preapprovedCase.coverageTierId ?? undefined,
        bufferAmount: preapprovedCase.bufferAmount ?? undefined,
      },
    });

    try {
      // Check if cardholder exists, create if not
      let cardholder;
      try {
        cardholder = await this.cardholdersService.getCardholderByUserId(case_.userId);
      } catch (error) {
        // Cardholder doesn't exist, create one
        if (error instanceof NotFoundError) {
          this.logger.info('Cardholder not found, creating new one', { userId: case_.userId });

          // Create cardholder DTO from user data
          // Using hardcoded values for testing - these should come from user profile or case in production
          const nameParts = user.name.split(' ');
          const firstName = nameParts[0] || user.name;
          const lastName = nameParts.slice(1).join(' ') || 'User';

          const createCardholderDto: CreateCardholderDto = {
            firstName,
            lastName,
            email: user.email,
            phoneNumber: user.phone || '012345678',
            dateOfBirth: '1990-01-01',
            address: {
              streetAddress: '123 Test Street',
              streetAddress2: 'Unit 1',
              city: 'Ho Chi Minh City',
              state: 'Ho Chi Minh',
              postalCode: '700000',
              countryCode: 'VN',
            },
          };
          this.logger.info('createCardholderDto', { createCardholderDto });

          cardholder = await this.cardholdersService.createCardholder(
            case_.userId,
            createCardholderDto,
          );
          this.logger.info('cardholder in db', { cardholder });
          await this.auditLogsService.log({
            actorId: approvedBy,
            actorType: userRole || UserRole.OPS_REVIEWER,
            action: 'CARDHOLDER_CREATED',
            entityType: 'cardholder',
            entityId: cardholder.id,
            beforeState: null,
            afterState: {
              userId: case_.userId,
              cardholderId: cardholder.id,
              airwallexCardholderId: cardholder.airwallexCardholderId,
              type: cardholder.type,
              status: cardholder.status,
            },
          });
        } else {
          this.logger.error(
            'Failed to get/create cardholder',
            error instanceof Error ? error.stack : undefined,
            {
              error: error instanceof Error ? error.message : String(error),
            },
          );
          throw error;
        }
      }

      // Calculate card limit (approved amount + buffer)
      const cardLimit = preapprovedCase.approvedAmount! + (preapprovedCase.bufferAmount || 0);

      // Calculate active dates (from now to planned visit date + some buffer)
      const activeFrom = new Date();
      const activeTo = new Date(case_.plannedVisitAt);
      activeTo.setDate(activeTo.getDate() + 7); // Add 7 days buffer after planned visit

      // Format dates as YYYY-MM-DD (matching working Postman format)
      const formatDate = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      // Create card
      const createCardDto: CreateCardDto = {
        caseId: case_.id,
        cardholderId: cardholder.id,
        limitAmount: cardLimit,
        limitCurrency: [preapprovedCase.approvedCurrency || 'VND'],
        activeFrom: formatDate(activeFrom),
        activeTo: formatDate(activeTo),
        transactionCount: 'MULTIPLE',
      };

      const card = await this.cardsService.createCard(case_.userId, createCardDto);

      await this.auditLogsService.log({
        actorId: approvedBy,
        actorType: userRole || UserRole.OPS_REVIEWER,
        action: 'CARD_CREATED',
        entityType: 'card',
        entityId: card.id,
        beforeState: null,
        afterState: {
          caseId: case_.id,
          cardholderId: cardholder.id,
          cardId: card.id,
          limitAmount: card.limitAmount,
          limitCurrency: card.limitCurrency,
          status: card.status,
        },
      });

      // Update case status to CARD_ISSUED
      const updatedCase = await this.casesRepository.updateToCardIssued(caseId, approvedBy);

      await this.auditLogsService.log({
        actorId: approvedBy,
        actorType: userRole || UserRole.OPS_REVIEWER,
        action: 'CASE_CARD_ISSUED',
        entityType: 'case',
        entityId: caseId,
        beforeState: { status: CaseStatus.PREAPPROVED },
        afterState: { status: CaseStatus.CARD_ISSUED },
      });

      this.logger.info('Case preapproved and card issued successfully', {
        caseId,
        cardholderId: cardholder.id,
        cardId: card.id,
      });

      return updatedCase;
    } catch (error) {
      this.logger.error(
        'Failed to issue card after preapproval',
        error instanceof Error ? error.stack : undefined,
        {
          error: error instanceof Error ? error.message : String(error),
          caseId,
        },
      );

      // Case is already preapproved, but card creation failed
      // The case status remains PREAPPROVED, and can be retried
      throw new UnprocessableEntityError(
        `Case preapproved but card creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'CARD_001',
      );
    }
  }

  async updateCaseStatus(caseId: string, status: CaseStatus, updatedBy: string): Promise<Case> {
    const updatedCase = await this.casesRepository.updateStatus(caseId, status, updatedBy, {
      status: status,
    });
    return updatedCase;
  }

  /**
   * Reject a submitted (or preapproved) case.
   * Transitions case to REJECTED and optionally stores a rejection reason.
   */
  async rejectCase(
    caseId: string,
    rejectedBy: string,
    dto: { rejectionReason?: string },
  ): Promise<Case> {
    this.logger.info('Rejecting case', { caseId, rejectedBy });

    const case_ = await this.getCaseById(caseId);

    this.stateMachine.validate(case_.status, CaseStatus.REJECTED);
    await this.validateTransitionRules(case_, CaseStatus.REJECTED);

    const updatedCase = await this.casesRepository.updateStatus(
      caseId,
      CaseStatus.REJECTED,
      rejectedBy,
      { rejectionReason: dto.rejectionReason ?? undefined },
    );

    await this.auditLogsService.log({
      actorId: rejectedBy,
      actorType: 'ops',
      action: 'CASE_REJECTED',
      entityType: 'case',
      entityId: caseId,
      beforeState: { status: case_.status },
      afterState: { status: CaseStatus.REJECTED, rejectionReason: dto.rejectionReason },
    });

    this.logger.info('Case rejected', { caseId, rejectedBy });
    return updatedCase;
  }
}
