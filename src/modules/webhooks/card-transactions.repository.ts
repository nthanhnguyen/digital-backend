import { Injectable } from '@nestjs/common';
import { PgClientService } from '../../common/infrastructure/pg-client';
import { LoggerService } from '../../common/infrastructure/logger';
import type { CardTransactionRecord } from './webhooks.interface';

@Injectable()
export class CardTransactionsRepository {
  constructor(
    private readonly pgClient: PgClientService,
    private readonly logger: LoggerService,
  ) {}

  async create(data: {
    cardId: string;
    airwallexTxnId: string;
    amount: number;
    currency: string;
    merchantName?: string | null;
    merchantCategory?: string | null;
    status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REVERSED';
    authorizationCode?: string | null;
    transactionAt: Date;
  }): Promise<CardTransactionRecord> {
    const query = `
      INSERT INTO card_transactions (
        card_id, airwallex_txn_id, amount, currency,
        merchant_name, merchant_category, status, authorization_code, transaction_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    const result = await this.pgClient.master.query(query, [
      data.cardId,
      data.airwallexTxnId,
      data.amount,
      data.currency,
      data.merchantName ?? null,
      data.merchantCategory ?? null,
      data.status,
      data.authorizationCode ?? null,
      data.transactionAt,
    ]);
    const row = result.rows[0];
    this.logger.debug('Card transaction stored', {
      airwallexTxnId: data.airwallexTxnId,
      cardId: data.cardId,
      status: data.status,
    });
    return this.mapToRecord(row);
  }

  async findByAirwallexTxnId(airwallexTxnId: string): Promise<CardTransactionRecord | null> {
    const query = `
      SELECT * FROM card_transactions
      WHERE airwallex_txn_id = $1
      LIMIT 1
    `;
    const result = await this.pgClient.replica.query(query, [airwallexTxnId]);
    return result.rows[0] ? this.mapToRecord(result.rows[0]) : null;
  }

  async findByCardId(cardId: string): Promise<CardTransactionRecord[]> {
    const query = `
      SELECT * FROM card_transactions
      WHERE card_id = $1
      ORDER BY transaction_at DESC
    `;
    const result = await this.pgClient.replica.query(query, [cardId]);
    return result.rows.map((row: Record<string, unknown>) => this.mapToRecord(row));
  }

  private mapToRecord(row: Record<string, unknown>): CardTransactionRecord {
    return {
      id: row.id as string,
      cardId: row.card_id as string,
      airwallexTxnId: row.airwallex_txn_id as string,
      amount: parseFloat(String(row.amount)),
      currency: row.currency as string,
      merchantName: row.merchant_name as string | null,
      merchantCategory: row.merchant_category as string | null,
      status: row.status as string,
      authorizationCode: row.authorization_code as string | null,
      transactionAt: new Date(row.transaction_at as string),
      createdAt: new Date(row.created_at as string),
    };
  }
}
