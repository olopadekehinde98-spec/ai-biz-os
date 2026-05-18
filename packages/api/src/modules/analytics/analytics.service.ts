import { Injectable, BadRequestException } from '@nestjs/common';
import { SupabaseProvider } from '../../providers/supabase.provider';
import { AnthropicProvider } from '../../providers/anthropic.provider';
import { MemoryService } from '../memory/memory.service';

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly supabase: SupabaseProvider,
    private readonly anthropic: AnthropicProvider,
    private readonly memory: MemoryService,
  ) {}

  async getOverview(businessId: string, days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const [leads, tickets, tasks, posts, aiCosts] = await Promise.all([
      this.getLeadMetrics(businessId, since),
      this.getTicketMetrics(businessId, since),
      this.getTaskMetrics(businessId, since),
      this.getPostMetrics(businessId, since),
      this.getAiCostMetrics(businessId, since),
    ]);

    return { period: `${days}d`, leads, tickets, tasks, posts, aiCosts };
  }

  async getLeadFunnel(businessId: string) {
    const statuses = ['new', 'contacted', 'qualified', 'converted', 'lost'] as const;
    const results = await Promise.all(
      statuses.map(status =>
        this.supabase.getAdminClient()
          .from('leads')
          .select('*', { count: 'exact', head: true })
          .eq('business_id', businessId)
          .eq('status', status)
          .then(r => ({ status, count: r.count ?? 0 })),
      ),
    );

    const total = results.reduce((sum, r) => sum + r.count, 0);
    return results.map(r => ({
      ...r,
      rate: total > 0 ? Math.round((r.count / total) * 100) : 0,
    }));
  }

  async getAiUsage(businessId: string, days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data } = await this.supabase.getAdminClient()
      .from('ai_cost_logs')
      .select('feature, provider, model, tokens_in, tokens_out, cost_usd, created_at')
      .eq('business_id', businessId)
      .gte('created_at', since)
      .order('created_at', { ascending: false });

    const logs = data ?? [];

    const byFeature = logs.reduce((acc, log) => {
      const key = log.feature as string;
      if (!acc[key]) acc[key] = { calls: 0, cost_usd: 0, tokens: 0 };
      acc[key].calls++;
      acc[key].cost_usd += log.cost_usd as number;
      acc[key].tokens += ((log.tokens_in as number) + (log.tokens_out as number));
      return acc;
    }, {} as Record<string, { calls: number; cost_usd: number; tokens: number }>);

    const totalCost = logs.reduce((sum, l) => sum + (l.cost_usd as number), 0);

    return { totalCost: Math.round(totalCost * 10000) / 10000, byFeature, logs: logs.slice(0, 20) };
  }

  async getAuditLog(businessId: string, limit = 50) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('audit_log')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  async generateInsights(businessId: string): Promise<string> {
    const [overview, funnel] = await Promise.all([
      this.getOverview(businessId, 7),
      this.getLeadFunnel(businessId),
    ]);

    const memories = await this.memory.retrieveRelevant(businessId, 'business performance analytics insights', 5);
    const memoriesText = await this.memory.formatMemoriesForPrompt(memories);

    const { data: business } = await this.supabase.getAdminClient()
      .from('businesses')
      .select('name, goals')
      .eq('id', businessId)
      .single();

    const systemPrompt = `You are a business analyst for ${business?.name ?? 'this business'}. Goals: ${(business?.goals ?? []).join(', ')}. Context:\n${memoriesText}`;
    const userMessage = `Analyze the last 7 days:\n${JSON.stringify({ overview, funnel }, null, 2)}\n\nProvide 3 specific, actionable insights with data-driven recommendations.`;

    try {
      return await this.anthropic.complete({
        systemPrompt,
        userMessage,
        businessId,
        feature: 'analytics_insights',
        maxTokens: 512,
      });
    } catch {
      return 'Unable to generate insights at this time. Please check your data and try again.';
    }
  }

  private async getLeadMetrics(businessId: string, since: string) {
    const [total, converted, thisWeek] = await Promise.all([
      this.supabase.getAdminClient().from('leads').select('*', { count: 'exact', head: true }).eq('business_id', businessId).gte('created_at', since),
      this.supabase.getAdminClient().from('leads').select('*', { count: 'exact', head: true }).eq('business_id', businessId).eq('status', 'converted').gte('created_at', since),
      this.supabase.getAdminClient().from('leads').select('*', { count: 'exact', head: true }).eq('business_id', businessId).gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    ]);

    const totalCount = total.count ?? 0;
    const convertedCount = converted.count ?? 0;
    return {
      total: totalCount,
      converted: convertedCount,
      conversionRate: totalCount > 0 ? Math.round((convertedCount / totalCount) * 100) : 0,
      thisWeek: thisWeek.count ?? 0,
    };
  }

  private async getTicketMetrics(businessId: string, since: string) {
    const [total, resolved, escalated] = await Promise.all([
      this.supabase.getAdminClient().from('support_tickets').select('*', { count: 'exact', head: true }).eq('business_id', businessId).gte('created_at', since),
      this.supabase.getAdminClient().from('support_tickets').select('*', { count: 'exact', head: true }).eq('business_id', businessId).eq('status', 'resolved').gte('created_at', since),
      this.supabase.getAdminClient().from('support_tickets').select('*', { count: 'exact', head: true }).eq('business_id', businessId).eq('status', 'escalated').gte('created_at', since),
    ]);

    const totalCount = total.count ?? 0;
    const resolvedCount = resolved.count ?? 0;
    return {
      total: totalCount,
      resolved: resolvedCount,
      escalated: escalated.count ?? 0,
      resolutionRate: totalCount > 0 ? Math.round((resolvedCount / totalCount) * 100) : 0,
    };
  }

  private async getTaskMetrics(businessId: string, since: string) {
    const [total, done, overdue] = await Promise.all([
      this.supabase.getAdminClient().from('tasks').select('*', { count: 'exact', head: true }).eq('business_id', businessId).gte('created_at', since),
      this.supabase.getAdminClient().from('tasks').select('*', { count: 'exact', head: true }).eq('business_id', businessId).eq('status', 'done').gte('created_at', since),
      this.supabase.getAdminClient().from('tasks').select('*', { count: 'exact', head: true }).eq('business_id', businessId).neq('status', 'done').lt('due_date', new Date().toISOString()),
    ]);

    return { total: total.count ?? 0, done: done.count ?? 0, overdue: overdue.count ?? 0 };
  }

  private async getPostMetrics(businessId: string, since: string) {
    const [published, scheduled, failed] = await Promise.all([
      this.supabase.getAdminClient().from('content_posts').select('*', { count: 'exact', head: true }).eq('business_id', businessId).eq('status', 'published').gte('created_at', since),
      this.supabase.getAdminClient().from('content_posts').select('*', { count: 'exact', head: true }).eq('business_id', businessId).eq('status', 'scheduled'),
      this.supabase.getAdminClient().from('content_posts').select('*', { count: 'exact', head: true }).eq('business_id', businessId).eq('status', 'failed').gte('created_at', since),
    ]);

    return { published: published.count ?? 0, scheduled: scheduled.count ?? 0, failed: failed.count ?? 0 };
  }

  private async getAiCostMetrics(businessId: string, since: string) {
    const { data } = await this.supabase.getAdminClient()
      .from('ai_cost_logs')
      .select('cost_usd')
      .eq('business_id', businessId)
      .gte('created_at', since);

    const total = (data ?? []).reduce((sum, r) => sum + (r.cost_usd as number), 0);
    return { totalCostUsd: Math.round(total * 10000) / 10000, calls: (data ?? []).length };
  }
}
