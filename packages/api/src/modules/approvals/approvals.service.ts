import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { SupabaseProvider } from '../../providers/supabase.provider';
import type { AiAction, ActionStatus } from '@ai-biz-os/shared';

@Injectable()
export class ApprovalsService {
  private readonly logger = new Logger(ApprovalsService.name);

  constructor(private readonly supabase: SupabaseProvider) {}

  async listActions(businessId: string, status?: ActionStatus): Promise<AiAction[]> {
    let query = this.supabase.getAdminClient()
      .from('ai_actions')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw new BadRequestException(error.message);
    return (data ?? []) as AiAction[];
  }

  async getAction(businessId: string, actionId: string): Promise<AiAction> {
    const { data, error } = await this.supabase.getAdminClient()
      .from('ai_actions')
      .select('*')
      .eq('id', actionId)
      .eq('business_id', businessId)
      .single();
    if (error || !data) throw new BadRequestException('Action not found');
    return data as AiAction;
  }

  async approveAction(businessId: string, actionId: string, userId: string): Promise<AiAction> {
    const action = await this.getAction(businessId, actionId);
    if (action.status !== 'pending_approval') {
      throw new BadRequestException('Action is not pending approval');
    }

    const { data, error } = await this.supabase.getAdminClient()
      .from('ai_actions')
      .update({ status: 'approved', executed_at: new Date().toISOString() })
      .eq('id', actionId)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    await this.supabase.getAdminClient()
      .from('audit_log')
      .insert({
        business_id: businessId,
        actor: 'user',
        action: 'approved_ai_action',
        entity_type: 'ai_action',
        entity_id: actionId,
        metadata: { action_type: action.action_type, approved_by: userId },
      });

    await this.executeAction(data as AiAction);
    return data as AiAction;
  }

  async rejectAction(businessId: string, actionId: string, userId: string): Promise<AiAction> {
    const action = await this.getAction(businessId, actionId);
    if (action.status !== 'pending_approval') {
      throw new BadRequestException('Action is not pending approval');
    }

    const { data, error } = await this.supabase.getAdminClient()
      .from('ai_actions')
      .update({ status: 'rejected' })
      .eq('id', actionId)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    await this.supabase.getAdminClient()
      .from('audit_log')
      .insert({
        business_id: businessId,
        actor: 'user',
        action: 'rejected_ai_action',
        entity_type: 'ai_action',
        entity_id: actionId,
        metadata: { action_type: action.action_type, rejected_by: userId },
      });

    return data as AiAction;
  }

  async getPendingCount(businessId: string): Promise<number> {
    const { count } = await this.supabase.getAdminClient()
      .from('ai_actions')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .eq('status', 'pending_approval');
    return count ?? 0;
  }

  private async executeAction(action: AiAction): Promise<void> {
    try {
      switch (action.action_type) {
        case 'lead_followup':
          await this.supabase.getAdminClient()
            .from('leads')
            .update({ status: 'contacted', last_contacted_at: new Date().toISOString() } as Record<string, unknown>)
            .eq('id', (action.payload as Record<string, unknown>)['lead_id'] as string);
          break;
        default:
          this.logger.log(`Executed action ${action.id} of type ${action.action_type}`);
      }

      await this.supabase.getAdminClient()
        .from('ai_actions')
        .update({ status: 'executed' })
        .eq('id', action.id);
    } catch (err) {
      this.logger.error(`Action execution failed for ${action.id}`, { err });
      await this.supabase.getAdminClient()
        .from('ai_actions')
        .update({ status: 'failed' })
        .eq('id', action.id);
    }
  }
}
