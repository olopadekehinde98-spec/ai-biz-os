import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BusinessId } from '../../common/decorators/business-id.decorator';
import { AnalyticsService } from './analytics.service';

@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('overview')
  overview(@BusinessId() businessId: string, @Query('days') days?: string) {
    return this.analytics.getOverview(businessId, days ? parseInt(days) : 30);
  }

  @Get('lead-funnel')
  leadFunnel(@BusinessId() businessId: string) {
    return this.analytics.getLeadFunnel(businessId);
  }

  @Get('ai-usage')
  aiUsage(@BusinessId() businessId: string, @Query('days') days?: string) {
    return this.analytics.getAiUsage(businessId, days ? parseInt(days) : 30);
  }

  @Get('audit-log')
  auditLog(@BusinessId() businessId: string, @Query('limit') limit?: string) {
    return this.analytics.getAuditLog(businessId, limit ? parseInt(limit) : 50);
  }

  @Post('insights')
  insights(@BusinessId() businessId: string) {
    return this.analytics.generateInsights(businessId).then(text => ({ insights: text }));
  }
}
