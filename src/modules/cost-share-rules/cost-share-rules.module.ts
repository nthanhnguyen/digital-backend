import { Module } from '@nestjs/common';
import { CostShareRulesRepository } from './cost-share-rules.repository';
import { PgClientModule } from 'src/common/infrastructure/pg-client';

@Module({
  imports: [PgClientModule],
  providers: [CostShareRulesRepository],
  exports: [CostShareRulesRepository],
})
export class CostShareRulesModule {}
