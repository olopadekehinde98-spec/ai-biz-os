import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { SupabaseProvider } from '../../providers/supabase.provider';

@Module({
  controllers: [AdminController],
  providers: [AdminService, SupabaseProvider],
  exports: [AdminService],
})
export class AdminModule {}
