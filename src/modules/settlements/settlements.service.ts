import { Injectable } from '@nestjs/common';
import {
  LoggerService,
  NotFoundError,
  BadRequestError,
  calculateSettlementPreview,
  ERRORS,
} from 'src/common';
import { CasesRepository } from '../cases/cases.repository';
import { SettlementsRepository } from './settlements.repository';
import { AirwallexPaymentLinksService } from '../airwallex/airwallex-payment-links.service';
import { AirwallexTransfersService } from '../airwallex/airwallex-transfers.service';
import { Settlement, SettlementType } from './settlements.interface';
import { CreateCollectSettlementDto } from './dto/create-collect-settlement.dto';
import { CreatePayoutSettlementDto } from './dto/create-payout-settlement.dto';
import { SettleAction } from './dto/create-settle.dto';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { UsersService } from '../users/users.service';
import { ClaimsRepository } from '../claims/claims.repository';
import { CostShareRulesRepository } from '../cost-share-rules';
import { CardsRepository, CardsService } from '../cards';
import { CardTransactionsRepository } from '../webhooks';
import { CaseStatus } from '../cases/cases.interface';
import { StateMachineValidator } from 'src/common/state-machine';
import { CASE_STATUS_TRANSITIONS, BACKWARD_TRANSITIONS } from '../cases/cases.const';
import { UserRole } from '../users';

@Injectable()
export class SettlementsService {
  private readonly stateMachine: StateMachineValidator<CaseStatus>;

  constructor(
    private readonly settlementsRepository: SettlementsRepository,
    private readonly casesRepository: CasesRepository,
    private readonly paymentLinksService: AirwallexPaymentLinksService,
    private readonly transfersService: AirwallexTransfersService,
    private readonly usersService: UsersService,
    private readonly logger: LoggerService,
    private readonly auditLogsService: AuditLogsService,
    private readonly claimsRepository: ClaimsRepository,
    private readonly costShareRulesRepository: CostShareRulesRepository,
    private readonly cardsRepository: CardsRepository,
    private readonly cardsService: CardsService,
    private readonly cardTransactionsRepository: CardTransactionsRepository,
  ) {
    this.stateMachine = new StateMachineValidator<CaseStatus>({
      transitions: CASE_STATUS_TRANSITIONS,
      backwardTransitions: BACKWARD_TRANSITIONS,
      invalidTransitionErrorCode: 'CASE_001',
      unauthorizedBackwardErrorCode: 'AUTH_004',
    });
  }

  /**
   * Create a COLLECT settlement and a one-time payment link for the customer to pay the overage.
   */
  async createCollectSettlement(
    caseId: string,
    createdBy: string,
    userRole: UserRole,
    dto: CreateCollectSettlementDto,
  ): Promise<Settlement> {
    const caseRecord = await this.casesRepository.findById(caseId);
    if (!caseRecord) {
      throw new NotFoundError(ERRORS.CASE_002, 'CASE_002');
    }

    const alreadyInProgress =
      await this.settlementsRepository.hasCollectSettlementInProgress(caseId);
    if (alreadyInProgress) {
      throw new BadRequestError(ERRORS.SETTLE_001, 'SETTLE_001');
    }

    const settlement = await this.settlementsRepository.create({
      caseId,
      type: SettlementType.COLLECT,
      amount: dto.amount,
      currency: dto.currency,
      calculationDetails: dto.calculationDetails,
      createdBy,
    });

    const title =
      dto.paymentLinkTitle ??
      `Payment for case ${caseId.slice(0, 8)} – ${dto.currency} ${dto.amount}`;

    try {
      const linkResponse = await this.paymentLinksService.createPaymentLink({
        amount: dto.amount,
        currency: dto.currency,
        title,
        reusable: false,
        reference: `settlement_${settlement.id}`,
        metadata: { case_id: caseId, settlement_id: settlement.id },
      });

      await this.settlementsRepository.updatePaymentLink(
        settlement.id,
        linkResponse.id,
        linkResponse.url,
      );

      const updated = await this.settlementsRepository.findById(settlement.id);
      if (!updated) throw new Error('Settlement not found after update');

      this.logger.info('Collect settlement and payment link created', {
        settlementId: updated.id,
        caseId,
        amount: dto.amount,
        currency: dto.currency,
        paymentLinkId: linkResponse.id,
      });

      await this.auditLogsService.log({
        actorId: createdBy,
        actorType: userRole || UserRole.OPS_REVIEWER,
        action: 'SETTLEMENT_CREATED',
        entityType: 'settlement',
        entityId: updated.id,
        beforeState: null,
        afterState: {
          status: 'PROCESSING',
          amount: dto.amount,
          currency: dto.currency,
          paymentLinkId: linkResponse.id,
        },
      });

      return updated;
    } catch (error) {
      await this.settlementsRepository.updateStatus(settlement.id, 'FAILED');
      throw error;
    }
  }

