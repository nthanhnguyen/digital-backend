import { Module } from '@nestjs/common';
import { AuditLogsService } from './audit-logs.service';
import { AuditLogsRepository } from './audit-logs.repository';

@Module({
  providers: [AuditLogsService, AuditLogsRepository],
  exports: [AuditLogsService],
})
export class AuditLogsModule {}
