import { Injectable } from '@nestjs/common';
import { PgClientService } from 'src/common';
import { Settlement, SettlementStatus, SettlementType } from './settlements.interface';

@Injectable()
export class SettlementsRepository {
  constructor(private readonly pgClient: PgClientService) {}

  async create(data: {
    caseId: string;
    type: SettlementType;
    amount: number;
    currency: string;
    calculationDetails: Record<string, unknown>;
    createdBy: string;
  }): Promise<Settlement> {
    const query = `
      INSERT INTO settlements (
        case_id, type, amount, currency, calculation_details, created_by
      )
      VALUES ($1, $2, $3, $4, $5::jsonb, $6)
      RETURNING *
    `;
    const result = await this.pgClient.master.query(query, [
      data.caseId,
      data.type,
      data.amount,
      data.currency,
      JSON.stringify(data.calculationDetails),
      data.createdBy,
    ]);
    return this.mapRow(result.rows[0]);
  }

  async findById(id: string): Promise<Settlement | null> {
    const query = `
      SELECT * FROM settlements
      WHERE id = $1 AND deleted_at IS NULL
    `;
    const result = await this.pgClient.replica.query(query, [id]);
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async findByCaseId(caseId: string): Promise<Settlement | null> {
    const query = `
      SELECT * FROM settlements
      WHERE case_id = $1 AND deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const result = await this.pgClient.replica.query(query, [caseId]);
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async findByAirwallexPaymentLinkId(airwallexPaymentLinkId: string): Promise<Settlement | null> {
    const query = `
      SELECT * FROM settlements
      WHERE airwallex_payment_link_id = $1 AND deleted_at IS NULL
    `;
    const result = await this.pgClient.replica.query(query, [airwallexPaymentLinkId]);
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async findByAirwallexTransferId(airwallexTransferId: string): Promise<Settlement | null> {
    const query = `
      SELECT * FROM settlements
      WHERE airwallex_transfer_id = $1 AND deleted_at IS NULL
    `;
    const result = await this.pgClient.replica.query(query, [airwallexTransferId]);
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async updatePaymentLink(
    id: string,
    airwallexPaymentLinkId: string,
    airwallexPaymentLinkUrl: string,
  ): Promise<void> {
    const query = `
      UPDATE settlements
      SET
        airwallex_payment_link_id = $2,
        airwallex_payment_link_url = $3,
        status = 'PROCESSING'
      WHERE id = $1 AND deleted_at IS NULL
    `;
    await this.pgClient.master.query(query, [id, airwallexPaymentLinkId, airwallexPaymentLinkUrl]);
  }

  async updateTransferId(id: string, airwallexTransferId: string): Promise<void> {
    const query = `
      UPDATE settlements
      SET
        airwallex_transfer_id = $2,
        status = 'PROCESSING'
      WHERE id = $1 AND deleted_at IS NULL
    `;
    await this.pgClient.master.query(query, [id, airwallexTransferId]);
  }

  async updateStatus(
    id: string,
    status: SettlementStatus,
    errorMessage?: string | null,
  ): Promise<void> {
    const shouldComplete = ['COMPLETED', 'FAILED', 'CANCELLED'].includes(status);
    const query = `
      UPDATE settlements
      SET
        status = $2,
        completed_at = CASE WHEN $3 THEN NOW() ELSE completed_at END
      WHERE id = $1 AND deleted_at IS NULL
    `;
    await this.pgClient.master.query(query, [id, status, shouldComplete]);
    if (errorMessage !== undefined && errorMessage !== null) {
      // If we need to store error_message we'd add a column; for now we just update status.
    }
  }

  async setCompletedAt(id: string, completedAt: Date): Promise<void> {
    const query = `
      UPDATE settlements
      SET completed_at = $2
      WHERE id = $1 AND deleted_at IS NULL
    `;
    await this.pgClient.master.query(query, [id, completedAt]);
  }

  async hasCollectSettlementInProgress(caseId: string): Promise<boolean> {
    const query = `
      SELECT 1 FROM settlements
      WHERE case_id = $1 AND type = $2
        AND status IN ('PENDING', 'PROCESSING')
        AND deleted_at IS NULL
      LIMIT 1
    `;
    const result = await this.pgClient.replica.query(query, [caseId, SettlementType.COLLECT]);
    return result.rows.length > 0;
  }

  async hasPayoutSettlementInProgress(caseId: string): Promise<boolean> {
    const query = `
      SELECT 1 FROM settlements
      WHERE case_id = $1 AND type = 'PAYOUT'
        AND status IN ('PENDING', 'PROCESSING')
        AND deleted_at IS NULL
      LIMIT 1
    `;
    const result = await this.pgClient.replica.query(query, [caseId]);
    return result.rows.length > 0;
  }

  private mapRow(row: Record<string, unknown>): Settlement {
    return {
      id: row.id as string,
      caseId: row.case_id as string,
      type: row.type as SettlementType,
      amount: Number(row.amount),
      currency: row.currency as string,
      status: row.status as SettlementStatus,
      airwallexPaymentLinkId: (row.airwallex_payment_link_id as string) || null,
      airwallexPaymentLinkUrl: (row.airwallex_payment_link_url as string) || null,
      airwallexTransferId: (row.airwallex_transfer_id as string) || null,
      calculationDetails: (row.calculation_details as Record<string, unknown>) || {},
      createdBy: row.created_by as string,
      createdAt: new Date(row.created_at as string),
      completedAt: row.completed_at ? new Date(row.completed_at as string) : null,
      deletedAt: row.deleted_at ? new Date(row.deleted_at as string) : null,
    };
  }
}
