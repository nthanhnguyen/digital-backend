import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '../../../common/infrastructure/http';
import { LoggerService } from '../../../common/infrastructure/logger';
import { AirwallexAuthService, AirwallexConfigService } from '../../airwallex';
import { CardsRepository } from '../repositories/cards.repository';
import { CardholdersRepository } from '../../card_holders/repositories/cardholders.repository';
import { CardsService } from './cards.service';
import { Card, CardStatus, CardStatusForAirwallex } from '../interfaces/card.interface';
import { UpdateCardDto } from '../dto/update-card.dto';
import { NotFoundError, UnprocessableEntityError, ERRORS } from '../../../common/errors';

describe('CardsService', () => {
  let service: CardsService;
  let httpService: jest.Mocked<HttpService>;
  let airwallexAuth: jest.Mocked<AirwallexAuthService>;

  let cardsRepository: jest.Mocked<CardsRepository>;
  let cardholdersRepository: jest.Mocked<CardholdersRepository>;

  const mockCard: Card = {
    id: 'card-db-123',
    caseId: 'case-123',
    cardholderId: 'ch-123',
    airwallexCardId: 'card-awx-456',
    status: CardStatus.ACTIVE,
    limitAmount: 10000,
    limitCurrency: 'VND',
    usedAmount: 0,
    activeFrom: new Date('2026-01-01'),
    activeTo: new Date('2026-12-31'),
    authorizationControls: {},
    createdAt: new Date(),
  };

  const mockCardholder = {
    id: 'ch-123',
    userId: 'user-123',
    airwallexCardholderId: 'ch-awx-789',
    type: 'PERSONAL' as const,
    status: 'ACTIVE',
    createdAt: new Date(),
  };

  const cardsUpdateEndpoint = 'https://api.example.com/v1/issuing/cards/{card_id}/update';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CardsService,
        {
          provide: HttpService,
          useValue: {
            get: jest.fn(),
            post: jest.fn(),
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
          provide: AirwallexAuthService,
          useValue: {
            getAuthHeaders: jest.fn().mockResolvedValue({ Authorization: 'Bearer token' }),
          },
        },
        {
          provide: AirwallexConfigService,
          useValue: {
            cardsEndpoint: 'https://api.example.com/v1/issuing/cards/create',
            cardsUpdateEndpoint,
            panTokenEndpoint: 'https://api.example.com/pan-token',
            iframeBaseUrl: 'https://airwallex.com/issuing/pci/v2',
            cardsDetailEndpoint: 'https://api.example.com/v1/issuing/cards/{card_id}',
          },
        },
        {
          provide: CardsRepository,
          useValue: {
            create: jest.fn(),
            findById: jest.fn(),
            findByCaseId: jest.fn(),
            findByAirwallexId: jest.fn(),
            findByCardholderId: jest.fn(),
            update: jest.fn(),
            updateStatus: jest.fn(),
            updateUsedAmount: jest.fn(),
            incrementUsedAmount: jest.fn(),
          },
        },
        {
          provide: CardholdersRepository,
          useValue: {
            findById: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CardsService>(CardsService);
    httpService = module.get(HttpService);
    airwallexAuth = module.get(AirwallexAuthService);
    cardsRepository = module.get(CardsRepository);
    cardholdersRepository = module.get(CardholdersRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('updateAirwallexCard', () => {
    it('should call Airwallex API with status when dto has status', async () => {
      const dto: UpdateCardDto = {
        cardholderId: 'ch-123',
        status: CardStatusForAirwallex.INACTIVE,
      };
      httpService.post.mockResolvedValue({ data: {} } as never);

      await service.updateAirwallexCard('card-awx-456', dto);

      expect(airwallexAuth.getAuthHeaders).toHaveBeenCalled();
      expect(httpService.post).toHaveBeenCalledWith(
        cardsUpdateEndpoint.replace('{card_id}', 'card-awx-456'),
        { card_status: CardStatusForAirwallex.INACTIVE, authorization_controls: {} },
        { headers: { Authorization: 'Bearer token' } },
      );
    });

    it('should include authorization_controls when dto has limitAmount', async () => {
      const dto: UpdateCardDto = {
        cardholderId: 'ch-123',
        limitAmount: 5000,
        limitCurrency: ['VND'],
      };
      httpService.post.mockResolvedValue({ data: {} } as never);

      await service.updateAirwallexCard('card-awx-456', dto);

      expect(httpService.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          authorization_controls: {
            transaction_limits: {
              currency: 'VND',
              limits: [{ amount: 5000, interval: 'ALL_TIME' }],
            },
          },
        }),
        expect.any(Object),
      );
    });

    it('should include active_from and active_to when dto has dates', async () => {
      const dto: UpdateCardDto = {
        cardholderId: 'ch-123',
        activeFrom: '2026-02-01T00:00:00Z',
        activeTo: '2026-11-30T23:59:59Z',
      };
      httpService.post.mockResolvedValue({ data: {} } as never);

      await service.updateAirwallexCard('card-awx-456', dto);

      expect(httpService.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          authorization_controls: expect.objectContaining({
            active_from: expect.any(String),
            active_to: expect.any(String),
          }),
        }),
        expect.any(Object),
      );
    });

    it('should throw UnprocessableEntityError when Airwallex API fails', async () => {
      const dto: UpdateCardDto = { cardholderId: 'ch-123', status: CardStatusForAirwallex.ACTIVE };
      httpService.post.mockRejectedValue(new Error('Network error'));

      await expect(service.updateAirwallexCard('card-awx-456', dto)).rejects.toThrow(
        UnprocessableEntityError,
      );
      await expect(service.updateAirwallexCard('card-awx-456', dto)).rejects.toThrow(
        'Failed to update Airwallex card',
      );
    });
  });

  describe('updateCard', () => {
    it('should throw NotFoundError when card does not exist', async () => {
      cardsRepository.findById.mockResolvedValue(null);
      const dto: UpdateCardDto = { cardholderId: 'ch-123', status: CardStatusForAirwallex.ACTIVE };

      await expect(service.updateCard('card-404', dto)).rejects.toThrow(NotFoundError);
      await expect(service.updateCard('card-404', dto)).rejects.toThrow(ERRORS.CARD_003);
      expect(cardsRepository.update).not.toHaveBeenCalled();
    });

    it('should update only status when dto has status', async () => {
      cardsRepository.findById.mockResolvedValue(mockCard);
      cardsRepository.update.mockResolvedValue({
        ...mockCard,
        status: CardStatus.INACTIVE,
      } as Card);
      const dto: UpdateCardDto = {
        cardholderId: 'ch-123',
        status: CardStatusForAirwallex.INACTIVE,
      };

      await service.updateCard(mockCard.id, dto);

      expect(cardsRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({
          id: mockCard.id,
          status: CardStatus.INACTIVE,
        }),
      );
    });

    it('should update authorizationControls and limit when dto has limitAmount and limitCurrency', async () => {
      cardsRepository.findById.mockResolvedValue(mockCard);
      cardsRepository.update.mockResolvedValue(mockCard);
      const dto: UpdateCardDto = {
        cardholderId: 'ch-123',
        limitAmount: 8000,
        limitCurrency: ['VND'],
      };

      await service.updateCard(mockCard.id, dto);

      expect(cardsRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({
          limitAmount: 8000,
          limitCurrency: 'VND',
          authorizationControls: expect.objectContaining({
            transaction_limits: {
              currency: 'VND',
              limits: [{ amount: 8000, interval: 'ALL_TIME' }],
            },
          }),
        }),
      );
    });

    it('should update active dates when dto has activeFrom and activeTo', async () => {
      cardsRepository.findById.mockResolvedValue(mockCard);
      cardsRepository.update.mockResolvedValue(mockCard);
      const dto: UpdateCardDto = {
        cardholderId: 'ch-123',
        activeFrom: '2026-03-01T00:00:00Z',
        activeTo: '2026-10-31T23:59:59Z',
      };

      await service.updateCard(mockCard.id, dto);

      expect(cardsRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({
          authorizationControls: expect.objectContaining({
            active_from: expect.any(String),
            active_to: expect.any(String),
          }),
        }),
      );
    });
  });

  describe('closeCard', () => {
    it('should throw NotFoundError when card does not exist', async () => {
      cardsRepository.findById.mockResolvedValue(null);

      await expect(service.closeCard('card-404')).rejects.toThrow(NotFoundError);
      await expect(service.closeCard('card-404')).rejects.toThrow(ERRORS.CARD_003);
      expect(httpService.post).not.toHaveBeenCalled();
      expect(cardsRepository.update).not.toHaveBeenCalled();
    });

    it('should return early when card is already CLOSED', async () => {
      const closedCard = { ...mockCard, status: CardStatus.CLOSED };
      cardsRepository.findById.mockResolvedValue(closedCard);

      await service.closeCard(mockCard.id);

      expect(cardholdersRepository.findById).not.toHaveBeenCalled();
      expect(httpService.post).not.toHaveBeenCalled();
      expect(cardsRepository.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundError when cardholder does not exist', async () => {
      cardsRepository.findById.mockResolvedValue(mockCard);
      cardholdersRepository.findById.mockResolvedValue(null);

      await expect(service.closeCard(mockCard.id)).rejects.toThrow(NotFoundError);
      await expect(service.closeCard(mockCard.id)).rejects.toThrow(ERRORS.CARDHOLDER_001);
      expect(httpService.post).not.toHaveBeenCalled();
      expect(cardsRepository.update).not.toHaveBeenCalled();
    });

    it('should call Airwallex update with CLOSED and then update DB', async () => {
      cardsRepository.findById.mockResolvedValue(mockCard);
      cardholdersRepository.findById.mockResolvedValue(mockCardholder as never);
      httpService.post.mockResolvedValue({ data: {} } as never);
      cardsRepository.update.mockResolvedValue({ ...mockCard, status: CardStatus.CLOSED } as Card);

      await service.closeCard(mockCard.id);

      const expectedUrl = cardsUpdateEndpoint.replace('{card_id}', mockCard.airwallexCardId);
      expect(httpService.post).toHaveBeenCalledWith(
        expectedUrl,
        { card_status: CardStatusForAirwallex.CLOSED },
        { headers: { Authorization: 'Bearer token' } },
      );
      expect(cardsRepository.update).toHaveBeenCalledWith({
        id: mockCard.id,
        status: CardStatus.CLOSED,
      });
    });

    it('should throw UnprocessableEntityError when Airwallex close fails', async () => {
      cardsRepository.findById.mockResolvedValue(mockCard);
      cardholdersRepository.findById.mockResolvedValue(mockCardholder as never);
      httpService.post.mockRejectedValue(new Error('Airwallex error'));

      await expect(service.closeCard(mockCard.id)).rejects.toThrow(UnprocessableEntityError);
      await expect(service.closeCard(mockCard.id)).rejects.toThrow(
        'Failed to close Airwallex card',
      );
      expect(cardsRepository.update).not.toHaveBeenCalled();
    });
  });
});
