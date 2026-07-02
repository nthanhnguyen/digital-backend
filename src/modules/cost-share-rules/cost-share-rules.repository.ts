import { Injectable } from '@nestjs/common';
import { PgClientService } from 'src/common/infrastructure/pg-client';
import { CostShareRule } from './cost-share-rules.interface';

@Injectable()
export class CostShareRulesRepository {
  constructor(private readonly pgClient: PgClientService) {}

  async findActive(): Promise<CostShareRule | null> {
    const query = `
      SELECT
        id,
        name,
        deductible_amount as "deductibleAmount",
        copay_percentage as "copayPercentage",
        copay_cap as "copayCap",
        apply_at_settlement as "applyAtSettlement",
        is_active as "isActive",
        created_at as "createdAt",
        updated_at as "updatedAt",
        updated_by as "updatedBy",
        deleted_at as "deletedAt"
      FROM cost_share_rules
      WHERE is_active = true AND deleted_at IS NULL
      LIMIT 1
    `;

    const result = await this.pgClient.replica.query(query);
    return result.rows[0] ?? null;
  }
}
