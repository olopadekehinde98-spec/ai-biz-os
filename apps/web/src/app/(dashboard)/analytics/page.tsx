'use client';

import { useEffect, useState } from 'react';
import { BarChart2, TrendingUp, DollarSign, Users, HeadphonesIcon, CheckSquare, FileText } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createClient } from '@/lib/supabase/client';
import { useBusinessStore } from '@/store/business';

interface LeadFunnelRow { status: string; count: number }
interface TicketRow { status: string; sentiment: string | null; count: number }
interface TaskRow { status: string; count: number }
interface ContentRow { status: string; platform: string; count: number }
interface AiCostRow { feature: string; cost_usd: number }

interface Analytics {
  leads: { total: number; converted: number; conversionRate: string };
  tickets: { total: number; resolved: number; escalated: number; resolutionRate: string };
  tasks: { total: number; completed: number; pending: number };
  content: { total: number; published: number };
  aiCost: { totalCost: number; byFeature: Record<string, { calls: number; cost_usd: number }> };
  leadFunnel: LeadFunnelRow[];
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className={`h-4 w-4 ${color}`} />
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

export default function AnalyticsPage() {
  const { activeBusiness } = useBusinessStore();
  const businessId = activeBusiness?.id;
  const [days, setDays] = useState('30');
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!businessId) return;

    const supabase = createClient();
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const since = new Date(Date.now() - parseInt(days) * 86400_000).toISOString();

        const [
          { data: leads },
          { data: tickets },
          { data: tasks },
          { data: content },
          { data: aiCosts },
        ] = await Promise.all([
          supabase
            .from('leads')
            .select('status')
            .eq('business_id', businessId)
            .gte('created_at', since),
          supabase
            .from('support_tickets')
            .select('status, sentiment')
            .eq('business_id', businessId)
            .gte('created_at', since),
          supabase
            .from('tasks')
            .select('status')
            .eq('business_id', businessId)
            .gte('created_at', since),
          supabase
            .from('content_posts')
            .select('status, platform')
            .eq('business_id', businessId)
            .gte('created_at', since),
          supabase
            .from('ai_cost_logs')
            .select('feature, cost_usd')
            .eq('business_id', businessId)
            .gte('created_at', since),
        ]);

        if (cancelled) return;

        // Leads
        const totalLeads = leads?.length ?? 0;
        const convertedLeads = leads?.filter((l) => l.status === 'converted').length ?? 0;
        const conversionRate = totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(1) : '0';

        // Lead funnel — group by status
        const leadStatusMap: Record<string, number> = {};
        for (const l of leads ?? []) {
          leadStatusMap[l.status] = (leadStatusMap[l.status] ?? 0) + 1;
        }
        const leadFunnel: LeadFunnelRow[] = Object.entries(leadStatusMap).map(([status, count]) => ({
          status,
          count,
        }));

        // Tickets
        const totalTickets = tickets?.length ?? 0;
        const resolvedTickets = tickets?.filter((t) => t.status === 'resolved').length ?? 0;
        const escalatedTickets = tickets?.filter((t) => t.status === 'escalated').length ?? 0;
        const resolutionRate = totalTickets > 0 ? ((resolvedTickets / totalTickets) * 100).toFixed(1) : '0';

        // Tasks
        const totalTasks = tasks?.length ?? 0;
        const completedTasks = tasks?.filter((t) => t.status === 'completed').length ?? 0;
        const pendingTasks = tasks?.filter((t) => t.status === 'pending').length ?? 0;

        // Content
        const totalContent = content?.length ?? 0;
        const publishedContent = content?.filter((c) => c.status === 'published').length ?? 0;

        // AI cost
        let totalCost = 0;
        const byFeature: Record<string, { calls: number; cost_usd: number }> = {};
        for (const row of aiCosts ?? []) {
          totalCost += row.cost_usd ?? 0;
          const feat = row.feature ?? 'unknown';
          if (!byFeature[feat]) byFeature[feat] = { calls: 0, cost_usd: 0 };
          byFeature[feat].calls += 1;
          byFeature[feat].cost_usd += row.cost_usd ?? 0;
        }

