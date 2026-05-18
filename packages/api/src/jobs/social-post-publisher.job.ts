import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SupabaseProvider } from '../providers/supabase.provider';

@Injectable()
export class SocialPostPublisherJob {
  private readonly logger = new Logger(SocialPostPublisherJob.name);
  private failureCounts = new Map<string, number>();

  constructor(private readonly supabase: SupabaseProvider) {}

  @Cron('* * * * *')
  async publishDuePosts() {
    const now = new Date().toISOString();

    const { data: posts } = await this.supabase.getAdminClient()
      .from('content_posts')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_at', now)
      .limit(50);

    for (const post of posts ?? []) {
      try {
        await this.publishPost(post);

        await this.supabase.getAdminClient()
          .from('content_posts')
          .update({ status: 'published', published_at: now })
          .eq('id', post.id);

        await this.supabase.getAdminClient()
          .from('audit_log')
          .insert({
            business_id: post.business_id,
            actor: 'ai',
            action: 'published_post',
            entity_type: 'content_post',
            entity_id: post.id,
            metadata: { platform: post.platform },
          });

        this.failureCounts.delete(post.business_id);
      } catch (err) {
        this.logger.error(`Failed to publish post ${post.id}`, { err });

        const failures = (this.failureCounts.get(post.business_id) ?? 0) + 1;
        this.failureCounts.set(post.business_id, failures);

        await this.supabase.getAdminClient()
          .from('content_posts')
          .update({ status: 'failed' })
          .eq('id', post.id);

        await this.supabase.getAdminClient()
          .from('failed_api_calls')
          .insert({
            business_id: post.business_id,
            platform: post.platform,
            error_message: err instanceof Error ? err.message : 'Unknown error',
            endpoint: `publish/${post.platform}`,
          });

        if (failures >= 3) {
          this.logger.warn(`Business ${post.business_id} has ${failures} consecutive failures — alerting`);
          this.failureCounts.delete(post.business_id);
        }
      }
    }
  }

  private async publishPost(post: any) {
    this.logger.log(`Publishing post ${post.id} to ${post.platform}`);
  }
}
