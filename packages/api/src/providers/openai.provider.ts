import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { SupabaseProvider } from './supabase.provider';

const TIMEOUT_MS = 30_000;
const EMBEDDING_MODEL = 'text-embedding-3-small';

@Injectable()
export class OpenAIProvider {
  private readonly client: OpenAI;
  private readonly logger = new Logger(OpenAIProvider.name);

  constructor(private readonly supabase: SupabaseProvider) {
    const apiKey = process.env['OPENAI_API_KEY'];
    if (!apiKey) throw new Error('Missing OPENAI_API_KEY');
    this.client = new OpenAI({ apiKey, timeout: TIMEOUT_MS });
  }

  async createEmbedding(text: string, businessId?: string): Promise<number[]> {
    try {
      const response = await this.client.embeddings.create({
        model: EMBEDDING_MODEL,
        input: text,
      });

      const embedding = response.data[0]?.embedding ?? [];

      if (businessId) {
        const tokens = response.usage.total_tokens;
        const costUsd = tokens * 0.00000002;
        await this.supabase.getAdminClient()
          .from('ai_cost_log')
          .insert({
            business_id: businessId,
            provider: 'openai',
            model: EMBEDDING_MODEL,
            tokens_in: tokens,
            tokens_out: 0,
            cost_usd: costUsd,
            feature: 'embedding',
          });
      }

      return embedding;
    } catch (error) {
      this.logger.error('OpenAI embedding error', { error });
      throw error;
    }
  }
}
