import { Global, Module } from '@nestjs/common';
import { TurnstileService } from './turnstile.service';
import { TurnstileGuard } from './turnstile.guard';

@Global()
@Module({
  providers: [TurnstileService, TurnstileGuard],
  exports: [TurnstileService, TurnstileGuard],
})
export class TurnstileModule {}
