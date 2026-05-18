import { Module } from '@nestjs/common';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';
import { MemoryModule } from '../memory/memory.module';
import { SupabaseProvider } from '../../providers/supabase.provider';
import { AnthropicProvider } from '../../providers/anthropic.provider';
import { OpenAIProvider } from '../../providers/openai.provider';
import { PineconeProvider } from '../../providers/pinecone.provider';

@Module({
  imports: [MemoryModule],
  controllers: [SupportController],
  providers: [SupportService, SupabaseProvider, AnthropicProvider, OpenAIProvider, PineconeProvider],
  exports: [SupportService],
})
export class SupportModule {}
