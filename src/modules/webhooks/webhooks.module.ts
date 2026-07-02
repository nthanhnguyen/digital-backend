import { Module, forwardRef } from '@nestjs/common';
import { LoggerModule } from '../../common/infrastructure/logger';
import { PgClientModule } from '../../common/infrastructure/pg-client';
import { AirwallexModule } from '../airwallex';
import { CardsModule } from '../cards';
import { CasesModule } from '../cases';
import { AuditLogsModule } from '../audit-logs';
import { SettlementsModule } from '../settlements';
import { WebhookEventsRepository } from './webhook-events.repository';
import { CardTransactionsRepository } from './card-transactions.repository';
import { WebhooksService } from './webhooks.service';

@Module({
  imports: [
    LoggerModule,
    PgClientModule,
    AirwallexModule,
    CardsModule,
    CasesModule,
    AuditLogsModule,
    forwardRef(() => SettlementsModule),
  ],
  providers: [WebhookEventsRepository, CardTransactionsRepository, WebhooksService],
  exports: [WebhooksService, CardTransactionsRepository],
})
export class WebhooksModule {}
