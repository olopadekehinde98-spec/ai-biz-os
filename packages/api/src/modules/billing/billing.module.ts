import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { SupabaseProvider } from '../../providers/supabase.provider';

@Module({
  controllers: [BillingController],
  providers: [BillingService, SupabaseProvider],
  exports: [BillingService],
})
export class BillingModule {}
