import { Test, TestingModule } from '@nestjs/testing';
import { ClaimsService } from './claims.service';
import { ClaimsRepository } from './claims.repository';
import { CasesRepository } from '../cases/cases.repository';
import { AuditLogsService } from '../audit-logs';
import { CardsRepository } from '../cards';
import { CardTransactionsRepository, CardTransactionRecord } from '../webhooks';
import { UserRole, UsersService } from '../users';
import { LoggerService, BadRequestError, NotFoundError, ERRORS } from 'src/common';
import { Claim, ClaimDocument, ClaimStatus, ClaimDocumentType } from './claims.interface';
import { Case, CaseStatus, ReasonCategory } from '../cases/cases.interface';
import { SettlementType } from './claims.dto';
import { CostShareRulesRepository, CostShareRule } from '../cost-share-rules';

describe('ClaimsService', () => {
  let service: ClaimsService;
  let claimsRepository: ClaimsRepository;
  let casesRepository: CasesRepository;

  const mockUserId = 'user-123';
  const mockCaseId = 'case-456';
  const mockClaimId = 'claim-789';

  const mockCase: Case = {
    id: mockCaseId,
    userId: mockUserId,
    hospitalName: 'Test Hospital',
    plannedVisitAt: new Date(),
    reasonCategory: ReasonCategory.SURGERY,
    status: CaseStatus.CARD_ISSUED,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockClaim: Claim = {
    id: mockClaimId,
    caseId: mockCaseId,
    billAmount: 8500,
    billCurrency: 'VND',
    billDate: new Date('2024-01-20'),
    outOfPocketAmount: 0,
    declarationAccepted: true,
    status: ClaimStatus.SUBMITTED,
    submittedAt: new Date(),
    reviewedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockDocuments: ClaimDocument[] = [
    {
      id: 'doc-1',
      claimId: mockClaimId,
      fileUrl: 'https://storage.example.com/docs/bill.pdf',
      fileName: 'hospital_bill.pdf',
      fileType: 'application/pdf',
      fileSize: 245000,
      documentType: ClaimDocumentType.BILL,
      uploadedAt: new Date(),
    },
  ];

  const mockSubmitClaimDto = {
    billAmount: 8500,
    billCurrency: 'VND',
    billDate: '2024-01-20',
    outOfPocketAmount: 0,
    documents: [
      {
        fileUrl: 'https://storage.example.com/docs/bill.pdf',
        fileName: 'hospital_bill.pdf',
        fileType: 'application/pdf',
        fileSize: 245000,
        documentType: ClaimDocumentType.BILL,
      },
    ],
    declarationAccepted: true,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClaimsService,
        {
          provide: ClaimsRepository,
          useValue: {
            findById: jest.fn(),
            findByCaseId: jest.fn(),
            create: jest.fn(),
            createDocuments: jest.fn(),
            findDocumentsByClaimId: jest.fn(),
            updateReview: jest.fn(),
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
          provide: AuditLogsService,
          useValue: {
            log: jest.fn(),
          },
        },
        {
          provide: CardsRepository,
          useValue: {
            findByCaseId: jest.fn(),
          },
        },
        {
          provide: CardTransactionsRepository,
          useValue: {
            findByCardId: jest.fn(),
          },
        },
        {
          provide: UsersService,
          useValue: {
            findById: jest.fn(),
          },
        },
        {
          provide: CostShareRulesRepository,
          useValue: {
            findActive: jest.fn(),
          },
        },
        {
          provide: LoggerService,
          useValue: {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ClaimsService>(ClaimsService);
    claimsRepository = module.get<ClaimsRepository>(ClaimsRepository);
    casesRepository = module.get<CasesRepository>(CasesRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('submitClaim', () => {
    it('should successfully submit a claim', async () => {
      // Arrange
      jest.spyOn(casesRepository, 'findById').mockResolvedValue(mockCase);
      jest.spyOn(claimsRepository, 'findByCaseId').mockResolvedValue(null);
      jest.spyOn(claimsRepository, 'create').mockResolvedValue(mockClaim);
      jest.spyOn(claimsRepository, 'createDocuments').mockResolvedValue(mockDocuments);
      jest.spyOn(casesRepository, 'updateStatus').mockResolvedValue(mockCase);

      // Act
      const result = await service.submitClaim(mockCaseId, mockUserId, mockSubmitClaimDto);

      // Assert
      expect(result.claim).toEqual(mockClaim);
      expect(result.documents).toEqual(mockDocuments);
      expect(casesRepository.updateStatus).toHaveBeenCalledWith(
        mockCaseId,
        CaseStatus.CLAIM_SUBMITTED,
        mockUserId,
      );
    });

    it('should throw NotFoundError when case not found', async () => {
      // Arrange
      jest.spyOn(casesRepository, 'findById').mockResolvedValue(null);

      // Act & Assert
      await expect(service.submitClaim(mockCaseId, mockUserId, mockSubmitClaimDto)).rejects.toThrow(
        NotFoundError,
      );
      await expect(service.submitClaim(mockCaseId, mockUserId, mockSubmitClaimDto)).rejects.toThrow(
        ERRORS.CASE_002,
      );
    });

    it('should throw NotFoundError when case belongs to different user', async () => {
      // Arrange
      const caseWithDifferentUser: Case = { ...mockCase, userId: 'other-user' };
      jest.spyOn(casesRepository, 'findById').mockResolvedValue(caseWithDifferentUser);

      // Act & Assert
      await expect(service.submitClaim(mockCaseId, mockUserId, mockSubmitClaimDto)).rejects.toThrow(
        NotFoundError,
      );
    });

    it('should throw BadRequestError when claim already exists', async () => {
      // Arrange
      jest.spyOn(casesRepository, 'findById').mockResolvedValue(mockCase);
      jest.spyOn(claimsRepository, 'findByCaseId').mockResolvedValue(mockClaim);

      // Act & Assert
      await expect(service.submitClaim(mockCaseId, mockUserId, mockSubmitClaimDto)).rejects.toThrow(
        BadRequestError,
      );
      await expect(service.submitClaim(mockCaseId, mockUserId, mockSubmitClaimDto)).rejects.toThrow(
        ERRORS.CLAIM_001,
      );
    });

    it('should throw BadRequestError when case status is invalid', async () => {
      // Arrange
      const caseWithInvalidStatus: Case = { ...mockCase, status: CaseStatus.DRAFT };
      jest.spyOn(casesRepository, 'findById').mockResolvedValue(caseWithInvalidStatus);
      jest.spyOn(claimsRepository, 'findByCaseId').mockResolvedValue(null);

      // Act & Assert
      await expect(service.submitClaim(mockCaseId, mockUserId, mockSubmitClaimDto)).rejects.toThrow(
        BadRequestError,
      );
    });

    it('should throw BadRequestError when bill date is in future', async () => {
      // Arrange
      jest.spyOn(casesRepository, 'findById').mockResolvedValue(mockCase);
      jest.spyOn(claimsRepository, 'findByCaseId').mockResolvedValue(null);

      const futureDateDto = {
        ...mockSubmitClaimDto,
        billDate: '2099-12-31',
      };

      // Act & Assert
      await expect(service.submitClaim(mockCaseId, mockUserId, futureDateDto)).rejects.toThrow(
        BadRequestError,
      );
      await expect(service.submitClaim(mockCaseId, mockUserId, futureDateDto)).rejects.toThrow(
        ERRORS.CLAIM_004,
      );
    });

    it('should throw BadRequestError when currency is not VND', async () => {
      // Arrange
      jest.spyOn(casesRepository, 'findById').mockResolvedValue(mockCase);
      jest.spyOn(claimsRepository, 'findByCaseId').mockResolvedValue(null);

      const invalidCurrencyDto = {
        ...mockSubmitClaimDto,
        billCurrency: 'USD',
      };

      // Act & Assert
      await expect(service.submitClaim(mockCaseId, mockUserId, invalidCurrencyDto)).rejects.toThrow(
        BadRequestError,
      );
      await expect(service.submitClaim(mockCaseId, mockUserId, invalidCurrencyDto)).rejects.toThrow(
        ERRORS.CLAIM_005,
      );
    });

    it('should throw BadRequestError when declaration not accepted', async () => {
      // Arrange
      jest.spyOn(casesRepository, 'findById').mockResolvedValue(mockCase);
      jest.spyOn(claimsRepository, 'findByCaseId').mockResolvedValue(null);

      const noDeclarationDto = {
        ...mockSubmitClaimDto,
        declarationAccepted: false,
      };

      // Act & Assert
      await expect(service.submitClaim(mockCaseId, mockUserId, noDeclarationDto)).rejects.toThrow(
        BadRequestError,
      );
      await expect(service.submitClaim(mockCaseId, mockUserId, noDeclarationDto)).rejects.toThrow(
        ERRORS.CLAIM_006,
      );
    });

    it('should allow submission when case status is PAID', async () => {
      // Arrange
      const paidCase: Case = { ...mockCase, status: CaseStatus.PAID };
      jest.spyOn(casesRepository, 'findById').mockResolvedValue(paidCase);
      jest.spyOn(claimsRepository, 'findByCaseId').mockResolvedValue(null);
      jest.spyOn(claimsRepository, 'create').mockResolvedValue(mockClaim);
      jest.spyOn(claimsRepository, 'createDocuments').mockResolvedValue(mockDocuments);
      jest.spyOn(casesRepository, 'updateStatus').mockResolvedValue(paidCase);

      // Act
      const result = await service.submitClaim(mockCaseId, mockUserId, mockSubmitClaimDto);

      // Assert
      expect(result.claim).toEqual(mockClaim);
    });
  });

  describe('getClaimByCaseId', () => {
    it('should successfully get claim with documents', async () => {
      // Arrange
      jest.spyOn(casesRepository, 'findById').mockResolvedValue(mockCase);
      jest.spyOn(claimsRepository, 'findByCaseId').mockResolvedValue(mockClaim);
      jest.spyOn(claimsRepository, 'findDocumentsByClaimId').mockResolvedValue(mockDocuments);

      // Act
      const result = await service.getClaimByCaseId(mockCaseId, mockUserId);

      // Assert
      expect(result.claim).toEqual(mockClaim);
      expect(result.documents).toEqual(mockDocuments);
      expect(claimsRepository.findDocumentsByClaimId).toHaveBeenCalledWith(mockClaimId);
    });

    it('should throw NotFoundError when case not found', async () => {
      // Arrange
      jest.spyOn(casesRepository, 'findById').mockResolvedValue(null);

      // Act & Assert
      await expect(service.getClaimByCaseId(mockCaseId, mockUserId)).rejects.toThrow(NotFoundError);
      await expect(service.getClaimByCaseId(mockCaseId, mockUserId)).rejects.toThrow(
        ERRORS.CASE_002,
      );
    });

    it('should throw NotFoundError when case belongs to different user', async () => {
      // Arrange
      const caseWithDifferentUser: Case = { ...mockCase, userId: 'other-user' };
      jest.spyOn(casesRepository, 'findById').mockResolvedValue(caseWithDifferentUser);

      // Act & Assert
      await expect(service.getClaimByCaseId(mockCaseId, mockUserId)).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when claim not found', async () => {
      // Arrange
      jest.spyOn(casesRepository, 'findById').mockResolvedValue(mockCase);
      jest.spyOn(claimsRepository, 'findByCaseId').mockResolvedValue(null);

      // Act & Assert
      await expect(service.getClaimByCaseId(mockCaseId, mockUserId)).rejects.toThrow(NotFoundError);
      await expect(service.getClaimByCaseId(mockCaseId, mockUserId)).rejects.toThrow(
        ERRORS.CLAIM_003,
      );
    });
  });

  describe('reviewClaim', () => {
    const mockReviewerId = 'ops-user-123';
    const mockUserRole = UserRole.OPS_REVIEWER;
    const mockReviewDto = {
      reviewedBillAmount: 8500,
      isValid: true,
      reviewNotes: 'All documents verified',
    };

    const mockCaseForReview: Case = {
      ...mockCase,
      status: CaseStatus.CLAIM_SUBMITTED,
    };

    const mockReviewedClaim: Claim = {
      ...mockClaim,
      reviewedBillAmount: 8500,
      isValid: true,
      reviewNotes: 'All documents verified',
      reviewedBy: mockReviewerId,
      reviewedAt: new Date(),
      status: ClaimStatus.APPROVED,
    };

    it('should successfully review and approve a claim', async () => {
      // Arrange
      jest.spyOn(claimsRepository, 'findById').mockResolvedValue(mockClaim);
      jest.spyOn(casesRepository, 'findById').mockResolvedValue(mockCaseForReview);
      jest.spyOn(claimsRepository, 'updateReview').mockResolvedValue(mockReviewedClaim);
      jest.spyOn(casesRepository, 'updateStatus').mockResolvedValue({
        ...mockCaseForReview,
        status: CaseStatus.IN_REVIEW,
      });

      // Act
      const result = await service.reviewClaim(
        mockClaimId,
        mockReviewerId,
        mockUserRole,
        mockReviewDto,
      );

      // Assert
      expect(result.id).toEqual(mockClaimId);
      expect(result.reviewedBillAmount).toEqual(8500);
      expect(result.isValid).toEqual(true);
      expect(result.status).toEqual(ClaimStatus.APPROVED);
      expect(claimsRepository.updateReview).toHaveBeenCalledWith(
        mockClaimId,
        expect.objectContaining({
          reviewedBillAmount: 8500,
          isValid: true,
          reviewNotes: 'All documents verified',
          reviewedBy: mockReviewerId,
          status: ClaimStatus.APPROVED,
        }),
      );
      expect(casesRepository.updateStatus).toHaveBeenCalledWith(
        mockCaseId,
        CaseStatus.IN_REVIEW,
        mockReviewerId,
      );
    });

    it('should successfully review and reject a claim', async () => {
      // Arrange
      const rejectDto = {
        reviewedBillAmount: 8500,
        isValid: false,
        reviewNotes: 'Invalid documents',
      };
      const rejectedClaim: Claim = {
        ...mockClaim,
        reviewedBillAmount: 8500,
        isValid: false,
        status: ClaimStatus.REJECTED,
        reviewedAt: new Date(),
      };

      jest.spyOn(claimsRepository, 'findById').mockResolvedValue(mockClaim);
      jest.spyOn(casesRepository, 'findById').mockResolvedValue(mockCaseForReview);
      jest.spyOn(claimsRepository, 'updateReview').mockResolvedValue(rejectedClaim);
      jest.spyOn(casesRepository, 'updateStatus').mockResolvedValue({
        ...mockCaseForReview,
        status: CaseStatus.IN_REVIEW,
      });

      // Act
      const result = await service.reviewClaim(
        mockClaimId,
        mockReviewerId,
        mockUserRole,
        rejectDto,
      );

      // Assert
      expect(result.status).toEqual(ClaimStatus.REJECTED);
      expect(claimsRepository.updateReview).toHaveBeenCalledWith(
        mockClaimId,
        expect.objectContaining({
          isValid: false,
          status: ClaimStatus.REJECTED,
        }),
      );
      expect(casesRepository.updateStatus).toHaveBeenCalledWith(
        mockCaseId,
        CaseStatus.IN_REVIEW,
        mockReviewerId,
      );
    });

    it('should throw NotFoundError when claim not found', async () => {
      // Arrange
      jest.spyOn(claimsRepository, 'findById').mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.reviewClaim(mockClaimId, mockReviewerId, mockUserRole, mockReviewDto),
      ).rejects.toThrow(NotFoundError);
      await expect(
        service.reviewClaim(mockClaimId, mockReviewerId, mockUserRole, mockReviewDto),
      ).rejects.toThrow(ERRORS.CLAIM_003);
    });

    it('should throw BadRequestError when reviewed amount exceeds bill amount', async () => {
      // Arrange
      const exceedingDto = {
        reviewedBillAmount: 10000, // Exceeds billAmount of 8500
        isValid: true,
      };
      jest.spyOn(claimsRepository, 'findById').mockResolvedValue(mockClaim);
      jest.spyOn(casesRepository, 'findById').mockResolvedValue(mockCaseForReview);

      // Act & Assert
      await expect(
        service.reviewClaim(mockClaimId, mockReviewerId, mockUserRole, exceedingDto),
      ).rejects.toThrow(BadRequestError);
      await expect(
        service.reviewClaim(mockClaimId, mockReviewerId, mockUserRole, exceedingDto),
      ).rejects.toThrow(ERRORS.CLAIM_007);
    });

    it('should throw NotFoundError when case not found', async () => {
      // Arrange
      jest.spyOn(claimsRepository, 'findById').mockResolvedValue(mockClaim);
      jest.spyOn(casesRepository, 'findById').mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.reviewClaim(mockClaimId, mockReviewerId, mockUserRole, mockReviewDto),
      ).rejects.toThrow(NotFoundError);
      await expect(
        service.reviewClaim(mockClaimId, mockReviewerId, mockUserRole, mockReviewDto),
      ).rejects.toThrow(ERRORS.CASE_002);
    });

    it('should throw BadRequestError when case status is invalid for review', async () => {
      // Arrange - case is in DRAFT status, not CLAIM_SUBMITTED
      const invalidStatusCase: Case = { ...mockCase, status: CaseStatus.DRAFT };
      jest.spyOn(claimsRepository, 'findById').mockResolvedValue(mockClaim);
      jest.spyOn(casesRepository, 'findById').mockResolvedValue(invalidStatusCase);

      // Act & Assert
      await expect(
        service.reviewClaim(mockClaimId, mockReviewerId, mockUserRole, mockReviewDto),
      ).rejects.toThrow(BadRequestError);
    });
  });

  describe('calculateSettlementPreview (via findByIdForOps)', () => {
    let cardsRepository: CardsRepository;
    let cardTransactionsRepository: CardTransactionsRepository;
    let usersService: UsersService;
    let costShareRulesRepository: CostShareRulesRepository;

    const mockUser = {
      id: mockUserId,
      name: 'Test User',
      email: 'test@example.com',
    };

    const mockCard = {
      id: 'card-123',
      caseId: mockCaseId,
    };

    const mockCostShareRule: CostShareRule = {
      id: 'rule-123',
      name: 'default',
      deductibleAmount: 200,
      copayPercentage: 10,
      copayCap: 1000,
      applyAtSettlement: true,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ClaimsService,
          {
            provide: ClaimsRepository,
            useValue: {
              findById: jest.fn(),
              findByCaseId: jest.fn(),
              create: jest.fn(),
              createDocuments: jest.fn(),
              findDocumentsByClaimId: jest.fn(),
              updateReview: jest.fn(),
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
            provide: AuditLogsService,
            useValue: {
              log: jest.fn(),
            },
          },
          {
            provide: CardsRepository,
            useValue: {
              findByCaseId: jest.fn(),
            },
          },
          {
            provide: CardTransactionsRepository,
            useValue: {
              findByCardId: jest.fn(),
            },
          },
          {
            provide: UsersService,
            useValue: {
              findById: jest.fn(),
            },
          },
          {
            provide: CostShareRulesRepository,
            useValue: {
              findActive: jest.fn(),
            },
          },
          {
            provide: LoggerService,
            useValue: {
              info: jest.fn(),
              error: jest.fn(),
              warn: jest.fn(),
            },
          },
        ],
      }).compile();

      service = module.get<ClaimsService>(ClaimsService);
      claimsRepository = module.get<ClaimsRepository>(ClaimsRepository);
      casesRepository = module.get<CasesRepository>(CasesRepository);
      cardsRepository = module.get<CardsRepository>(CardsRepository);
      cardTransactionsRepository = module.get<CardTransactionsRepository>(
        CardTransactionsRepository,
      );
      usersService = module.get<UsersService>(UsersService);
      costShareRulesRepository = module.get<CostShareRulesRepository>(CostShareRulesRepository);
    });

    const setupMocks = (
      claim: Claim,
      caseData: Partial<Case>,
      transactions: CardTransactionRecord[] = [],
      costShareRule: CostShareRule | null = mockCostShareRule,
    ): void => {
      jest.spyOn(claimsRepository, 'findById').mockResolvedValue(claim);
      jest.spyOn(claimsRepository, 'findDocumentsByClaimId').mockResolvedValue(mockDocuments);
      jest.spyOn(casesRepository, 'findById').mockResolvedValue({
        ...mockCase,
        ...caseData,
      } as Case);
      jest.spyOn(usersService, 'findById').mockResolvedValue(mockUser as never);
      jest.spyOn(cardsRepository, 'findByCaseId').mockResolvedValue(mockCard as never);
      jest.spyOn(cardTransactionsRepository, 'findByCardId').mockResolvedValue(transactions);
      jest.spyOn(costShareRulesRepository, 'findActive').mockResolvedValue(costShareRule);
    };

    it('should return null settlementPreview when claim has no submittedAt', async () => {
      // Arrange
      const claimWithoutSubmit: Claim = {
        ...mockClaim,
        submittedAt: null,
      };
      setupMocks(claimWithoutSubmit, { approvedAmount: 10000 });

      // Act
      const result = await service.findByIdForOps(mockClaimId);

      // Assert
      expect(result.settlementPreview).toBeNull();
    });

    it('should use reviewedBillAmount when available', async () => {
      // Arrange
      const claimWithReview: Claim = {
        ...mockClaim,
        billAmount: 10000,
        reviewedBillAmount: 8000,
        submittedAt: new Date(),
      };
      setupMocks(claimWithReview, { approvedAmount: 15000 });

      // Act
      const result = await service.findByIdForOps(mockClaimId);

      // Assert
      expect(result.settlementPreview).not.toBeNull();
      expect(result.settlementPreview!.reviewedBillAmount).toBe(8000);
    });

    it('should fall back to billAmount when reviewedBillAmount is null', async () => {
      // Arrange
      const claimWithoutReview: Claim = {
        ...mockClaim,
        billAmount: 10000,
        reviewedBillAmount: null,
        submittedAt: new Date(),
      };
      setupMocks(claimWithoutReview, { approvedAmount: 15000 });

      // Act
      const result = await service.findByIdForOps(mockClaimId);

      // Assert
      expect(result.settlementPreview).not.toBeNull();
      expect(result.settlementPreview!.reviewedBillAmount).toBe(10000);
    });

    it('should calculate insurerLiability as min of approvedAmount and reviewedBillAmount', async () => {
      // Arrange - approvedAmount (5000) < reviewedBillAmount (8000)
      const claim: Claim = {
        ...mockClaim,
        billAmount: 8000,
        reviewedBillAmount: 8000,
        submittedAt: new Date(),
      };
      setupMocks(claim, { approvedAmount: 5000 });

      // Act
      const result = await service.findByIdForOps(mockClaimId);

      // Assert
      expect(result.settlementPreview!.insurerLiability).toBe(5000);
    });

    it('should calculate insurerLiability when reviewedBillAmount is less than approvedAmount', async () => {
      // Arrange - reviewedBillAmount (3000) < approvedAmount (10000)
      const claim: Claim = {
        ...mockClaim,
        billAmount: 3000,
        reviewedBillAmount: 3000,
        submittedAt: new Date(),
      };
      setupMocks(claim, { approvedAmount: 10000 });

      // Act
      const result = await service.findByIdForOps(mockClaimId);

      // Assert
      expect(result.settlementPreview!.insurerLiability).toBe(3000);
    });

    it('should apply deductible of VND 200', async () => {
      // Arrange
      const claim: Claim = {
        ...mockClaim,
        billAmount: 5000,
        submittedAt: new Date(),
      };
      setupMocks(claim, { approvedAmount: 10000 });

      // Act
      const result = await service.findByIdForOps(mockClaimId);

      // Assert
      expect(result.settlementPreview!.deductible).toBe(200);
    });

    it('should calculate copay as 10% of amount after deductible', async () => {
      // Arrange
      // insurerLiability = 5000, deductible = 200
      // copayBase = 5000 - 200 = 4800
      // copayAmount = 4800 * 0.1 = 480
      const claim: Claim = {
        ...mockClaim,
        billAmount: 5000,
        submittedAt: new Date(),
      };
      setupMocks(claim, { approvedAmount: 10000 });

      // Act
      const result = await service.findByIdForOps(mockClaimId);

      // Assert
      expect(result.settlementPreview!.copayAmount).toBe(480);
    });

    it('should apply copay cap of VND 1000 when copay exceeds cap', async () => {
      // Arrange
      // insurerLiability = 15000, deductible = 200
      // copayBase = 15000 - 200 = 14800
      // copayAmount = 14800 * 0.1 = 1480, but capped at 1000
      const claim: Claim = {
        ...mockClaim,
        billAmount: 15000,
        submittedAt: new Date(),
      };
      setupMocks(claim, { approvedAmount: 20000 });

      // Act
      const result = await service.findByIdForOps(mockClaimId);

      // Assert
      expect(result.settlementPreview!.copayAmount).toBe(1000);
    });

    it('should calculate userCostShare as deductible + copayAmount', async () => {
      // Arrange
      // insurerLiability = 5000, deductible = 200, copay = 480
      // userCostShare = 200 + 480 = 680
      const claim: Claim = {
        ...mockClaim,
        billAmount: 5000,
        submittedAt: new Date(),
      };
      setupMocks(claim, { approvedAmount: 10000 });

      // Act
      const result = await service.findByIdForOps(mockClaimId);

      // Assert
      expect(result.settlementPreview!.userCostShare).toBe(680);
    });

    it('should calculate platformExpectedPay as insurerLiability - userCostShare', async () => {
      // Arrange
      // insurerLiability = 5000, userCostShare = 680
      // platformExpectedPay = 5000 - 680 = 4320
      const claim: Claim = {
        ...mockClaim,
        billAmount: 5000,
        submittedAt: new Date(),
      };
      setupMocks(claim, { approvedAmount: 10000 });

      // Act
      const result = await service.findByIdForOps(mockClaimId);

      // Assert
      expect(result.settlementPreview!.platformExpectedPay).toBe(4320);
    });

    it('should only sum SUCCEEDED transactions for cardPaidAmount', async () => {
      // Arrange
      const claim: Claim = {
        ...mockClaim,
        billAmount: 5000,
        submittedAt: new Date(),
      };
      const transactions: CardTransactionRecord[] = [
        {
          id: 'tx-1',
          cardId: 'card-123',
          airwallexTxnId: 'awx-tx-1',
          amount: 1000,
          currency: 'VND',
          merchantName: 'Test Hospital',
          merchantCategory: 'MEDICAL',
          status: 'SUCCEEDED',
          authorizationCode: 'AUTH001',
          transactionAt: new Date(),
          createdAt: new Date(),
        },
        {
          id: 'tx-2',
          cardId: 'card-123',
          airwallexTxnId: 'awx-tx-2',
          amount: 2000,
          currency: 'VND',
          merchantName: 'Test Hospital',
          merchantCategory: 'MEDICAL',
          status: 'SUCCEEDED',
          authorizationCode: 'AUTH002',
          transactionAt: new Date(),
          createdAt: new Date(),
        },
        {
          id: 'tx-3',
          cardId: 'card-123',
          airwallexTxnId: 'awx-tx-3',
          amount: 500,
          currency: 'VND',
          merchantName: 'Test Hospital',
          merchantCategory: 'MEDICAL',
          status: 'FAILED',
          authorizationCode: null,
          transactionAt: new Date(),
          createdAt: new Date(),
        },
        {
          id: 'tx-4',
          cardId: 'card-123',
          airwallexTxnId: 'awx-tx-4',
          amount: 300,
          currency: 'VND',
          merchantName: 'Test Hospital',
          merchantCategory: 'MEDICAL',
          status: 'PENDING',
          authorizationCode: null,
          transactionAt: new Date(),
          createdAt: new Date(),
        },
      ];
      setupMocks(claim, { approvedAmount: 10000 }, transactions);

      // Act
      const result = await service.findByIdForOps(mockClaimId);

      // Assert
      expect(result.settlementPreview!.cardPaidAmount).toBe(3000); // Only 1000 + 2000
    });

    it('should return COLLECT settlementType when cardPaidAmount > platformExpectedPay', async () => {
      // Arrange
      // platformExpectedPay = 4320, cardPaidAmount = 5000
      // difference = 5000 - 4320 = 680 (positive = COLLECT)
      const claim: Claim = {
        ...mockClaim,
        billAmount: 5000,
        submittedAt: new Date(),
      };
      const transactions: CardTransactionRecord[] = [
        {
          id: 'tx-1',
          cardId: 'card-123',
          airwallexTxnId: 'awx-tx-1',
          amount: 5000,
          currency: 'VND',
          merchantName: 'Test Hospital',
          merchantCategory: 'MEDICAL',
          status: 'SUCCEEDED',
          authorizationCode: 'AUTH001',
          transactionAt: new Date(),
          createdAt: new Date(),
        },
      ];
      setupMocks(claim, { approvedAmount: 10000 }, transactions);

      // Act
      const result = await service.findByIdForOps(mockClaimId);

      // Assert
      expect(result.settlementPreview!.settlementType).toBe(SettlementType.COLLECT);
      expect(result.settlementPreview!.difference).toBe(680);
    });

    it('should return PAYOUT settlementType when cardPaidAmount < platformExpectedPay', async () => {
      // Arrange
      // platformExpectedPay = 4320, cardPaidAmount = 3000
      // difference = 3000 - 4320 = -1320 (negative = PAYOUT)
      const claim: Claim = {
        ...mockClaim,
        billAmount: 5000,
        submittedAt: new Date(),
      };
      const transactions: CardTransactionRecord[] = [
        {
          id: 'tx-1',
          cardId: 'card-123',
          airwallexTxnId: 'awx-tx-1',
          amount: 3000,
          currency: 'VND',
          merchantName: 'Test Hospital',
          merchantCategory: 'MEDICAL',
          status: 'SUCCEEDED',
          authorizationCode: 'AUTH001',
          transactionAt: new Date(),
          createdAt: new Date(),
        },
      ];
      setupMocks(claim, { approvedAmount: 10000 }, transactions);

      // Act
      const result = await service.findByIdForOps(mockClaimId);

      // Assert
      expect(result.settlementPreview!.settlementType).toBe(SettlementType.PAYOUT);
      expect(result.settlementPreview!.difference).toBe(1320);
    });

    it('should return NONE settlementType when cardPaidAmount equals platformExpectedPay', async () => {
      // Arrange
      // platformExpectedPay = 4320, cardPaidAmount = 4320
      const claim: Claim = {
        ...mockClaim,
        billAmount: 5000,
        submittedAt: new Date(),
      };
      const transactions: CardTransactionRecord[] = [
        {
          id: 'tx-1',
          cardId: 'card-123',
          airwallexTxnId: 'awx-tx-1',
          amount: 4320,
          currency: 'VND',
          merchantName: 'Test Hospital',
          merchantCategory: 'MEDICAL',
          status: 'SUCCEEDED',
          authorizationCode: 'AUTH001',
          transactionAt: new Date(),
          createdAt: new Date(),
        },
      ];
      setupMocks(claim, { approvedAmount: 10000 }, transactions);

      // Act
      const result = await service.findByIdForOps(mockClaimId);

      // Assert
      expect(result.settlementPreview!.settlementType).toBe(SettlementType.NONE);
      expect(result.settlementPreview!.difference).toBe(0);
    });

    it('should handle zero transactions (cardPaidAmount = 0)', async () => {
      // Arrange
      const claim: Claim = {
        ...mockClaim,
        billAmount: 5000,
        submittedAt: new Date(),
      };
      setupMocks(claim, { approvedAmount: 10000 }, []);

      // Act
      const result = await service.findByIdForOps(mockClaimId);

      // Assert
      expect(result.settlementPreview!.cardPaidAmount).toBe(0);
      expect(result.settlementPreview!.settlementType).toBe(SettlementType.PAYOUT);
      expect(result.settlementPreview!.difference).toBe(4320);
    });

    it('should handle small bill amounts where copay base is zero', async () => {
      // Arrange
      // insurerLiability = 150 (less than deductible of 200)
      // copayBase = max(0, 150 - 200) = 0
      // copayAmount = 0
      // userCostShare = 200 + 0 = 200
      // platformExpectedPay = max(0, 150 - 200) = 0
      const claim: Claim = {
        ...mockClaim,
        billAmount: 150,
        submittedAt: new Date(),
      };
      setupMocks(claim, { approvedAmount: 10000 });

      // Act
      const result = await service.findByIdForOps(mockClaimId);

      // Assert
      expect(result.settlementPreview!.insurerLiability).toBe(150);
      expect(result.settlementPreview!.copayAmount).toBe(0);
      expect(result.settlementPreview!.userCostShare).toBe(200);
      expect(result.settlementPreview!.platformExpectedPay).toBe(0);
    });

    it('should handle when no card exists for the case', async () => {
      // Arrange
      const claim: Claim = {
        ...mockClaim,
        billAmount: 5000,
        submittedAt: new Date(),
      };
      jest.spyOn(claimsRepository, 'findById').mockResolvedValue(claim);
      jest.spyOn(claimsRepository, 'findDocumentsByClaimId').mockResolvedValue(mockDocuments);
      jest.spyOn(casesRepository, 'findById').mockResolvedValue({
        ...mockCase,
        approvedAmount: 10000,
      } as Case);
      jest.spyOn(usersService, 'findById').mockResolvedValue(mockUser as never);
      jest.spyOn(cardsRepository, 'findByCaseId').mockResolvedValue(null);
      jest.spyOn(costShareRulesRepository, 'findActive').mockResolvedValue(mockCostShareRule);

      // Act
      const result = await service.findByIdForOps(mockClaimId);

      // Assert
      expect(result.settlementPreview!.cardPaidAmount).toBe(0);
      expect(result.transactions).toEqual([]);
    });

    it('should calculate correctly with copay cap applied and high bill amount', async () => {
      // Arrange
      // billAmount = 20000, approvedAmount = 25000
      // insurerLiability = min(25000, 20000) = 20000
      // deductible = 200
      // copayBase = 20000 - 200 = 19800
      // copayAmount = 19800 * 0.1 = 1980, but capped at 1000
      // userCostShare = 200 + 1000 = 1200
      // platformExpectedPay = 20000 - 1200 = 18800
      const claim: Claim = {
        ...mockClaim,
        billAmount: 20000,
        submittedAt: new Date(),
      };
      const transactions: CardTransactionRecord[] = [
        {
          id: 'tx-1',
          cardId: 'card-123',
          airwallexTxnId: 'awx-tx-1',
          amount: 20000,
          currency: 'VND',
          merchantName: 'Test Hospital',
          merchantCategory: 'MEDICAL',
          status: 'SUCCEEDED',
          authorizationCode: 'AUTH001',
          transactionAt: new Date(),
          createdAt: new Date(),
        },
      ];
      setupMocks(claim, { approvedAmount: 25000 }, transactions);

      // Act
      const result = await service.findByIdForOps(mockClaimId);

      // Assert
      expect(result.settlementPreview!.insurerLiability).toBe(20000);
      expect(result.settlementPreview!.deductible).toBe(200);
      expect(result.settlementPreview!.copayAmount).toBe(1000); // Capped
      expect(result.settlementPreview!.userCostShare).toBe(1200);
      expect(result.settlementPreview!.platformExpectedPay).toBe(18800);
      expect(result.settlementPreview!.cardPaidAmount).toBe(20000);
      expect(result.settlementPreview!.difference).toBe(1200); // 20000 - 18800
      expect(result.settlementPreview!.settlementType).toBe(SettlementType.COLLECT);
    });
  });
});
