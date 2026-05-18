import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { SupabaseProvider } from '../providers/supabase.provider';
import { ReportService } from '../modules/reports/report.service';
import { toZonedTime, format } from 'date-fns-tz';

@Injectable()
export class DailyReportJob {
  private readonly logger = new Logger(DailyReportJob.name);

  constructor(
    @InjectQueue('daily-report') private readonly queue: Queue,
    private readonly supabase: SupabaseProvider,
    private readonly reportService: ReportService,
  ) {}

  @Cron('0 * * * *')
  async scheduleReports() {
    const now = new Date();
    const { data: businesses } = await this.supabase.getAdminClient()
      .from('businesses')
      .select('id, timezone');

    for (const biz of businesses ?? []) {
      try {
        const localTime = toZonedTime(now, biz.timezone ?? 'UTC');
        const hour = parseInt(format(localTime, 'H', { timeZone: biz.timezone ?? 'UTC' }));

        if (hour === 7) {
          await this.queue.add(
            'generate',
            { businessId: biz.id },
            {
              attempts: 3,
              backoff: { type: 'exponential', delay: 60000 },
              removeOnComplete: true,
            },
          );
        }
      } catch (err) {
        this.logger.error(`Failed to schedule report for business ${biz.id}`, { err });
      }
    }
  }

  async processReport(businessId: string) {
    try {
      const report = await this.reportService.generateReport(businessId);
      await this.reportService.sendReport(report.id, businessId);
      this.logger.log(`Report generated and sent for business ${businessId}`);
    } catch (err) {
      this.logger.error(`Report generation failed for business ${businessId}`, { err });
      throw err;
    }
  }
}
