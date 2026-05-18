import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SupabaseProvider } from '../providers/supabase.provider';

@Injectable()
export class TokenRefresherJob {
  private readonly logger = new Logger(TokenRefresherJob.name);

  constructor(private readonly supabase: SupabaseProvider) {}

  @Cron(CronExpression.EVERY_HOUR)
  async refreshExpiringTokens() {
    const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const { data: accounts } = await this.supabase.getAdminClient()
      .from('connected_accounts')
      .select('*')
      .eq('is_active', true)
      .not('refresh_token', 'is', null)
      .lte('expires_at', oneHourFromNow);

    for (const account of accounts ?? []) {
      try {
        this.logger.log(`Would refresh token for ${account.platform} account ${account.id}`);
      } catch (err) {
        this.logger.error(`Token refresh failed for account ${account.id}`, { err });
        await this.supabase.getAdminClient()
          .from('connected_accounts')
          .update({ is_active: false })
          .eq('id', account.id);
      }
    }
  }
}
