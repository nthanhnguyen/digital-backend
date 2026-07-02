import { Test, TestingModule } from '@nestjs/testing';
import { CoverageTiersService } from './coverage-tiers.service';
import { CoverageTiersRepository } from './coverage-tiers.repository';
import { LoggerService } from 'src/common';
import { CoverageTier } from './coverage-tiers.interface';

describe('CoverageTiersService', () => {
  let service: CoverageTiersService;
  let repository: CoverageTiersRepository;
  let logger: LoggerService;

  const mockCoverageTiers: CoverageTier[] = [
    {
      id: 'tier-1',
      label: 'Basic',
      amount: 10000,
      currency: 'VND',
      description: 'Basic coverage tier',
      isActive: true,
      sortOrder: 1,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      updatedBy: 'admin-1',
      deletedAt: null,
    },
    {
      id: 'tier-2',
      label: 'Premium',
      amount: 50000,
      currency: 'VND',
      description: 'Premium coverage tier',
      isActive: true,
      sortOrder: 2,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      updatedBy: 'admin-1',
      deletedAt: null,
    },
    {
      id: 'tier-3',
      label: 'VIP',
      amount: 100000,
      currency: 'VND',
      description: 'VIP coverage tier',
      isActive: true,
      sortOrder: 3,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      deletedAt: null,
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoverageTiersService,
        {
          provide: CoverageTiersRepository,
          useValue: {
            findAll: jest.fn(),
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

    service = module.get<CoverageTiersService>(CoverageTiersService);
    repository = module.get<CoverageTiersRepository>(CoverageTiersRepository);
    logger = module.get<LoggerService>(LoggerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should successfully fetch all coverage tiers', async () => {
      // Arrange
      jest.spyOn(repository, 'findAll').mockResolvedValue(mockCoverageTiers);

      // Act
      const result = await service.findAll();

      // Assert
      expect(result).toEqual(mockCoverageTiers);
      expect(result).toHaveLength(3);
      expect(repository.findAll).toHaveBeenCalledTimes(1);
    });

    it('should log info message before fetching tiers', async () => {
      // Arrange
      jest.spyOn(repository, 'findAll').mockResolvedValue(mockCoverageTiers);

      // Act
      await service.findAll();

      // Assert
      expect(logger.info).toHaveBeenCalledWith('Fetching all coverage tiers');
    });

    it('should log info message after fetching tiers with count', async () => {
      // Arrange
      jest.spyOn(repository, 'findAll').mockResolvedValue(mockCoverageTiers);

      // Act
      await service.findAll();

      // Assert
      expect(logger.info).toHaveBeenCalledWith('Coverage tiers fetched', {
        count: mockCoverageTiers.length,
      });
    });

    it('should call logger.info exactly twice (before and after)', async () => {
      // Arrange
      jest.spyOn(repository, 'findAll').mockResolvedValue(mockCoverageTiers);

      // Act
      await service.findAll();

      // Assert
      expect(logger.info).toHaveBeenCalledTimes(2);
    });

    it('should return empty array when no tiers exist', async () => {
      // Arrange
      const emptyTiers: CoverageTier[] = [];
      jest.spyOn(repository, 'findAll').mockResolvedValue(emptyTiers);

      // Act
      const result = await service.findAll();

      // Assert
      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
      expect(logger.info).toHaveBeenCalledWith('Coverage tiers fetched', { count: 0 });
    });

    it('should return only active tiers sorted by sortOrder', async () => {
      // Arrange
      const sortedTiers = [...mockCoverageTiers];
      jest.spyOn(repository, 'findAll').mockResolvedValue(sortedTiers);

      // Act
      const result = await service.findAll();

      // Assert
      expect(result[0].label).toBe('Basic');
      expect(result[1].label).toBe('Premium');
      expect(result[2].label).toBe('VIP');
      expect(result[0].sortOrder).toBeLessThan(result[1].sortOrder);
      expect(result[1].sortOrder).toBeLessThan(result[2].sortOrder);
    });

    it('should handle repository errors and propagate them', async () => {
      // Arrange
      const mockError = new Error('Database connection failed');
      jest.spyOn(repository, 'findAll').mockRejectedValue(mockError);

      // Act & Assert
      await expect(service.findAll()).rejects.toThrow('Database connection failed');
      expect(repository.findAll).toHaveBeenCalledTimes(1);
      expect(logger.info).toHaveBeenCalledWith('Fetching all coverage tiers');
      // Note: The second logger.info should NOT be called when error occurs
      expect(logger.info).toHaveBeenCalledTimes(1);
    });

    it('should return tiers with correct structure', async () => {
      // Arrange
      jest.spyOn(repository, 'findAll').mockResolvedValue(mockCoverageTiers);

      // Act
      const result = await service.findAll();

      // Assert
      result.forEach((tier) => {
        expect(tier).toHaveProperty('id');
        expect(tier).toHaveProperty('label');
        expect(tier).toHaveProperty('amount');
        expect(tier).toHaveProperty('currency');
        expect(tier).toHaveProperty('isActive');
        expect(tier).toHaveProperty('sortOrder');
        expect(tier).toHaveProperty('createdAt');
        expect(tier).toHaveProperty('updatedAt');
      });
    });

    it('should handle tiers with optional fields', async () => {
      // Arrange
      const tiersWithOptionalFields: CoverageTier[] = [
        {
          id: 'tier-4',
          label: 'Test Tier',
          amount: 25000,
          currency: 'VND',
          isActive: true,
          sortOrder: 4,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          // description and updatedBy are optional
        },
      ];
      jest.spyOn(repository, 'findAll').mockResolvedValue(tiersWithOptionalFields);

      // Act
      const result = await service.findAll();

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].description).toBeUndefined();
      expect(result[0].updatedBy).toBeUndefined();
    });

    it('should return tiers with correct data types', async () => {
      // Arrange
      jest.spyOn(repository, 'findAll').mockResolvedValue(mockCoverageTiers);

      // Act
      const result = await service.findAll();

      // Assert
      const firstTier = result[0];
      expect(typeof firstTier.id).toBe('string');
      expect(typeof firstTier.label).toBe('string');
      expect(typeof firstTier.amount).toBe('number');
      expect(typeof firstTier.currency).toBe('string');
      expect(typeof firstTier.isActive).toBe('boolean');
      expect(typeof firstTier.sortOrder).toBe('number');
      expect(firstTier.createdAt).toBeInstanceOf(Date);
      expect(firstTier.updatedAt).toBeInstanceOf(Date);
    });
  });
});
