import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SupabaseProvider } from '../providers/supabase.provider';
import { AnthropicProvider } from '../providers/anthropic.provider';

@Injectable()
export class LeadFollowupJob {
  private readonly logger = new Logger(LeadFollowupJob.name);

  constructor(
    private readonly supabase: SupabaseProvider,
    private readonly anthropic: AnthropicProvider,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async checkLeadsNeedingFollowup() {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

    const { data: leads } = await this.supabase.getAdminClient()
      .from('leads')
      .select('*, businesses(id, name)')
      .in('status', ['new', 'contacted'])
      .lt('last_contacted_at', threeDaysAgo)
      .is('last_contacted_at', null)
      .limit(100);

    for (const lead of leads ?? []) {
      try {
        await this.supabase.getAdminClient()
          .from('ai_actions')
          .insert({
            business_id: lead.business_id,
            action_type: 'lead_followup',
            description: `Follow up with ${lead.name} (${lead.email ?? 'no email'}) — no contact in 3+ days`,
            payload: { lead_id: lead.id, lead_name: lead.name, lead_email: lead.email },
            status: 'pending_approval',
          });
      } catch (err) {
        this.logger.error(`Failed to create followup action for lead ${lead.id}`, { err });
      }
    }
  }
}
