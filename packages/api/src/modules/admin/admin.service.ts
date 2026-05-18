import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { SupabaseProvider } from '../../providers/supabase.provider';

@Injectable()
export class AdminService {
  private readonly adminEmails = (process.env['ADMIN_EMAILS'] ?? '').split(',').map(e => e.trim()).filter(Boolean);

  constructor(private readonly supabase: SupabaseProvider) {}

  assertAdmin(email: string): void {
    if (!this.adminEmails.includes(email)) {
      throw new ForbiddenException('Admin access required');
    }
  }

  async getStats() {
    const [users, businesses, tickets, leads, aiCost] = await Promise.all([
      this.supabase.getAdminClient().from('users').select('*', { count: 'exact', head: true }),
      this.supabase.getAdminClient().from('businesses').select('*', { count: 'exact', head: true }),
      this.supabase.getAdminClient().from('support_tickets').select('*', { count: 'exact', head: true }),
      this.supabase.getAdminClient().from('leads').select('*', { count: 'exact', head: true }),
      this.supabase.getAdminClient().from('ai_cost_logs').select('cost_usd'),
    ]);

    const totalCost = (aiCost.data ?? []).reduce((s, r) => s + (r.cost_usd as number), 0);

    return {
      totalUsers: users.count ?? 0,
      totalBusinesses: businesses.count ?? 0,
      totalTickets: tickets.count ?? 0,
      totalLeads: leads.count ?? 0,
      totalAiCostUsd: Math.round(totalCost * 100) / 100,
    };
  }

  async getUsers(page = 1, limit = 50) {
    const offset = (page - 1) * limit;
    const { data, count, error } = await this.supabase.getAdminClient()
      .from('users')
      .select('id, email, full_name, plan, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new BadRequestException(error.message);
    return { items: data ?? [], total: count ?? 0, page, limit };
  }

  async updateUserPlan(userId: string, plan: string) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('users')
      .update({ plan })
      .eq('id', userId)
      .select('id, email, plan')
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async getPrompts() {
    const { data, error } = await this.supabase.getAdminClient()
      .from('prompts')
      .select('*')
      .order('name')
      .order('version', { ascending: false });

    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  async upsertPrompt(payload: { name: string; content: string }) {
    const { data: existing } = await this.supabase.getAdminClient()
      .from('prompts')
      .select('version')
      .eq('name', payload.name)
      .order('version', { ascending: false })
      .limit(1)
      .single();

    const nextVersion = (existing?.version ?? 0) + 1;

    await this.supabase.getAdminClient()
      .from('prompts')
      .update({ is_active: false })
      .eq('name', payload.name);

    const { data, error } = await this.supabase.getAdminClient()
      .from('prompts')
      .insert({ name: payload.name, content: payload.content, version: nextVersion, is_active: true })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async getFailedApiCalls(limit = 100) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('failed_api_calls')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  async getAiCostBreakdown(days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await this.supabase.getAdminClient()
      .from('ai_cost_logs')
      .select('business_id, provider, model, feature, tokens_in, tokens_out, cost_usd, created_at')
      .gte('created_at', since)
      .order('cost_usd', { ascending: false })
      .limit(200);

    const logs = data ?? [];
    const byBusiness: Record<string, { calls: number; cost_usd: number }> = {};
    const byModel: Record<string, { calls: number; cost_usd: number }> = {};

    for (const log of logs) {
      const biz = log.business_id as string;
      const model = log.model as string;
      const cost = log.cost_usd as number;

      byBusiness[biz] = byBusiness[biz] ?? { calls: 0, cost_usd: 0 };
      byBusiness[biz].calls++;
      byBusiness[biz].cost_usd += cost;

      byModel[model] = byModel[model] ?? { calls: 0, cost_usd: 0 };
      byModel[model].calls++;
      byModel[model].cost_usd += cost;
    }

    return {
      totalCost: Math.round(logs.reduce((s, l) => s + (l.cost_usd as number), 0) * 10000) / 10000,
      byBusiness,
      byModel,
    };
  }
}
