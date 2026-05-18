import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { SupabaseProvider } from './supabase.provider';

const TIMEOUT_MS = 30_000;

@Injectable()
export class AnthropicProvider {
  private readonly client: Anthropic;
  private readonly logger = new Logger(AnthropicProvider.name);

  constructor(private readonly supabase: SupabaseProvider) {
    const apiKey = process.env['ANTHROPIC_API_KEY'];
    if (!apiKey) throw new Error('Missing ANTHROPIC_API_KEY');
    this.client = new Anthropic({ apiKey });
  }

  async complete(params: {
    systemPrompt: string;
    userMessage: string;
    businessId?: string;
    feature?: string;
    model?: string;
    maxTokens?: number;
  }): Promise<string> {
    const model = params.model ?? 'claude-sonnet-4-6';
    const maxTokens = params.maxTokens ?? 2048;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await this.client.messages.create({
        model,
        max_tokens: maxTokens,
        system: params.systemPrompt,
        messages: [{ role: 'user', content: params.userMessage }],
      });

      const text = response.content[0]?.type === 'text'
        ? response.content[0].text
        : '';

      if (params.businessId && params.feature) {
        const inputTokens = response.usage.input_tokens;
        const outputTokens = response.usage.output_tokens;
        const costUsd = (inputTokens * 0.000003) + (outputTokens * 0.000015);

        await this.supabase.getAdminClient()
          .from('ai_cost_log')
          .insert({
            business_id: params.businessId,
            provider: 'anthropic',
            model,
            tokens_in: inputTokens,
            tokens_out: outputTokens,
            cost_usd: costUsd,
            feature: params.feature,
          });
      }

      return text;
    } catch (error) {
      this.logger.error('Anthropic API error', { error, feature: params.feature });
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}
