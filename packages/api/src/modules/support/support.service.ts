import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { SupabaseProvider } from '../../providers/supabase.provider';
import { AnthropicProvider } from '../../providers/anthropic.provider';
import { MemoryService } from '../memory/memory.service';
import type { SupportTicket, TicketStatus, TicketSentiment } from '@ai-biz-os/shared';

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  constructor(
    private readonly supabase: SupabaseProvider,
    private readonly anthropic: AnthropicProvider,
    private readonly memory: MemoryService,
  ) {}

  async listTickets(businessId: string, status?: TicketStatus): Promise<SupportTicket[]> {
    let query = this.supabase.getAdminClient()
      .from('support_tickets')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw new BadRequestException(error.message);
    return (data ?? []) as SupportTicket[];
  }

  async getTicket(businessId: string, ticketId: string): Promise<SupportTicket> {
    const { data, error } = await this.supabase.getAdminClient()
      .from('support_tickets')
      .select('*')
      .eq('id', ticketId)
      .eq('business_id', businessId)
      .single();
    if (error || !data) throw new BadRequestException('Ticket not found');
    return data as SupportTicket;
  }

  async createTicket(businessId: string, payload: {
    customer_name: string;
    customer_email: string;
    platform: string;
    message: string;
  }): Promise<SupportTicket> {
    const sentiment = await this.analyzeSentiment(businessId, payload.message);

    const { data, error } = await this.supabase.getAdminClient()
      .from('support_tickets')
      .insert({
        business_id: businessId,
        ...payload,
        sentiment,
        status: 'open',
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    const ticket = data as SupportTicket;
    await this.generateAiResponse(businessId, ticket);
    return ticket;
  }

  async generateAiResponse(businessId: string, ticket: SupportTicket): Promise<string> {
    const memories = await this.memory.retrieveRelevant(
      businessId,
      `customer support: ${ticket.message}`,
      5,
    );
    const memoriesText = await this.memory.formatMemoriesForPrompt(memories);

    const { data: business } = await this.supabase.getAdminClient()
      .from('businesses')
      .select('name')
      .eq('id', businessId)
      .single();

    const systemPrompt = `You are a customer support representative for ${business?.name ?? 'our company'}. Business context:\n${memoriesText}\n\nRespond professionally, empathetically, and helpfully. Keep responses concise but complete.`;

    const userMessage = `Customer: ${ticket.customer_name}\nMessage: ${ticket.message}\n\nGenerate a helpful response.`;

    let response: string;
    try {
      response = await this.anthropic.complete({
        systemPrompt,
        userMessage,
        businessId,
        feature: 'support_response',
        maxTokens: 512,
      });
    } catch (err) {
      this.logger.error('AI response generation failed', { err });
      response = `Thank you for reaching out, ${ticket.customer_name}. We've received your message and will get back to you shortly.`;
    }

    await this.supabase.getAdminClient()
      .from('support_tickets')
      .update({ ai_response: response, status: 'ai_replied' })
      .eq('id', ticket.id);

    await this.supabase.getAdminClient()
      .from('audit_log')
      .insert({
        business_id: businessId,
        actor: 'ai',
        action: 'generated_support_response',
        entity_type: 'support_ticket',
        entity_id: ticket.id,
        metadata: { sentiment: ticket.sentiment },
      });

    return response;
  }

  async updateTicketStatus(businessId: string, ticketId: string, status: TicketStatus): Promise<SupportTicket> {
    const { data, error } = await this.supabase.getAdminClient()
      .from('support_tickets')
      .update({ status })
      .eq('id', ticketId)
      .eq('business_id', businessId)
      .select()
      .single();

    if (error || !data) throw new BadRequestException(error?.message ?? 'Ticket not found');
    return data as SupportTicket;
  }

  async escalateTicket(businessId: string, ticketId: string): Promise<SupportTicket> {
    return this.updateTicketStatus(businessId, ticketId, 'escalated');
  }

  async getStats(businessId: string) {
    const [open, aiReplied, escalated, angry] = await Promise.all([
      this.supabase.getAdminClient().from('support_tickets').select('*', { count: 'exact', head: true }).eq('business_id', businessId).eq('status', 'open'),
      this.supabase.getAdminClient().from('support_tickets').select('*', { count: 'exact', head: true }).eq('business_id', businessId).eq('status', 'ai_replied'),
      this.supabase.getAdminClient().from('support_tickets').select('*', { count: 'exact', head: true }).eq('business_id', businessId).eq('status', 'escalated'),
      this.supabase.getAdminClient().from('support_tickets').select('*', { count: 'exact', head: true }).eq('business_id', businessId).eq('sentiment', 'angry'),
    ]);

    return {
      open: open.count ?? 0,
      aiReplied: aiReplied.count ?? 0,
      escalated: escalated.count ?? 0,
      angryCustomers: angry.count ?? 0,
    };
  }

  private async analyzeSentiment(businessId: string, message: string): Promise<TicketSentiment> {
    try {
      const raw = await this.anthropic.complete({
        systemPrompt: 'Analyze customer message sentiment. Reply with exactly one word: positive, neutral, frustrated, or angry.',
        userMessage: message,
        businessId,
        feature: 'sentiment_analysis',
        maxTokens: 10,
      });
      const sentiment = raw.trim().toLowerCase() as TicketSentiment;
      return ['positive', 'neutral', 'frustrated', 'angry'].includes(sentiment) ? sentiment : 'neutral';
    } catch {
      return 'neutral';
    }
  }
}
