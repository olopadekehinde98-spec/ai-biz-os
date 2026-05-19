'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { CheckCircle, XCircle, Zap, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createClient } from '@/lib/supabase/client';
import { useBusinessStore } from '@/store/business';
import { formatRelative } from '@/lib/utils';

type ActionStatus = 'pending_approval' | 'approved' | 'rejected' | 'executed' | 'failed';

interface AiAction {
  id: string;
  business_id: string;
  action_type: string;
  description: string;
  payload: Record<string, unknown> | null;
  status: ActionStatus;
  created_at: string;
}

const STATUS_VARIANT: Record<ActionStatus, 'warning' | 'success' | 'secondary' | 'info' | 'destructive'> = {
  pending_approval: 'warning',
  approved: 'success',
  rejected: 'secondary',
  executed: 'info',
  failed: 'destructive',
};

export default function ApprovalsPage() {
  const { activeBusiness } = useBusinessStore();
  const businessId = activeBusiness?.id;
  const [actions, setActions] = useState<AiAction[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<string>('pending_approval');
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    const supabase = createClient();
    let query = supabase
      .from('ai_actions')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    if (filter !== 'all') {
      query = query.eq('status', filter);
    }

    const { data, error } = await query;
    if (error) {
      // Table may be missing created_at — try without ordering
      const { data: fallback } = await supabase
        .from('ai_actions')
        .select('*')
        .eq('business_id', businessId);
      setActions(fallback ?? []);
    } else {
      setActions(data ?? []);
    }
    setLoading(false);
  }, [businessId, filter]);

  useEffect(() => {
    load();

    // Auto-refresh every 30 seconds
    intervalRef.current = setInterval(load, 30_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [load]);

  async function updateStatus(id: string, status: 'approved' | 'rejected') {
    setMutatingId(id);
    const supabase = createClient();
    const { error } = await supabase
      .from('ai_actions')
      .update({ status })
      .eq('id', id);

    if (error) {
      toast.error(`Failed to ${status === 'approved' ? 'approve' : 'reject'} action`);
    } else {
      toast.success(status === 'approved' ? 'Action approved' : 'Action rejected');
      setActions((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status } : a))
      );
    }
    setMutatingId(null);
  }

  const pendingCount = actions.filter((a) => a.status === 'pending_approval').length;

  return (
    <div>
      <Header
        title="AI Approvals"
        description="Review and approve actions your AI wants to take"
        action={
          pendingCount > 0 ? (
            <Badge variant="warning" className="text-sm px-3 py-1">{pendingCount} pending</Badge>
          ) : undefined
        }
      />

      <div className="p-6 space-y-4">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending_approval">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="executed">Executed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>

        {loading ? (
          <div className="text-center py-12 text-sm text-muted-foreground">Loading…</div>
        ) : actions.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Zap className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">No pending actions — your AI is up to date</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {actions.map((action) => (
              <Card key={action.id}>
                <CardContent className="flex items-start gap-4 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Zap className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {action.action_type.replace(/_/g, ' ')}
                      </Badge>
                      <Badge variant={STATUS_VARIANT[action.status]} className="text-[10px]">
                        {action.status.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium">{action.description}</p>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {formatRelative(action.created_at)}
                    </p>
                    {action.payload && Object.keys(action.payload).length > 0 && (
                      <pre className="mt-2 text-[11px] bg-muted rounded-md p-2 overflow-x-auto max-h-24 leading-relaxed">
                        {JSON.stringify(action.payload, null, 2)}
                      </pre>
                    )}
                  </div>
                  {action.status === 'pending_approval' && (
                    <div className="flex gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateStatus(action.id, 'rejected')}
                        disabled={mutatingId === action.id}
                        className="text-destructive border-destructive/30 hover:bg-destructive/10"
                      >
                        <XCircle className="h-4 w-4" /> Reject
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => updateStatus(action.id, 'approved')}
                        disabled={mutatingId === action.id}
                      >
                        <CheckCircle className="h-4 w-4" /> Approve
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
