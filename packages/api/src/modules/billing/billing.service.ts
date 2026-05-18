import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { SupabaseProvider } from '../../providers/supabase.provider';
import Stripe from 'stripe';
import type { UserPlan } from '@ai-biz-os/shared';

const PLAN_PRICE_IDS: Record<string, string> = {
  starter: process.env['STRIPE_STARTER_PRICE_ID'] ?? '',
  pro: process.env['STRIPE_PRO_PRICE_ID'] ?? '',
  enterprise: process.env['STRIPE_ENTERPRISE_PRICE_ID'] ?? '',
};

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly stripe: Stripe;

  constructor(private readonly supabase: SupabaseProvider) {
    this.stripe = new Stripe(process.env['STRIPE_SECRET_KEY'] ?? '', {
      apiVersion: '2024-11-20.acacia',
    });
  }

  async getSubscription(userId: string) {
    const { data: user } = await this.supabase.getAdminClient()
      .from('users')
      .select('stripe_customer_id, plan, email, full_name')
      .eq('id', userId)
      .single();

    if (!user) throw new BadRequestException('User not found');

    if (!user.stripe_customer_id) {
      return { plan: user.plan, subscription: null, usage: await this.getUsage(userId) };
    }

    try {
      const subscriptions = await this.stripe.subscriptions.list({
        customer: user.stripe_customer_id,
        status: 'active',
        limit: 1,
      });

      return {
        plan: user.plan,
        subscription: subscriptions.data[0] ?? null,
        usage: await this.getUsage(userId),
      };
    } catch (err) {
      this.logger.error('Failed to fetch Stripe subscription', { err });
      return { plan: user.plan, subscription: null, usage: await this.getUsage(userId) };
    }
  }

  async createCheckoutSession(userId: string, plan: UserPlan, returnUrl: string): Promise<string> {
    if (plan === 'starter') throw new BadRequestException('Cannot checkout to starter plan');

    const priceId = PLAN_PRICE_IDS[plan];
    if (!priceId) throw new BadRequestException(`No price configured for plan: ${plan}`);

    const { data: user } = await this.supabase.getAdminClient()
      .from('users')
      .select('stripe_customer_id, email, full_name')
      .eq('id', userId)
      .single();

    if (!user) throw new BadRequestException('User not found');

    let customerId = user.stripe_customer_id;

    if (!customerId) {
      const customer = await this.stripe.customers.create({
        email: user.email,
        name: user.full_name ?? undefined,
        metadata: { userId },
      });
      customerId = customer.id;

      await this.supabase.getAdminClient()
        .from('users')
        .update({ stripe_customer_id: customerId })
        .eq('id', userId);
    }

    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${returnUrl}?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: `${returnUrl}?canceled=true`,
      metadata: { userId, plan },
    });

    if (!session.url) throw new BadRequestException('Failed to create checkout session');
    return session.url;
  }

  async createPortalSession(userId: string, returnUrl: string): Promise<string> {
    const { data: user } = await this.supabase.getAdminClient()
      .from('users')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single();

    if (!user?.stripe_customer_id) {
      throw new BadRequestException('No billing account found. Please subscribe first.');
    }

    const session = await this.stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: returnUrl,
    });

    return session.url;
  }

  async getUsage(userId: string) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: businesses } = await this.supabase.getAdminClient()
      .from('businesses')
      .select('id')
      .eq('user_id', userId);

    const businessIds = (businesses ?? []).map((b: { id: string }) => b.id);

    if (businessIds.length === 0) {
      return { aiCalls: 0, totalCostUsd: 0, tokensUsed: 0 };
    }

    const { data: logs } = await this.supabase.getAdminClient()
      .from('ai_cost_logs')
      .select('cost_usd, tokens_in, tokens_out')
      .in('business_id', businessIds)
      .gte('created_at', thirtyDaysAgo);

    const costLogs = logs ?? [];
    return {
      aiCalls: costLogs.length,
      totalCostUsd: Math.round(costLogs.reduce((s, l) => s + (l.cost_usd as number), 0) * 10000) / 10000,
      tokensUsed: costLogs.reduce((s, l) => s + ((l.tokens_in as number) + (l.tokens_out as number)), 0),
    };
  }

  async getPlans() {
    return [
      {
        id: 'starter',
        name: 'Starter',
        price: 0,
        interval: 'month',
        features: ['1 business', '500 AI actions/month', 'Basic reports', 'Email support'],
        actionLimit: 500,
      },
      {
        id: 'pro',
        name: 'Pro',
        price: 49,
        interval: 'month',
        features: ['5 businesses', '2,000 AI actions/month', 'Advanced analytics', 'Priority support', 'Custom prompts'],
        actionLimit: 2000,
      },
      {
        id: 'enterprise',
        name: 'Enterprise',
        price: null,
        interval: 'month',
        features: ['Unlimited businesses', 'Unlimited AI actions', 'Dedicated support', 'Custom integrations', 'SLA guarantee'],
        actionLimit: null,
      },
    ];
  }
}
