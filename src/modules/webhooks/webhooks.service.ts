import * as crypto from 'crypto';
import { Injectable } from '@nestjs/common';
import { LoggerService } from '../../common/infrastructure/logger';
import { AirwallexConfigService } from '../airwallex';
import { CardsService } from '../cards';
import { WebhookEventsRepository } from './webhook-events.repository';
import { CardTransactionsRepository } from './card-transactions.repository';
import type {
  AirwallexWebhookPayload,
  AirwallexWebhookData,
  AirwallexPaymentIntentWebhookData,
  AirwallexPaymentLinkWebhookData,
  AirwallexTransferWebhookData,
} from './webhooks.interface';
import { CasesService, CaseStatus } from '../cases';
import { AuditLogsService } from '../audit-logs';
import { SettlementsRepository } from '../settlements/settlements.repository';

const SOURCE_AIRWALLEX = 'airwallex';
const TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000; // 5 minutes

@Injectable()
export class WebhooksService {
  constructor(
    private readonly logger: LoggerService,
    private readonly airwallexConfig: AirwallexConfigService,
    private readonly webhookEventsRepo: WebhookEventsRepository,
    private readonly cardTransactionsRepo: CardTransactionsRepository,
    private readonly cardsService: CardsService,
    private readonly casesService: CasesService,
    private readonly auditLogsService: AuditLogsService,
    private readonly settlementsRepository: SettlementsRepository,
  ) {}

  /**
   * Verify Airwallex webhook signature (HMAC-SHA256 of timestamp + raw body).
   * Use raw body only; do not use parsed JSON.
   */
  verifySignature(rawBody: Buffer, xTimestamp: string, xSignature: string): boolean {
    if (!xTimestamp || !xSignature) return false;
    const secret = this.airwallexConfig.webhookSecret;
    const valueToDigest = `${xTimestamp}${rawBody.toString('utf8')}`;
    const expectedHex = crypto.createHmac('sha256', secret).update(valueToDigest).digest('hex');
    const expected = Buffer.from(expectedHex, 'hex');
    let received: Buffer;
    try {
      received = Buffer.from(xSignature, 'hex');
    } catch {
      return false;
    }
    if (expected.length !== received.length) return false;
    return crypto.timingSafeEqual(expected, received);
  }

  /**
   * Check timestamp is within tolerance to reduce replay risk.
   */
  isTimestampWithinTolerance(xTimestamp: string): boolean {
    const ts = parseInt(xTimestamp, 10);
    if (Number.isNaN(ts)) return false;
    const now = Date.now();
    return Math.abs(now - ts) <= TIMESTAMP_TOLERANCE_MS;
  }

