import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { HttpService } from '../../../common/infrastructure/http';
import { LoggerService } from '../../../common/infrastructure/logger';
import { AirwallexAuthService, AirwallexConfigService } from '../../airwallex';
import { CardsRepository } from '../repositories/cards.repository';
import { CardholdersRepository } from '../../card_holders/repositories/cardholders.repository';
import { CreateCardDto } from '../dto/create-card.dto';
import {
  AirwallexCardDetailsResponse,
  AirwallexCardResponse,
  AirwallexCardSummaryResponse,
  AirwallexCreateCardRequest,
  AirwallexUpdateCardRequest,
  Card,
  CardStatus,
  CardStatusForAirwallex,
} from '../interfaces/card.interface';
import {
  NotFoundError,
  BadRequestError,
  ConflictError,
  UnprocessableEntityError,
  ERRORS,
} from '../../../common/errors';
import { toAirwallexDate } from '../../../common/utilities';
import { isHttpErrorWithResponse } from '../../../common/types/http-error.types';
import { UpdateCardDto } from '../dto/update-card.dto';
import { GetCardDetailsResponseDto } from '../dto/get-card-details-response.dto';

@Injectable()
export class CardsService {
  constructor(
    private readonly httpService: HttpService,
    private readonly logger: LoggerService,
    private readonly airwallexAuth: AirwallexAuthService,
    private readonly airwallexConfig: AirwallexConfigService,
    private readonly cardsRepository: CardsRepository,
    private readonly cardholdersRepository: CardholdersRepository,
  ) {}

