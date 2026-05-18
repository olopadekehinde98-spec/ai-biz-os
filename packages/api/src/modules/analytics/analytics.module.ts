import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { MemoryModule } from '../memory/memory.module';
import { SupabaseProvider } from '../../providers/supabase.provider';
import { AnthropicProvider } from '../../providers/anthropic.provider';
import { OpenAIProvider } from '../../providers/openai.provider';
import { PineconeProvider } from '../../providers/pinecone.provider';

@Module({
  imports: [MemoryModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, SupabaseProvider, AnthropicProvider, OpenAIProvider, PineconeProvider],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
