import { Module } from '@nestjs/common';
import { ApprovalsController } from './approvals.controller';
import { ApprovalsService } from './approvals.service';
import { SupabaseProvider } from '../../providers/supabase.provider';

@Module({
  controllers: [ApprovalsController],
  providers: [ApprovalsService, SupabaseProvider],
  exports: [ApprovalsService],
})
export class ApprovalsModule {}