  async getSettlementById(id: string): Promise<Settlement> {
    const settlement = await this.settlementsRepository.findById(id);
    if (!settlement) {
      throw new NotFoundError(ERRORS.SETTLE_004, 'SETTLE_004');
    }
    return settlement;
  }

  async getSettlementByCaseId(caseId: string): Promise<Settlement | null> {
    return this.settlementsRepository.findByCaseId(caseId);
  }

  async getSettlementByPaymentLinkId(airwallexPaymentLinkId: string): Promise<Settlement | null> {
    return this.settlementsRepository.findByAirwallexPaymentLinkId(airwallexPaymentLinkId);
  }

  /**
   * Create a PAYOUT settlement and initiate a transfer to reimburse the customer.
   * Uses the case user's bank details; user must have bank_account_number and bank_code set.
   */
  async createPayoutSettlement(
    caseId: string,
    createdBy: string,
    userRole: UserRole,
    dto: CreatePayoutSettlementDto,
  ): Promise<Settlement> {
    const caseRecord = await this.casesRepository.findById(caseId);
    if (!caseRecord) {
      throw new NotFoundError(ERRORS.CASE_002, 'CASE_002');
    }

    const alreadyInProgress =
      await this.settlementsRepository.hasPayoutSettlementInProgress(caseId);
    if (alreadyInProgress) {
      throw new BadRequestError(ERRORS.SETTLE_001, 'SETTLE_001');
    }

    const user = await this.usersService.findById(caseRecord.userId);
    if (!user) {
      throw new NotFoundError(ERRORS.USER_001, 'USER_001');
    }
    if (!user.bankAccountNumber || !user.bankCode) {
      throw new BadRequestError(ERRORS.SETTLE_006, 'SETTLE_006');
    }

    const settlement = await this.settlementsRepository.create({
      caseId,
      type: SettlementType.PAYOUT,
      amount: dto.amount,
      currency: dto.currency,
      calculationDetails: dto.calculationDetails,
      createdBy,
    });

    try {
      const transferResponse = await this.transfersService.createTransfer({
        amount: dto.amount,
        currency: dto.currency,
        reference: `settlement_${settlement.id}`,
        reason: 'reimbursement',
        metadata: { case_id: caseId, settlement_id: settlement.id },
        beneficiary: {
          bankDetails: {
            accountNumber: user.bankAccountNumber,
            accountName: user.name,
            accountCurrency: dto.currency,
            bankCountryCode: 'VN',
            accountRoutingType1: 'bank_code',
            accountRoutingValue1: user.bankCode,
            localClearingSystem: 'ACH',
          },
          entityType: 'PERSONAL',
          ...(user.email && { personalEmail: user.email }),
        },
      });

      await this.settlementsRepository.updateTransferId(settlement.id, transferResponse.id);

      const updated = await this.settlementsRepository.findById(settlement.id);
      if (!updated) throw new Error('Settlement not found after update');

      this.logger.info('Payout settlement and transfer created', {
        settlementId: updated.id,
        caseId,
        amount: dto.amount,
        currency: dto.currency,
        transferId: transferResponse.id,
      });

      await this.auditLogsService.log({
        actorId: createdBy,
        actorType: userRole || UserRole.OPS_REVIEWER,
        action: 'SETTLEMENT_CREATED',
        entityType: 'settlement',
        entityId: updated.id,
        beforeState: null,
        afterState: {
          status: 'PROCESSING',
          type: SettlementType.PAYOUT,
          amount: dto.amount,
          currency: dto.currency,
          transferId: transferResponse.id,
        },
      });

      return updated;
    } catch (error) {
      await this.settlementsRepository.updateStatus(settlement.id, 'FAILED');
      throw error;
    }
  }

