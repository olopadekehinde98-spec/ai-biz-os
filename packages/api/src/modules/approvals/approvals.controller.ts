import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BusinessId } from '../../common/decorators/business-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApprovalsService } from './approvals.service';
import type { ActionStatus } from '@ai-biz-os/shared';

@ApiTags('approvals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('approvals')
export class ApprovalsController {
  constructor(private readonly approvals: ApprovalsService) {}

  @Get()
  list(@BusinessId() businessId: string, @Query('status') status?: ActionStatus) {
    return this.approvals.listActions(businessId, status);
  }

  @Get('pending/count')
  pendingCount(@BusinessId() businessId: string) {
    return this.approvals.getPendingCount(businessId).then(count => ({ count }));
  }

  @Get(':id')
  get(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.approvals.getAction(businessId, id);
  }

  @Post(':id/approve')
  approve(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.approvals.approveAction(businessId, id, user.id);
  }

  @Post(':id/reject')
  reject(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.approvals.rejectAction(businessId, id, user.id);
  }
}
