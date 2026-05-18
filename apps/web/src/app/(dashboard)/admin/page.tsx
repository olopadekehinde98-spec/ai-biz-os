'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Users, Building2, DollarSign, Activity,
  ShieldCheck, TrendingUp, AlertTriangle, Cpu,
} from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/client';
import { formatDate } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────
interface AdminUser {
  id: string;
  email: string;
  full_name: string | null;
  plan: string;
  created_at: string;
  stripe_customer_id: string | null;
}

interface BusinessRow {
  id: string;
  name: string;
  industry: string | null;
  created_at: string;
  user_id: string;
}

interface CostRow {
  provider: string;
  model: string;
  feature: string;
  cost_usd: number;
  created_at: string;
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color = 'text-primary' }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={`rounded-lg p-2 bg-muted ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Plan badge ───────────────────────────────────────────────────────────────
function PlanBadge({ plan }: { plan: string }) {
  const v = plan === 'enterprise' ? 'info' : plan === 'pro' ? 'success' : 'secondary';
  return <Badge variant={v as any} className="capitalize">{plan}</Badge>;
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [tab, setTab] = useState<'overview' | 'users' | 'businesses' | 'costs'>('overview');

  // Fetch directly from Supabase (admin sees all via service role — here we use anon but RLS filters)
  const supabase = createClient();

  const { data: users = [] } = useQuery<AdminUser[]>({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: businesses = [] } = useQuery<BusinessRow[]>({
    queryKey: ['admin-businesses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('businesses')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: costs = [] } = useQuery<CostRow[]>({
    queryKey: ['admin-costs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_cost_logs')
        .select('provider, model, feature, cost_usd, created_at')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const totalCost = costs.reduce((s, r) => s + Number(r.cost_usd), 0);
  const planCounts = users.reduce((acc, u) => {
    acc[u.plan] = (acc[u.plan] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const TABS = ['overview', 'users', 'businesses', 'costs'] as const;

  return (
    <div>
      <Header
        title="Admin Panel"
        description="Platform-wide overview — only visible to admins"
        icon={<ShieldCheck className="h-5 w-5 text-primary" />}
      />

      <div className="p-6 space-y-6">
        {/* Tab bar */}
        <div className="flex gap-1 border-b">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${
                tab === t
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* OVERVIEW */}
        {tab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={Users} label="Total Users" value={users.length} sub={`${planCounts['starter'] ?? 0} starter · ${planCounts['pro'] ?? 0} pro · ${planCounts['enterprise'] ?? 0} enterprise`} />
              <StatCard icon={Building2} label="Businesses" value={businesses.length} color="text-blue-500" />
              <StatCard icon={DollarSign} label="AI Cost (last 100)" value={`$${totalCost.toFixed(4)}`} color="text-green-500" />
              <StatCard icon={Activity} label="AI Calls (last 100)" value={costs.length} color="text-orange-500" />
            </div>

            {/* Plan breakdown */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" /> Plan Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(['starter', 'pro', 'enterprise'] as const).map(plan => {
                    const count = planCounts[plan] ?? 0;
                    const pct = users.length ? Math.round((count / users.length) * 100) : 0;
                    return (
                      <div key={plan} className="flex items-center gap-3">
                        <span className="text-sm capitalize w-20">{plan}</span>
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-sm text-muted-foreground w-16 text-right">
                          {count} ({pct}%)
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Recent signups */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Recent Signups</CardTitle>
                <CardDescription>Last 5 users who joined</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="divide-y">
                  {users.slice(0, 5).map(u => (
                    <div key={u.id} className="flex items-center justify-between py-2.5">
                      <div>
                        <p className="text-sm font-medium">{u.full_name ?? '—'}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <PlanBadge plan={u.plan} />
                        <span className="text-xs text-muted-foreground">{formatDate(u.created_at)}</span>
                      </div>
                    </div>
                  ))}
                  {users.length === 0 && (
                    <p className="text-sm text-muted-foreground py-4 text-center">No users yet</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* USERS */}
        {tab === 'users' && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">All Users ({users.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Name</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Email</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Plan</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Stripe</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Joined</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {users.map(u => (
                      <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium">{u.full_name ?? '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                        <td className="px-4 py-3"><PlanBadge plan={u.plan} /></td>
                        <td className="px-4 py-3">
                          {u.stripe_customer_id
                            ? <Badge variant="outline" className="font-mono text-[10px]">{u.stripe_customer_id.slice(0, 14)}…</Badge>
                            : <span className="text-muted-foreground">—</span>
                          }
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{formatDate(u.created_at)}</td>
                      </tr>
                    ))}
                    {users.length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No users yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* BUSINESSES */}
        {tab === 'businesses' && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">All Businesses ({businesses.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Name</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Industry</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {businesses.map(b => (
                      <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium">{b.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{b.industry ?? '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground">{formatDate(b.created_at)}</td>
                      </tr>
                    ))}
                    {businesses.length === 0 && (
                      <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">No businesses yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* AI COSTS */}
        {tab === 'costs' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <StatCard icon={DollarSign} label="Total Cost Shown" value={`$${totalCost.toFixed(6)}`} color="text-green-500" />
              <StatCard icon={Cpu} label="AI Calls Shown" value={costs.length} sub="Last 100 calls" color="text-purple-500" />
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" /> Recent AI Calls
                </CardTitle>
                <CardDescription>Last 100 API calls across all businesses</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Provider</th>
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Model</th>
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Feature</th>
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Cost</th>
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {costs.map((c, i) => (
                        <tr key={i} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-2.5">
                            <Badge variant={c.provider === 'anthropic' ? 'default' : 'secondary'} className="capitalize">
                              {c.provider}
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground font-mono text-xs">{c.model}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{c.feature}</td>
                          <td className="px-4 py-2.5 font-medium">${Number(c.cost_usd).toFixed(6)}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{formatDate(c.created_at)}</td>
                        </tr>
                      ))}
                      {costs.length === 0 && (
                        <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No AI calls logged yet</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
