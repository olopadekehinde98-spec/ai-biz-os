import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { DailyReportJob } from './daily-report.job';
import { SocialPostPublisherJob } from './social-post-publisher.job';
import { TokenRefresherJob } from './token-refresher.job';
import { LeadFollowupJob } from './lead-followup.job';
import { MemoryConsolidatorJob } from './memory-consolidator.job';
import { ReportModule } from '../modules/reports/report.module';
import { MemoryModule } from '../modules/memory/memory.module';
import { SupabaseProvider } from '../providers/supabase.provider';
import { AnthropicProvider } from '../providers/anthropic.provider';
import { OpenAIProvider } from '../providers/openai.provider';
import { PineconeProvider } from '../providers/pinecone.provider';

const QUEUES = [
  'daily-report',
  'social-post-publisher',
  'token-refresher',
  'lead-followup',
  'memory-consolidator',
];

@Module({
  imports: [
    ...QUEUES.map(name => BullModule.registerQueue({ name })),
    ReportModule,
    MemoryModule,
  ],
  providers: [
    DailyReportJob,
    SocialPostPublisherJob,
    TokenRefresherJob,
    LeadFollowupJob,
    MemoryConsolidatorJob,
    SupabaseProvider,
    AnthropicProvider,
    OpenAIProvider,
    PineconeProvider,
  ],
})
export class JobsModule {}
