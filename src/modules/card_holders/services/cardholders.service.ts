import { Injectable } from '@nestjs/common';
import { HttpService } from '../../../common/infrastructure/http';
import { LoggerService } from '../../../common/infrastructure/logger';
import { AirwallexAuthService, AirwallexConfigService } from '../../airwallex';
import { CardholdersRepository } from '../repositories/cardholders.repository';
import { CreateCardholderDto } from '../dto/create-cardholder.dto';
import {
  AirwallexCardholderResponse,
  AirwallexCreateCardholderRequest,
  Cardholder,
  CardholderStatus,
  CardholderType,
} from '../interfaces/cardholder.interface';
import { NotFoundError, ConflictError, ERRORS, BadRequestError } from '../../../common/errors';
import { isHttpErrorWithResponse } from '../../../common/types/http-error.types';

@Injectable()
export class CardholdersService {
  constructor(
    private readonly httpService: HttpService,
    private readonly logger: LoggerService,
    private readonly airwallexAuth: AirwallexAuthService,
    private readonly airwallexConfig: AirwallexConfigService,
    private readonly cardholdersRepository: CardholdersRepository,
  ) {}

  /**
   * Create a cardholder in Airwallex and store the reference in our database
   */
  async createCardholder(userId: string, dto: CreateCardholderDto): Promise<Cardholder> {
    this.logger.info('Creating cardholder', { userId, email: dto.email });

    // Check if user already has a cardholder
    const existingCardholder = await this.cardholdersRepository.findByUserId(userId);
    if (existingCardholder) {
      throw new ConflictError(ERRORS.CARDHOLDER_002, 'CARDHOLDER_002');
    }

    try {
      // Prepare Airwallex API request
      const airwallexRequest: AirwallexCreateCardholderRequest = {
        email: dto.email,
        type: dto.type || 'INDIVIDUAL',
        individual: {
          name: {
            first_name: dto.firstName,
            last_name: dto.lastName,
          },
          date_of_birth: dto.dateOfBirth,
          address: {
            line1: dto.address.streetAddress,
            city: dto.address.city,
            country: dto.address.countryCode,
            postcode: dto.address.postalCode,
          },
          express_consent_obtained: 'yes',
        },
      };

      // Get auth headers
      const headers = await this.airwallexAuth.getAuthHeaders();

      // Call Airwallex API
      const response = await this.httpService.post<AirwallexCardholderResponse>(
        this.airwallexConfig.cardholdersEndpoint,
        airwallexRequest,
        { headers },
      );

      const airwallexCardholder = response.data;

      // Map Airwallex status to our internal status
      // Airwallex returns: CREATED, VERIFIED, ACTIVE, SUSPENDED, CLOSED
      // Our statuses: INCOMPLETE, PENDING, READY, DISABLED
      const mapAirwallexStatus = (awxStatus: string): CardholderStatus => {
        const upperStatus = awxStatus?.toUpperCase();
        switch (upperStatus) {
          case 'ACTIVE':
          case 'VERIFIED':
          case 'READY':
            return CardholderStatus.READY;
          case 'SUSPENDED':
          case 'CLOSED':
          case 'DISABLED':
            return CardholderStatus.DISABLED;
          case 'INCOMPLETE':
            return CardholderStatus.INCOMPLETE;
          case 'CREATED':
          case 'PENDING':
          default:
            return CardholderStatus.PENDING;
        }
      };

      const status = mapAirwallexStatus(airwallexCardholder.status);

      this.logger.info('Mapping Airwallex cardholder status', {
        airwallexStatus: airwallexCardholder.status,
        mappedStatus: status,
      });

      // Store in our database
      const cardholderType = dto.type || CardholderType.INDIVIDUAL;
      const cardholder = await this.cardholdersRepository.create({
        userId,
        airwallexCardholderId: airwallexCardholder.cardholder_id,
        type: cardholderType,
        status,
      });

      this.logger.info('Cardholder created successfully', {
        cardholderId: cardholder.id,
        airwallexCardholderId: airwallexCardholder.cardholder_id,
      });

      return cardholder;
    } catch (error) {
      this.logger.error(
        'Failed to create cardholder in Airwallex',
        error instanceof Error ? error.stack : undefined,
        {
          error: error instanceof Error ? error.message : String(error),
          status: isHttpErrorWithResponse(error) ? error.response?.status : undefined,
          data: isHttpErrorWithResponse(error) ? error.response?.data : undefined,
        },
      );

      if (error instanceof ConflictError) {
        throw error;
      }

      throw new BadRequestError(
        `Failed to create cardholder: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'CARDHOLDER_003',
      );
    }
  }

  /**
   * Get cardholder by user ID
   */
  async getCardholderByUserId(userId: string): Promise<Cardholder> {
    const cardholder = await this.cardholdersRepository.findByUserId(userId);
    if (!cardholder) {
      throw new NotFoundError(ERRORS.CARDHOLDER_001, 'CARDHOLDER_001');
    }
    return cardholder;
  }

  /**
   * Get cardholder by ID
   */
  async getCardholderById(id: string): Promise<Cardholder> {
    const cardholder = await this.cardholdersRepository.findById(id);
    if (!cardholder) {
      throw new NotFoundError(ERRORS.CARDHOLDER_001, 'CARDHOLDER_001');
    }
    return cardholder;
  }
}
