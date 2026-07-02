import { Injectable } from '@nestjs/common';
import { PgClientService } from '../../common/infrastructure/pg-client';
import { LoggerService } from '../../common/infrastructure/logger';
import type { WebhookEventRecord, WebhookEventStatus } from './webhooks.interface';

@Injectable()
export class WebhookEventsRepository {
  constructor(
    private readonly pgClient: PgClientService,
    private readonly logger: LoggerService,
  ) {}

  async create(data: {
    source: string;
    eventId: string;
    eventType: string;
    payload: Record<string, unknown>;
  }): Promise<WebhookEventRecord> {
    const query = `
      INSERT INTO webhook_events (source, event_id, event_type, payload, status)
      VALUES ($1, $2, $3, $4, 'RECEIVED')
      RETURNING *
    `;
    const result = await this.pgClient.master.query(query, [
      data.source,
      data.eventId,
      data.eventType,
      JSON.stringify(data.payload),
    ]);
    const row = result.rows[0];
    this.logger.debug('Webhook event stored', { eventId: data.eventId, source: data.source });
    return this.mapToRecord(row);
  }

  async findBySourceAndEventId(
    source: string,
    eventId: string,
  ): Promise<WebhookEventRecord | null> {
    const query = `
      SELECT * FROM webhook_events
      WHERE source = $1 AND event_id = $2
      LIMIT 1
    `;
    const result = await this.pgClient.replica.query(query, [source, eventId]);
    return result.rows[0] ? this.mapToRecord(result.rows[0]) : null;
  }

  async updateStatus(
    id: string,
    status: WebhookEventStatus,
    errorMessage?: string | null,
  ): Promise<void> {
    const processedAt = status === 'PROCESSED' || status === 'FAILED' ? new Date() : null;
    const query = `
      UPDATE webhook_events
      SET status = $1, error_message = $2, processed_at = $3
      WHERE id = $4
    `;
    await this.pgClient.master.query(query, [status, errorMessage ?? null, processedAt, id]);
  }

  async incrementRetryCount(id: string): Promise<void> {
    const query = `
      UPDATE webhook_events
      SET retry_count = retry_count + 1
      WHERE id = $1
    `;
    await this.pgClient.master.query(query, [id]);
  }

  private mapToRecord(row: Record<string, unknown>): WebhookEventRecord {
    return {
      id: row.id as string,
      source: row.source as string,
      eventId: row.event_id as string,
      eventType: row.event_type as string,
      payload: (typeof row.payload === 'object' && row.payload !== null
        ? row.payload
        : JSON.parse((row.payload as string) || '{}')) as Record<string, unknown>,
      status: row.status as WebhookEventStatus,
      errorMessage: row.error_message as string | null,
      retryCount: Number(row.retry_count) || 0,
      processedAt: row.processed_at ? new Date(row.processed_at as string) : null,
      createdAt: new Date(row.created_at as string),
    };
  }
}
