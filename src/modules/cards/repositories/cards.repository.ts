import { Injectable } from '@nestjs/common';
import { PgClientService } from '../../../common/infrastructure/pg-client';
import { LoggerService } from '../../../common/infrastructure/logger';
import { Card, CardStatus, AuthorizationControls } from '../interfaces/card.interface';

@Injectable()
export class CardsRepository {
  constructor(
    private readonly pgClient: PgClientService,
    private readonly logger: LoggerService,
  ) {}

  async create(data: {
    caseId: string;
    cardholderId: string;
    airwallexCardId: string;
    status?: CardStatus;
    limitAmount: number;
    limitCurrency: string;
    activeFrom: Date;
    activeTo: Date;
    authorizationControls?: AuthorizationControls;
  }): Promise<Card> {
    const query = `
      INSERT INTO cards (
        case_id, cardholder_id, airwallex_card_id, status,
        limit_amount, limit_currency, used_amount,
        active_from, active_to, authorization_controls
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const result = await this.pgClient.master.query(query, [
      data.caseId,
      data.cardholderId,
      data.airwallexCardId,
      data.status || CardStatus.PENDING,
      data.limitAmount,
      data.limitCurrency,
      0, // used_amount starts at 0
      data.activeFrom,
      data.activeTo,
      JSON.stringify(data.authorizationControls || {}),
    ]);

    const card = this.mapToCard(result.rows[0]);
    this.logger.info('Card created', { cardId: card.id });
    return card;
  }

  async findById(id: string): Promise<Card | null> {
    const query = `
      SELECT * FROM cards
      WHERE id = $1
    `;

    const result = await this.pgClient.replica.query(query, [id]);
    return result.rows[0] ? this.mapToCard(result.rows[0]) : null;
  }

  async findByCaseId(caseId: string): Promise<Card | null> {
    const query = `
      SELECT * FROM cards
      WHERE case_id = $1
    `;

    const result = await this.pgClient.replica.query(query, [caseId]);
    return result.rows[0] ? this.mapToCard(result.rows[0]) : null;
  }

  async findByAirwallexId(airwallexCardId: string): Promise<Card | null> {
    const query = `
      SELECT * FROM cards
      WHERE airwallex_card_id = $1
    `;

    const result = await this.pgClient.replica.query(query, [airwallexCardId]);
    return result.rows[0] ? this.mapToCard(result.rows[0]) : null;
  }

  async findByCardholderId(cardholderId: string): Promise<Card[]> {
    const query = `
      SELECT * FROM cards
      WHERE cardholder_id = $1
      ORDER BY created_at DESC
    `;

    const result = await this.pgClient.replica.query(query, [cardholderId]);
    return result.rows.map((row: Record<string, unknown>) => this.mapToCard(row));
  }

  async updateStatus(id: string, status: CardStatus): Promise<Card> {
    const query = `
      UPDATE cards
      SET status = $1
      WHERE id = $2
      RETURNING *
    `;

    const result = await this.pgClient.master.query(query, [status, id]);
    if (!result.rows[0]) {
      throw new Error(`Card with id ${id} not found`);
    }

    return this.mapToCard(result.rows[0]);
  }

  async updateUsedAmount(id: string, usedAmount: number): Promise<Card> {
    const query = `
      UPDATE cards
      SET used_amount = $1
      WHERE id = $2
      RETURNING *
    `;

    const result = await this.pgClient.master.query(query, [usedAmount, id]);
    if (!result.rows[0]) {
      throw new Error(`Card with id ${id} not found`);
    }

    return this.mapToCard(result.rows[0]);
  }

  async incrementUsedAmount(id: string, delta: number): Promise<Card> {
    const query = `
      UPDATE cards
      SET used_amount = used_amount + $1
      WHERE id = $2
      RETURNING *
    `;

    const result = await this.pgClient.master.query(query, [delta, id]);
    if (!result.rows[0]) {
      throw new Error(`Card with id ${id} not found`);
    }

    return this.mapToCard(result.rows[0]);
  }

  private mapToCard(row: Record<string, unknown>): Card {
    return {
      id: row.id as string,
      caseId: row.case_id as string,
      cardholderId: row.cardholder_id as string,
      airwallexCardId: row.airwallex_card_id as string,
      status: row.status as CardStatus,
      limitAmount: parseFloat(row.limit_amount as string),
      limitCurrency: row.limit_currency as string,
      usedAmount: parseFloat(row.used_amount as string),
      activeFrom: new Date(row.active_from as string),
      activeTo: new Date(row.active_to as string),
      authorizationControls: (row.authorization_controls as AuthorizationControls) || {},
      createdAt: new Date(row.created_at as string),
    };
  }

  /**
   * Partial update: only provided fields are updated.
   * Requires id; all other Card fields are optional.
   */
  async update(partial: Partial<Card> & Pick<Card, 'id'>): Promise<Card> {
    const id = partial.id;
    const allowedKeys: (keyof Omit<
      Card,
      'id' | 'caseId' | 'cardholderId' | 'airwallexCardId' | 'usedAmount' | 'createdAt'
    >)[] = [
      'status',
      'limitAmount',
      'limitCurrency',
      'activeFrom',
      'activeTo',
      'authorizationControls',
    ];
    const columnMap: Record<string, string> = {
      status: 'status',
      limitAmount: 'limit_amount',
      limitCurrency: 'limit_currency',
      activeFrom: 'active_from',
      activeTo: 'active_to',
      authorizationControls: 'authorization_controls',
    };
    const setParts: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;
    for (const key of allowedKeys) {
      const value = partial[key];
      if (value === undefined) continue;
      const col = columnMap[key];
      setParts.push(`${col} = $${paramIndex}`);
      params.push(
        key === 'authorizationControls'
          ? JSON.stringify(value)
          : key === 'activeFrom' || key === 'activeTo'
            ? value instanceof Date
              ? value
              : new Date(value as unknown as string)
            : value,
      );
      paramIndex++;
    }
    if (setParts.length === 0) {
      const existing = await this.findById(id);
      if (!existing) throw new Error(`Card with id ${id} not found`);
      return existing;
    }
    params.push(id);
    const query = `
      UPDATE cards
      SET ${setParts.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;
    const result = await this.pgClient.master.query(query, params);
    if (!result.rows[0]) {
      throw new Error(`Card with id ${id} not found`);
    }
    return this.mapToCard(result.rows[0]);
  }
}
