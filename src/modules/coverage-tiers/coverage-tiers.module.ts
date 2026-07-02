import { Module } from '@nestjs/common';
import { CoverageTiersService } from './coverage-tiers.service';
import { CoverageTiersRepository } from './coverage-tiers.repository';
import { PgClientModule } from 'src/common/infrastructure/pg-client';
import { LoggerModule } from 'src/common';

@Module({
  imports: [PgClientModule, LoggerModule],
  providers: [CoverageTiersService, CoverageTiersRepository],
  exports: [CoverageTiersService],
})
export class CoverageTiersModule {}
