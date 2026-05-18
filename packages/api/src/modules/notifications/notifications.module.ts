import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { SupabaseProvider } from '../../providers/supabase.provider';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, SupabaseProvider],
  exports: [NotificationsService],
})
export class NotificationsModule {}
