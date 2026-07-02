import { Injectable } from '@nestjs/common';
import { LoggerService, PgClientService } from 'src/common';
import { Claim, ClaimDocument, ClaimStatus, ClaimDocumentType } from './claims.interface';

@Injectable()
export class ClaimsRepository {
  constructor(
    private readonly pgClient: PgClientService,
    private readonly logger: LoggerService,
  ) {}

  async findById(id: string): Promise<Claim | null> {
    const query = `
      SELECT * FROM claims
      WHERE id = $1 AND deleted_at IS NULL
    `;

    const result = await this.pgClient.replica.query(query, [id]);
    return result.rows[0] ? this.mapToClaim(result.rows[0]) : null;
  }

  async findByCaseId(caseId: string): Promise<Claim | null> {
    const query = `
      SELECT * FROM claims
      WHERE case_id = $1 AND deleted_at IS NULL
    `;

    const result = await this.pgClient.replica.query(query, [caseId]);
    return result.rows[0] ? this.mapToClaim(result.rows[0]) : null;
  }

  async create(data: {
    caseId: string;
    billAmount: number;
    billCurrency: string;
    billDate: Date;
    outOfPocketAmount?: number;
    declarationAccepted: boolean;
    updatedBy: string;
  }): Promise<Claim> {
    const query = `
      INSERT INTO claims (
        case_id, bill_amount, bill_currency, bill_date,
        out_of_pocket_amount, declaration_accepted,
        status, submitted_at, updated_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)
      RETURNING *
    `;

    const result = await this.pgClient.master.query(query, [
      data.caseId,
      data.billAmount,
      data.billCurrency,
      data.billDate,
      data.outOfPocketAmount || 0,
      data.declarationAccepted,
      ClaimStatus.SUBMITTED,
      data.updatedBy,
    ]);

    this.logger.info('Claim created', { claimId: result.rows[0].id, caseId: data.caseId });
    return this.mapToClaim(result.rows[0]);
  }

  async createDocuments(
    claimId: string,
    documents: Array<{
      fileUrl: string;
      fileName: string;
      fileType: string;
      fileSize: number;
      documentType: string;
    }>,
  ): Promise<ClaimDocument[]> {
    if (documents.length === 0) {
      return [];
    }

    const values: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    documents.forEach((doc) => {
      values.push(
        `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5})`,
      );
      params.push(claimId, doc.fileUrl, doc.fileName, doc.fileType, doc.fileSize, doc.documentType);
      paramIndex += 6;
    });

    const query = `
      INSERT INTO claim_documents (
        claim_id, file_url, file_name, file_type, file_size, document_type
      )
      VALUES ${values.join(', ')}
      RETURNING *
    `;

    const result = await this.pgClient.master.query(query, params);
    this.logger.info('Claim documents created', { claimId, count: result.rows.length });

    return result.rows.map((row) => this.mapToClaimDocument(row));
  }

  async findDocumentsByClaimId(claimId: string): Promise<ClaimDocument[]> {
    const query = `
      SELECT * FROM claim_documents
      WHERE claim_id = $1 AND deleted_at IS NULL
      ORDER BY uploaded_at ASC
    `;

    const result = await this.pgClient.replica.query(query, [claimId]);
    return result.rows.map((row) => this.mapToClaimDocument(row));
  }

  async findAllWithPagination(params: {
    page: number;
    limit: number;
    status?: ClaimStatus;
    keyword?: string;
  }): Promise<{
    claims: Array<{
      id: string;
      billAmount: number;
      billDate: Date;
      status: ClaimStatus;
      submittedAt: Date | null;
      case: {
        id: string;
        hospitalName: string;
        approvedAmount: number | null;
      };
      user: {
        id: string;
        name: string;
        email: string;
      };
    }>;
    total: number;
  }> {
    const { page, limit, status, keyword } = params;
    const offset = (page - 1) * limit;

    // Build WHERE clause
    const conditions: string[] = ['cl.deleted_at IS NULL'];
    const queryParams: unknown[] = [];
    let paramIndex = 1;

    if (keyword?.trim()) {
      const searchPattern = `%${keyword.trim()}%`;
      conditions.push(
        `(cl.id::text ILIKE $${paramIndex} OR c.id::text ILIKE $${paramIndex} OR c.hospital_name ILIKE $${paramIndex} OR u.name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`,
      );
      queryParams.push(searchPattern);
      paramIndex++;
    }

    if (status) {
      conditions.push(`cl.status = $${paramIndex}`);
      queryParams.push(status);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // Count query (with joins when keyword is used)
    const countFrom = keyword?.trim()
      ? 'FROM claims cl INNER JOIN cases c ON cl.case_id = c.id INNER JOIN users u ON c.user_id = u.id'
      : 'FROM claims cl';
    const countQuery = `
      SELECT COUNT(*) as total
      ${countFrom}
      WHERE ${whereClause}
    `;

    const countResult = await this.pgClient.replica.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].total, 10);

