import { Injectable } from '@nestjs/common';
import { PgClientService } from '../../../common/infrastructure/pg-client';
import { LoggerService } from '../../../common/infrastructure/logger';
import { Cardholder, CardholderType, CardholderStatus } from '../interfaces/cardholder.interface';

@Injectable()
export class CardholdersRepository {
  constructor(
    private readonly pgClient: PgClientService,
    private readonly logger: LoggerService,
  ) {}

  async create(data: {
    userId: string;
    airwallexCardholderId: string;
    type?: CardholderType;
    status?: CardholderStatus;
  }): Promise<Cardholder> {
    const query = `
      INSERT INTO cardholders (user_id, airwallex_cardholder_id, type, status)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    const result = await this.pgClient.master.query(query, [
      data.userId,
      data.airwallexCardholderId,
      data.type || CardholderType.INDIVIDUAL,
      data.status || CardholderStatus.PENDING,
    ]);

    const cardholder = this.mapToCardholder(result.rows[0]);
    this.logger.info('Cardholder created', { cardholderId: cardholder.id });
    return cardholder;
  }

  async findById(id: string): Promise<Cardholder | null> {
    const query = `
      SELECT * FROM cardholders
      WHERE id = $1
    `;

    const result = await this.pgClient.replica.query(query, [id]);
    return result.rows[0] ? this.mapToCardholder(result.rows[0]) : null;
  }

  async findByUserId(userId: string): Promise<Cardholder | null> {
    const query = `
      SELECT * FROM cardholders
      WHERE user_id = $1
    `;

    const result = await this.pgClient.replica.query(query, [userId]);
    return result.rows[0] ? this.mapToCardholder(result.rows[0]) : null;
  }

  async findByAirwallexId(airwallexCardholderId: string): Promise<Cardholder | null> {
    const query = `
      SELECT * FROM cardholders
      WHERE airwallex_cardholder_id = $1
    `;

    const result = await this.pgClient.replica.query(query, [airwallexCardholderId]);
    return result.rows[0] ? this.mapToCardholder(result.rows[0]) : null;
  }

  async updateStatus(id: string, status: CardholderStatus): Promise<Cardholder> {
    const query = `
      UPDATE cardholders
      SET status = $1
      WHERE id = $2
      RETURNING *
    `;

    const result = await this.pgClient.master.query(query, [status, id]);
    if (!result.rows[0]) {
      throw new Error(`Cardholder with id ${id} not found`);
    }

    return this.mapToCardholder(result.rows[0]);
  }

  private mapToCardholder(row: Record<string, unknown>): Cardholder {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      airwallexCardholderId: row.airwallex_cardholder_id as string,
      type: row.type as CardholderType,
      status: row.status as CardholderStatus,
      createdAt: new Date(row.created_at as string),
    };
  }
}
