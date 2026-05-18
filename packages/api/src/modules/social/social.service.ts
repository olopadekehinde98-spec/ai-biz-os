import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { SupabaseProvider } from '../../providers/supabase.provider';
import { AnthropicProvider } from '../../providers/anthropic.provider';
import { MemoryService } from '../memory/memory.service';
import type { ContentPost, PostStatus } from '@ai-biz-os/shared';

@Injectable()
export class SocialService {
  private readonly logger = new Logger(SocialService.name);

  constructor(
    private readonly supabase: SupabaseProvider,
    private readonly anthropic: AnthropicProvider,
    private readonly memory: MemoryService,
  ) {}

  async listPosts(businessId: string, status?: PostStatus): Promise<ContentPost[]> {
    let query = this.supabase.getAdminClient()
      .from('content_posts')
      .select('*')
      .eq('business_id', businessId)
      .order('scheduled_at', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw new BadRequestException(error.message);
    return (data ?? []) as ContentPost[];
  }

  async getPost(businessId: string, postId: string): Promise<ContentPost> {
    const { data, error } = await this.supabase.getAdminClient()
      .from('content_posts')
      .select('*')
      .eq('id', postId)
      .eq('business_id', businessId)
      .single();
    if (error || !data) throw new BadRequestException('Post not found');
    return data as ContentPost;
  }

  async createPost(businessId: string, payload: {
    platform: string;
    content: string;
    media_urls?: string[];
    scheduled_at?: string;
    ai_generated?: boolean;
  }): Promise<ContentPost> {
    const status: PostStatus = payload.scheduled_at ? 'scheduled' : 'draft';

    const { data, error } = await this.supabase.getAdminClient()
      .from('content_posts')
      .insert({
        business_id: businessId,
        platform: payload.platform,
        content: payload.content,
        media_urls: payload.media_urls ?? [],
        scheduled_at: payload.scheduled_at ?? null,
        status,
        ai_generated: payload.ai_generated ?? false,
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data as ContentPost;
  }

  async updatePost(businessId: string, postId: string, payload: Partial<{
    content: string;
    scheduled_at: string;
    status: PostStatus;
    media_urls: string[];
  }>): Promise<ContentPost> {
    const { data, error } = await this.supabase.getAdminClient()
      .from('content_posts')
      .update(payload)
      .eq('id', postId)
      .eq('business_id', businessId)
      .select()
      .single();

    if (error || !data) throw new BadRequestException(error?.message ?? 'Post not found');
    return data as ContentPost;
  }

  async deletePost(businessId: string, postId: string): Promise<void> {
    const { error } = await this.supabase.getAdminClient()
      .from('content_posts')
      .delete()
      .eq('id', postId)
      .eq('business_id', businessId);

    if (error) throw new BadRequestException(error.message);
  }

  async generateContent(businessId: string, payload: {
    platform: string;
    topic: string;
    tone?: string;
    schedule_at?: string;
  }): Promise<ContentPost> {
    const memories = await this.memory.retrieveRelevant(
      businessId,
      `social media content for ${payload.platform} about ${payload.topic}`,
      5,
    );
    const memoriesText = await this.memory.formatMemoriesForPrompt(memories);

    const { data: business } = await this.supabase.getAdminClient()
      .from('businesses')
      .select('name, industry')
      .eq('id', businessId)
      .single();

    const systemPrompt = `You are a social media expert for ${business?.name ?? 'this business'} (${business?.industry ?? 'general'}). Use this business context:\n${memoriesText}\n\nGenerate engaging, platform-appropriate content. Return JSON: {"content": "post text", "hashtags": ["tag1"]}`;

    const userMessage = `Create a ${payload.platform} post about: ${payload.topic}. Tone: ${payload.tone ?? 'professional'}. Include relevant hashtags.`;

    let content: string;
    try {
      const raw = await this.anthropic.complete({
        systemPrompt,
        userMessage,
        businessId,
        feature: 'social_content',
        maxTokens: 512,
      });
      const parsed = JSON.parse(raw) as { content: string; hashtags: string[] };
      const tags = (parsed.hashtags ?? []).map((t: string) => `#${t.replace(/^#/, '')}`).join(' ');
      content = `${parsed.content}\n\n${tags}`.trim();
    } catch {
      content = `${payload.topic} — stay tuned for more updates! #business`;
    }

    return this.createPost(businessId, {
      platform: payload.platform,
      content,
      scheduled_at: payload.schedule_at,
      ai_generated: true,
    });
  }

  async getConnectedAccounts(businessId: string) {
    const { data } = await this.supabase.getAdminClient()
      .from('connected_accounts')
      .select('id, platform, account_name, is_active, expires_at')
      .eq('business_id', businessId);
    return data ?? [];
  }
}
