import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './modules/auth/auth.module';
import { BusinessModule } from './modules/business/business.module';
import { MemoryModule } from './modules/memory/memory.module';
import { ReportModule } from './modules/reports/report.module';
import { SocialModule } from './modules/social/social.module';
import { SupportModule } from './modules/support/support.module';
import { LeadsModule } from './modules/leads/leads.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { ApprovalsModule } from './modules/approvals/approvals.module';
import { WebhookModule } from './modules/webhooks/webhook.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { BillingModule } from './modules/billing/billing.module';
import { AdminModule } from './modules/admin/admin.module';
import { JobsModule } from './jobs/jobs.module';
import { HealthController } from './health.controller';
import { SupabaseProvider } from './providers/supabase.provider';
import { PineconeProvider } from './providers/pinecone.provider';
import { AnthropicProvider } from './providers/anthropic.provider';
import { OpenAIProvider } from './providers/openai.provider';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,
        limit: 100,
      },
    ]),
    BullModule.forRoot({
      redis: {
        host: new URL(process.env['REDIS_URL'] ?? 'redis://localhost:6379').hostname,
        port: parseInt(new URL(process.env['REDIS_URL'] ?? 'redis://localhost:6379').port || '6379'),
      },
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    BusinessModule,
    MemoryModule,
    ReportModule,
    SocialModule,
    SupportModule,
    LeadsModule,
    TasksModule,
    ApprovalsModule,
    WebhookModule,
    NotificationsModule,
    AnalyticsModule,
    BillingModule,
    AdminModule,
    JobsModule,
  ],
  controllers: [HealthController],
  providers: [SupabaseProvider, PineconeProvider, AnthropicProvider, OpenAIProvider],
  exports: [SupabaseProvider, PineconeProvider, AnthropicProvider, OpenAIProvider],
})
export class AppModule {}
