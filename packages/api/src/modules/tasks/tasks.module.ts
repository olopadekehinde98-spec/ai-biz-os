import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { MemoryModule } from '../memory/memory.module';
import { SupabaseProvider } from '../../providers/supabase.provider';
import { AnthropicProvider } from '../../providers/anthropic.provider';
import { OpenAIProvider } from '../../providers/openai.provider';
import { PineconeProvider } from '../../providers/pinecone.provider';

@Module({
  imports: [MemoryModule],
  controllers: [TasksController],
  providers: [TasksService, SupabaseProvider, AnthropicProvider, OpenAIProvider, PineconeProvider],
  exports: [TasksService],
})
export class TasksModule {}
