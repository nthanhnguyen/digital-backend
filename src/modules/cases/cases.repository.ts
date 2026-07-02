import { Injectable } from '@nestjs/common';
import { LoggerService, PgClientService } from 'src/common';
import { Case, CaseStatus, ReasonCategory } from './cases.interface';

@Injectable()
export class CasesRepository {
  constructor(
    private readonly pgClient: PgClientService,
    private readonly logger: LoggerService,
  ) {}

  async create(data: {
    userId: string;
    hospitalName: string;
    plannedVisitAt: Date;
    reasonCategory: ReasonCategory;
    contactPhone?: string;
    notes?: string;
    status: CaseStatus;
  }): Promise<Case> {
    const query = `
      INSERT INTO cases (
        user_id, hospital_name, planned_visit_at, reason_category,
        contact_phone, notes, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const result = await this.pgClient.master.query(query, [
      data.userId,
      data.hospitalName,
      data.plannedVisitAt,
      data.reasonCategory,
      data.contactPhone,
      data.notes,
      data.status,
    ]);

    return this.mapToCase(result.rows[0]);
  }

  async findById(id: string): Promise<Case | null> {
    const query = `
      SELECT * FROM cases
      WHERE id = $1 AND deleted_at IS NULL
    `;

    const result = await this.pgClient.replica.query(query, [id]);
    return result.rows[0] ? this.mapToCase(result.rows[0]) : null;
  }

  async findByIdWithRelations(id: string): Promise<{
    case: Case;
    coverageTier?: Record<string, unknown>;
    card?: Record<string, unknown>;
    claim?: Record<string, unknown>;
    settlement?: Record<string, unknown>;
  } | null> {
    const query = `
      SELECT
        c.*,
        ct.id as coverage_tier_id,
        ct.label as coverage_tier_label,
        ct.amount as coverage_tier_amount,
        card.id as card_id,
        card.status as card_status,
        card.limit_amount as card_limit_amount,
        card.limit_currency as card_limit_currency,
        card.used_amount as card_used_amount,
        card.active_from as card_active_from,
        card.active_to as card_active_to,
        cl.id as claim_id,
        cl.bill_amount as claim_bill_amount,
        cl.status as claim_status,
        cl.created_at as claim_created_at,
        s.id as settlement_id,
        s.type as settlement_type,
        s.amount as settlement_amount,
        s.status as settlement_status,
        s.airwallex_payment_link_url as settlement_payment_link_url
      FROM cases c
      LEFT JOIN coverage_tiers ct ON c.coverage_tier_id = ct.id
      LEFT JOIN cards card ON card.case_id = c.id AND card.deleted_at IS NULL
      LEFT JOIN claims cl ON cl.case_id = c.id AND cl.deleted_at IS NULL
      LEFT JOIN settlements s ON s.case_id = c.id
      WHERE c.id = $1 AND c.deleted_at IS NULL
    `;

    const result = await this.pgClient.replica.query(query, [id]);

    if (!result.rows[0]) {
      return null;
    }

    const row = result.rows[0];
    const caseRecord = this.mapToCase(row);

    const response: {
      case: Case;
      coverageTier?: Record<string, unknown>;
      card?: Record<string, unknown>;
      claim?: Record<string, unknown>;
      settlement?: Record<string, unknown>;
    } = { case: caseRecord };

    // Map coverage tier if exists
    if (row.coverage_tier_id) {
      response.coverageTier = {
        id: row.coverage_tier_id,
        label: row.coverage_tier_label,
        amount: Number(row.coverage_tier_amount),
      };
    }

    // Map card if exists
    if (row.card_id) {
      response.card = {
        id: row.card_id,
        status: row.card_status,
        limitAmount: Number(row.card_limit_amount),
        limitCurrency: row.card_limit_currency,
        usedAmount: Number(row.card_used_amount),
        activeFrom: new Date(row.card_active_from),
        activeTo: new Date(row.card_active_to),
      };
    }

    // Map claim if exists
    if (row.claim_id) {
      response.claim = {
        id: row.claim_id,
        billAmount: Number(row.claim_bill_amount),
        status: row.claim_status,
        createdAt: row.claim_created_at,
      };
    }

    // Map settlement if exists
    if (row.settlement_id) {
      response.settlement = {
        id: row.settlement_id,
        type: row.settlement_type,
        amount: Number(row.settlement_amount),
        status: row.settlement_status,
        paymentLinkUrl: row.settlement_payment_link_url || undefined,
      };
    }

    return response;
  }

  async findByUserId(
    userId: string,
    options: {
      page: number;
      limit: number;
      status?: CaseStatus;
      sortBy: string;
      sortOrder: 'asc' | 'desc';
    },
  ): Promise<{ cases: Case[]; total: number }> {
    const { page, limit, status, sortBy, sortOrder } = options;
    const offset = (page - 1) * limit;

    // Build WHERE clause
    const conditions: string[] = ['user_id = $1', 'deleted_at IS NULL'];
    const params: unknown[] = [userId];
    let paramIndex = 2;

    if (status) {
      conditions.push(`status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // Validate sortBy to prevent SQL injection
    const validSortFields = ['createdAt', 'updatedAt', 'plannedVisitAt', 'status'];
    const sortField = validSortFields.includes(sortBy) ? this.toSnakeCase(sortBy) : 'created_at';
    const order = sortOrder === 'asc' ? 'ASC' : 'DESC';

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM cases
      WHERE ${whereClause}
    `;
    const countResult = await this.pgClient.replica.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total, 10);

    // Get paginated results
    const dataQuery = `
      SELECT * FROM cases
      WHERE ${whereClause}
      ORDER BY ${sortField} ${order}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    const dataResult = await this.pgClient.replica.query(dataQuery, [...params, limit, offset]);

    return {
      cases: dataResult.rows.map((row) => this.mapToCase(row)),
      total,
    };
  }

