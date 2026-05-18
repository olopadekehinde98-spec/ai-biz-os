import { Module } from '@nestjs/common';
import { MemoryService } from './memory.service';
import { MemoryController } from './memory.controller';
import { SupabaseProvider } from '../../providers/supabase.provider';
import { PineconeProvider } from '../../providers/pinecone.provider';
import { AnthropicProvider } from '../../providers/anthropic.provider';
import { OpenAIProvider } from '../../providers/openai.provider';

@Module({
  controllers: [MemoryController],
  providers: [MemoryService, SupabaseProvider, PineconeProvider, AnthropicProvider, OpenAIProvider],
  exports: [MemoryService],
})
export class MemoryModule {}
