import { Module } from '@nestjs/common';
import { BusinessController } from './business.controller';
import { BusinessService } from './business.service';
import { SupabaseProvider } from '../../providers/supabase.provider';
import { MemoryModule } from '../memory/memory.module';
import { PineconeProvider } from '../../providers/pinecone.provider';
import { AnthropicProvider } from '../../providers/anthropic.provider';
import { OpenAIProvider } from '../../providers/openai.provider';

@Module({
  imports: [MemoryModule],
  controllers: [BusinessController],
  providers: [BusinessService, SupabaseProvider, PineconeProvider, AnthropicProvider, OpenAIProvider],
  exports: [BusinessService],
})
export class BusinessModule {}
