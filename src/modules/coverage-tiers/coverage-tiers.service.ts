import { Injectable } from '@nestjs/common';
import { LoggerService } from 'src/common';
import { CoverageTiersRepository } from './coverage-tiers.repository';
import { CoverageTier } from './coverage-tiers.interface';

@Injectable()
export class CoverageTiersService {
  constructor(
    private readonly coverageTiersRepository: CoverageTiersRepository,
    private readonly logger: LoggerService,
  ) {}

  async findAll(): Promise<CoverageTier[]> {
    this.logger.info('Fetching all coverage tiers');
    const tiers = await this.coverageTiersRepository.findAll();
    this.logger.info('Coverage tiers fetched', { count: tiers.length });
    return tiers;
  }
}