    // Data query with joins
    const dataQuery = `
      SELECT
        cl.id,
        cl.bill_amount,
        cl.bill_date,
        cl.status,
        cl.submitted_at,
        c.id as case_id,
        c.hospital_name as case_hospital_name,
        c.approved_amount as case_approved_amount,
        u.id as user_id,
        u.name as user_name,
        u.email as user_email
      FROM claims cl
      INNER JOIN cases c ON cl.case_id = c.id
      INNER JOIN users u ON c.user_id = u.id
      WHERE ${whereClause}
      ORDER BY cl.submitted_at DESC NULLS LAST, cl.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const dataParams = [...queryParams, limit, offset];
    const dataResult = await this.pgClient.replica.query(dataQuery, dataParams);

    const claims = dataResult.rows.map((row) => ({
      id: row.id as string,
      billAmount: Number(row.bill_amount),
      billDate: new Date(row.bill_date as string),
      status: row.status as ClaimStatus,
      submittedAt: row.submitted_at != null ? new Date(row.submitted_at as string) : null,
      case: {
        id: row.case_id as string,
        hospitalName: row.case_hospital_name as string,
        approvedAmount: row.case_approved_amount != null ? Number(row.case_approved_amount) : null,
      },
      user: {
        id: row.user_id as string,
        name: row.user_name as string,
        email: row.user_email as string,
      },
    }));

    return { claims, total };
  }

  async updateReview(
    id: string,
    data: {
      reviewedBillAmount: number;
      isValid: boolean;
      reviewNotes?: string;
      reviewedBy: string;
      status: ClaimStatus;
    },
  ): Promise<Claim> {
    const query = `
      UPDATE claims
      SET
        reviewed_bill_amount = $2,
        is_valid = $3,
        review_notes = $4,
        reviewed_by = $5,
        reviewed_at = NOW(),
        status = $6,
        updated_by = $5,
        updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *
    `;

    const result = await this.pgClient.master.query(query, [
      id,
      data.reviewedBillAmount,
      data.isValid,
      data.reviewNotes || null,
      data.reviewedBy,
      data.status,
    ]);

    this.logger.info('Claim review updated', { claimId: id, status: data.status });
    return this.mapToClaim(result.rows[0]);
  }

  private mapToClaim(row: Record<string, unknown>): Claim {
    return {
      id: row.id as string,
      caseId: row.case_id as string,
      billAmount: Number(row.bill_amount),
      billCurrency: row.bill_currency as string,
      billDate: new Date(row.bill_date as string),
      outOfPocketAmount: row.out_of_pocket_amount != null ? Number(row.out_of_pocket_amount) : null,
      declarationAccepted: row.declaration_accepted as boolean,
      reviewedBillAmount:
        row.reviewed_bill_amount != null ? Number(row.reviewed_bill_amount) : null,
      isValid: row.is_valid != null ? (row.is_valid as boolean) : null,
      reviewedBy: row.reviewed_by as string | undefined,
      reviewNotes: row.review_notes as string | undefined,
      status: row.status as ClaimStatus,
      submittedAt: row.submitted_at != null ? new Date(row.submitted_at as string) : null,
      reviewedAt: row.reviewed_at != null ? new Date(row.reviewed_at as string) : null,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
      updatedBy: row.updated_by as string | undefined,
      deletedAt: row.deleted_at ? new Date(row.deleted_at as string) : null,
    };
  }

  private mapToClaimDocument(row: Record<string, unknown>): ClaimDocument {
    return {
      id: row.id as string,
      claimId: row.claim_id as string,
      fileUrl: row.file_url as string,
      fileName: row.file_name as string,
      fileType: row.file_type as string,
      fileSize: Number(row.file_size),
      documentType: row.document_type as ClaimDocumentType,
      uploadedAt: new Date(row.uploaded_at as string),
      deletedAt: row.deleted_at ? new Date(row.deleted_at as string) : null,
    };
  }
}
