import { Injectable } from '@nestjs/common';
import { LoggerService } from 'src/common';
import { AuditLogsRepository } from './audit-logs.repository';
import { AuditLog, CreateAuditLogDto } from './audit-logs.interface';

@Injectable()
export class AuditLogsService {
  constructor(
    private readonly auditLogsRepository: AuditLogsRepository,
    private readonly logger: LoggerService,
  ) {}

  async log(data: CreateAuditLogDto): Promise<AuditLog> {
    const auditLog = await this.auditLogsRepository.create(data);

    this.logger.info('Audit log created', {
      auditLogId: auditLog.id,
      action: auditLog.action,
      entityType: auditLog.entityType,
      entityId: auditLog.entityId,
      actorId: auditLog.actorId,
    });

    return auditLog;
  }

  async findByEntity(entityType: string, entityId: string): Promise<AuditLog[]> {
    return this.auditLogsRepository.findByEntityId(entityType, entityId);
  }

  async findByActor(actorId: string, limit = 100): Promise<AuditLog[]> {
    return this.auditLogsRepository.findByActorId(actorId, limit);
  }
}
