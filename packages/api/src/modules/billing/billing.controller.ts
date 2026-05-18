import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { BillingService } from './billing.service';
import type { UserPlan } from '@ai-biz-os/shared';

@ApiTags('billing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('plans')
  plans() {
    return this.billing.getPlans();
  }

  @Get('subscription')
  subscription(@CurrentUser() user: { id: string }) {
    return this.billing.getSubscription(user.id);
  }

  @Get('usage')
  usage(@CurrentUser() user: { id: string }) {
    return this.billing.getUsage(user.id);
  }

  @Post('checkout')
  checkout(
    @CurrentUser() user: { id: string },
    @Body() body: { plan: UserPlan; return_url: string },
  ) {
    return this.billing.createCheckoutSession(user.id, body.plan, body.return_url)
      .then(url => ({ url }));
  }

  @Post('portal')
  portal(
    @CurrentUser() user: { id: string },
    @Body() body: { return_url: string },
  ) {
    return this.billing.createPortalSession(user.id, body.return_url)
      .then(url => ({ url }));
  }
}
