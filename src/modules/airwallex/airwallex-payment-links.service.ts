import { Injectable } from '@nestjs/common';
import { HttpService } from '../../common/infrastructure/http';
import { LoggerService } from '../../common/infrastructure/logger';
import { AirwallexAuthService } from './airwallex-auth.service';
import { AirwallexConfigService } from './airwallex.config.service';
import { isHttpErrorWithResponse } from '../../common/types/http-error.types';

/** Request body for creating a fixed-amount payment link. */
export interface CreatePaymentLinkRequest {
  amount: number;
  currency: string;
  title: string;
  reusable: boolean;
  /** Optional reference for reconciliation (e.g. settlement or case id). */
  reference?: string;
  /** Optional metadata. */
  metadata?: Record<string, string>;
}

/** Response from Airwallex Create Payment Link API. */
export interface CreatePaymentLinkResponse {
  id: string;
  url: string;
  amount?: number;
  currency?: string;
  title?: string;
  status?: string;
  [key: string]: unknown;
}

@Injectable()
export class AirwallexPaymentLinksService {
  constructor(
    private readonly httpService: HttpService,
    private readonly logger: LoggerService,
    private readonly airwallexAuth: AirwallexAuthService,
    private readonly airwallexConfig: AirwallexConfigService,
  ) {}

  /**
   * Create a one-time fixed-amount payment link for collecting from a customer.
   */
  async createPaymentLink(request: CreatePaymentLinkRequest): Promise<CreatePaymentLinkResponse> {
    const url = this.airwallexConfig.paymentLinksEndpoint;
    const headers = await this.airwallexAuth.getAuthHeaders();

    const body: Record<string, unknown> = {
      amount: request.amount,
      currency: request.currency,
      title: request.title,
      reusable: request.reusable,
    };
    if (request.reference) body.reference = request.reference;
    if (request.metadata) body.metadata = request.metadata;

    try {
      this.logger.debug('Creating Airwallex payment link', {
        amount: request.amount,
        currency: request.currency,
        title: request.title,
      });

      const response = await this.httpService.post<CreatePaymentLinkResponse>(url, body, {
        headers: { ...headers, 'x-api-version': this.airwallexConfig.apiVersion },
      });

      const data = response.data;
      if (!data?.id || !data?.url) {
        throw new Error('Invalid payment link response: missing id or url');
      }

      this.logger.info('Airwallex payment link created', {
        linkId: data.id,
        amount: request.amount,
        currency: request.currency,
      });

      return data;
    } catch (error) {
      const status = isHttpErrorWithResponse(error) ? error.response?.status : undefined;
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        'Failed to create Airwallex payment link',
        error instanceof Error ? error.stack : undefined,
        { amount: request.amount, currency: request.currency, status, message },
      );
      throw new Error(`Failed to create payment link: ${message}`);
    }
  }
}
