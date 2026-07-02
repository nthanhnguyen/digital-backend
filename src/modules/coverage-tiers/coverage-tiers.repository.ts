import { Injectable } from '@nestjs/common';
import { PgClientService } from 'src/common/infrastructure/pg-client';
import { CoverageTier } from './coverage-tiers.interface';

@Injectable()
export class CoverageTiersRepository {
  constructor(private readonly pgClient: PgClientService) {}

  async findAll(): Promise<CoverageTier[]> {
    const query = `
      SELECT
        id,
        label,
        amount,
        currency,
        description,
        is_active as "isActive",
        sort_order as "sortOrder",
        created_at as "createdAt",
        updated_at as "updatedAt",
        updated_by as "updatedBy",
        deleted_at as "deletedAt"
      FROM coverage_tiers
      WHERE deleted_at IS NULL
      ORDER BY sort_order ASC, label ASC
    `;

    const result = await this.pgClient.replica.query(query);
    return result.rows;
  }
}
