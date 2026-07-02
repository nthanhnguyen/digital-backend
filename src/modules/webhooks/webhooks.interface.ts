/**
 * Airwallex webhook payload shape.
 * @see https://www.airwallex.com/docs/developer-tools/webhooks/listen-for-webhook-events
 */
export interface AirwallexWebhookPayload {
  id: string;
  name: string;
  account_id?: string;
  org_id?: string;
  data: AirwallexWebhookData;
  created_at: string;
  version?: string;
}

/**
 * Event-specific data. Issuing transaction events use a common structure.
 */
export interface AirwallexWebhookData {
  transaction_id: string;
  card_id?: string;
  transaction_amount?: number;
  transaction_currency?: string;
  merchant: {
    name: string;
    postcode: string;
    state: string;
    city: string;
    category_code?: string;
  };
  billing_amount?: number;
  billing_currency?: string;
  auth_code?: string;
  event_type?: string;
  failure_reason?: string;
  status: 'APPROVED' | 'DECLINED' | 'FAILED';
  posted_date: string;
  masked_card_number: string;
  [key: string]: unknown;
}

/**
 * Payment intent webhook data (payment_intent.succeeded, payment_intent.failed, etc.).
 * data.object is the Payment Intent resource.
 */
export interface AirwallexPaymentIntentWebhookData {
  object: {
    id: string;
    status: string;
    payment_link_id?: string;
    [key: string]: unknown;
  };
}

/**
 * Payment link webhook data (payment_link.paid, payment_link.created, etc.).
 * data.object is the Payment Link resource.
 */
export interface AirwallexPaymentLinkWebhookData {
  object: {
    id: string;
    url?: string;
    status?: string;
    [key: string]: unknown;
  };
}

/**
 * Transfer webhook data (payout.transfer.paid, payout.transfer.failed, etc.).
 * data may be the transfer object directly (data.id) or data.object.id.
 */
export interface AirwallexTransferWebhookData {
  id?: string;
  object?: {
    id: string;
    status?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export type WebhookEventStatus = 'RECEIVED' | 'PROCESSING' | 'PROCESSED' | 'FAILED';

export interface WebhookEventRecord {
  id: string;
  source: string;
  eventId: string;
  eventType: string;
  payload: Record<string, unknown>;
  status: WebhookEventStatus;
  errorMessage: string | null;
  retryCount: number;
  processedAt: Date | null;
  createdAt: Date;
}

export interface CardTransactionRecord {
  id: string;
  cardId: string;
  airwallexTxnId: string;
  amount: number;
  currency: string;
  merchantName: string | null;
  merchantCategory: string | null;
  status: string;
  authorizationCode: string | null;
  transactionAt: Date;
  createdAt: Date;
}
