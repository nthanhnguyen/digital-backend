import { Test, TestingModule } from '@nestjs/testing';
import { SettlementsService } from './settlements.service';
import { SettlementsRepository } from './settlements.repository';
import { CasesRepository } from '../cases/cases.repository';
import { AirwallexPaymentLinksService } from '../airwallex/airwallex-payment-links.service';
import { AirwallexTransfersService } from '../airwallex/airwallex-transfers.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { UsersService } from '../users/users.service';
import { ClaimsRepository } from '../claims/claims.repository';
import { CostShareRulesRepository } from '../cost-share-rules';
import { CardsRepository, CardsService } from '../cards';
import { CardTransactionsRepository } from '../webhooks';
import { LoggerService, NotFoundError, BadRequestError, ERRORS } from 'src/common';
import { Settlement, SettlementType } from './settlements.interface';
import { CreateCollectSettlementDto } from './dto/create-collect-settlement.dto';
import { UserRole } from '../users';
import { SettleAction } from './dto/create-settle.dto';
import { CaseStatus } from '../cases/cases.interface';

describe('SettlementsService', () => {
  let service: SettlementsService;
  let settlementsRepository: jest.Mocked<SettlementsRepository>;
  let casesRepository: jest.Mocked<CasesRepository>;
  let paymentLinksService: jest.Mocked<AirwallexPaymentLinksService>;
  let transfersService: jest.Mocked<AirwallexTransfersService>;
  let auditLogsService: jest.Mocked<AuditLogsService>;
  let claimsRepository: jest.Mocked<ClaimsRepository>;
  let costShareRulesRepository: jest.Mocked<CostShareRulesRepository>;
  let cardsRepository: jest.Mocked<CardsRepository>;
  let cardsService: jest.Mocked<CardsService>;
  let cardTransactionsRepository: jest.Mocked<CardTransactionsRepository>;
  let usersService: jest.Mocked<UsersService>;

  const mockCase = {
    id: 'case-123',
    userId: 'user-123',
    hospitalName: 'Queen Mary',
    plannedVisitAt: new Date(),
    reasonCategory: 'general_consultation' as const,
    status: 'CLAIM_SUBMITTED' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockSettlement: Settlement = {
    id: 'settlement-123',
    caseId: 'case-123',
    type: SettlementType.COLLECT,
    amount: 500,
    currency: 'VND',
    status: 'PENDING',
    airwallexPaymentLinkId: null,
    airwallexPaymentLinkUrl: null,
    airwallexTransferId: null,
    calculationDetails: { overage: 500 },
    createdBy: 'user-ops',
    createdAt: new Date(),
    completedAt: null,
    deletedAt: null,
  };

  const mockSettlementWithLink: Settlement = {
    ...mockSettlement,
    status: 'PROCESSING',
    airwallexPaymentLinkId: 'link-awx-1',
    airwallexPaymentLinkUrl: 'https://pay.airwallex.com/link/xxx',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettlementsService,
        {
          provide: SettlementsRepository,
          useValue: {
            create: jest.fn(),
            findById: jest.fn(),
            findByCaseId: jest.fn(),
            findByAirwallexPaymentLinkId: jest.fn(),
            updatePaymentLink: jest.fn(),
            updateTransferId: jest.fn(),
            updateStatus: jest.fn(),
            hasCollectSettlementInProgress: jest.fn(),
            hasPayoutSettlementInProgress: jest.fn(),
          },
        },
        {
          provide: CasesRepository,
          useValue: {
            findById: jest.fn(),
            updateStatus: jest.fn(),
          },
        },
        {
          provide: AirwallexPaymentLinksService,
          useValue: {
            createPaymentLink: jest.fn(),
          },
        },
        {
          provide: AirwallexTransfersService,
          useValue: {
            createTransfer: jest.fn(),
          },
        },
        {
          provide: UsersService,
          useValue: {
            findById: jest.fn(),
          },
        },
        {
          provide: AuditLogsService,
          useValue: {
            log: jest.fn(),
          },
        },
        {
          provide: ClaimsRepository,
          useValue: {
            findByCaseId: jest.fn(),
          },
        },
        {
          provide: CostShareRulesRepository,
          useValue: {
            findActive: jest.fn(),
          },
        },
        {
          provide: CardsRepository,
          useValue: {
            findByCaseId: jest.fn(),
          },
        },
        {
          provide: CardsService,
          useValue: {
            closeCard: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: CardTransactionsRepository,
          useValue: {
            findByCardId: jest.fn(),
          },
        },
        {
          provide: LoggerService,
          useValue: {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SettlementsService>(SettlementsService);
    settlementsRepository = module.get(SettlementsRepository);
    casesRepository = module.get(CasesRepository);
    paymentLinksService = module.get(AirwallexPaymentLinksService);
    transfersService = module.get(AirwallexTransfersService);
    auditLogsService = module.get(AuditLogsService);
    claimsRepository = module.get(ClaimsRepository);
    costShareRulesRepository = module.get(CostShareRulesRepository);
    cardsRepository = module.get(CardsRepository);
    cardsService = module.get(CardsService);
    cardTransactionsRepository = module.get(CardTransactionsRepository);
    usersService = module.get(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createCollectSettlement', () => {
    const dto: CreateCollectSettlementDto = {
      amount: 500,
      currency: 'VND',
      calculationDetails: { overage: 500 },
    };
    const createdBy = 'user-ops';
    const userRole = UserRole.OPS_ADMIN;

    it('should create settlement and payment link when case exists and no collect in progress', async () => {
      casesRepository.findById.mockResolvedValue(mockCase as never);
      settlementsRepository.hasCollectSettlementInProgress.mockResolvedValue(false);
      settlementsRepository.create.mockResolvedValue(mockSettlement);
      paymentLinksService.createPaymentLink.mockResolvedValue({
        id: 'link-awx-1',
        url: 'https://pay.airwallex.com/link/xxx',
      });
      settlementsRepository.updatePaymentLink.mockResolvedValue(undefined);
      settlementsRepository.findById.mockResolvedValue(mockSettlementWithLink);

      const result = await service.createCollectSettlement('case-123', createdBy, userRole, dto);

      expect(casesRepository.findById).toHaveBeenCalledWith('case-123');
      expect(settlementsRepository.hasCollectSettlementInProgress).toHaveBeenCalledWith('case-123');
      expect(settlementsRepository.create).toHaveBeenCalledWith({
        caseId: 'case-123',
        type: SettlementType.COLLECT,
        amount: 500,
        currency: 'VND',
        calculationDetails: dto.calculationDetails,
        createdBy,
      });
      expect(paymentLinksService.createPaymentLink).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 500,
          currency: 'VND',
          reusable: false,
          reference: `settlement_${mockSettlement.id}`,
          metadata: { case_id: 'case-123', settlement_id: mockSettlement.id },
        }),
      );
      expect(settlementsRepository.updatePaymentLink).toHaveBeenCalledWith(
        mockSettlement.id,
        'link-awx-1',
        'https://pay.airwallex.com/link/xxx',
      );
      expect(auditLogsService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SETTLEMENT_CREATED',
          entityType: 'settlement',
          entityId: mockSettlementWithLink.id,
          afterState: expect.objectContaining({
            status: 'PROCESSING',
            amount: 500,
            currency: 'VND',
          }),
        }),
      );
      expect(result).toEqual(mockSettlementWithLink);
    });

    it('should throw NotFoundError when case does not exist', async () => {
      casesRepository.findById.mockResolvedValue(null);

      await expect(
        service.createCollectSettlement('case-404', createdBy, userRole, dto),
      ).rejects.toThrow(NotFoundError);
      await expect(
        service.createCollectSettlement('case-404', createdBy, userRole, dto),
      ).rejects.toThrow('Case not found');

      expect(settlementsRepository.create).not.toHaveBeenCalled();
      expect(paymentLinksService.createPaymentLink).not.toHaveBeenCalled();
    });

    it('should throw BadRequestError when collect settlement already in progress', async () => {
      casesRepository.findById.mockResolvedValue(mockCase as never);
      settlementsRepository.hasCollectSettlementInProgress.mockResolvedValue(true);

      await expect(
        service.createCollectSettlement('case-123', createdBy, userRole, dto),
      ).rejects.toThrow(BadRequestError);
      await expect(
        service.createCollectSettlement('case-123', createdBy, userRole, dto),
      ).rejects.toThrow(ERRORS.SETTLE_001);

      expect(settlementsRepository.create).not.toHaveBeenCalled();
      expect(paymentLinksService.createPaymentLink).not.toHaveBeenCalled();
    });

    it('should mark settlement FAILED and rethrow when createPaymentLink fails', async () => {
      casesRepository.findById.mockResolvedValue(mockCase as never);
      settlementsRepository.hasCollectSettlementInProgress.mockResolvedValue(false);
      settlementsRepository.create.mockResolvedValue(mockSettlement);
      paymentLinksService.createPaymentLink.mockRejectedValue(new Error('Airwallex API error'));

      await expect(
        service.createCollectSettlement('case-123', createdBy, userRole, dto),
      ).rejects.toThrow('Airwallex API error');

      expect(settlementsRepository.updateStatus).toHaveBeenCalledWith(mockSettlement.id, 'FAILED');
    });
  });

  describe('getSettlementById', () => {
    it('should return settlement when found', async () => {
      settlementsRepository.findById.mockResolvedValue(mockSettlement);

      const result = await service.getSettlementById('settlement-123');

      expect(settlementsRepository.findById).toHaveBeenCalledWith('settlement-123');
      expect(result).toEqual(mockSettlement);
    });

    it('should throw NotFoundError when settlement not found', async () => {
      settlementsRepository.findById.mockResolvedValue(null);

      await expect(service.getSettlementById('settlement-404')).rejects.toThrow(NotFoundError);
      await expect(service.getSettlementById('settlement-404')).rejects.toThrow(
        'Settlement not found',
      );
    });
  });

  describe('getSettlementByCaseId', () => {
    it('should return settlement when found', async () => {
      settlementsRepository.findByCaseId.mockResolvedValue(mockSettlement);

      const result = await service.getSettlementByCaseId('case-123');

      expect(settlementsRepository.findByCaseId).toHaveBeenCalledWith('case-123');
      expect(result).toEqual(mockSettlement);
    });

    it('should return null when no settlement for case', async () => {
      settlementsRepository.findByCaseId.mockResolvedValue(null);

      const result = await service.getSettlementByCaseId('case-123');

      expect(result).toBeNull();
    });
  });

  describe('getSettlementByPaymentLinkId', () => {
    it('should return settlement when found by payment link id', async () => {
      settlementsRepository.findByAirwallexPaymentLinkId.mockResolvedValue(mockSettlementWithLink);

      const result = await service.getSettlementByPaymentLinkId('link-awx-1');

      expect(settlementsRepository.findByAirwallexPaymentLinkId).toHaveBeenCalledWith('link-awx-1');
      expect(result).toEqual(mockSettlementWithLink);
    });

    it('should return null when no settlement for payment link id', async () => {
      settlementsRepository.findByAirwallexPaymentLinkId.mockResolvedValue(null);

      const result = await service.getSettlementByPaymentLinkId('link-unknown');

      expect(result).toBeNull();
    });
  });

  describe('settle', () => {
    const createdBy = 'user-ops';
    const userRole = UserRole.OPS_ADMIN;

    const mockCaseInReview = {
      id: 'case-123',
      userId: 'user-123',
      hospitalName: 'Queen Mary',
      plannedVisitAt: new Date(),
      reasonCategory: 'general_consultation' as const,
      status: CaseStatus.IN_REVIEW,
      approvedAmount: 5000,
      approvedCurrency: 'VND',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };

    const mockClaim = {
      id: 'claim-123',
      caseId: 'case-123',
      billAmount: 3000,
      reviewedBillAmount: 2800,
      submittedAt: new Date(),
      status: 'APPROVED',
    };

    const mockCostShareRule = {
      id: 'rule-1',
      deductibleAmount: 200,
      copayPercentage: 10,
      copayCap: 1000,
    };

    const mockCard = {
      id: 'card-123',
      caseId: 'case-123',
    };

    const mockTransactions = [
      { amount: 2500, status: 'SUCCEEDED' },
      { amount: 100, status: 'FAILED' },
    ];

    const mockNoneSettlement: Settlement = {
      id: 'settlement-none',
      caseId: 'case-123',
      type: SettlementType.NONE,
      amount: 0,
      currency: 'VND',
      status: 'COMPLETED',
      airwallexPaymentLinkId: null,
      airwallexPaymentLinkUrl: null,
      airwallexTransferId: null,
      calculationDetails: {},
      createdBy: 'user-ops',
      createdAt: new Date(),
      completedAt: new Date(),
      deletedAt: null,
    };

    const mockUser = {
      id: 'user-123',
      name: 'Test User',
      email: 'test@example.com',
      bankAccountNumber: '123456789',
      bankCode: '004',
    };

    it('should throw NotFoundError when case not found', async () => {
      casesRepository.findById.mockResolvedValue(null);

      await expect(
        service.settle('case-404', createdBy, userRole, SettleAction.COLLECT),
      ).rejects.toThrow(NotFoundError);
      await expect(
        service.settle('case-404', createdBy, userRole, SettleAction.COLLECT),
      ).rejects.toThrow('Case not found');
    });

    it('should throw error when case status is not IN_REVIEW', async () => {
      const mockCaseSubmitted = { ...mockCaseInReview, status: CaseStatus.SUBMITTED };
      casesRepository.findById.mockResolvedValue(mockCaseSubmitted as never);

      await expect(
        service.settle('case-123', createdBy, userRole, SettleAction.COLLECT),
      ).rejects.toThrow();
    });

    it('should throw BadRequestError when settlement already exists', async () => {
      casesRepository.findById.mockResolvedValue(mockCaseInReview as never);
      settlementsRepository.findByCaseId.mockResolvedValue(mockSettlement);

      await expect(
        service.settle('case-123', createdBy, userRole, SettleAction.COLLECT),
      ).rejects.toThrow(BadRequestError);
      await expect(
        service.settle('case-123', createdBy, userRole, SettleAction.COLLECT),
      ).rejects.toThrow(ERRORS.SETTLE_001);
    });

    it('should throw NotFoundError when claim not found', async () => {
      casesRepository.findById.mockResolvedValue(mockCaseInReview as never);
      settlementsRepository.findByCaseId.mockResolvedValue(null);
      claimsRepository.findByCaseId.mockResolvedValue(null);

      await expect(
        service.settle('case-123', createdBy, userRole, SettleAction.COLLECT),
      ).rejects.toThrow(NotFoundError);
      await expect(
        service.settle('case-123', createdBy, userRole, SettleAction.COLLECT),
      ).rejects.toThrow(ERRORS.CLAIM_003);
    });

    it('should throw BadRequestError when claim not submitted', async () => {
      const mockClaimNotSubmitted = { ...mockClaim, submittedAt: null };
      casesRepository.findById.mockResolvedValue(mockCaseInReview as never);
      settlementsRepository.findByCaseId.mockResolvedValue(null);
      claimsRepository.findByCaseId.mockResolvedValue(mockClaimNotSubmitted as never);
      costShareRulesRepository.findActive.mockResolvedValue(mockCostShareRule as never);
      cardsRepository.findByCaseId.mockResolvedValue(mockCard as never);
      cardTransactionsRepository.findByCardId.mockResolvedValue(mockTransactions as never);

      await expect(
        service.settle('case-123', createdBy, userRole, SettleAction.COLLECT),
      ).rejects.toThrow(BadRequestError);
      await expect(
        service.settle('case-123', createdBy, userRole, SettleAction.COLLECT),
      ).rejects.toThrow(ERRORS.SETTLE_005);
    });

    it('should create COLLECT settlement with payment link when action is COLLECT', async () => {
      casesRepository.findById.mockResolvedValue(mockCaseInReview as never);
      settlementsRepository.findByCaseId.mockResolvedValue(null);
      claimsRepository.findByCaseId.mockResolvedValue(mockClaim as never);
      costShareRulesRepository.findActive.mockResolvedValue(mockCostShareRule as never);
      cardsRepository.findByCaseId.mockResolvedValue(mockCard as never);
      cardTransactionsRepository.findByCardId.mockResolvedValue(mockTransactions as never);
      settlementsRepository.hasCollectSettlementInProgress.mockResolvedValue(false);
      settlementsRepository.create.mockResolvedValue(mockSettlement);
      paymentLinksService.createPaymentLink.mockResolvedValue({
        id: 'link-awx-1',
        url: 'https://pay.airwallex.com/link/xxx',
      });
      settlementsRepository.updatePaymentLink.mockResolvedValue(undefined);
      settlementsRepository.findById.mockResolvedValue(mockSettlementWithLink);
      const mockSettledCase = { ...mockCaseInReview, status: CaseStatus.SETTLED };
      casesRepository.updateStatus.mockResolvedValue(mockSettledCase as never);

      const result = await service.settle('case-123', createdBy, userRole, SettleAction.COLLECT);

      expect(result).toEqual(mockSettlementWithLink);
      expect(casesRepository.updateStatus).toHaveBeenCalledWith(
        'case-123',
        CaseStatus.SETTLED,
        createdBy,
      );
      expect(cardsService.closeCard).toHaveBeenCalledWith(mockCard.id);
    });

    it('should create PAYOUT settlement with transfer when action is PAYOUT', async () => {
      const mockPayoutSettlement: Settlement = {
        ...mockSettlement,
        type: SettlementType.PAYOUT,
        airwallexTransferId: 'transfer-123',
      };

      casesRepository.findById.mockResolvedValue(mockCaseInReview as never);
      settlementsRepository.findByCaseId.mockResolvedValue(null);
      claimsRepository.findByCaseId.mockResolvedValue(mockClaim as never);
      costShareRulesRepository.findActive.mockResolvedValue(mockCostShareRule as never);
      cardsRepository.findByCaseId.mockResolvedValue(mockCard as never);
      cardTransactionsRepository.findByCardId.mockResolvedValue(mockTransactions as never);
      settlementsRepository.hasPayoutSettlementInProgress.mockResolvedValue(false);
      usersService.findById.mockResolvedValue(mockUser as never);
      settlementsRepository.create.mockResolvedValue(mockPayoutSettlement);
      transfersService.createTransfer.mockResolvedValue({ id: 'transfer-123' });
      settlementsRepository.updateTransferId.mockResolvedValue(undefined);
      settlementsRepository.findById.mockResolvedValue(mockPayoutSettlement);
      const mockSettledCase = { ...mockCaseInReview, status: CaseStatus.SETTLED };
      casesRepository.updateStatus.mockResolvedValue(mockSettledCase as never);

      const result = await service.settle('case-123', createdBy, userRole, SettleAction.PAYOUT);

      expect(result).toEqual(mockPayoutSettlement);
      expect(transfersService.createTransfer).toHaveBeenCalled();
      expect(casesRepository.updateStatus).toHaveBeenCalledWith(
        'case-123',
        CaseStatus.SETTLED,
        createdBy,
      );
    });

    it('should create NONE settlement and mark as completed when action is NONE', async () => {
      casesRepository.findById.mockResolvedValue(mockCaseInReview as never);
      settlementsRepository.findByCaseId.mockResolvedValue(null);
      claimsRepository.findByCaseId.mockResolvedValue(mockClaim as never);
      costShareRulesRepository.findActive.mockResolvedValue(mockCostShareRule as never);
      cardsRepository.findByCaseId.mockResolvedValue(mockCard as never);
      cardTransactionsRepository.findByCardId.mockResolvedValue(mockTransactions as never);
      settlementsRepository.create.mockResolvedValue({ ...mockNoneSettlement, status: 'PENDING' });
      settlementsRepository.updateStatus.mockResolvedValue(undefined);
      settlementsRepository.findById.mockResolvedValue(mockNoneSettlement);
      const mockSettledCase = { ...mockCaseInReview, status: CaseStatus.SETTLED };
      casesRepository.updateStatus.mockResolvedValue(mockSettledCase as never);

      const result = await service.settle('case-123', createdBy, userRole, SettleAction.NONE);

      expect(result.type).toEqual(SettlementType.NONE);
      expect(settlementsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: SettlementType.NONE,
        }),
      );
      expect(settlementsRepository.updateStatus).toHaveBeenCalledWith(
        mockNoneSettlement.id,
        'COMPLETED',
      );
      expect(casesRepository.updateStatus).toHaveBeenCalledWith(
        'case-123',
        CaseStatus.SETTLED,
        createdBy,
      );
      expect(auditLogsService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SETTLEMENT_CREATED',
          afterState: expect.objectContaining({
            status: 'COMPLETED',
            type: SettlementType.NONE,
          }),
        }),
      );
    });

    it('should handle case with no card (cardTransactions empty)', async () => {
      casesRepository.findById.mockResolvedValue(mockCaseInReview as never);
      settlementsRepository.findByCaseId.mockResolvedValue(null);
      claimsRepository.findByCaseId.mockResolvedValue(mockClaim as never);
      costShareRulesRepository.findActive.mockResolvedValue(mockCostShareRule as never);
      cardsRepository.findByCaseId.mockResolvedValue(null); // No card
      settlementsRepository.create.mockResolvedValue({ ...mockNoneSettlement, status: 'PENDING' });
      settlementsRepository.updateStatus.mockResolvedValue(undefined);
      settlementsRepository.findById.mockResolvedValue(mockNoneSettlement);
      const mockSettledCase = { ...mockCaseInReview, status: CaseStatus.SETTLED };
      casesRepository.updateStatus.mockResolvedValue(mockSettledCase as never);

      const result = await service.settle('case-123', createdBy, userRole, SettleAction.NONE);

      expect(result).toBeDefined();
      expect(cardTransactionsRepository.findByCardId).not.toHaveBeenCalled();
    });

    it('should use default cost share rules when no active rule exists', async () => {
      casesRepository.findById.mockResolvedValue(mockCaseInReview as never);
      settlementsRepository.findByCaseId.mockResolvedValue(null);
      claimsRepository.findByCaseId.mockResolvedValue(mockClaim as never);
      costShareRulesRepository.findActive.mockResolvedValue(null); // No active rule
      cardsRepository.findByCaseId.mockResolvedValue(mockCard as never);
      cardTransactionsRepository.findByCardId.mockResolvedValue(mockTransactions as never);
      settlementsRepository.create.mockResolvedValue({ ...mockNoneSettlement, status: 'PENDING' });
      settlementsRepository.updateStatus.mockResolvedValue(undefined);
      settlementsRepository.findById.mockResolvedValue(mockNoneSettlement);
      const mockSettledCase = { ...mockCaseInReview, status: CaseStatus.SETTLED };
      casesRepository.updateStatus.mockResolvedValue(mockSettledCase as never);

      const result = await service.settle('case-123', createdBy, userRole, SettleAction.NONE);

      expect(result).toBeDefined();
      // Settlement should be created with default values (200 deductible, 10% copay, 1000 cap)
      expect(settlementsRepository.create).toHaveBeenCalled();
    });
  });
});
