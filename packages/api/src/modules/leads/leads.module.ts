import { Module } from '@nestjs/common';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { MemoryModule } from '../memory/memory.module';
import { SupabaseProvider } from '../../providers/supabase.provider';
import { AnthropicProvider } from '../../providers/anthropic.provider';
import { OpenAIProvider } from '../../providers/openai.provider';
import { PineconeProvider } from '../../providers/pinecone.provider';

@Module({
  imports: [MemoryModule],
  controllers: [LeadsController],
  providers: [LeadsService, SupabaseProvider, AnthropicProvider, OpenAIProvider, PineconeProvider],
  exports: [LeadsService],
})
export class LeadsModule {}
