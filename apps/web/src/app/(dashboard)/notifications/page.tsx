'use client';

import { useEffect, useState, useCallback } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/client';
import { useBusinessStore } from '@/store/business';
import { formatRelative } from '@/lib/utils';

interface Notification {
  id: string;
  user_id: string;
  business_id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
}

export default function NotificationsPage() {
  const { activeBusiness } = useBusinessStore();
  const businessId = activeBusiness?.id;
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Resolve current user once
  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, []);

  const load = useCallback(async () => {
    if (!userId || !businessId) return;
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load notifications');
    } else {
      setNotifications(data ?? []);
    }
    setLoading(false);
  }, [userId, businessId]);

  useEffect(() => {
    load();
  }, [load]);

  async function markRead(id: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id);

    if (error) {
      toast.error('Failed to mark as read');
    } else {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    }
  }

  async function markAllRead() {
    if (!userId || !businessId) return;
    const supabase = createClient();
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('business_id', businessId)
      .eq('read', false);

    if (error) {
      toast.error('Failed to mark all as read');
    } else {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      toast.success('All notifications marked as read');
    }
  }

  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div>
      <Header
        title="Notifications"
        description="Your activity feed"
        action={
          <div className="flex items-center gap-2">
            {unread > 0 && (
              <Badge variant="destructive">{unread} unread</Badge>
            )}
            {unread > 0 && (
              <Button size="sm" variant="outline" onClick={markAllRead}>
                <CheckCheck className="h-4 w-4" /> Mark all read
              </Button>
            )}
          </div>
        }
      />

      <div className="p-6">
        {loading ? (
          <div className="text-center py-12 text-sm text-muted-foreground">Loading…</div>
        ) : notifications.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Bell className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">No notifications yet</p>
              <p className="text-xs text-muted-foreground mt-1">You're all caught up</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0 divide-y">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`flex gap-3 px-4 py-3 transition-colors ${
                    !n.read ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-muted/50'
                  }`}
                >
                  {/* Unread indicator dot */}
                  <div
                    className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${
                      !n.read ? 'bg-primary' : 'bg-transparent'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-snug">{n.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{formatRelative(n.created_at)}</p>
                      </div>
                      {!n.read && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs h-7 px-2 shrink-0"
                          onClick={() => markRead(n.id)}
                        >
                          Mark read
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
