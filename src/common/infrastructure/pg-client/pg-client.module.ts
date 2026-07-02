import { Module, Global } from '@nestjs/common';
import { PgClientService } from './pg-client.service';

@Global()
@Module({
  providers: [PgClientService],
  exports: [PgClientService],
})
export class PgClientModule {}