  /**
   * Create a virtual card in Airwallex and store the reference in our database
   */
  async createCard(userId: string, dto: CreateCardDto): Promise<Card> {
    this.logger.info('Creating virtual card', {
      caseId: dto.caseId,
      cardholderId: dto.cardholderId,
    });

    // Validate cardholder exists
    const cardholder = await this.cardholdersRepository.findById(dto.cardholderId);
    if (!cardholder) {
      throw new NotFoundError(ERRORS.CARDHOLDER_001, 'CARDHOLDER_001');
    }

    // Check if case already has a card
    const existingCard = await this.cardsRepository.findByCaseId(dto.caseId);
    if (existingCard) {
      throw new ConflictError(ERRORS.CARD_002, 'CARD_002');
    }

    // Validate dates
    const activeFrom = new Date(dto.activeFrom);
    const activeTo = new Date(dto.activeTo);
    if (activeFrom >= activeTo) {
      throw new BadRequestError(ERRORS.CARD_004, 'CARD_004');
    }

    try {
      // Prepare Airwallex API request
      const airwallexRequest: AirwallexCreateCardRequest = {
        cardholder_id: cardholder.airwallexCardholderId,
        client_data: '', // TODO: Add case id or something
        metadata: {
          case_id: dto.caseId,
        },
        created_by: userId,
        form_factor: 'VIRTUAL',
        is_personalized: true,
        program: {
          purpose: 'COMMERCIAL',
          sub_type: 'GOOD_FUNDS_CREDIT',
          type: 'CREDIT',
        },
        request_id: uuidv4(),
        authorization_controls: {
          allowed_transaction_count: dto.transactionCount || 'MULTIPLE',
          active_from: toAirwallexDate(dto.activeFrom || new Date().toISOString()),
          active_to: toAirwallexDate(dto.activeTo || new Date().toISOString()),
          allowed_currencies: dto.limitCurrency || ['VND'],
          allowed_merchant_categories: [
            4119, 8011, 8021, 8031, 8041, 8042, 8043, 8049, 8050, 8062, 8071, 8099,
          ], // https://www.visa.com.au/dam/VCOM/download/merchants/visa-merchant-data-standards-manual.pdf
          transaction_limits: {
            currency: dto.limitCurrency?.[0] || 'VND',
            limits: [
              {
                amount: dto.limitAmount,
                interval: 'ALL_TIME',
              },
            ],
          },
        },
      };

      // Get auth headers
      const headers = await this.airwallexAuth.getAuthHeaders();

      // Call Airwallex API
      const response = await this.httpService.post<AirwallexCardResponse>(
        this.airwallexConfig.cardsEndpoint,
        airwallexRequest,
        { headers },
      );

      const airwallexCard = response.data;

      // Determine status based on Airwallex response
      let status = CardStatus.PENDING;
      if (airwallexCard.card_status === 'ACTIVE') {
        status = CardStatus.ACTIVE;
      } else if (airwallexCard.card_status === 'FAILED') {
        status = CardStatus.FAILED;
      }

      // Store in our database
      // Use dates from DTO (validated) instead of Airwallex response which may not have them
      const card = await this.cardsRepository.create({
        caseId: dto.caseId,
        cardholderId: dto.cardholderId,
        airwallexCardId: airwallexCard.card_id,
        status,
        limitAmount: airwallexCard.limit_amount || dto.limitAmount,
        limitCurrency:
          airwallexCard.limit_currency ||
          (Array.isArray(dto.limitCurrency) ? dto.limitCurrency[0] : dto.limitCurrency) ||
          'VND',
        activeFrom: activeFrom, // Use validated date from DTO (already parsed above)
        activeTo: activeTo, // Use validated date from DTO (already parsed above)
        authorizationControls:
          (airwallexCard.authorization_controls as Record<string, unknown>) || {},
      });

      this.logger.info('Virtual card created successfully', {
        cardId: card.id,
        airwallexCardId: airwallexCard.card_id,
        caseId: dto.caseId,
        requestId: airwallexRequest.request_id,
      });

      return card;
    } catch (error) {
      this.logger.error(
        'Failed to create card in Airwallex',
        error instanceof Error ? error.stack : undefined,
        {
          error: error instanceof Error ? error.message : String(error),
          status: isHttpErrorWithResponse(error) ? error.response?.status : undefined,
          data: isHttpErrorWithResponse(error) ? error.response?.data : undefined,
        },
      );

      if (error instanceof ConflictError || error instanceof NotFoundError) {
        throw error;
      }

      throw new UnprocessableEntityError(
        `Failed to create card: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'CARD_001',
      );
    }
  }

  /**
   * Get card by ID
   */
  async getCardById(id: string): Promise<Card> {
    const card = await this.cardsRepository.findById(id);
    if (!card) {
      throw new NotFoundError(ERRORS.CARD_003, 'CARD_003');
    }
    return card;
  }

  /**
   * Get card by case ID
   */
  async getCardByCaseId(caseId: string): Promise<Card> {
    const card = await this.cardsRepository.findByCaseId(caseId);
    if (!card) {
      throw new NotFoundError(ERRORS.CARD_003, 'CARD_003');
    }
    return card;
  }

  /**
   * Get all cards for a cardholder
   */
  async getCardsByCardholderId(cardholderId: string): Promise<Card[]> {
    return this.cardsRepository.findByCardholderId(cardholderId);
  }

  /**
   * Get card by Airwallex card ID (used by webhook handlers).
   */
  async getCardByAirwallexId(airwallexCardId: string): Promise<Card | null> {
    return this.cardsRepository.findByAirwallexId(airwallexCardId);
  }

  /**
   * Atomically add a positive amount to the card's used_amount (e.g. from cleared transactions).
   */
  async incrementUsedAmount(cardId: string, delta: number): Promise<Card> {
    return this.cardsRepository.incrementUsedAmount(cardId, delta);
  }

  /**
   * Get card iframe configuration using PAN delegation
   * Returns a secure iframe URL with token for displaying card details
   */
  async getCardIframe(
    cardId: string,
    options?: {
      langKey?: 'en' | 'zh' | 'zh-Hant';
      rules?: Record<string, Record<string, string>>;
    },
  ): Promise<{
    iframeUrl: string;
    token: string;
    expiresAt: string;
    cardId: string;
    airwallexCardId: string;
  }> {
    this.logger.info('Creating PAN token for card iframe', { cardId });

    // Resolve card by internal id or Airwallex card id (callers may pass either)
    let card = await this.cardsRepository.findById(cardId);
    if (!card) {
      throw new NotFoundError(ERRORS.CARD_003, 'CARD_003');
    }
    const airwallexCardId = card.airwallexCardId;

    try {
      // Get auth headers
      const headers = await this.airwallexAuth.getAuthHeaders();

      // Step 1: Create PAN token
      const tokenResponse = await this.httpService.post<{
        token: string;
        expires_at: string;
      }>(
        this.airwallexConfig.panTokenEndpoint,
        {
          card_id: airwallexCardId,
        },
        { headers },
      );

      const { token, expires_at } = tokenResponse.data;

      this.logger.info('PAN token created successfully', {
        cardId,
        airwallexCardId,
        expiresAt: expires_at,
      });

      // Step 2: Prepare hash for iframe
      const hash = {
        token,
        ...(options?.langKey && { langKey: options.langKey }),
        ...(options?.rules && { rules: options.rules }),
      };

      const hashURI = encodeURIComponent(JSON.stringify(hash));

      // Step 3: Construct iframe URL
      // Format: https://airwallex.com/issuing/pci/v2/:cardId/details#:hash
      const iframeUrl = `${this.airwallexConfig.iframeBaseUrl}/${airwallexCardId}/details#${hashURI}`;

      return {
        iframeUrl,
        token,
        expiresAt: expires_at,
        cardId,
        airwallexCardId,
      };
    } catch (error) {
      this.logger.error(
        'Failed to create PAN token from Airwallex',
        error instanceof Error ? error.stack : undefined,
        {
          error: error instanceof Error ? error.message : String(error),
          status: isHttpErrorWithResponse(error) ? error.response?.status : undefined,
          data: isHttpErrorWithResponse(error) ? error.response?.data : undefined,
        },
      );

      throw new UnprocessableEntityError(
        `Failed to create PAN token: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'CARD_001',
      );
    }
  }

  async updateAirwallexCard(cardId: string, dto: UpdateCardDto): Promise<void> {
    try {
      // Get auth headers
      const headers = await this.airwallexAuth.getAuthHeaders();

      // Prepare Airwallex API request
      const airwallexRequest: AirwallexUpdateCardRequest = {};

      if (dto.status) {
        airwallexRequest.card_status = dto.status;
      }
      if (dto.limitAmount) {
        airwallexRequest.authorization_controls = {
          transaction_limits: {
            currency: dto.limitCurrency?.[0] || 'VND',
            limits: [
              {
                amount: dto.limitAmount,
                interval: 'ALL_TIME',
              },
            ],
          },
        };
      }
      if (!airwallexRequest.authorization_controls) {
        airwallexRequest.authorization_controls = {};
      }
      if (dto.activeFrom) {
        airwallexRequest.authorization_controls.active_from = toAirwallexDate(dto.activeFrom);
      }
      if (dto.activeTo) {
        airwallexRequest.authorization_controls.active_to = toAirwallexDate(dto.activeTo);
      }

      // Call Airwallex API
      await this.httpService.post<AirwallexCardResponse>(
        this.airwallexConfig.cardsUpdateEndpoint.replace('{card_id}', cardId),
        airwallexRequest,
        { headers },
      );
    } catch (error) {
      this.logger.error(
        'Failed to update Airwallex card',
        error instanceof Error ? error.stack : undefined,
        {
          error: error instanceof Error ? error.message : String(error),
          status: isHttpErrorWithResponse(error) ? error.response?.status : undefined,
          data: isHttpErrorWithResponse(error) ? error.response?.data : undefined,
        },
      );
      throw new UnprocessableEntityError(
        `Failed to update Airwallex card: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'CARD_001',
      );
    }
  }

  async updateCard(cardId: string, dto: UpdateCardDto): Promise<void> {
    const card = await this.cardsRepository.findById(cardId);
    if (!card) {
      throw new NotFoundError(ERRORS.CARD_003, 'CARD_003');
    }
    if (dto.status) {
      card.status = dto.status as unknown as CardStatus;
    }
    if (dto.activeFrom && dto.activeTo) {
      card.authorizationControls = {
        active_from: toAirwallexDate(dto.activeFrom),
        active_to: toAirwallexDate(dto.activeTo),
      };
    }
    if (dto.limitAmount && dto.limitCurrency) {
      card.authorizationControls = {
        ...card.authorizationControls,
        transaction_limits: {
          currency: dto.limitCurrency?.[0] || 'VND',
          limits: [
            {
              amount: dto.limitAmount,
              interval: 'ALL_TIME',
            },
          ],
        },
      };
      card.limitAmount = dto.limitAmount;
      card.limitCurrency = dto.limitCurrency?.[0] || 'VND';
    }

    await this.cardsRepository.update(card);
  }

  /**
   * Close the card in Airwallex and set status to CLOSED in DB.
   * Used when a case is settled (e.g. after settlement is created).
   */
  async closeCard(cardId: string): Promise<void> {
    const card = await this.cardsRepository.findById(cardId);
    if (!card) {
      throw new NotFoundError(ERRORS.CARD_003, 'CARD_003');
    }
    if (card.status === CardStatus.CLOSED) {
      this.logger.debug('Card already closed', { cardId });
      return;
    }
    const cardholder = await this.cardholdersRepository.findById(card.cardholderId);
    if (!cardholder) {
      throw new NotFoundError(ERRORS.CARDHOLDER_001, 'CARDHOLDER_001');
    }
    try {
      const headers = await this.airwallexAuth.getAuthHeaders();
      const airwallexRequest: AirwallexUpdateCardRequest = {
        card_status: CardStatusForAirwallex.CLOSED,
      };
      const url = this.airwallexConfig.cardsUpdateEndpoint.replace(
        '{card_id}',
        card.airwallexCardId,
      );
      await this.httpService.post<AirwallexCardResponse>(url, airwallexRequest, {
        headers,
      });
      this.logger.info('Airwallex card closed', { cardId, airwallexCardId: card.airwallexCardId });
    } catch (error) {
      this.logger.error(
        'Failed to close Airwallex card',
        error instanceof Error ? error.stack : undefined,
        {
          error: error instanceof Error ? error.message : String(error),
          status: isHttpErrorWithResponse(error) ? error.response?.status : undefined,
        },
      );
      throw new UnprocessableEntityError(
        `Failed to close Airwallex card: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'CARD_001',
      );
    }
    await this.cardsRepository.update({ id: card.id, status: CardStatus.CLOSED });
    this.logger.info('Card status updated to CLOSED in DB', { cardId });
  }

  async getAirwallexCardById(airwallexCardId: string): Promise<AirwallexCardResponse> {
    const headers = await this.airwallexAuth.getAuthHeaders();
    const response = await this.httpService.get<AirwallexCardResponse>(
      this.airwallexConfig.cardsDetailEndpoint.replace('{card_id}', airwallexCardId),
      { headers },
    );
    return response.data;
  }

  /**
   * Get card details from Airwallex: cardholder name, last 4 digits, expiry date, limit, and available balance.
   * Uses sensitive details endpoint when card is active; falls back to card summary otherwise.
   */
  async getCardDetails(cardId: string): Promise<GetCardDetailsResponseDto> {
    const card = await this.cardsRepository.findById(cardId);
    if (!card) {
      throw new NotFoundError(ERRORS.CARD_003, 'CARD_003');
    }
    const airwallexCardId = card.airwallexCardId;
    const headers = await this.airwallexAuth.getAuthHeaders();
    const limitAmount = card.limitAmount;
    const limitCurrency = card.limitCurrency;
    const availableBalance = Math.max(0, card.limitAmount - card.usedAmount);

    try {
      const sensitiveUrl = this.airwallexConfig.cardsDetailSensitiveEndpoint.replace(
        '{card_id}',
        airwallexCardId,
      );
      const detailsResponse = await this.httpService.get<AirwallexCardDetailsResponse>(
        sensitiveUrl,
        { headers },
      );
      const d = detailsResponse.data;
      const last4 = d.card_number.slice(-4);
      const expiryDate = `${String(d.expiry_month).padStart(2, '0')}/${String(d.expiry_year).slice(-2)}`;
      return {
        cardholderName: d.name_on_card,
        last4Digits: last4,
        expiryDate,
        limitAmount,
        limitCurrency,
        availableBalance,
      };
    } catch (error) {
      if (isHttpErrorWithResponse(error) && error.response?.status === 400) {
        this.logger.debug(
          'Sensitive card details not available (e.g. inactive card), using summary',
          {
            cardId,
            airwallexCardId,
          },
        );
      } else {
        this.logger.error(
          'Failed to get sensitive card details from Airwallex',
          error instanceof Error ? error.stack : undefined,
          {
            error: error instanceof Error ? error.message : String(error),
            status: isHttpErrorWithResponse(error) ? error.response?.status : undefined,
          },
        );
      }
      const summaryResponse = await this.httpService.get<AirwallexCardSummaryResponse>(
        this.airwallexConfig.cardsDetailEndpoint.replace('{card_id}', airwallexCardId),
        { headers },
      );
      const s = summaryResponse.data;
      const name = s.name_on_card ?? s.primary_contact_details?.full_name ?? '';
      const last4 = s.card_number ? s.card_number.slice(-4) : '';
      return {
        cardholderName: name,
        last4Digits: last4,
        expiryDate: null,
        limitAmount,
        limitCurrency,
        availableBalance,
      };
    }
  }
}
