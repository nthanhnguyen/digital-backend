import { Module } from '@nestjs/common';
import { AirwallexModule } from '../airwallex';
import { HttpModule } from '../../common/infrastructure/http';
import { CardholdersService } from './services/cardholders.service';
import { CardholdersRepository } from './repositories/cardholders.repository';

@Module({
  imports: [AirwallexModule, HttpModule],
  providers: [CardholdersService, CardholdersRepository],
  exports: [CardholdersService, CardholdersRepository],
})
export class CardholdersModule {}
