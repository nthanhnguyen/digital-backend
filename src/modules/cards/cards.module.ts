import { Module } from '@nestjs/common';
import { AirwallexModule } from '../airwallex';
import { CardholdersModule } from '../card_holders';
import { HttpModule } from '../../common/infrastructure/http';
import { CardsService } from './services/cards.service';
import { CardsRepository } from './repositories/cards.repository';

@Module({
  imports: [AirwallexModule, CardholdersModule, HttpModule],
  providers: [CardsService, CardsRepository],
  exports: [CardsService, CardsRepository],
})
export class CardsModule {}
