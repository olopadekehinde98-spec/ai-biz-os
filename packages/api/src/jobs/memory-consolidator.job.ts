import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SupabaseProvider } from '../providers/supabase.provider';
import { MemoryService } from '../modules/memory/memory.service';

@Injectable()
export class MemoryConsolidatorJob {
  private readonly logger = new Logger(MemoryConsolidatorJob.name);

  constructor(
    private readonly supabase: SupabaseProvider,
    private readonly memory: MemoryService,
  ) {}

  @Cron('0 2 * * 0')
  async consolidateAllBusinessMemories() {
    const { data: businesses } = await this.supabase.getAdminClient()
      .from('businesses')
      .select('id');

    for (const biz of businesses ?? []) {
      try {
        await this.memory.consolidateMemories(biz.id);
      } catch (err) {
        this.logger.error(`Memory consolidation failed for business ${biz.id}`, { err });
      }
    }
  }
}
