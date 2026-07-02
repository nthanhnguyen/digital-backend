import { Injectable } from '@nestjs/common';
import { ConfigService } from '../../common/config';

@Injectable()
export class AirwallexConfigService {
  constructor(private readonly configService: ConfigService) {}

  get baseUrl(): string {
    return this.configService.getOrThrow<string>('AIRWALLEX_BASE_URL');
  }

  get clientId(): string {
    return this.configService.getOrThrow<string>('AIRWALLEX_CLIENT_ID');
  }

  get apiKey(): string {
    return this.configService.getOrThrow<string>('AIRWALLEX_API_KEY');
  }

  get authEndpoint(): string {
    return `${this.baseUrl}/api/v1/authentication/login`;
  }

  // Card Issuing endpoints
  get cardholdersEndpoint(): string {
    return `${this.baseUrl}/api/v1/issuing/cardholders/create`;
  }

  get cardsEndpoint(): string {
    return `${this.baseUrl}/api/v1/issuing/cards/create`;
  }

  get cardsDetailEndpoint(): string {
    return `${this.baseUrl}/api/v1/issuing/cards/{card_id}`;
  }

  /** Sensitive card details (name, last4, expiry) - only returns data for active cards. */
  get cardsDetailSensitiveEndpoint(): string {
    return `${this.baseUrl}/api/v1/issuing/cards/{card_id}/details`;
  }

  get cardsUpdateEndpoint(): string {
    return `${this.baseUrl}/api/v1/issuing/cards/{card_id}/update`;
  }

  get panTokenEndpoint(): string {
    return `${this.baseUrl}/api/v1/issuing/pantokens/create`;
  }

  get iframeBaseUrl(): string {
    return `https://demo.airwallex.com/issuing/pci/v2`;
  }

  /** Webhook secret for signature verification (from Airwallex web app per notification URL). */
  get webhookSecret(): string {
    return this.configService.getOrThrow<string>('AIRWALLEX_WEBHOOK_SECRET');
  }

  /**
   * API version for all Airwallex API calls (x-api-version header).
   * Set AIRWALLEX_API_VERSION in env; defaults to 2023-05-16.
   */
  get apiVersion(): string {
    return this.configService.get<string>('AIRWALLEX_API_VERSION') ?? '2023-05-16';
  }

  // Payment endpoints (for future use)
  get paymentsEndpoint(): string {
    return `${this.baseUrl}/api/v1/pa/payments`;
  }

  get paymentLinksEndpoint(): string {
    return `${this.baseUrl}/api/v1/pa/payment_links/create`;
  }

  // Payout / Transfer endpoints
  get payoutsEndpoint(): string {
    return `${this.baseUrl}/api/v1/pa/payouts`;
  }

  /** Create a transfer (payout) to a beneficiary. */
  get transfersCreateEndpoint(): string {
    return `${this.baseUrl}/api/v1/transfers/create`;
  }
}
