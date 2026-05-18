import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BusinessId } from '../../common/decorators/business-id.decorator';
import { SupportService } from './support.service';
import type { TicketStatus } from '@ai-biz-os/shared';

@ApiTags('support')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('support')
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Get('tickets')
  list(@BusinessId() businessId: string, @Query('status') status?: TicketStatus) {
    return this.support.listTickets(businessId, status);
  }

  @Get('tickets/stats')
  stats(@BusinessId() businessId: string) {
    return this.support.getStats(businessId);
  }

  @Get('tickets/:id')
  get(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.support.getTicket(businessId, id);
  }

  @Post('tickets')
  create(
    @BusinessId() businessId: string,
    @Body() body: { customer_name: string; customer_email: string; platform: string; message: string },
  ) {
    return this.support.createTicket(businessId, body);
  }

  @Patch('tickets/:id/status')
  updateStatus(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Body() body: { status: TicketStatus },
  ) {
    return this.support.updateTicketStatus(businessId, id, body.status);
  }

  @Post('tickets/:id/escalate')
  escalate(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.support.escalateTicket(businessId, id);
  }

  @Post('tickets/:id/regenerate')
  regenerate(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.support.getTicket(businessId, id).then(ticket =>
      this.support.generateAiResponse(businessId, ticket),
    );
  }
}
