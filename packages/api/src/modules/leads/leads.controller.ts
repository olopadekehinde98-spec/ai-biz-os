import { Controller, Get, Post, Put, Delete, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BusinessId } from '../../common/decorators/business-id.decorator';
import { LeadsService } from './leads.service';
import type { LeadStatus } from '@ai-biz-os/shared';

@ApiTags('leads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('leads')
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Get()
  list(@BusinessId() businessId: string, @Query('status') status?: LeadStatus) {
    return this.leads.listLeads(businessId, status);
  }

  @Get('stats')
  stats(@BusinessId() businessId: string) {
    return this.leads.getStats(businessId);
  }

  @Get(':id')
  get(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.leads.getLead(businessId, id);
  }

  @Post()
  create(
    @BusinessId() businessId: string,
    @Body() body: { name: string; email?: string; company?: string; source?: string; notes?: string },
  ) {
    return this.leads.createLead(businessId, body);
  }

  @Put(':id')
  update(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Body() body: Partial<{ name: string; email: string; company: string; source: string; status: LeadStatus; notes: string }>,
  ) {
    return this.leads.updateLead(businessId, id, body);
  }

  @Delete(':id')
  remove(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.leads.deleteLead(businessId, id);
  }

  @Post(':id/outreach')
  outreach(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.leads.generateOutreach(businessId, id);
  }
}
