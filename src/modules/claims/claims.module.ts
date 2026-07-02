import { Module, forwardRef } from '@nestjs/common';
import { ClaimsService } from './claims.service';
import { ClaimsRepository } from './claims.repository';
import { PgClientModule } from 'src/common/infrastructure/pg-client';
import { LoggerModule } from 'src/common';
import { CasesModule } from '../cases/cases.module';
import { AuditLogsModule } from '../audit-logs';
import { CardsModule } from '../cards';
import { WebhooksModule } from '../webhooks';
import { UsersModule } from '../users';
import { CostShareRulesModule } from '../cost-share-rules';

@Module({
  imports: [
    PgClientModule,
    LoggerModule,
    AuditLogsModule,
    CasesModule,
    CardsModule,
    forwardRef(() => WebhooksModule),
    UsersModule,
    CostShareRulesModule,
  ],
  providers: [ClaimsService, ClaimsRepository],
  exports: [ClaimsService, ClaimsRepository],
})
export class ClaimsModule {}
