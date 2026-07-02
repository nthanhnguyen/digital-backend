import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { HttpService } from '../../common/infrastructure/http';
import { LoggerService } from '../../common/infrastructure/logger';
import { AirwallexAuthService } from './airwallex-auth.service';
import { AirwallexConfigService } from './airwallex.config.service';
import { isHttpErrorWithResponse } from '../../common/types/http-error.types';

/** Beneficiary bank details for inline transfer (VN LOCAL / ACH). */
export interface TransferBeneficiaryBankDetails {
  accountNumber: string;
  accountName: string;
  accountCurrency: string;
  bankCountryCode: string;
  /** Routing type, e.g. bank_code. */
  accountRoutingType1?: string;
  /** Routing value, e.g. bank code. */
  accountRoutingValue1?: string;
  localClearingSystem?: string;
}

/** Beneficiary address (required by Airwallex for many corridors). */
export interface TransferBeneficiaryAddress {
  streetAddress: string;
  city: string;
  countryCode: string;
}

/** Request to create a transfer (payout) to a beneficiary. */
export interface CreateTransferRequest {
  amount: number;
  currency: string;
  /** Reference for reconciliation (e.g. settlement id or invoice). */
  reference?: string;
  /** Reason for transfer (e.g. travel, reimbursement). */
  reason?: string;
  /** Transfer date YYYY-MM-DD; defaults to today. */
  transferDate?: string;
  /** Metadata for reconciliation (e.g. case_id). */
  metadata?: Record<string, string>;
  /** Use saved beneficiary; omit if providing inline beneficiary. */
  beneficiaryId?: string;
  /** Inline beneficiary (required if beneficiaryId not set). */
  beneficiary?: {
    bankDetails: TransferBeneficiaryBankDetails;
    entityType: 'PERSONAL' | 'COMPANY';
    /** Beneficiary address (required for many corridors). */
    address?: TransferBeneficiaryAddress;
    /** Date of birth YYYY-MM-DD (optional). */
    dateOfBirth?: string;
    /** Personal email for notifications (optional). */
    personalEmail?: string;
  };
}

/** Response from Airwallex Create Transfer API. */
export interface CreateTransferResponse {
  id: string;
  status?: string;
  amount?: number;
  currency?: string;
  [key: string]: unknown;
}

@Injectable()
export class AirwallexTransfersService {
  constructor(
    private readonly httpService: HttpService,
    private readonly logger: LoggerService,
    private readonly airwallexAuth: AirwallexAuthService,
    private readonly airwallexConfig: AirwallexConfigService,
  ) {}

  /**
   * Create a transfer (payout) to reimburse a customer.
   * Uses either a saved beneficiary_id or inline beneficiary per Airwallex API structure.
   */
  async createTransfer(request: CreateTransferRequest): Promise<CreateTransferResponse> {
    const url = this.airwallexConfig.transfersCreateEndpoint;
    const headers = await this.airwallexAuth.getAuthHeaders();

    const transferDate = request.transferDate ?? new Date().toISOString().slice(0, 10);

    const body: Record<string, unknown> = {
      application_fee_options: [
        {
          amount: '1',
          currency: request.currency,
          source_type: 'TRANSFER',
          type: 'FIXED',
        },
      ],
      transfer_amount: String(request.amount),
      transfer_currency: request.currency,
      source_currency: request.currency,
      transfer_date: transferDate,
      transfer_method: 'LOCAL',
      lock_rate_on_create: 'false',
      request_id: randomUUID(),
      reason: request.reason ?? 'reimbursement',
      reference: request.reference ?? '',
      remarks: '',
    };
    if (request.metadata && Object.keys(request.metadata).length > 0) {
      body.metadata = request.metadata;
    }
    if (request.beneficiaryId) {
      body.beneficiary_id = request.beneficiaryId;
    } else if (request.beneficiary) {
      body.beneficiary = this.buildBeneficiaryPayload(request.beneficiary);
    } else {
      throw new Error('Either beneficiaryId or beneficiary is required');
    }

    try {
      this.logger.debug('Creating Airwallex transfer', {
        amount: request.amount,
        currency: request.currency,
        reference: request.reference,
      });

      const response = await this.httpService.post<CreateTransferResponse>(url, body, {
        headers,
      });

      const data = response.data;
      if (!data?.id) {
        throw new Error('Invalid transfer response: missing id');
      }

      this.logger.info('Airwallex transfer created', {
        transferId: data.id,
        amount: request.amount,
        currency: request.currency,
      });

      return data;
    } catch (error) {
      const status = isHttpErrorWithResponse(error) ? error.response?.status : undefined;
      const message = error.response?.data?.message;
      this.logger.error(
        'Failed to create Airwallex transfer',
        error instanceof Error ? error.stack : undefined,
        { amount: request.amount, currency: request.currency, status, message },
      );
      throw new Error(`Failed to create transfer: ${message}`);
    }
  }

  /**
   * Build beneficiary object per Airwallex API (VN LOCAL / ACH pattern).
   * @see https://www.airwallex.com/docs/payouts/transfers/create-a-transfer
   */
  private buildBeneficiaryPayload(
    beneficiary: CreateTransferRequest['beneficiary'],
  ): Record<string, unknown> {
    if (!beneficiary) throw new Error('Beneficiary is required');
    const b = beneficiary.bankDetails;
    const bankDetails: Record<string, string> = {
      account_currency: b.accountCurrency,
      account_name: b.accountName,
      account_number: b.accountNumber,
      account_routing_type1: b.accountRoutingType1 ?? 'bank_code',
      account_routing_value1: b.accountRoutingValue1 ?? '',
      bank_country_code: b.bankCountryCode,
      local_clearing_system: b.localClearingSystem ?? 'ACH',
    };
    const payload: Record<string, unknown> = {
      type: 'BANK_ACCOUNT',
      entity_type: beneficiary.entityType,
      bank_details: bankDetails,
    };
    if (beneficiary.address) {
      payload.address = {
        street_address: beneficiary.address.streetAddress,
        city: beneficiary.address.city,
        country_code: beneficiary.address.countryCode,
      };
    }
    if (beneficiary.dateOfBirth) {
      payload.date_of_birth = beneficiary.dateOfBirth;
    }
    if (beneficiary.personalEmail) {
      payload.additional_info = {
        external_identifier: '',
        personal_email: beneficiary.personalEmail,
      };
    }
    return payload;
  }
}