  async updateStatus(
    id: string,
    status: CaseStatus,
    updatedBy: string,
    additionalFields?: Record<string, unknown>,
  ): Promise<Case> {
    const fields = ['status = $1', 'updated_at = NOW()', 'updated_by = $2'];
    const values: unknown[] = [status, updatedBy];
    let paramIndex = 3;

    // Add submitted_at when transitioning to SUBMITTED
    if (status === CaseStatus.SUBMITTED && !additionalFields?.submittedAt) {
      fields.push(`submitted_at = NOW()`);
    }

    // Add approved_at when transitioning to PREAPPROVED
    if (status === CaseStatus.PREAPPROVED && !additionalFields?.approvedAt) {
      fields.push(`approved_at = NOW()`);
    }

    // Handle additional fields (exclude status - already set above)
    if (additionalFields) {
      for (const [key, value] of Object.entries(additionalFields)) {
        if (key === 'status') continue;
        const snakeKey = this.toSnakeCase(key);
        fields.push(`${snakeKey} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    const query = `
      UPDATE cases
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex} AND deleted_at IS NULL
      RETURNING *
    `;

    values.push(id);

    const result = await this.pgClient.master.query(query, values);
    return this.mapToCase(result.rows[0]);
  }

  async hasCard(caseId: string): Promise<boolean> {
    const query = `
      SELECT EXISTS(
        SELECT 1 FROM cards WHERE case_id = $1 AND deleted_at IS NULL
      ) as has_card
    `;

    const result = await this.pgClient.replica.query(query, [caseId]);
    return result.rows[0].has_card;
  }

  async hasClaimDocuments(caseId: string): Promise<boolean> {
    const query = `
      SELECT EXISTS(
        SELECT 1 FROM claims c
        INNER JOIN claim_documents cd ON c.id = cd.claim_id
        WHERE c.case_id = $1 AND c.deleted_at IS NULL AND cd.deleted_at IS NULL
      ) as has_documents
    `;

    const result = await this.pgClient.replica.query(query, [caseId]);
    return result.rows[0].has_documents;
  }

  async hasSettlement(caseId: string): Promise<boolean> {
    const query = `
      SELECT EXISTS(
        SELECT 1 FROM settlements WHERE case_id = $1
      ) as has_settlement
    `;

    const result = await this.pgClient.replica.query(query, [caseId]);
    return result.rows[0].has_settlement;
  }

  private mapToCase(row: Record<string, unknown>): Case {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      hospitalName: row.hospital_name as string,
      plannedVisitAt: new Date(row.planned_visit_at as string),
      reasonCategory: row.reason_category as ReasonCategory,
      contactPhone: row.contact_phone as string | undefined,
      contactEmail: row.contact_email as string | undefined,
      notes: row.notes as string | undefined,
      status: row.status as CaseStatus,
      approvedBy: row.approved_by as string | undefined,
      approvedAmount: row.approved_amount != null ? Number(row.approved_amount) : null,
      approvedCurrency: row.approved_currency as string | undefined,
      coverageTierId: row.coverage_tier_id as string | undefined,
      bufferAmount: row.buffer_amount != null ? Number(row.buffer_amount) : null,
      rejectionReason: row.rejection_reason as string | undefined,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
      updatedBy: row.updated_by as string | undefined,
      submittedAt: row.submitted_at != null ? new Date(row.submitted_at as string) : null,
      approvedAt: row.approved_at != null ? new Date(row.approved_at as string) : null,
      deletedAt: row.deleted_at ? new Date(row.deleted_at as string) : null,
    };
  }

  async findAllForOps(options: {
    page: number;
    limit: number;
    statuses?: CaseStatus[];
    userId?: string;
    fromDate?: Date;
    toDate?: Date;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
    keyword?: string;
  }): Promise<{
    cases: Array<
      Case & {
        userName: string;
        userEmail: string;
      }
    >;
    total: number;
  }> {
    const { page, limit, statuses, userId, fromDate, toDate, sortBy, sortOrder, keyword } = options;
    const offset = (page - 1) * limit;

    // Build WHERE clause
    const conditions: string[] = ['c.deleted_at IS NULL'];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (keyword?.trim()) {
      const searchPattern = `%${keyword.trim()}%`;
      conditions.push(
        `(c.id::text ILIKE $${paramIndex} OR c.hospital_name ILIKE $${paramIndex} OR u.name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`,
      );
      params.push(searchPattern);
      paramIndex++;
    }

    if (statuses && statuses.length > 0) {
      const placeholders = statuses.map((_, index) => `$${paramIndex + index}`).join(', ');
      conditions.push(`c.status IN (${placeholders})`);
      params.push(...statuses);
      paramIndex += statuses.length;
    }

    if (userId) {
      conditions.push(`c.user_id = $${paramIndex}`);
      params.push(userId);
      paramIndex++;
    }

    if (fromDate) {
      conditions.push(`c.created_at >= $${paramIndex}`);
      params.push(fromDate);
      paramIndex++;
    }

    if (toDate) {
      conditions.push(`c.created_at <= $${paramIndex}`);
      params.push(toDate);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // Validate sortBy to prevent SQL injection
    const validSortFields = ['createdAt', 'updatedAt', 'plannedVisitAt', 'status', 'submittedAt'];
    const sortField = validSortFields.includes(sortBy) ? this.toSnakeCase(sortBy) : 'created_at';
    const order = sortOrder === 'asc' ? 'ASC' : 'DESC';

    // Get total count (join users when keyword is used so u.name/u.email are available)
    const countFrom = keyword?.trim()
      ? 'FROM cases c INNER JOIN users u ON c.user_id = u.id'
      : 'FROM cases c';
    const countQuery = `
      SELECT COUNT(*) as total
      ${countFrom}
      WHERE ${whereClause}
    `;
    const countResult = await this.pgClient.replica.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total, 10);

    // Get paginated results with user info
    const dataQuery = `
      SELECT
        c.*,
        u.name as user_name,
        u.email as user_email
      FROM cases c
      INNER JOIN users u ON c.user_id = u.id
      WHERE ${whereClause}
      ORDER BY c.${sortField} ${order}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    const dataResult = await this.pgClient.replica.query(dataQuery, [...params, limit, offset]);

    return {
      cases: dataResult.rows.map((row) => ({
        ...this.mapToCase(row),
        userName: row.user_name,
        userEmail: row.user_email,
      })),
      total,
    };
  }

  async findByIdForOps(id: string): Promise<{
    case: Case;
    user: {
      id: string;
      name: string;
      email: string;
      phone: string;
      bankAccountNumber: string;
      bankCode: string;
    };
    limits: {
      perCase: number;
      remainingToday: number;
      remainingThisYear: number;
    };
    coverageTier?: Record<string, unknown>;
    card?: Record<string, unknown>;
    claim?: Record<string, unknown>;
    settlement?: Record<string, unknown>;
    auditLogs: Array<{
      action: string;
      actor: string;
      timestamp: Date;
    }>;
  } | null> {
    // Fetch case with all related data
    const caseQuery = `
      SELECT
        c.*,
        u.id as user_id,
        u.name as user_name,
        u.email as user_email,
        u.phone as user_phone,
        u.bank_account_number as user_bank_account_number,
        u.bank_code as user_bank_code,
        ct.id as coverage_tier_id,
        ct.label as coverage_tier_label,
        ct.amount as coverage_tier_amount,
        card.id as card_id,
        card.status as card_status,
        card.limit_amount as card_limit_amount,
        card.limit_currency as card_limit_currency,
        card.used_amount as card_used_amount,
        card.active_from as card_active_from,
        card.active_to as card_active_to,
        cl.id as claim_id,
        cl.bill_amount as claim_bill_amount,
        cl.status as claim_status,
        s.id as settlement_id,
        s.type as settlement_type,
        s.amount as settlement_amount,
        s.status as settlement_status,
        s.airwallex_payment_link_url as settlement_payment_link_url
      FROM cases c
      INNER JOIN users u ON c.user_id = u.id
      LEFT JOIN coverage_tiers ct ON c.coverage_tier_id = ct.id
      LEFT JOIN cards card ON card.case_id = c.id AND card.deleted_at IS NULL
      LEFT JOIN claims cl ON cl.case_id = c.id AND cl.deleted_at IS NULL
      LEFT JOIN settlements s ON s.case_id = c.id
      WHERE c.id = $1 AND c.deleted_at IS NULL
    `;

    const caseResult = await this.pgClient.replica.query(caseQuery, [id]);

    if (!caseResult.rows[0]) {
      return null;
    }

    const row = caseResult.rows[0];
    const caseRecord = this.mapToCase(row);

    // Fetch coverage limits from coverage_limits table
    const limitsQuery = `
      SELECT limit_type, amount
      FROM coverage_limits
      WHERE is_active = true AND deleted_at IS NULL
    `;
    const limitsResult = await this.pgClient.replica.query(limitsQuery);

    const limits = limitsResult.rows.reduce(
      (acc, limitRow) => {
        acc[limitRow.limit_type] = Number(limitRow.amount);
        return acc;
      },
      {} as Record<string, number>,
    );

    const perCaseLimit = limits['PER_CASE'] || 0;
    const dailyLimit = limits['PER_DAY'] || 0;
    const yearlyLimit = limits['PER_YEAR'] || 0;

    // Fetch audit logs for this case
    const auditLogsQuery = `
      SELECT
        al.action,
        COALESCE(u.name, al.actor_id::text) as actor,
        al.created_at as timestamp
      FROM audit_logs al
      LEFT JOIN users u ON al.actor_id = u.id
      WHERE al.entity_type = 'case' AND al.entity_id = $1
      ORDER BY al.created_at DESC
    `;

    const auditLogsResult = await this.pgClient.replica.query(auditLogsQuery, [id]);

    // Calculate user limits
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    const yearStart = new Date(today.getFullYear(), 0, 1);
    const yearEnd = new Date(today.getFullYear(), 11, 31, 23, 59, 59, 999);

    // Get total approved amount for today
    const todayQuery = `
      SELECT COALESCE(SUM(approved_amount), 0) as total
      FROM cases
      WHERE user_id = $1
        AND status IN ('PREAPPROVED', 'CARD_ISSUED', 'CLAIM_SUBMITTED', 'SETTLED', 'CLOSED')
        AND approved_at >= $2
        AND approved_at <= $3
        AND deleted_at IS NULL
    `;
    const todayResult = await this.pgClient.replica.query(todayQuery, [
      row.user_id,
      today,
      todayEnd,
    ]);

    // Get total approved amount for this year
    const yearQuery = `
      SELECT COALESCE(SUM(approved_amount), 0) as total
      FROM cases
      WHERE user_id = $1
        AND status IN ('PREAPPROVED', 'CARD_ISSUED', 'CLAIM_SUBMITTED', 'SETTLED', 'CLOSED')
        AND approved_at >= $2
        AND approved_at <= $3
        AND deleted_at IS NULL
    `;
    const yearResult = await this.pgClient.replica.query(yearQuery, [
      row.user_id,
      yearStart,
      yearEnd,
    ]);

    const totalToday = Number(todayResult.rows[0].total);
    const totalThisYear = Number(yearResult.rows[0].total);

    const response: {
      case: Case;
      user: {
        id: string;
        name: string;
        email: string;
        phone: string;
        bankAccountNumber: string;
        bankCode: string;
      };
      limits: {
        perCase: number;
        remainingToday: number;
        remainingThisYear: number;
      };
      coverageTier?: Record<string, unknown>;
      card?: Record<string, unknown>;
      claim?: Record<string, unknown>;
      settlement?: Record<string, unknown>;
      auditLogs: Array<{
        action: string;
        actor: string;
        timestamp: Date;
      }>;
    } = {
      case: caseRecord,
      user: {
        id: row.user_id as string,
        name: row.user_name as string,
        email: row.user_email as string,
        phone: row.user_phone as string,
        bankAccountNumber: row.user_bank_account_number as string,
        bankCode: row.user_bank_code as string,
      },
      limits: {
        perCase: perCaseLimit,
        remainingToday: Math.max(0, dailyLimit - totalToday),
        remainingThisYear: Math.max(0, yearlyLimit - totalThisYear),
      },
      auditLogs: auditLogsResult.rows.map((log) => ({
        action: log.action as string,
        actor: log.actor as string,
        timestamp: new Date(log.timestamp as string),
      })),
    };

    // Map coverage tier if exists
    if (row.coverage_tier_id) {
      response.coverageTier = {
        id: row.coverage_tier_id,
        label: row.coverage_tier_label,
        amount: Number(row.coverage_tier_amount),
      };
    }

    // Map card if exists
    if (row.card_id) {
      response.card = {
        id: row.card_id,
        status: row.card_status,
        limitAmount: Number(row.card_limit_amount),
        limitCurrency: row.card_limit_currency,
        usedAmount: Number(row.card_used_amount),
        activeFrom: new Date(row.card_active_from),
        activeTo: new Date(row.card_active_to),
      };
    }

    // Map claim if exists
    if (row.claim_id) {
      response.claim = {
        id: row.claim_id,
        billAmount: Number(row.claim_bill_amount),
        status: row.claim_status,
      };
    }

    // Map settlement if exists
    if (row.settlement_id) {
      response.settlement = {
        id: row.settlement_id,
        type: row.settlement_type,
        amount: Number(row.settlement_amount),
        status: row.settlement_status,
        paymentLinkUrl: row.settlement_payment_link_url || undefined,
      };
    }

    return response;
  }

  private toSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  }

  async preapprove(
    id: string,
    data: {
      approvedBy: string;
      approvedAmount: number;
      approvedCurrency: string;
      coverageTierId?: string;
      bufferAmount?: number;
      updatedBy?: string;
    },
  ): Promise<Case> {
    const query = `
      UPDATE cases
      SET 
        status = 'PREAPPROVED',
        approved_by = $1,
        approved_amount = $2,
        approved_currency = $3,
        coverage_tier_id = $4,
        buffer_amount = COALESCE($5, 0),
        approved_at = NOW(),
        updated_at = NOW(),
        updated_by = $6
      WHERE id = $7
      RETURNING *
    `;

    const result = await this.pgClient.master.query(query, [
      data.approvedBy,
      data.approvedAmount,
      data.approvedCurrency,
      data.coverageTierId || null,
      data.bufferAmount || 0,
      data.updatedBy || data.approvedBy,
      id,
    ]);

    if (!result.rows[0]) {
      throw new Error(`Case with id ${id} not found`);
    }

    this.logger.info('Case preapproved', { caseId: id, approvedBy: data.approvedBy });
    return this.mapToCase(result.rows[0]);
  }

  async updateToCardIssued(id: string, updatedBy: string): Promise<Case> {
    return this.updateStatus(id, CaseStatus.CARD_ISSUED, updatedBy);
  }
}
