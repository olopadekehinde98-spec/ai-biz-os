import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { SupabaseProvider } from '../../providers/supabase.provider';
import { SupportService } from '../support/support.service';
import { LeadsService } from '../leads/leads.service';
import * as crypto from 'crypto';

interface WebhookEvent {
  type: string;
  payload: Record<string, unknown>;
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly supabase: SupabaseProvider,
    private readonly support: SupportService,
    private readonly leads: LeadsService,
  ) {}

  async handleStripeWebhook(rawBody: Buffer, signature: string): Promise<void> {
    const secret = process.env['STRIPE_WEBHOOK_SECRET'] ?? '';
    const computed = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    const sig = signature.split(',').find(s => s.startsWith('v1='))?.slice(3) ?? '';
    if (!crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(sig))) {
      throw new BadRequestException('Invalid Stripe signature');
    }

    const event = JSON.parse(rawBody.toString()) as WebhookEvent;
    await this.processStripeEvent(event);
  }

  async handleSocialWebhook(platform: string, body: Record<string, unknown>): Promise<void> {
    this.logger.log(`Received ${platform} webhook`, { body });

    switch (platform) {
      case 'instagram':
      case 'facebook':
        await this.handleSocialMessage(platform, body);
        break;
      default:
        this.logger.warn(`Unhandled platform webhook: ${platform}`);
    }
  }

  async handleFormWebhook(businessId: string, formData: Record<string, unknown>): Promise<void> {
    const name = String(formData['name'] ?? formData['full_name'] ?? 'Unknown');
    const email = formData['email'] ? String(formData['email']) : undefined;
    const message = formData['message'] ? String(formData['message']) : undefined;
    const source = formData['source'] ? String(formData['source']) : 'website_form';

    if (message) {
      await this.support.createTicket(businessId, {
        customer_name: name,
        customer_email: email ?? '',
        platform: 'website',
        message,
      });
    } else {
      await this.leads.createLead(businessId, {
        name,
        email,
        source,
        notes: Object.entries(formData)
          .filter(([k]) => !['name', 'full_name', 'email', 'source'].includes(k))
          .map(([k, v]) => `${k}: ${v}`)
          .join(', '),
      });
    }
  }

  private async processStripeEvent(event: WebhookEvent): Promise<void> {
    const data = event.payload?.['object'] as Record<string, unknown> | undefined;

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const customerId = String(data?.['customer'] ?? '');
        const status = String(data?.['status'] ?? '');
        const planId = String((data?.['items'] as Record<string, unknown>)?.['data']?.[0]?.['price']?.['lookup_key'] ?? '');

        if (customerId && status === 'active') {
          await this.supabase.getAdminClient()
            .from('users')
            .update({ plan: planId || 'pro' })
            .eq('stripe_customer_id', customerId);
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const customerId = String(data?.['customer'] ?? '');
        if (customerId) {
          await this.supabase.getAdminClient()
            .from('users')
            .update({ plan: 'starter' })
            .eq('stripe_customer_id', customerId);
        }
        break;
      }
      default:
        this.logger.log(`Unhandled Stripe event: ${event.type}`);
    }
  }

  private async handleSocialMessage(platform: string, body: Record<string, unknown>): Promise<void> {
    const entry = (body['entry'] as Record<string, unknown>[])?.[0];
    const messaging = (entry?.['messaging'] as Record<string, unknown>[])?.[0];
    if (!messaging) return;

    const sender = String((messaging['sender'] as Record<string, unknown>)?.['id'] ?? 'unknown');
    const messageText = String((messaging['message'] as Record<string, unknown>)?.['text'] ?? '');
    if (!messageText) return;

    const { data: account } = await this.supabase.getAdminClient()
      .from('connected_accounts')
      .select('business_id')
      .eq('platform', platform)
      .eq('is_active', true)
      .limit(1)
      .single();

    if (account?.business_id) {
      await this.support.createTicket(account.business_id, {
        customer_name: `${platform} user ${sender}`,
        customer_email: '',
        platform,
        message: messageText,
      });
    }
  }
}
