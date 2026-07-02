export enum CardStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  FAILED = 'FAILED',
  CLOSED = 'CLOSED',
  BLOCKED = 'BLOCKED',
}

export enum CardStatusForAirwallex {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  CLOSED = 'CLOSED',
}

export interface AuthorizationControls {
  allowedMcc?: string[];
  transactionCount?: 'SINGLE' | 'MULTIPLE';
  [key: string]: unknown;
}

export interface Card {
  id: string;
  caseId: string;
  cardholderId: string;
  airwallexCardId: string;
  status: CardStatus;
  limitAmount: number;
  limitCurrency: string;
  usedAmount: number;
  activeFrom: Date;
  activeTo: Date;
  authorizationControls: AuthorizationControls;
  createdAt: Date;
}

export interface AirwallexCreateCardRequest {
  activate_on_issue?: boolean;
  cardholder_id: string;
  client_data: string;
  created_by: string;
  form_factor: string;
  is_personalized: boolean;
  metadata?: {
    case_id: string;
  };
  program: {
    purpose: string;
    sub_type: string;
    type: string;
  };
  request_id: string;
  authorization_controls?: {
    active_from: string;
    active_to: string;
    allowed_transaction_count?: 'SINGLE' | 'MULTIPLE';
    transaction_limits?: {
      currency?: string;
      limits: {
        amount: number;
        interval: string;
      }[];
    };
    [key: string]: unknown;
  };
  alert_settings?: {
    low_remaining_transaction_limit?: {
      enabled: boolean;
    };
  };
}

export interface AirwallexCardResponse {
  card_id: string;
  cardholder_id: string;
  card_status: string;
  limit_amount: number;
  limit_currency: string;
  used_amount: number;
  active_from: string;
  active_to: string;
  authorization_controls: Record<string, unknown>;
  created_at: string;
}

/** Full GET card response from Airwallex (includes name_on_card, card_number masked). */
export interface AirwallexCardSummaryResponse extends AirwallexCardResponse {
  name_on_card?: string;
  card_number?: string;
  primary_contact_details?: { full_name?: string };
}

/** Response from GET /api/v1/issuing/cards/{id}/details (sensitive; active cards only). */
export interface AirwallexCardDetailsResponse {
  name_on_card: string;
  card_number: string;
  expiry_month: number;
  expiry_year: number;
  cvv?: string;
}

export interface AirwallexUpdateCardRequest {
  card_status?: CardStatusForAirwallex;
  cardholder_id?: string;
  authorization_controls?: {
    active_from?: string;
    active_to?: string;
    allowed_transaction_count?: 'SINGLE' | 'MULTIPLE';
    transaction_limits?: {
      currency?: string;
      limits?: {
        amount: number;
        interval: string;
      }[];
    };
    [key: string]: unknown;
  };
}
