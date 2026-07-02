import { Module } from '@nestjs/common';
import { CasesService } from './cases.service';
import { CasesRepository } from './cases.repository';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { CardholdersModule } from '../card_holders';
import { CardsModule } from '../cards';
import { UsersModule } from '../users';

@Module({
  imports: [AuditLogsModule, CardholdersModule, CardsModule, UsersModule],
  providers: [CasesService, CasesRepository],
  exports: [CasesService, CasesRepository],
})
export class CasesModule {}
