import { Injectable, Logger } from '@nestjs/common';
import { SupabaseProvider } from '../../providers/supabase.provider';
import { AnthropicProvider } from '../../providers/anthropic.provider';
import { MemoryService } from '../memory/memory.service';
import { Resend } from 'resend';
import type { DailyReport, ReportContent } from '@ai-biz-os/shared';

@Injectable()
export class ReportService {
  private readonly logger = new Logger(ReportService.name);
  private readonly resend: Resend;

  constructor(
    private readonly supabase: SupabaseProvider,
    private readonly anthropic: AnthropicProvider,
    private readonly memory: MemoryService,
  ) {
    this.resend = new Resend(process.env['RESEND_API_KEY']);
  }

  async generateReport(businessId: string): Promise<DailyReport> {
    const [business, memories, promptRow] = await Promise.all([
      this.supabase.getAdminClient()
        .from('businesses')
        .select('*')
        .eq('id', businessId)
        .single()
        .then(r => r.data),
      this.memory.retrieveRelevant(businessId, 'daily business performance report', 10),
      this.supabase.getAdminClient()
        .from('prompts')
        .select('content')
        .eq('name', 'daily_ceo_report')
        .eq('is_active', true)
        .order('version', { ascending: false })
        .limit(1)
        .single()
        .then(r => r.data),
    ]);

    if (!business) throw new Error(`Business ${businessId} not found`);

    const memoriesText = await this.memory.formatMemoriesForPrompt(memories);

    const [supportStats, leadStats, taskStats] = await Promise.all([
      this.getSupportStats(businessId),
      this.getLeadStats(businessId),
      this.getTaskStats(businessId),
    ]);

    const dataContext = JSON.stringify({
      support: supportStats,
      leads: leadStats,
      tasks: taskStats,
      date: new Date().toISOString().split('T')[0],
    });

    const systemPrompt = `You are the AI Chief of Staff for ${business.name}. You have deep knowledge of this business:\n${memoriesText}\nGenerate a structured CEO morning briefing. Respond with valid JSON only.`;

    const userMessage = (promptRow?.content ?? 'Generate daily report based on: {{data}}')
      .replace('{{business_name}}', business.name)
      .replace('{{memories}}', memoriesText)
      .replace('{{data}}', dataContext);

    let content: ReportContent;
    try {
      const raw = await this.anthropic.complete({
        systemPrompt,
        userMessage,
        businessId,
        feature: 'report',
        maxTokens: 2048,
      });
      content = JSON.parse(raw) as ReportContent;
    } catch {
      content = {
        executive_summary: 'Report generation encountered an issue. Data is being processed.',
        revenue_financial: 'Unable to retrieve financial data at this time.',
        marketing_performance: 'Social media data is being fetched.',
        customer_support: `${supportStats.open} open tickets.`,
        growth_opportunities: 'Analysis in progress.',
        priority_actions: ['Review dashboard for latest metrics', 'Check support inbox'],
      };
    }

    const today = new Date().toISOString().split('T')[0]!;

    const { data: report, error } = await this.supabase.getAdminClient()
      .from('daily_reports')
      .upsert({
        business_id: businessId,
        report_date: today,
        content,
        summary: content.executive_summary,
        key_insights: [content.marketing_performance, content.customer_support].filter(Boolean),
        action_items: content.priority_actions,
      }, { onConflict: 'business_id,report_date' })
      .select()
      .single();

    if (error) throw new Error(error.message);

    await this.supabase.getAdminClient()
      .from('audit_log')
      .insert({
        business_id: businessId,
        actor: 'ai',
        action: 'generated_daily_report',
        entity_type: 'daily_report',
        entity_id: report?.id,
        metadata: { report_date: today },
      });

    return report as DailyReport;
  }

