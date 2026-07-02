import { Injectable } from '@nestjs/common';
import { PgClientService } from 'src/common';
import { AuditLog, CreateAuditLogDto } from './audit-logs.interface';

@Injectable()
export class AuditLogsRepository {
  constructor(private readonly pgClient: PgClientService) {}

  async create(data: CreateAuditLogDto): Promise<AuditLog> {
    const query = `
      INSERT INTO audit_logs (
        actor_id, actor_type, action, entity_type, entity_id,
        before_state, after_state, ip_address, user_agent
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const result = await this.pgClient.master.query(query, [
      data.actorId,
      data.actorType,
      data.action,
      data.entityType,
      data.entityId,
      data.beforeState ? JSON.stringify(data.beforeState) : null,
      data.afterState ? JSON.stringify(data.afterState) : null,
      data.ipAddress || null,
      data.userAgent || null,
    ]);

    return this.mapToAuditLog(result.rows[0]);
  }

  async findByEntityId(entityType: string, entityId: string): Promise<AuditLog[]> {
    const query = `
      SELECT * FROM audit_logs
      WHERE entity_type = $1 AND entity_id = $2
      ORDER BY created_at DESC
    `;

    const result = await this.pgClient.master.query(query, [entityType, entityId]);
    return result.rows.map((row) => this.mapToAuditLog(row));
  }

  async findByActorId(actorId: string, limit = 100): Promise<AuditLog[]> {
    const query = `
      SELECT * FROM audit_logs
      WHERE actor_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `;

    const result = await this.pgClient.master.query(query, [actorId, limit]);
    return result.rows.map((row) => this.mapToAuditLog(row));
  }

  private mapToAuditLog(row: Record<string, unknown>): AuditLog {
    return {
      id: row.id as string,
      actorId: row.actor_id as string,
      actorType: row.actor_type as string,
      action: row.action as string,
      entityType: row.entity_type as string,
      entityId: row.entity_id as string,
      beforeState: this.parseJsonField(row.before_state),
      afterState: this.parseJsonField(row.after_state),
      ipAddress: row.ip_address as string | undefined,
      userAgent: row.user_agent as string | undefined,
      createdAt: new Date(row.created_at as string),
    };
  }

  private parseJsonField(value: unknown): Record<string, unknown> | null {
    if (!value) return null;
    // PostgreSQL JSONB fields may already be parsed as objects
    if (typeof value === 'object') return value as Record<string, unknown>;
    // If it's a string, parse it
    if (typeof value === 'string') return JSON.parse(value);
    return null;
  }
}
