'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, HeadphonesIcon, CheckSquare, Share2, Zap, TrendingUp, Clock } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { useBusinessStore } from '@/store/business';
import { formatRelative } from '@/lib/utils';

function StatCard({ title, value, icon: Icon, description, color = 'text-primary' }: {
  title: string; value: number | string; icon: React.ElementType; description?: string; color?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${color}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { activeBusiness, setActiveBusiness, setBusinesses } = useBusinessStore();
  const [stats, setStats] = useState({ leads: 0, tickets: 0, tasks: 0, posts: 0 });
  const [recentLeads, setRecentLeads] = useState<any[]>([]);
  const [pendingActions, setPendingActions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // On mount: load businesses, redirect to onboarding if none
  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const { data: biz } = await supabase
        .from('businesses').select('*').eq('user_id', user.id).order('created_at', { ascending: true });

      if (!biz || biz.length === 0) {
        router.push('/onboarding');
        return;
      }

      setBusinesses(biz);
      const active = activeBusiness ?? biz[0];
      setActiveBusiness(active);
      await loadStats(active.id);
    }
    init();
  }, []);

  // Reload stats when active business changes
  useEffect(() => {
    if (activeBusiness?.id) loadStats(activeBusiness.id);
  }, [activeBusiness?.id]);

  async function loadStats(bizId: string) {
    setLoading(true);
    const supabase = createClient();
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [leadsRes, ticketsRes, tasksRes, postsRes, recentLeadsRes, actionsRes] = await Promise.all([
      supabase.from('leads').select('id', { count: 'exact', head: true }).eq('business_id', bizId).gte('created_at', weekAgo),
      supabase.from('support_tickets').select('id', { count: 'exact', head: true }).eq('business_id', bizId).eq('status', 'open'),
      supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('business_id', bizId).eq('status', 'todo'),
      supabase.from('content_posts').select('id', { count: 'exact', head: true }).eq('business_id', bizId).eq('status', 'scheduled'),
      supabase.from('leads').select('id, name, email, status, created_at').eq('business_id', bizId).order('created_at', { ascending: false }).limit(5),
      supabase.from('ai_actions').select('*').eq('business_id', bizId).eq('status', 'pending_approval').limit(5),
    ]);

    setStats({
      leads: leadsRes.count ?? 0,
      tickets: ticketsRes.count ?? 0,
      tasks: tasksRes.count ?? 0,
      posts: postsRes.count ?? 0,
    });
    setRecentLeads(recentLeadsRes.data ?? []);
    setPendingActions(actionsRes.data ?? []);
    setLoading(false);
  }

  const statusColor: Record<string, string> = {
    new: 'secondary', contacted: 'info', qualified: 'warning', converted: 'success', lost: 'destructive',
  };

  return (
    <div>
      <Header
        title={activeBusiness ? `Good morning — ${activeBusiness.name}` : 'Dashboard'}
        description="Here's what's happening with your business today"
      />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="New Leads (7d)" value={stats.leads} icon={Users} description="This week" color="text-blue-500" />
          <StatCard title="Open Tickets" value={stats.tickets} icon={HeadphonesIcon} description="Need attention" color="text-orange-500" />
          <StatCard title="Tasks To Do" value={stats.tasks} icon={CheckSquare} description="In your backlog" color="text-purple-500" />
          <StatCard title="Scheduled Posts" value={stats.posts} icon={Share2} description="Ready to publish" color="text-pink-500" />
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Pending AI Actions */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" /> Pending AI Approvals
              </CardTitle>
              {pendingActions.length > 0 && (
                <Button size="sm" variant="outline" onClick={() => router.push('/approvals')}>
                  View all
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 bg-muted animate-pulse rounded" />)}</div>
              ) : pendingActions.length === 0 ? (
                <div className="text-center py-6">
                  <Zap className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No pending actions — your AI is up to date</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {pendingActions.map(action => (
                    <div key={action.id} className="flex items-start gap-3 rounded-lg border p-3">
                      <Zap className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{action.action_type}</p>
                        <p className="text-xs text-muted-foreground truncate">{action.description}</p>
                      </div>
                      <Badge variant="warning" className="shrink-0">Pending</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Leads */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-500" /> Recent Leads
              </CardTitle>
              <Button size="sm" variant="outline" onClick={() => router.push('/leads')}>
                View all
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 bg-muted animate-pulse rounded" />)}</div>
              ) : recentLeads.length === 0 ? (
                <div className="text-center py-6">
                  <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No leads yet</p>
                  <Button size="sm" className="mt-3" onClick={() => router.push('/leads')}>Add your first lead</Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentLeads.map(lead => (
                    <div key={lead.id} className="flex items-center gap-3 rounded-lg border px-3 py-2.5">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                        {lead.name[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{lead.name}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {formatRelative(lead.created_at)}
                        </p>
                      </div>
                      <Badge variant={statusColor[lead.status] as any ?? 'secondary'} className="capitalize shrink-0">
                        {lead.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