  /**
   * Create a settlement for a case based on the action.
   * - COLLECT: Create payment link for user to pay difference
   * - PAYOUT: Mark as settled (no payout action needed per business rules)
   * - NONE: No action needed, mark as settled
   */
  async settle(
    caseId: string,
    createdBy: string,
    userRole: UserRole,
    action: SettleAction,
  ): Promise<Settlement> {
    // 1. Get case and validate it exists
    const caseRecord = await this.casesRepository.findById(caseId);
    if (!caseRecord) {
      throw new NotFoundError(ERRORS.CASE_002, 'CASE_002');
    }

    // 2. Validate case status transition (IN_REVIEW -> SETTLED)
    this.stateMachine.validate(caseRecord.status, CaseStatus.SETTLED);

    // 3. Check if settlement already exists
    const existingSettlement = await this.settlementsRepository.findByCaseId(caseId);
    if (existingSettlement) {
      throw new BadRequestError(ERRORS.SETTLE_001, 'SETTLE_001');
    }

    // 4. Get claim for the case
    const claim = await this.claimsRepository.findByCaseId(caseId);
    if (!claim) {
      throw new NotFoundError(ERRORS.CLAIM_003, 'CLAIM_003');
    }

    // 5. Get cost share rules
    const costShareRule = await this.costShareRulesRepository.findActive();

    // 6. Get card and transactions
    const card = await this.cardsRepository.findByCaseId(caseId);
    let cardTransactions: { amount: number; status: string }[] = [];
    if (card) {
      cardTransactions = await this.cardTransactionsRepository.findByCardId(card.id);
    }

    // 7. Calculate settlement preview using shared utility
    const calculationResult = calculateSettlementPreview(
      {
        billAmount: claim.billAmount,
        reviewedBillAmount: claim.reviewedBillAmount,
        submittedAt: claim.submittedAt ?? null,
      },
      caseRecord.approvedAmount ?? 0,
      cardTransactions.map((t) => ({ amount: t.amount, status: t.status })),
      costShareRule,
    );

    if (!calculationResult) {
      throw new BadRequestError(ERRORS.SETTLE_005, 'SETTLE_005');
    }

    // Spread to make compatible with Record<string, unknown>
    const calculationDetails = { ...calculationResult };

    const amount = calculationDetails.difference;
    const currency = 'VND';

    let settlement: Settlement;

    // 8. Create settlement based on action
    if (action === SettleAction.COLLECT) {
      // Create COLLECT settlement with payment link
      settlement = await this.createCollectSettlement(caseId, createdBy, userRole, {
        amount,
        currency,
        calculationDetails,
      });
    } else if (action === SettleAction.PAYOUT) {
      // Create PAYOUT settlement with bank transfer
      settlement = await this.createPayoutSettlement(caseId, createdBy, userRole, {
        amount,
        currency,
        calculationDetails,
      });
    } else {
      // For NONE, create settlement record and mark as completed
      settlement = await this.settlementsRepository.create({
        caseId,
        type: SettlementType.NONE,
        amount,
        currency,
        calculationDetails,
        createdBy,
      });

      // Mark as completed immediately for NONE
      await this.settlementsRepository.updateStatus(settlement.id, 'COMPLETED');

      // Refetch to get updated status
      const updated = await this.settlementsRepository.findById(settlement.id);
      if (!updated) throw new Error('Settlement not found after update');
      settlement = updated;

      this.logger.info('NONE settlement created and completed', {
        settlementId: settlement.id,
        caseId,
        amount,
        currency,
      });

      await this.auditLogsService.log({
        actorId: createdBy,
        actorType: userRole || UserRole.OPS_REVIEWER,
        action: 'SETTLEMENT_CREATED',
        entityType: 'settlement',
        entityId: settlement.id,
        beforeState: null,
        afterState: {
          status: 'COMPLETED',
          type: SettlementType.NONE,
          amount,
          currency,
        },
      });
    }

    // 9. Update case status to SETTLED
    await this.casesRepository.updateStatus(caseId, CaseStatus.SETTLED, createdBy);

    // 10. Close the virtual card in Airwallex and DB when a card exists
    if (card) {
      try {
        await this.cardsService.closeCard(card.id);
      } catch (error) {
        this.logger.error(
          'Failed to close card after settle',
          error instanceof Error ? error.stack : undefined,
          { caseId, cardId: card.id },
        );
        throw error;
      }
    }

    this.logger.info('Case settled', {
      caseId,
      settlementId: settlement.id,
      action,
    });

    return settlement;
  }
}
