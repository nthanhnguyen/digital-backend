import { Module, forwardRef } from '@nestjs/common';
import { LoggerModule } from '../../common/infrastructure/logger';
import { PgClientModule } from '../../common/infrastructure/pg-client';
import { CasesModule } from '../cases';
import { AirwallexModule } from '../airwallex';
import { UsersModule } from '../users';
import { SettlementsRepository } from './settlements.repository';
import { SettlementsService } from './settlements.service';
import { AuditLogsModule } from '../audit-logs';
import { ClaimsModule } from '../claims';
import { CostShareRulesModule } from '../cost-share-rules';
import { CardsModule } from '../cards';
import { WebhooksModule } from '../webhooks';

@Module({
  imports: [
    LoggerModule,
    PgClientModule,
    forwardRef(() => CasesModule),
    AirwallexModule,
    UsersModule,
    AuditLogsModule,
    forwardRef(() => ClaimsModule),
    CostShareRulesModule,
    CardsModule,
    forwardRef(() => WebhooksModule),
  ],
  providers: [SettlementsRepository, SettlementsService],
  exports: [SettlementsRepository, SettlementsService],
})
export class SettlementsModule {}