  /**
   * Process incoming webhook: verify, idempotency, route, persist.
   * Caller must pass raw body for verification; we parse after verify.
   */
  async processWebhook(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<{ ok: true; duplicate?: boolean } | { ok: false; status: number; message: string }> {
    const xTimestamp = headers['x-timestamp'];
    const xSignature = headers['x-signature'];
    const ts = Array.isArray(xTimestamp) ? xTimestamp[0] : xTimestamp;
    const sig = Array.isArray(xSignature) ? xSignature[0] : xSignature;

    if (!ts || !sig) {
      return { ok: false, status: 401, message: 'Missing x-timestamp or x-signature' };
    }
    if (!this.isTimestampWithinTolerance(ts)) {
      return { ok: false, status: 401, message: 'Timestamp outside tolerance' };
    }
    if (!this.verifySignature(rawBody, ts, sig)) {
      return { ok: false, status: 401, message: 'Invalid signature' };
    }

    let payload: AirwallexWebhookPayload;
    try {
      payload = JSON.parse(rawBody.toString('utf8')) as AirwallexWebhookPayload;
    } catch {
      return { ok: false, status: 400, message: 'Invalid JSON body' };
    }

    const eventId = payload.id;
    const eventType = payload.name;
    if (!eventId || !eventType) {
      return { ok: false, status: 400, message: 'Missing event id or name' };
    }

    const existing = await this.webhookEventsRepo.findBySourceAndEventId(SOURCE_AIRWALLEX, eventId);
    if (existing) {
      if (existing.status === 'PROCESSED') {
        this.logger.debug('Webhook event already processed', { eventId, eventType });
        return { ok: true, duplicate: true };
      }
      if (existing.status === 'PROCESSING') {
        this.logger.warn('Webhook event already in progress', { eventId, eventType });
        return { ok: true, duplicate: true };
      }
    }

    let record = existing;
    if (!record) {
      record = await this.webhookEventsRepo.create({
        source: SOURCE_AIRWALLEX,
        eventId,
        eventType,
        payload: payload as unknown as Record<string, unknown>,
      });
    }

    await this.webhookEventsRepo.updateStatus(record.id, 'PROCESSING');

    try {
      await this.dispatch(record.id, payload);
      await this.webhookEventsRepo.updateStatus(record.id, 'PROCESSED');
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error('Webhook processing failed', err instanceof Error ? err.stack : undefined, {
        eventId,
        eventType,
        error: message,
      });
      await this.webhookEventsRepo.updateStatus(record.id, 'FAILED', message);
      return { ok: false, status: 500, message: 'Processing failed' };
    }
  }

  private async dispatch(webhookEventId: string, payload: AirwallexWebhookPayload): Promise<void> {
    switch (payload.name) {
      case 'issuing.transaction.succeeded':
        await this.handleTransactionSucceeded(payload.data as AirwallexWebhookData);
        break;
      case 'issuing.transaction.failed':
        await this.handleTransactionFailed(payload.data as AirwallexWebhookData);
        break;
      case 'payment_intent.succeeded':
        await this.handlePaymentIntentSucceeded(
          payload.data as unknown as AirwallexPaymentIntentWebhookData,
        );
        break;
      case 'payment_intent.failed':
      case 'payment_intent.cancelled':
        await this.handlePaymentIntentFailed(
          payload.data as unknown as AirwallexPaymentIntentWebhookData,
        );
        break;
      case 'payment_link.paid':
        await this.handlePaymentLinkPaid(
          payload.data as unknown as AirwallexPaymentLinkWebhookData,
        );
        break;
      case 'payout.transfer.paid':
        await this.handleTransferPaid(payload.data as unknown as AirwallexTransferWebhookData);
        break;
      case 'payout.transfer.failed':
        await this.handleTransferFailed(payload.data as unknown as AirwallexTransferWebhookData);
        break;
      case 'payout.transfer.cancelled':
        await this.handleTransferCancelled(payload.data as unknown as AirwallexTransferWebhookData);
        break;
      default:
        this.logger.debug('Unhandled webhook event type', {
          eventType: payload.name,
          webhookEventId,
        });
    }
  }

  /**
   * Update settlement to COMPLETED when payment intent succeeds.
   * Resolve settlement via payment_link_id on the payment intent object.
   */
  private async handlePaymentIntentSucceeded(
    data: AirwallexPaymentIntentWebhookData,
  ): Promise<void> {
    const paymentLinkId = data.object?.payment_link_id;
    if (!paymentLinkId) {
      this.logger.debug(
        'payment_intent.succeeded has no payment_link_id, skipping settlement update',
        {
          paymentIntentId: data.object?.id,
        },
      );
      return;
    }
    const settlement = await this.settlementsRepository.findByAirwallexPaymentLinkId(paymentLinkId);
    if (!settlement) {
      this.logger.debug('No settlement found for payment link', { paymentLinkId });
      return;
    }
    if (settlement.status === 'COMPLETED') {
      this.logger.debug('Settlement already completed', { settlementId: settlement.id });
      return;
    }
    await this.settlementsRepository.updateStatus(settlement.id, 'COMPLETED');
    await this.settlementsRepository.setCompletedAt(settlement.id, new Date());
    await this.auditLogsService.log({
      actorId: 'airwallex',
      actorType: 'system',
      action: 'SETTLEMENT_COMPLETED',
      entityType: 'settlement',
      entityId: settlement.id,
      beforeState: { status: 'PROCESSING' },
      afterState: { status: 'COMPLETED' },
    });
    this.logger.info('Settlement marked COMPLETED from payment_intent.succeeded', {
      settlementId: settlement.id,
      paymentLinkId,
    });
  }

  /**
   * Update settlement to FAILED when payment intent fails or is cancelled.
   */
  private async handlePaymentIntentFailed(data: AirwallexPaymentIntentWebhookData): Promise<void> {
    const paymentLinkId = data.object?.payment_link_id;
    if (!paymentLinkId) {
      this.logger.debug('payment_intent failed/cancelled has no payment_link_id', {
        paymentIntentId: data.object?.id,
      });
      return;
    }
    const settlement = await this.settlementsRepository.findByAirwallexPaymentLinkId(paymentLinkId);
    if (!settlement) {
      this.logger.debug('No settlement found for payment link', { paymentLinkId });
      return;
    }
    if (settlement.status === 'COMPLETED' || settlement.status === 'FAILED') {
      return;
    }
    await this.settlementsRepository.updateStatus(settlement.id, 'FAILED');
    await this.settlementsRepository.setCompletedAt(settlement.id, new Date());
    this.logger.info('Settlement marked FAILED from payment_intent failed/cancelled', {
      settlementId: settlement.id,
      paymentLinkId,
    });
  }

  /**
   * Update settlement to COMPLETED when payment link receives a payment (alternative to payment_intent.succeeded).
   */
  private async handlePaymentLinkPaid(data: AirwallexPaymentLinkWebhookData): Promise<void> {
    const paymentLinkId = data.object?.id;
    if (!paymentLinkId) return;
    const settlement = await this.settlementsRepository.findByAirwallexPaymentLinkId(paymentLinkId);
    if (!settlement) {
      this.logger.debug('No settlement found for payment_link.paid', { paymentLinkId });
      return;
    }
    if (settlement.status === 'COMPLETED') return;
    await this.settlementsRepository.updateStatus(settlement.id, 'COMPLETED');
    await this.settlementsRepository.setCompletedAt(settlement.id, new Date());
    await this.auditLogsService.log({
      actorId: 'airwallex',
      actorType: 'system',
      action: 'SETTLEMENT_COMPLETED',
      entityType: 'settlement',
      entityId: settlement.id,
      beforeState: { status: 'PROCESSING' },
      afterState: { status: 'COMPLETED' },
    });
    this.logger.info('Settlement marked COMPLETED from payment_link.paid', {
      settlementId: settlement.id,
      paymentLinkId,
    });
  }

  /**
   * Update settlement to COMPLETED when payout transfer is paid (success).
   */
  private async handleTransferPaid(data: AirwallexTransferWebhookData): Promise<void> {
    const transferId = data.id ?? data.object?.id;
    if (!transferId) {
      this.logger.debug('payout.transfer.paid has no transfer id', { data: Object.keys(data) });
      return;
    }
    const settlement = await this.settlementsRepository.findByAirwallexTransferId(transferId);
    if (!settlement) {
      this.logger.debug('No settlement found for transfer', { transferId });
      return;
    }
    if (settlement.status === 'COMPLETED') return;
    await this.settlementsRepository.updateStatus(settlement.id, 'COMPLETED');
    await this.settlementsRepository.setCompletedAt(settlement.id, new Date());
    await this.auditLogsService.log({
      actorId: 'airwallex',
      actorType: 'system',
      action: 'SETTLEMENT_COMPLETED',
      entityType: 'settlement',
      entityId: settlement.id,
      beforeState: { status: 'PROCESSING' },
      afterState: { status: 'COMPLETED' },
    });
    this.logger.info('Settlement marked COMPLETED from payout.transfer.paid', {
      settlementId: settlement.id,
      transferId,
    });
  }

  /**
   * Update settlement to FAILED when payout transfer fails.
   */
  private async handleTransferFailed(data: AirwallexTransferWebhookData): Promise<void> {
    const transferId = data.id ?? data.object?.id;
    if (!transferId) {
      this.logger.debug('payout.transfer.failed has no transfer id', { data: Object.keys(data) });
      return;
    }
    const settlement = await this.settlementsRepository.findByAirwallexTransferId(transferId);
    if (!settlement) {
      this.logger.debug('No settlement found for transfer', { transferId });
      return;
    }
    if (settlement.status === 'COMPLETED' || settlement.status === 'FAILED') return;
    await this.settlementsRepository.updateStatus(settlement.id, 'FAILED');
    await this.settlementsRepository.setCompletedAt(settlement.id, new Date());
    this.logger.info('Settlement marked FAILED from payout.transfer.failed', {
      settlementId: settlement.id,
      transferId,
    });
  }

  /**
   * Update settlement to CANCELLED when payout transfer is cancelled.
   */
  private async handleTransferCancelled(data: AirwallexTransferWebhookData): Promise<void> {
    const transferId = data.id ?? data.object?.id;
    if (!transferId) {
      this.logger.debug('payout.transfer.cancelled has no transfer id', {
        data: Object.keys(data),
      });
      return;
    }
    const settlement = await this.settlementsRepository.findByAirwallexTransferId(transferId);
    if (!settlement) {
      this.logger.debug('No settlement found for transfer', { transferId });
      return;
    }
    if (
      settlement.status === 'COMPLETED' ||
      settlement.status === 'FAILED' ||
      settlement.status === 'CANCELLED'
    ) {
      return;
    }
    await this.settlementsRepository.updateStatus(settlement.id, 'CANCELLED');
    await this.settlementsRepository.setCompletedAt(settlement.id, new Date());
    this.logger.info('Settlement marked CANCELLED from payout.transfer.cancelled', {
      settlementId: settlement.id,
      transferId,
    });
    await this.auditLogsService.log({
      actorId: 'airwallex',
      actorType: 'system',
      action: 'SETTLEMENT_CANCELLED',
      entityType: 'settlement',
      entityId: settlement.id,
      beforeState: { status: 'PROCESSING' },
      afterState: { status: 'CANCELLED' },
    });
  }

  private async handleTransactionSucceeded(data: AirwallexWebhookData): Promise<void> {
    const txnId = data.transaction_id;
    const airwallexCardId = data.card_id;
    const amount = data.transaction_amount ?? 0;
    const currency = data.transaction_currency ?? 'VND';
    const eventType = data.event_type;

    if (!txnId || !airwallexCardId) {
      throw new Error('Transaction succeeded event missing id or card_id');
    }

    const card = await this.cardsService.getCardByAirwallexId(airwallexCardId);
    if (!card) {
      this.logger.warn('Card not found for transaction', { airwallexCardId, txnId });
      throw new Error(`Card not found for airwallex_card_id ${airwallexCardId}`);
    }

    if (eventType === 'AUTHORIZATION' || eventType === 'REVERSAL') {
      this.logger.debug('Skipping transaction create for non-clearing event', {
        txnId,
        eventType,
      });
      return;
    }

    const existing = await this.cardTransactionsRepo.findByAirwallexTxnId(txnId);
    if (existing) {
      this.logger.debug('Transaction already recorded', { txnId });
      return;
    }

    const transactionAt = data.posted_date ? new Date(data.posted_date) : new Date();
    await this.cardTransactionsRepo.create({
      cardId: card.id,
      airwallexTxnId: txnId,
      amount: Math.abs(amount),
      currency,
      merchantName: data.merchant.name,
      merchantCategory: data.merchant.category_code ?? null,
      status: 'SUCCEEDED',
      authorizationCode: data.auth_code,
      transactionAt,
    });

    const absAmount = Math.abs(amount);
    if (eventType === 'REFUND') {
      await this.cardsService.incrementUsedAmount(card.id, -absAmount);
    } else {
      await this.cardsService.incrementUsedAmount(card.id, absAmount);
    }

    const case_ = await this.casesService.getCaseById(card.caseId);
    if (case_.status === CaseStatus.CARD_ISSUED) {
      await this.casesService.updateCaseStatus(card.caseId, CaseStatus.PAID, 'airwallex');
      this.logger.info('Case updated to PAID (card used)', { caseId: card.caseId });
      await this.auditLogsService.log({
        actorId: 'airwallex',
        actorType: 'system',
        action: 'CASE_PAID',
        entityType: 'case',
        entityId: card.caseId,
        beforeState: { status: CaseStatus.CARD_ISSUED },
        afterState: { status: CaseStatus.PAID },
      });
    }
  }

  private async handleTransactionFailed(data: AirwallexWebhookData): Promise<void> {
    const txnId = data.transaction_id;
    const airwallexCardId = data.card_id;
    const amount = data.transaction_amount ?? 0;
    const currency = data.transaction_currency ?? 'VND';

    if (!txnId || !airwallexCardId) {
      throw new Error('Transaction failed event missing id or card_id');
    }

    const card = await this.cardsService.getCardByAirwallexId(airwallexCardId);
    if (!card) {
      this.logger.warn('Card not found for failed transaction', { airwallexCardId, txnId });
      throw new Error(`Card not found for airwallex_card_id ${airwallexCardId}`);
    }

    const existing = await this.cardTransactionsRepo.findByAirwallexTxnId(txnId);
    if (existing) {
      this.logger.debug('Failed transaction already recorded', { txnId });
      return;
    }

    const transactionAt = data.posted_date ? new Date(data.posted_date) : new Date();
    await this.cardTransactionsRepo.create({
      cardId: card.id,
      airwallexTxnId: txnId,
      amount: Math.abs(amount),
      currency,
      merchantName: data.merchant.name,
      merchantCategory: data.merchant.category_code ?? null,
      status: 'FAILED',
      authorizationCode: data.auth_code,
      transactionAt,
    });
  }
}
