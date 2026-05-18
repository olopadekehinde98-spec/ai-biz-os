import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { SupportModule } from '../support/support.module';
import { LeadsModule } from '../leads/leads.module';
import { SupabaseProvider } from '../../providers/supabase.provider';

@Module({
  imports: [SupportModule, LeadsModule],
  controllers: [WebhookController],
  providers: [WebhookService, SupabaseProvider],
})
export class WebhookModule {}