  async sendReport(reportId: string, businessId: string) {
    const [report, business, user] = await Promise.all([
      this.supabase.getAdminClient()
        .from('daily_reports')
        .select('*')
        .eq('id', reportId)
        .single()
        .then(r => r.data as DailyReport | null),
      this.supabase.getAdminClient()
        .from('businesses')
        .select('name, user_id')
        .eq('id', businessId)
        .single()
        .then(r => r.data),
      null,
    ]);

    if (!report || !business) return;

    const userRecord = await this.supabase.getAdminClient()
      .from('users')
      .select('email, full_name')
      .eq('id', business.user_id)
      .single()
      .then(r => r.data);

    if (!userRecord?.email) return;

    const htmlBody = this.buildReportEmail(report, business.name);

    try {
      await this.resend.emails.send({
        from: 'AI BizOS <reports@ai-biz-os.com>',
        to: userRecord.email,
        subject: `${business.name} — Daily CEO Report (${report.report_date})`,
        html: htmlBody,
      });

      await this.supabase.getAdminClient()
        .from('daily_reports')
        .update({ sent_at: new Date().toISOString() })
        .eq('id', reportId);
    } catch (err) {
      this.logger.error('Failed to send report email', { err, reportId });
    }
  }

  async getReports(businessId: string, limit = 30): Promise<DailyReport[]> {
    const { data } = await this.supabase.getAdminClient()
      .from('daily_reports')
      .select('*')
      .eq('business_id', businessId)
      .order('report_date', { ascending: false })
      .limit(limit);
    return (data ?? []) as DailyReport[];
  }

  async getReport(businessId: string, reportId: string): Promise<DailyReport | null> {
    const { data } = await this.supabase.getAdminClient()
      .from('daily_reports')
      .select('*')
      .eq('id', reportId)
      .eq('business_id', businessId)
      .single();
    return data as DailyReport | null;
  }

  private async getSupportStats(businessId: string) {
    const { count: open } = await this.supabase.getAdminClient()
      .from('support_tickets')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .eq('status', 'open');

    const { count: angry } = await this.supabase.getAdminClient()
      .from('support_tickets')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .eq('sentiment', 'angry');

    return { open: open ?? 0, angry: angry ?? 0 };
  }

  private async getLeadStats(businessId: string) {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count: thisWeek } = await this.supabase.getAdminClient()
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .gte('created_at', weekAgo);
    return { thisWeek: thisWeek ?? 0 };
  }

  private async getTaskStats(businessId: string) {
    const today = new Date().toISOString().split('T')[0];
    const { count: dueToday } = await this.supabase.getAdminClient()
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .lte('due_date', `${today}T23:59:59Z`)
      .neq('status', 'done');
    return { dueToday: dueToday ?? 0 };
  }

  private buildReportEmail(report: DailyReport, businessName: string): string {
    const c = report.content as ReportContent;
    return `
      <!DOCTYPE html>
      <html>
      <body style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#111">
        <div style="background:#0f172a;color:#fff;padding:24px;border-radius:8px 8px 0 0">
          <h1 style="margin:0;font-size:20px">${businessName}</h1>
          <p style="margin:4px 0 0;opacity:0.7;font-size:14px">Daily CEO Report — ${report.report_date}</p>
        </div>
        <div style="border:1px solid #e2e8f0;border-top:none;padding:24px;border-radius:0 0 8px 8px">
          <h2 style="color:#0f172a;font-size:16px;margin-top:0">Executive Summary</h2>
          <p style="color:#374151">${c.executive_summary}</p>
          <h2 style="color:#0f172a;font-size:16px">Revenue & Financial</h2>
          <p style="color:#374151">${c.revenue_financial}</p>
          <h2 style="color:#0f172a;font-size:16px">Marketing Performance</h2>
          <p style="color:#374151">${c.marketing_performance}</p>
          <h2 style="color:#0f172a;font-size:16px">Customer & Support</h2>
          <p style="color:#374151">${c.customer_support}</p>
          <h2 style="color:#0f172a;font-size:16px">Growth Opportunities</h2>
          <p style="color:#374151">${c.growth_opportunities}</p>
          <h2 style="color:#0f172a;font-size:16px">Today's Priority Actions</h2>
          <ol style="color:#374151">
            ${c.priority_actions.map(a => `<li>${a}</li>`).join('')}
          </ol>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
          <p style="font-size:12px;color:#6b7280">AI BizOS — Your AI Chief of Staff</p>
        </div>
      </body>
      </html>
    `;
  }
}
