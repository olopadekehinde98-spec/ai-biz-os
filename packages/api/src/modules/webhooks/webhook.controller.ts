import { Controller, Post, Body, Param, Headers, RawBodyRequest, Req, HttpCode } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { WebhookService } from './webhook.service';

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhookController {
  constructor(private readonly webhooks: WebhookService) {}

  @Post('stripe')
  @HttpCode(200)
  stripe(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    return this.webhooks.handleStripeWebhook(req.rawBody ?? Buffer.from(''), signature);
  }

  @Post('social/:platform')
  @HttpCode(200)
  social(@Param('platform') platform: string, @Body() body: Record<string, unknown>) {
    return this.webhooks.handleSocialWebhook(platform, body);
  }

  @Post('form/:businessId')
  @HttpCode(200)
  form(@Param('businessId') businessId: string, @Body() body: Record<string, unknown>) {
    return this.webhooks.handleFormWebhook(businessId, body);
  }
}
