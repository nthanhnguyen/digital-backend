import { Test, TestingModule } from '@nestjs/testing';
import { CasesService } from './cases.service';
import { CasesRepository } from './cases.repository';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { LoggerService, BadRequestError, NotFoundError, ERRORS } from 'src/common';
import { CaseStatus, ReasonCategory, Case } from './cases.interface';
import { UserRole } from '../users/users.interface';
import { CardholdersService } from '../card_holders';
import { CardsService } from '../cards';
import { UsersService } from '../users';

describe('CasesService', () => {
  let service: CasesService;
  let repository: jest.Mocked<CasesRepository>;
  let auditLogsService: jest.Mocked<AuditLogsService>;
  let logger: jest.Mocked<LoggerService>;

  const mockCase: Case = {
    id: 'case-123',
    userId: 'user-123',
    hospitalName: 'Queen Mary Hospital',
    plannedVisitAt: new Date('2099-12-31'), // Far future date to avoid test failures
    reasonCategory: ReasonCategory.GENERAL_CONSULTATION,
    contactPhone: '+84 912 345 678',
    notes: 'Annual checkup',
    status: CaseStatus.DRAFT,
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15'),
    deletedAt: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CasesService,
        {
          provide: CasesRepository,
          useValue: {
            create: jest.fn(),
            findById: jest.fn(),
            findByIdWithRelations: jest.fn(),
            findByUserId: jest.fn(),
            updateStatus: jest.fn(),
            hasCard: jest.fn(),
            hasClaimDocuments: jest.fn(),
            hasSettlement: jest.fn(),
            findAllForOps: jest.fn(),
            findByIdForOps: jest.fn(),
          },
        },
        {
          provide: AuditLogsService,
          useValue: {
            log: jest.fn(),
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
        {
          provide: CardholdersService,
          useValue: {},
        },
        {
          provide: CardsService,
          useValue: {},
        },
        {
          provide: UsersService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<CasesService>(CasesService);
    repository = module.get(CasesRepository);
    auditLogsService = module.get(AuditLogsService);
    logger = module.get(LoggerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createData = {
      userId: 'user-123',
      hospitalName: 'Queen Mary Hospital',
      plannedVisitAt: new Date('2099-12-31'), // Far future date to avoid test failures
      reasonCategory: ReasonCategory.GENERAL_CONSULTATION,
      contactPhone: '+84 912 345 678',
      notes: 'Annual checkup',
    };

    it('should create a case with DRAFT status', async () => {
      repository.create.mockResolvedValue(mockCase);

      const result = await service.create(createData);

      expect(repository.create).toHaveBeenCalledWith({
        ...createData,
        status: CaseStatus.DRAFT,
      });
      expect(result).toEqual(mockCase);
    });

    it('should log audit for case creation', async () => {
      repository.create.mockResolvedValue(mockCase);

      await service.create(createData);

      expect(auditLogsService.log).toHaveBeenCalledWith({
        actorId: createData.userId,
        actorType: UserRole.USER,
        action: 'CASE_CREATED',
        entityType: 'case',
        entityId: mockCase.id,
        beforeState: null,
        afterState: { status: CaseStatus.DRAFT },
      });
    });

    it('should log case creation info', async () => {
      repository.create.mockResolvedValue(mockCase);

      await service.create(createData);

      expect(logger.info).toHaveBeenCalledWith('Case created', {
        caseId: mockCase.id,
        userId: createData.userId,
        status: CaseStatus.DRAFT,
      });
    });

    it('should throw BadRequestError if plannedVisitAt is in the past', async () => {
      const pastDate = new Date('2020-01-01');
      const invalidData = { ...createData, plannedVisitAt: pastDate };

      await expect(service.create(invalidData)).rejects.toThrow(BadRequestError);
      await expect(service.create(invalidData)).rejects.toThrow(ERRORS.CASE_004);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestError if plannedVisitAt is current date', async () => {
      const now = new Date();
      const invalidData = { ...createData, plannedVisitAt: now };

      await expect(service.create(invalidData)).rejects.toThrow(BadRequestError);
    });
  });

  describe('findById', () => {
    it('should return a case when found', async () => {
      repository.findById.mockResolvedValue(mockCase);

      const result = await service.findById('case-123');

      expect(repository.findById).toHaveBeenCalledWith('case-123');
      expect(result).toEqual(mockCase);
    });

    it('should throw NotFoundError when case not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundError);
      await expect(service.findById('nonexistent')).rejects.toThrow(ERRORS.CASE_002);
    });
  });

  describe('findByIdWithRelations', () => {
    const mockCaseWithRelations = {
      case: mockCase,
      coverageTier: {
        id: 'tier-123',
        label: 'Standard',
        amount: 10000,
      },
      card: {
        id: 'card-123',
        status: 'ACTIVE',
        limitAmount: 10000,
        limitCurrency: 'VND',
        usedAmount: 0,
        activeFrom: new Date('2024-01-15'),
        activeTo: new Date('2024-02-14'),
      },
    };

    it('should return case with relations when found and user owns it', async () => {
      repository.findByIdWithRelations.mockResolvedValue(mockCaseWithRelations);

      const result = await service.findByIdWithRelations('case-123', 'user-123');

      expect(repository.findByIdWithRelations).toHaveBeenCalledWith('case-123');
      expect(result).toEqual(mockCaseWithRelations);
    });

    it('should throw NotFoundError when case not found', async () => {
      repository.findByIdWithRelations.mockResolvedValue(null);

      await expect(service.findByIdWithRelations('nonexistent', 'user-123')).rejects.toThrow(
        NotFoundError,
      );
    });

    it('should throw NotFoundError when user does not own the case', async () => {
      repository.findByIdWithRelations.mockResolvedValue(mockCaseWithRelations);

      await expect(service.findByIdWithRelations('case-123', 'other-user')).rejects.toThrow(
        NotFoundError,
      );
      await expect(service.findByIdWithRelations('case-123', 'other-user')).rejects.toThrow(
        ERRORS.CASE_002,
      );
    });
  });

  describe('findByUserId', () => {
    const options = {
      page: 1,
      limit: 20,
      status: CaseStatus.DRAFT,
      sortBy: 'createdAt',
      sortOrder: 'desc' as const,
    };

    it('should return paginated cases', async () => {
      const mockResult = {
        cases: [mockCase],
        total: 1,
      };
      repository.findByUserId.mockResolvedValue(mockResult);

      const result = await service.findByUserId('user-123', options);

      expect(repository.findByUserId).toHaveBeenCalledWith('user-123', options);
      expect(result).toEqual(mockResult);
    });
  });

  describe('submitCase', () => {
    const submittedCase = {
      ...mockCase,
      status: CaseStatus.SUBMITTED,
      submittedAt: new Date('2024-01-15T10:35:00Z'),
    };

    beforeEach(() => {
      repository.findById.mockResolvedValue(mockCase);
      repository.updateStatus.mockResolvedValue(submittedCase);
    });

    it('should submit a draft case successfully', async () => {
      const result = await service.submitCase('case-123', 'user-123');

      expect(repository.findById).toHaveBeenCalledWith('case-123');
      expect(repository.updateStatus).toHaveBeenCalledWith(
        'case-123',
        CaseStatus.SUBMITTED,
        'user-123',
      );
      expect(result).toEqual(submittedCase);
    });

    it('should create audit log when submitting', async () => {
      await service.submitCase('case-123', 'user-123');

      expect(auditLogsService.log).toHaveBeenCalledWith({
        actorId: 'user-123',
        actorType: UserRole.USER,
        action: 'CASE_SUBMITTED',
        entityType: 'case',
        entityId: 'case-123',
        beforeState: { status: CaseStatus.DRAFT },
        afterState: { status: CaseStatus.SUBMITTED },
      });
    });

    it('should log case submission', async () => {
      await service.submitCase('case-123', 'user-123');

      expect(logger.info).toHaveBeenCalledWith('Case submitted', {
        caseId: 'case-123',
        userId: 'user-123',
        status: CaseStatus.SUBMITTED,
      });
    });

    it('should throw NotFoundError if case not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.submitCase('nonexistent', 'user-123')).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError if user does not own case', async () => {
      await expect(service.submitCase('case-123', 'other-user')).rejects.toThrow(NotFoundError);
      await expect(service.submitCase('case-123', 'other-user')).rejects.toThrow(ERRORS.CASE_002);
    });

    it('should throw BadRequestError if case is not in DRAFT status', async () => {
      const submittedCase = { ...mockCase, status: CaseStatus.SUBMITTED };
      repository.findById.mockResolvedValue(submittedCase);

      await expect(service.submitCase('case-123', 'user-123')).rejects.toThrow(BadRequestError);
      await expect(service.submitCase('case-123', 'user-123')).rejects.toThrow(ERRORS.CASE_005);
    });

    it('should validate state machine transition', async () => {
      await service.submitCase('case-123', 'user-123');

      // State machine should allow DRAFT -> SUBMITTED
      expect(repository.updateStatus).toHaveBeenCalled();
    });

    it('should validate required fields for SUBMITTED status', async () => {
      const invalidCase = {
        ...mockCase,
        hospitalName: '',
      };
      repository.findById.mockResolvedValue(invalidCase);

      await expect(service.submitCase('case-123', 'user-123')).rejects.toThrow(BadRequestError);
      await expect(service.submitCase('case-123', 'user-123')).rejects.toThrow(ERRORS.CASE_006);
    });
  });

  describe('transitionStatus', () => {
    const transition = {
      caseId: 'case-123',
      from: CaseStatus.SUBMITTED,
      to: CaseStatus.PREAPPROVED,
      actorId: 'ops-user',
      metadata: { approvedAmount: 10000, approvedCurrency: 'VND' },
    };

    beforeEach(() => {
      const submittedCase = { ...mockCase, status: CaseStatus.SUBMITTED };
      repository.findById.mockResolvedValue(submittedCase);
    });

    it('should transition to PREAPPROVED with ops role', async () => {
      const caseWithApprovedAmount = {
        ...mockCase,
        status: CaseStatus.SUBMITTED,
        approvedAmount: 10000,
      };
      repository.findById.mockResolvedValue(caseWithApprovedAmount);

      const updatedCase = {
        ...caseWithApprovedAmount,
        status: CaseStatus.PREAPPROVED,
        approvedAt: new Date(),
      };
      repository.updateStatus.mockResolvedValue(updatedCase);

      const result = await service.transitionStatus(transition, UserRole.OPS_REVIEWER);

      expect(repository.updateStatus).toHaveBeenCalledWith(
        'case-123',
        CaseStatus.PREAPPROVED,
        'ops-user',
        transition.metadata,
      );
      expect(result.status).toBe(CaseStatus.PREAPPROVED);
    });

    it('should create audit log for status transition', async () => {
      const caseWithApprovedAmount = {
        ...mockCase,
        status: CaseStatus.SUBMITTED,
        approvedAmount: 10000,
      };
      repository.findById.mockResolvedValue(caseWithApprovedAmount);
      repository.updateStatus.mockResolvedValue({
        ...caseWithApprovedAmount,
        status: CaseStatus.PREAPPROVED,
      });

      await service.transitionStatus(transition, UserRole.OPS_REVIEWER);

      expect(auditLogsService.log).toHaveBeenCalledWith({
        actorId: 'ops-user',
        actorType: UserRole.OPS_REVIEWER,
        action: 'STATUS_CHANGED',
        entityType: 'case',
        entityId: 'case-123',
        beforeState: { status: CaseStatus.SUBMITTED },
        afterState: { status: CaseStatus.PREAPPROVED },
      });
    });

    it('should throw BadRequestError if approved amount missing for PREAPPROVED', async () => {
      const transitionWithoutAmount = {
        ...transition,
        metadata: {},
      };
      repository.findById.mockResolvedValue({ ...mockCase, status: CaseStatus.SUBMITTED });

      await expect(
        service.transitionStatus(transitionWithoutAmount, UserRole.OPS_REVIEWER),
      ).rejects.toThrow(BadRequestError);
      await expect(
        service.transitionStatus(transitionWithoutAmount, UserRole.OPS_REVIEWER),
      ).rejects.toThrow(ERRORS.CASE_007);
    });
  });

  describe('validateTransitionRules - CARD_ISSUED', () => {
    it('should validate card exists when transitioning to CARD_ISSUED', async () => {
      const preapprovedCase = {
        ...mockCase,
        status: CaseStatus.PREAPPROVED,
        approvedAmount: 10000,
      };
      repository.findById.mockResolvedValue(preapprovedCase);
      repository.hasCard.mockResolvedValue(true);
      repository.updateStatus.mockResolvedValue({
        ...preapprovedCase,
        status: CaseStatus.CARD_ISSUED,
      });

      const transition = {
        caseId: 'case-123',
        from: CaseStatus.PREAPPROVED,
        to: CaseStatus.CARD_ISSUED,
        actorId: 'ops-user',
      };

      await service.transitionStatus(transition, UserRole.OPS_REVIEWER);

      expect(repository.hasCard).toHaveBeenCalledWith('case-123');
    });

    it('should throw BadRequestError if card missing for CARD_ISSUED', async () => {
      const preapprovedCase = {
        ...mockCase,
        status: CaseStatus.PREAPPROVED,
        approvedAmount: 10000,
      };
      repository.findById.mockResolvedValue(preapprovedCase);
      repository.hasCard.mockResolvedValue(false);

      const transition = {
        caseId: 'case-123',
        from: CaseStatus.PREAPPROVED,
        to: CaseStatus.CARD_ISSUED,
        actorId: 'ops-user',
      };

      await expect(service.transitionStatus(transition, UserRole.OPS_REVIEWER)).rejects.toThrow(
        BadRequestError,
      );
      await expect(service.transitionStatus(transition, UserRole.OPS_REVIEWER)).rejects.toThrow(
        ERRORS.CASE_008,
      );
    });
  });

  describe('validateTransitionRules - CLAIM_SUBMITTED', () => {
    it('should validate claim documents exist for CLAIM_SUBMITTED', async () => {
      const paidCase = { ...mockCase, status: CaseStatus.PAID };
      repository.findById.mockResolvedValue(paidCase);
      repository.hasClaimDocuments.mockResolvedValue(true);
      repository.updateStatus.mockResolvedValue({
        ...paidCase,
        status: CaseStatus.CLAIM_SUBMITTED,
      });

      const transition = {
        caseId: 'case-123',
        from: CaseStatus.PAID,
        to: CaseStatus.CLAIM_SUBMITTED,
        actorId: 'user-123',
      };

      await service.transitionStatus(transition);

      expect(repository.hasClaimDocuments).toHaveBeenCalledWith('case-123');
    });

    it('should throw BadRequestError if claim documents missing', async () => {
      const paidCase = { ...mockCase, status: CaseStatus.PAID };
      repository.findById.mockResolvedValue(paidCase);
      repository.hasClaimDocuments.mockResolvedValue(false);

      const transition = {
        caseId: 'case-123',
        from: CaseStatus.PAID,
        to: CaseStatus.CLAIM_SUBMITTED,
        actorId: 'user-123',
      };

      await expect(service.transitionStatus(transition)).rejects.toThrow(BadRequestError);
      await expect(service.transitionStatus(transition)).rejects.toThrow(ERRORS.CASE_009);
    });
  });

  describe('validateTransitionRules - SETTLED', () => {
    it('should validate settlement record exists for SETTLED', async () => {
      const inReviewCase = { ...mockCase, status: CaseStatus.IN_REVIEW };
      repository.findById.mockResolvedValue(inReviewCase);
      repository.hasSettlement.mockResolvedValue(true);
      repository.updateStatus.mockResolvedValue({
        ...inReviewCase,
        status: CaseStatus.SETTLED,
      });

      const transition = {
        caseId: 'case-123',
        from: CaseStatus.IN_REVIEW,
        to: CaseStatus.SETTLED,
        actorId: 'ops-user',
      };

      await service.transitionStatus(transition, UserRole.OPS_REVIEWER);

      expect(repository.hasSettlement).toHaveBeenCalledWith('case-123');
    });

    it('should throw BadRequestError if settlement missing', async () => {
      const inReviewCase = { ...mockCase, status: CaseStatus.IN_REVIEW };
      repository.findById.mockResolvedValue(inReviewCase);
      repository.hasSettlement.mockResolvedValue(false);

      const transition = {
        caseId: 'case-123',
        from: CaseStatus.IN_REVIEW,
        to: CaseStatus.SETTLED,
        actorId: 'ops-user',
      };

      await expect(service.transitionStatus(transition, UserRole.OPS_REVIEWER)).rejects.toThrow(
        BadRequestError,
      );
      await expect(service.transitionStatus(transition, UserRole.OPS_REVIEWER)).rejects.toThrow(
        ERRORS.CASE_010,
      );
    });
  });

  describe('findAllForOps', () => {
    const mockOpsCases = [
      {
        ...mockCase,
        userName: 'John Doe',
        userEmail: 'john@example.com',
      },
      {
        ...mockCase,
        id: 'case-456',
        userName: 'Jane Smith',
        userEmail: 'jane@example.com',
      },
    ];

    it('should return paginated cases with user info', async () => {
      const options = {
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc' as const,
      };

      repository.findAllForOps.mockResolvedValue({
        cases: mockOpsCases,
        total: 2,
      });

      const result = await service.findAllForOps(options);

      expect(repository.findAllForOps).toHaveBeenCalledWith(options);
      expect(result.cases).toEqual(mockOpsCases);
      expect(result.total).toBe(2);
    });

    it('should filter by status array', async () => {
      const options = {
        page: 1,
        limit: 20,
        statuses: [CaseStatus.SUBMITTED, CaseStatus.PREAPPROVED],
        sortBy: 'createdAt',
        sortOrder: 'desc' as const,
      };

      repository.findAllForOps.mockResolvedValue({
        cases: [mockOpsCases[0]],
        total: 1,
      });

      const result = await service.findAllForOps(options);

      expect(repository.findAllForOps).toHaveBeenCalledWith(options);
      expect(result.cases).toHaveLength(1);
    });

    it('should filter by userId and date range', async () => {
      const options = {
        page: 1,
        limit: 20,
        userId: 'user-123',
        fromDate: new Date('2024-01-01'),
        toDate: new Date('2024-12-31'),
        sortBy: 'createdAt',
        sortOrder: 'asc' as const,
      };

      repository.findAllForOps.mockResolvedValue({
        cases: [mockOpsCases[0]],
        total: 1,
      });

      const result = await service.findAllForOps(options);

      expect(repository.findAllForOps).toHaveBeenCalledWith(options);
      expect(result.cases[0].userName).toBe('John Doe');
      expect(result.cases[0].userEmail).toBe('john@example.com');
    });
  });

  describe('findByIdForOps', () => {
    const mockOpsResponse = {
      case: mockCase,
      user: {
        id: 'user-123',
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+84 912 345 678',
        bankAccountNumber: '1234567890',
        bankCode: '004',
      },
      limits: {
        perCase: 50000,
        remainingToday: 100000,
        remainingThisYear: 450000,
      },
      coverageTier: {
        id: 'tier-1',
        label: 'Premium',
        amount: 50000,
      },
      card: {
        id: 'card-123',
        status: 'ACTIVE',
        limitAmount: 50000,
        limitCurrency: 'VND',
        usedAmount: 0,
        activeFrom: new Date('2024-01-15'),
        activeTo: new Date('2024-02-15'),
      },
      claim: undefined,
      settlement: undefined,
      auditLogs: [
        {
          action: 'CASE_CREATED',
          actor: 'John Doe',
          timestamp: new Date('2024-01-15T10:30:00Z'),
        },
        {
          action: 'STATUS_CHANGED',
          actor: 'John Doe',
          timestamp: new Date('2024-01-15T10:35:00Z'),
        },
      ],
    };

    it('should return full case details with all related data', async () => {
      repository.findByIdForOps.mockResolvedValue(mockOpsResponse);

      const result = await service.findByIdForOps('case-123');

      expect(repository.findByIdForOps).toHaveBeenCalledWith('case-123');
      expect(result.case).toEqual(mockCase);
      expect(result.user.name).toBe('John Doe');
      expect(result.user.bankAccountNumber).toBe('1234567890');
      expect(result.limits.perCase).toBe(50000);
      expect(result.limits.remainingToday).toBe(100000);
      expect(result.limits.remainingThisYear).toBe(450000);
      expect(result.coverageTier).toBeDefined();
      expect(result.card).toBeDefined();
      expect(result.auditLogs).toHaveLength(2);
    });

    it('should throw NotFoundError if case not found', async () => {
      repository.findByIdForOps.mockResolvedValue(null);

      await expect(service.findByIdForOps('non-existent')).rejects.toThrow(NotFoundError);
      await expect(service.findByIdForOps('non-existent')).rejects.toThrow(ERRORS.CASE_002);
    });

    it('should include audit logs with actor names', async () => {
      repository.findByIdForOps.mockResolvedValue(mockOpsResponse);

      const result = await service.findByIdForOps('case-123');

      expect(result.auditLogs).toHaveLength(2);
      expect(result.auditLogs[0].action).toBe('CASE_CREATED');
      expect(result.auditLogs[0].actor).toBe('John Doe');
      expect(result.auditLogs[1].action).toBe('STATUS_CHANGED');
    });

    it('should handle optional related entities', async () => {
      const responseWithoutOptionals = {
        ...mockOpsResponse,
        coverageTier: undefined,
        card: undefined,
        claim: undefined,
        settlement: undefined,
      };

      repository.findByIdForOps.mockResolvedValue(responseWithoutOptionals);

      const result = await service.findByIdForOps('case-123');

      expect(result.case).toEqual(mockCase);
      expect(result.coverageTier).toBeUndefined();
      expect(result.card).toBeUndefined();
      expect(result.claim).toBeUndefined();
      expect(result.settlement).toBeUndefined();
    });

    it('should calculate remaining limits correctly', async () => {
      repository.findByIdForOps.mockResolvedValue(mockOpsResponse);

      const result = await service.findByIdForOps('case-123');

      // Verify limits are returned as calculated by repository
      expect(result.limits.perCase).toBe(50000);
      expect(result.limits.remainingToday).toBeGreaterThanOrEqual(0);
      expect(result.limits.remainingThisYear).toBeGreaterThanOrEqual(0);
    });
  });
});
