import { Injectable, Logger } from '@nestjs/common';
import { SupabaseProvider } from '../../providers/supabase.provider';
import { PineconeProvider } from '../../providers/pinecone.provider';
import { AnthropicProvider } from '../../providers/anthropic.provider';
import { OpenAIProvider } from '../../providers/openai.provider';
import type { AiMemory, MemoryType } from '@ai-biz-os/shared';

interface ExtractedMemory {
  memory_type: MemoryType;
  content: string;
  importance_score: number;
}

@Injectable()
export class MemoryService {
  private readonly logger = new Logger(MemoryService.name);

  constructor(
    private readonly supabase: SupabaseProvider,
    private readonly pinecone: PineconeProvider,
    private readonly anthropic: AnthropicProvider,
    private readonly openai: OpenAIProvider,
  ) {}

  async extractAndStore(businessId: string, text: string): Promise<AiMemory[]> {
    const { data: promptRow } = await this.supabase.getAdminClient()
      .from('prompts')
      .select('content')
      .eq('name', 'memory_extraction')
      .eq('is_active', true)
      .order('version', { ascending: false })
      .limit(1)
      .single();

    const systemPrompt = 'You are a business intelligence extraction system. Extract key memories from business text.';
    const userMessage = (promptRow?.content ?? 'Extract memories from: {{text}}')
      .replace('{{text}}', text);

    let extracted: ExtractedMemory[] = [];
    try {
      const raw = await this.anthropic.complete({
        systemPrompt,
        userMessage,
        businessId,
        feature: 'memory_extraction',
        maxTokens: 1024,
      });
      extracted = JSON.parse(raw) as ExtractedMemory[];
    } catch {
      this.logger.warn('Memory extraction parse failed, using fallback');
      extracted = [{
        memory_type: 'fact',
        content: text.slice(0, 500),
        importance_score: 0.5,
      }];
    }

    const saved: AiMemory[] = [];
    for (const mem of extracted) {
      try {
        const embedding = await this.openai.createEmbedding(mem.content, businessId);
        const pineconeId = `${businessId}_${Date.now()}_${Math.random().toString(36).slice(2)}`;

        await this.pinecone.getIndex().namespace(businessId).upsert([{
          id: pineconeId,
          values: embedding,
          metadata: {
            business_id: businessId,
            memory_type: mem.memory_type,
            content: mem.content,
            importance_score: mem.importance_score,
          },
        }]);

        const { data } = await this.supabase.getAdminClient()
          .from('ai_memories')
          .insert({
            business_id: businessId,
            memory_type: mem.memory_type,
            content: mem.content,
            pinecone_id: pineconeId,
            importance_score: mem.importance_score,
          })
          .select()
          .single();

        if (data) saved.push(data as AiMemory);
      } catch (err) {
        this.logger.error('Failed to save memory', { err, mem });
      }
    }

    return saved;
  }

  async retrieveRelevant(businessId: string, query: string, topK = 10): Promise<AiMemory[]> {
    try {
      const embedding = await this.openai.createEmbedding(query, businessId);

      const results = await this.pinecone.getIndex()
        .namespace(businessId)
        .query({ vector: embedding, topK, includeMetadata: true });

      const pineconeIds = results.matches
        .filter(m => m.score && m.score > 0.7)
        .map(m => m.id);

      if (pineconeIds.length === 0) return this.getFallbackMemories(businessId);

      const { data } = await this.supabase.getAdminClient()
        .from('ai_memories')
        .select('*')
        .eq('business_id', businessId)
        .in('pinecone_id', pineconeIds);

      return (data ?? []) as AiMemory[];
    } catch (err) {
      this.logger.error('Memory retrieval failed', { err });
      return this.getFallbackMemories(businessId);
    }
  }

  private async getFallbackMemories(businessId: string): Promise<AiMemory[]> {
    const { data } = await this.supabase.getAdminClient()
      .from('ai_memories')
      .select('*')
      .eq('business_id', businessId)
      .order('importance_score', { ascending: false })
      .limit(10);
    return (data ?? []) as AiMemory[];
  }

  async formatMemoriesForPrompt(memories: AiMemory[]): Promise<string> {
    return memories
      .map(m => `[${m.memory_type.toUpperCase()}] ${m.content}`)
      .join('\n');
  }

  async listMemories(businessId: string) {
    const { data, error } = await this.supabase.getAdminClient()
      .from('ai_memories')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data as AiMemory[];
  }

  async deleteMemory(businessId: string, memoryId: string) {
    const { data } = await this.supabase.getAdminClient()
      .from('ai_memories')
      .select('pinecone_id')
      .eq('id', memoryId)
      .eq('business_id', businessId)
      .single();

    if (data?.pinecone_id) {
      try {
        await this.pinecone.getIndex().namespace(businessId).deleteOne(data.pinecone_id);
      } catch (err) {
        this.logger.warn('Pinecone delete failed', { err });
      }
    }

    await this.supabase.getAdminClient()
      .from('ai_memories')
      .delete()
      .eq('id', memoryId)
      .eq('business_id', businessId);
  }

  async addMemory(businessId: string, content: string, memoryType: MemoryType, importanceScore = 0.5) {
    const embedding = await this.openai.createEmbedding(content, businessId);
    const pineconeId = `${businessId}_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    await this.pinecone.getIndex().namespace(businessId).upsert([{
      id: pineconeId,
      values: embedding,
      metadata: { business_id: businessId, memory_type: memoryType, content, importance_score: importanceScore },
    }]);

    const { data, error } = await this.supabase.getAdminClient()
      .from('ai_memories')
      .insert({ business_id: businessId, memory_type: memoryType, content, pinecone_id: pineconeId, importance_score: importanceScore })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as AiMemory;
  }

  async consolidateMemories(businessId: string) {
    const memories = await this.listMemories(businessId);
    const seenContent = new Set<string>();
    const duplicates: string[] = [];

    for (const memory of memories) {
      const key = memory.content.toLowerCase().trim();
      if (seenContent.has(key)) {
        duplicates.push(memory.id);
      } else {
        seenContent.add(key);
      }
    }

    for (const id of duplicates) {
      await this.deleteMemory(businessId, id);
    }

    this.logger.log(`Consolidated memories for ${businessId}: removed ${duplicates.length} duplicates`);
  }
}
