import { Module, Global } from '@nestjs/common';
import { HttpModule } from '../../common/infrastructure/http';
import { LoggerModule } from '../../common/infrastructure/logger';
import { ConfigModule } from '../../common/config';
import { AirwallexConfigService } from './airwallex.config.service';
import { AirwallexAuthService } from './airwallex-auth.service';
import { AirwallexPaymentLinksService } from './airwallex-payment-links.service';
import { AirwallexTransfersService } from './airwallex-transfers.service';

@Global()
@Module({
  imports: [HttpModule, LoggerModule, ConfigModule],
  providers: [
    AirwallexConfigService,
    AirwallexAuthService,
    AirwallexPaymentLinksService,
    AirwallexTransfersService,
  ],
  exports: [
    AirwallexConfigService,
    AirwallexAuthService,
    AirwallexPaymentLinksService,
    AirwallexTransfersService,
  ],
})
export class AirwallexModule {}
