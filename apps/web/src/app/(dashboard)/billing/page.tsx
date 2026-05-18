'use client';

import { useEffect, useState, useCallback } from 'react';
import { CreditCard, Zap, CheckCircle, ArrowUpRight, Users, HeadphonesIcon, CheckSquare } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { createClient } from '@/lib/supabase/client';
import { useBusinessStore } from '@/store/business';

type PlanId = 'starter' | 'pro' | 'enterprise';

interface Plan {
  id: PlanId;
  name: string;
  price: number | null;
  priceLabel: string;
  features: string[];
}

const PLANS: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: 0,
    priceLabel: 'Free',
    features: [
      '1 business',
      '500 AI actions / month',
      'Basic reports',
      'Email support',
      'Lead & ticket tracking',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 49,
    priceLabel: '$49/mo',
    features: [
      '5 businesses',
      '2,000 AI actions / month',
      'Advanced analytics',
      'Priority support',
      'Custom prompts',
      'Content scheduling',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 199,
    priceLabel: '$199/mo',
    features: [
      'Unlimited businesses',
      'Unlimited AI actions',
      'Dedicated support',
      'Custom integrations',
      'SLA guarantee',
      'Onboarding session',
    ],
  },
];

interface UsageStats {
  leads: number;
  tickets: number;
  tasks: number;
}

export default function BillingPage() {
  const { activeBusiness } = useBusinessStore();
  const businessId = activeBusiness?.id;
  const [currentPlan, setCurrentPlan] = useState<PlanId>('starter');
  const [usage, setUsage] = useState<UsageStats>({ leads: 0, tickets: 0, tasks: 0 });
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    setLoading(true);

    try {
      // Get current user's plan
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: userRow } = await supabase
          .from('users')
          .select('plan')
          .eq('id', user.id)
          .single();
        if (userRow?.plan) setCurrentPlan(userRow.plan as PlanId);
      }

      // Get usage counts for the active business
      if (businessId) {
        const [
          { count: leadsCount },
          { count: ticketsCount },
          { count: tasksCount },
        ] = await Promise.all([
          supabase.from('leads').select('*', { count: 'exact', head: true }).eq('business_id', businessId),
          supabase.from('support_tickets').select('*', { count: 'exact', head: true }).eq('business_id', businessId),
          supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('business_id', businessId),
        ]);

        setUsage({
          leads: leadsCount ?? 0,
          tickets: ticketsCount ?? 0,
          tasks: tasksCount ?? 0,
        });
      }
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    load();
  }, [load]);

  function handleUpgrade(planId: PlanId) {
    toast.info('Stripe payments coming soon — contact us to upgrade', {
      description: 'Email us at hello@ai-biz-os.com to get set up on a paid plan.',
      duration: 5000,
    });
  }

  return (
    <div>
      <Header
        title="Billing"
        description="Manage your plan and usage"
      />

      <div className="p-6 space-y-6">
        {/* Current plan card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Current Plan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Zap className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold capitalize">{currentPlan}</p>
                      <p className="text-xs text-muted-foreground">
                        {currentPlan === 'starter' ? 'Free forever' : 'Billed monthly'}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={
                      currentPlan === 'pro'
                        ? 'default'
                        : currentPlan === 'enterprise'
                        ? 'info'
                        : 'secondary'
                    }
                    className="capitalize"
                  >
                    {currentPlan}
                  </Badge>
                </div>

                <Separator />

                {/* Usage stats */}
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <Users className="h-4 w-4 text-blue-500" />
                    </div>
                    <p className="text-2xl font-bold">{usage.leads}</p>
                    <p className="text-xs text-muted-foreground">Leads</p>
                  </div>
                  <div>
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <HeadphonesIcon className="h-4 w-4 text-orange-500" />
                    </div>
                    <p className="text-2xl font-bold">{usage.tickets}</p>
                    <p className="text-xs text-muted-foreground">Tickets</p>
                  </div>
                  <div>
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <CheckSquare className="h-4 w-4 text-green-500" />
                    </div>
                    <p className="text-2xl font-bold">{usage.tasks}</p>
                    <p className="text-xs text-muted-foreground">Tasks</p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Plan cards */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Plans</h3>
            <Link href="/pricing" className="text-xs text-primary hover:underline flex items-center gap-1">
              View pricing page <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {PLANS.map((plan) => {
              const isCurrent = plan.id === currentPlan;
              const isPro = plan.id === 'pro';

              return (
                <Card
                  key={plan.id}
                  className={`relative ${isPro ? 'border-primary ring-1 ring-primary' : ''}`}
                >
                  {isPro && (
                    <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                      <Badge className="text-[10px] px-2">Most Popular</Badge>
                    </div>
                  )}
                  <CardHeader className="pb-3">
                    <CardTitle className="capitalize">{plan.name}</CardTitle>
                    <CardDescription>
                      {plan.price === null ? (
                        <span className="text-xl font-bold text-foreground">Custom</span>
                      ) : plan.price === 0 ? (
                        <span className="text-xl font-bold text-foreground">Free</span>
                      ) : (
                        <span className="text-xl font-bold text-foreground">
                          ${plan.price}
                          <span className="text-sm font-normal text-muted-foreground">/mo</span>
                        </span>
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ul className="space-y-2">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-center gap-2 text-sm">
                          <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    {isCurrent ? (
                      <Button variant="outline" className="w-full" disabled>
                        Current plan
                      </Button>
                    ) : plan.id === 'enterprise' ? (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => handleUpgrade(plan.id)}
                      >
                        Contact sales <ArrowUpRight className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        className="w-full"
                        variant={isPro ? 'default' : 'outline'}
                        onClick={() => handleUpgrade(plan.id)}
                      >
                        Upgrade to {plan.name}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Need a custom plan?{' '}
          <a href="mailto:hello@ai-biz-os.com" className="text-primary hover:underline">
            Contact us
          </a>
          .
        </p>
      </div>
    </div>
  );
}
