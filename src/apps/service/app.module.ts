import { MiddlewareConsumer, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { LoggerModule } from '../../common/infrastructure/logger';
import { PgClientModule } from '../../common/infrastructure/pg-client';
import { ConfigModule } from '../../common/config';
import { HttpModule } from '../../common/infrastructure/http';
import { RequestIdMiddleware, RequestContextMiddleware } from '../../common/request-contexts';
import { AllExceptionsFilter } from '../../common/filters';
import { AuthModule } from '../../modules/auth';
import { UsersModule } from '../../modules/users';
import { AirwallexModule } from '../../modules/airwallex';
import { CardholdersModule } from '../../modules/card_holders';
import { CardsModule } from '../../modules/cards';
import { CasesModule } from '../../modules/cases';
import { SettlementsModule } from '../../modules/settlements';
import {
  MobileAuthController,
  MobileCasesController,
  MobileUploadsController,
} from '../../controllers/mobile';
import {
  OpsUsersController,
  OpsCasesController,
  OpsConfigController,
  OpsClaimsController,
  OpsAuthController,
} from '../../controllers/ops';
import { OpsIssuingController } from '../../controllers/ops/ops-issuing.controller';
import { AuditLogsModule } from '../../modules/audit-logs';
import { CoverageTiersModule } from '../../modules/coverage-tiers';
import { UploadsModule } from '../../modules/uploads';
import { WebhooksModule } from '../../modules/webhooks';
import { WebhooksController } from '../../controllers/webhooks';
import { ClaimsModule } from '../../modules/claims';

@Module({
  imports: [
    ConfigModule,
    LoggerModule,
    PgClientModule,
    HttpModule,
    AuthModule,
    UsersModule,
    AirwallexModule,
    CardholdersModule,
    CardsModule,
    CasesModule,
    ClaimsModule,
    SettlementsModule,
    AuditLogsModule,
    CoverageTiersModule,
    UploadsModule,
    WebhooksModule,
  ],
  controllers: [
    MobileAuthController,
    MobileCasesController,
    MobileUploadsController,
    OpsUsersController,
    OpsIssuingController,
    OpsCasesController,
    OpsConfigController,
    OpsClaimsController,
    WebhooksController,
    OpsAuthController,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer): void {
    // Apply RequestIdMiddleware first for request tracing
    consumer.apply(RequestIdMiddleware).forRoutes('*');
    // Apply RequestContextMiddleware for context management
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
