import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { SupabaseProvider } from '../../providers/supabase.provider';
import { MemoryService } from '../memory/memory.service';
import type { Business } from '@ai-biz-os/shared';

@Injectable()
export class BusinessService {
  constructor(
    private readonly supabase: SupabaseProvider,
    private readonly memory: MemoryService,
  ) {}

  async getUserBusinesses(userId: string): Promise<Business[]> {
    const { data, error } = await this.supabase.getAdminClient()
      .from('businesses')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw new BadRequestException(error.message);
    return (data ?? []) as Business[];
  }

  async getBusiness(businessId: string, userId: string): Promise<Business> {
    const { data, error } = await this.supabase.getAdminClient()
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();
    if (error || !data) throw new BadRequestException('Business not found');
    return data as Business;
  }

  async createBusiness(userId: string, payload: { name: string; industry?: string; description?: string; goals?: string[]; timezone?: string }) {
    const { count } = await this.supabase.getAdminClient()
      .from('businesses')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    if ((count ?? 0) >= 10) throw new ForbiddenException('Maximum 10 businesses per user');

    const { data, error } = await this.supabase.getAdminClient()
      .from('businesses')
      .insert({ ...payload, user_id: userId, goals: payload.goals ?? [] })
      .select()
      .single();
    if (error) throw new BadRequestException(error.message);

    if (payload.description) {
      await this.memory.extractAndStore(data.id, `Business: ${payload.name}. ${payload.description}. Goals: ${(payload.goals ?? []).join(', ')}`);
    }

    return data as Business;
  }

  async updateBusiness(businessId: string, userId: string, payload: Partial<{ name: string; industry: string; description: string; goals: string[]; timezone: string }>) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('businesses')
      .update(payload)
      .eq('id', businessId)
      .eq('user_id', userId)
      .select()
      .single();
    if (error) throw new BadRequestException(error.message);
    return data as Business;
  }

  async getDashboardStats(businessId: string) {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const today = new Date().toISOString().split('T')[0];

    const [tickets, leads, tasks, posts, actions] = await Promise.all([
      this.supabase.getAdminClient().from('support_tickets').select('*', { count: 'exact', head: true }).eq('business_id', businessId).eq('status', 'open'),
      this.supabase.getAdminClient().from('leads').select('*', { count: 'exact', head: true }).eq('business_id', businessId).gte('created_at', weekAgo),
      this.supabase.getAdminClient().from('tasks').select('*', { count: 'exact', head: true }).eq('business_id', businessId).lte('due_date', `${today}T23:59:59Z`).neq('status', 'done'),
      this.supabase.getAdminClient().from('content_posts').select('*', { count: 'exact', head: true }).eq('business_id', businessId).eq('status', 'scheduled'),
      this.supabase.getAdminClient().from('ai_actions').select('*', { count: 'exact', head: true }).eq('business_id', businessId).eq('status', 'pending_approval'),
    ]);

    return {
      mrr: 0,
      activeCustomers: 0,
      openTickets: tickets.count ?? 0,
      scheduledPosts: posts.count ?? 0,
      pendingApprovals: actions.count ?? 0,
      leadsThisWeek: leads.count ?? 0,
      tasksDueToday: tasks.count ?? 0,
    };
  }

  async completeOnboardingStep(userId: string, step: number) {
    const { data: existing } = await this.supabase.getAdminClient()
      .from('user_onboarding')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!existing) {
      await this.supabase.getAdminClient()
        .from('user_onboarding')
        .insert({ user_id: userId, step_completed: step });
    } else {
      await this.supabase.getAdminClient()
        .from('user_onboarding')
        .update({ step_completed: Math.max(existing.step_completed, step), completed_at: step >= 5 ? new Date().toISOString() : null })
        .eq('user_id', userId);
    }
  }
}
