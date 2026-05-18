import { Module } from '@nestjs/common';
import { SocialController } from './social.controller';
import { SocialService } from './social.service';
import { MemoryModule } from '../memory/memory.module';
import { SupabaseProvider } from '../../providers/supabase.provider';
import { AnthropicProvider } from '../../providers/anthropic.provider';
import { OpenAIProvider } from '../../providers/openai.provider';
import { PineconeProvider } from '../../providers/pinecone.provider';

@Module({
  imports: [MemoryModule],
  controllers: [SocialController],
  providers: [SocialService, SupabaseProvider, AnthropicProvider, OpenAIProvider, PineconeProvider],
  exports: [SocialService],
})
export class SocialModule {}