        setAnalytics({
          leads: { total: totalLeads, converted: convertedLeads, conversionRate },
          tickets: { total: totalTickets, resolved: resolvedTickets, escalated: escalatedTickets, resolutionRate },
          tasks: { total: totalTasks, completed: completedTasks, pending: pendingTasks },
          content: { total: totalContent, published: publishedContent },
          aiCost: { totalCost, byFeature },
          leadFunnel,
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [businessId, days]);

  const funnel = analytics?.leadFunnel ?? [];
  const funnelMax = funnel.reduce((m, r) => Math.max(m, r.count), 1);

  return (
    <div>
      <Header
        title="Analytics"
        description="Performance metrics for your business"
        action={
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 days</SelectItem>
              <SelectItem value="30">30 days</SelectItem>
              <SelectItem value="90">90 days</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      <div className="p-6 space-y-6">
        {loading && (
          <div className="text-center py-4 text-sm text-muted-foreground">Loading…</div>
        )}

        {!loading && !businessId && (
          <Card className="border-dashed">
            <CardContent className="flex items-center justify-center py-12">
              <p className="text-sm text-muted-foreground">Select a business to view analytics</p>
            </CardContent>
          </Card>
        )}

        {!loading && businessId && analytics && (
          <>
            {/* Summary stat cards */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Overview ({days}d)</h3>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard label="Total leads" value={analytics.leads.total} icon={Users} color="text-blue-500" />
                <StatCard label="Conversion rate" value={`${analytics.leads.conversionRate}%`} icon={TrendingUp} color="text-green-500" />
                <StatCard label="Support tickets" value={analytics.tickets.total} icon={HeadphonesIcon} color="text-orange-500" />
                <StatCard label="Resolution rate" value={`${analytics.tickets.resolutionRate}%`} icon={BarChart2} color="text-purple-500" />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Lead funnel */}
              <Card>
                <CardHeader><CardTitle className="text-sm">Lead Funnel ({days}d)</CardTitle></CardHeader>
                <CardContent>
                  {funnel.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">No lead data</p>
                  ) : (
                    <div className="space-y-2">
                      {funnel.map((stage) => {
                        const pct = Math.round((stage.count / funnelMax) * 100);
                        return (
                          <div key={stage.status} className="flex items-center gap-3">
                            <span className="w-24 text-xs text-muted-foreground capitalize shrink-0">{stage.status}</span>
                            <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                              <div
                                className="h-2 bg-primary rounded-full transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="w-16 text-right text-xs font-medium shrink-0">
                              {stage.count} <span className="text-muted-foreground">({pct}%)</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Support breakdown */}
              <Card>
                <CardHeader><CardTitle className="text-sm">Support Breakdown ({days}d)</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {analytics.tickets.total === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">No ticket data</p>
                  ) : (
                    <>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Total</span>
                        <span className="font-bold">{analytics.tickets.total}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Resolved</span>
                        <Badge variant="success">{analytics.tickets.resolved}</Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Escalated</span>
                        <Badge variant="destructive">{analytics.tickets.escalated}</Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Open</span>
                        <Badge variant="warning">
                          {analytics.tickets.total - analytics.tickets.resolved - analytics.tickets.escalated}
                        </Badge>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Task progress */}
              <Card>
                <CardHeader><CardTitle className="text-sm">Task Progress ({days}d)</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {analytics.tasks.total === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">No task data</p>
                  ) : (
                    <>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Total</span>
                        <span className="font-bold">{analytics.tasks.total}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Completed</span>
                        <Badge variant="success">{analytics.tasks.completed}</Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Pending</span>
                        <Badge variant="warning">{analytics.tasks.pending}</Badge>
                      </div>
                      <div className="mt-2">
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>Completion</span>
                          <span>{analytics.tasks.total > 0 ? Math.round((analytics.tasks.completed / analytics.tasks.total) * 100) : 0}%</span>
                        </div>
                        <div className="bg-muted rounded-full h-2 overflow-hidden">
                          <div
                            className="h-2 bg-green-500 rounded-full transition-all"
                            style={{
                              width: `${analytics.tasks.total > 0 ? (analytics.tasks.completed / analytics.tasks.total) * 100 : 0}%`,
                            }}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* AI cost by feature */}
              <Card>
                <CardHeader><CardTitle className="text-sm">AI Cost by Feature ({days}d)</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total cost</span>
                    <span className="text-sm font-bold">${analytics.aiCost.totalCost.toFixed(4)}</span>
                  </div>
                  {Object.keys(analytics.aiCost.byFeature).length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2 text-center">No AI usage data</p>
                  ) : (
                    <div className="space-y-1.5 pt-2 border-t">
                      <p className="text-xs font-semibold text-muted-foreground">By feature</p>
                      {Object.entries(analytics.aiCost.byFeature)
                        .sort((a, b) => b[1].cost_usd - a[1].cost_usd)
                        .slice(0, 6)
                        .map(([feature, data]) => (
                          <div key={feature} className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground capitalize">{feature.replace(/_/g, ' ')}</span>
                            <div className="flex gap-3 text-xs">
                              <span>{data.calls} calls</span>
                              <span className="text-muted-foreground">${data.cost_usd.toFixed(4)}</span>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
