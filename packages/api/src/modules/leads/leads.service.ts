import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { SupabaseProvider } from '../../providers/supabase.provider';
import { AnthropicProvider } from '../../providers/anthropic.provider';
import { MemoryService } from '../memory/memory.service';
import type { Lead, LeadStatus } from '@ai-biz-os/shared';

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    private readonly supabase: SupabaseProvider,
    private readonly anthropic: AnthropicProvider,
    private readonly memory: MemoryService,
  ) {}

  async listLeads(businessId: string, status?: LeadStatus): Promise<Lead[]> {
    let query = this.supabase.getAdminClient()
      .from('leads')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw new BadRequestException(error.message);
    return (data ?? []) as Lead[];
  }

  async getLead(businessId: string, leadId: string): Promise<Lead> {
    const { data, error } = await this.supabase.getAdminClient()
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .eq('business_id', businessId)
      .single();
    if (error || !data) throw new BadRequestException('Lead not found');
    return data as Lead;
  }

  async createLead(businessId: string, payload: {
    name: string;
    email?: string;
    company?: string;
    source?: string;
    notes?: string;
  }): Promise<Lead> {
    const { data, error } = await this.supabase.getAdminClient()
      .from('leads')
      .insert({
        business_id: businessId,
        ...payload,
        status: 'new',
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    const lead = data as Lead;

    await this.memory.extractAndStore(
      businessId,
      `New lead: ${lead.name}${lead.company ? ` from ${lead.company}` : ''}. Source: ${lead.source ?? 'unknown'}. Email: ${lead.email ?? 'unknown'}.`,
    );

    return lead;
  }

  async updateLead(businessId: string, leadId: string, payload: Partial<{
    name: string;
    email: string;
    company: string;
    source: string;
    status: LeadStatus;
    notes: string;
  }>): Promise<Lead> {
    const updates: Record<string, unknown> = { ...payload };

    if (payload.status === 'contacted') {
      updates['last_contacted_at'] = new Date().toISOString();
    }

    const { data, error } = await this.supabase.getAdminClient()
      .from('leads')
      .update(updates)
      .eq('id', leadId)
      .eq('business_id', businessId)
      .select()
      .single();

    if (error || !data) throw new BadRequestException(error?.message ?? 'Lead not found');
    return data as Lead;
  }

  async deleteLead(businessId: string, leadId: string): Promise<void> {
    const { error } = await this.supabase.getAdminClient()
      .from('leads')
      .delete()
      .eq('id', leadId)
      .eq('business_id', businessId);

    if (error) throw new BadRequestException(error.message);
  }

  async generateOutreach(businessId: string, leadId: string): Promise<string> {
    const [lead, memories] = await Promise.all([
      this.getLead(businessId, leadId),
      this.memory.retrieveRelevant(businessId, 'sales outreach lead qualification', 5),
    ]);

    const memoriesText = await this.memory.formatMemoriesForPrompt(memories);

    const { data: business } = await this.supabase.getAdminClient()
      .from('businesses')
      .select('name, industry')
      .eq('id', businessId)
      .single();

    const systemPrompt = `You are a sales expert for ${business?.name ?? 'our company'}. Business context:\n${memoriesText}\n\nWrite personalized, compelling outreach. Return JSON: {"subject": "email subject", "body": "email body"}`;

    const userMessage = `Write an outreach email to ${lead.name}${lead.company ? ` at ${lead.company}` : ''}. Lead source: ${lead.source ?? 'unknown'}. Notes: ${lead.notes ?? 'none'}.`;

    try {
      const raw = await this.anthropic.complete({
        systemPrompt,
        userMessage,
        businessId,
        feature: 'lead_outreach',
        maxTokens: 512,
      });
      return raw;
    } catch (err) {
      this.logger.error('Outreach generation failed', { err });
      return JSON.stringify({
        subject: `Following up — ${business?.name ?? 'Our Services'}`,
        body: `Hi ${lead.name},\n\nI wanted to reach out and introduce ourselves...`,
      });
    }
  }

  async getStats(businessId: string) {
    const statuses: LeadStatus[] = ['new', 'contacted', 'qualified', 'converted', 'lost'];
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

    return results.reduce((acc, r) => ({ ...acc, [r.status]: r.count }), {} as Record<LeadStatus, number>);
  }
}
