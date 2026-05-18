'use client';

import Link from 'next/link';
import { Check, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 0,
    description: 'Perfect for solo founders just getting started',
    badge: null,
    cta: 'Start free',
    href: '/signup',
    features: [
      '1 business',
      'Up to 100 leads',
      'Up to 50 support tickets/mo',
      '10 AI-generated posts/mo',
      'Basic analytics',
      'Email support',
    ],
    limits: ['No team members', 'No API access', 'Watermarked reports'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 49,
    description: 'For growing businesses that need more power',
    badge: 'Most popular',
    cta: 'Start 14-day trial',
    href: '/signup?plan=pro',
    features: [
      '3 businesses',
      'Unlimited leads',
      'Unlimited support tickets',
      '100 AI-generated posts/mo',
      'Advanced analytics & insights',
      'Up to 5 team members',
      'Daily CEO briefings',
      'Priority support',
    ],
    limits: [],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 199,
    description: 'For agencies and large teams',
    badge: null,
    cta: 'Contact sales',
    href: 'mailto:sales@aibizos.com',
    features: [
      'Unlimited businesses',
      'Unlimited everything',
      'Unlimited team members',
      'Custom AI prompts',
      'White-label reports',
      'API access',
      'Dedicated account manager',
      'Custom integrations',
      'SLA guarantee',
    ],
    limits: [],
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-white">AI BizOS</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm text-slate-300 hover:text-white transition-colors">
            Sign in
          </Link>
          <Link href="/signup">
            <Button size="sm">Get started free</Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <div className="text-center pt-16 pb-12 px-4">
        <h1 className="text-4xl font-bold text-white mb-4">
          Simple, transparent pricing
        </h1>
        <p className="text-lg text-slate-400 max-w-xl mx-auto">
          Start free, upgrade when you're ready. No hidden fees, cancel anytime.
        </p>
      </div>

      {/* Plans */}
      <div className="max-w-5xl mx-auto px-4 pb-20">
        <div className="grid md:grid-cols-3 gap-6">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={cn(
                'relative rounded-2xl border p-6 flex flex-col',
                plan.badge
                  ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10'
                  : 'border-white/10 bg-white/5',
              )}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-white px-3 py-1 text-xs font-semibold">
                    {plan.badge}
                  </Badge>
                </div>
              )}

              <div className="mb-6">
                <h2 className="text-lg font-bold text-white">{plan.name}</h2>
                <p className="text-sm text-slate-400 mt-1">{plan.description}</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-white">
                    {plan.price === 0 ? 'Free' : `$${plan.price}`}
                  </span>
                  {plan.price > 0 && (
                    <span className="text-slate-400 text-sm">/month</span>
                  )}
                </div>
              </div>

              <Link href={plan.href} className="mb-6">
                <Button
                  className="w-full"
                  variant={plan.badge ? 'default' : 'outline'}
                >
                  {plan.cta}
                </Button>
              </Link>

              <div className="flex-1 space-y-2.5">
                {plan.features.map((f) => (
                  <div key={f} className="flex items-start gap-2.5">
                    <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span className="text-sm text-slate-300">{f}</span>
                  </div>
                ))}
                {plan.limits.map((l) => (
                  <div key={l} className="flex items-start gap-2.5 opacity-50">
                    <span className="h-4 w-4 shrink-0 mt-0.5 text-center text-xs">✕</span>
                    <span className="text-sm text-slate-400">{l}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <div className="mt-16 text-center">
          <p className="text-slate-400 text-sm">
            Questions?{' '}
            <a href="mailto:hello@aibizos.com" className="text-primary hover:underline">
              Contact us
            </a>
            {' '}· All plans include a 14-day money-back guarantee.
          </p>
        </div>
      </div>
    </div>
  );
}
