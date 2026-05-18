import { withAuth, ok, err } from '@/lib/api-handler';

export const GET = withAuth(async (_req, { supabase, businessId }) => {
  if (!businessId) return err('x-business-id header required');

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const today = new Date().toISOString().split('T')[0];

  const [leadsRes, ticketsRes, tasksRes, postsRes] = await Promise.all([
    supabase.from('leads').select('id', { count: 'exact' })
      .eq('business_id', businessId).gte('created_at', weekAgo),
    supabase.from('support_tickets').select('id', { count: 'exact' })
      .eq('business_id', businessId).eq('status', 'open'),
    supabase.from('tasks').select('id', { count: 'exact' })
      .eq('business_id', businessId).eq('status', 'todo')
      .gte('due_date', today).lt('due_date', today + 'T23:59:59'),
    supabase.from('content_posts').select('id', { count: 'exact' })
      .eq('business_id', businessId).eq('status', 'scheduled'),
  ]);

  return ok({
    leadsThisWeek: leadsRes.count ?? 0,
    openTickets: ticketsRes.count ?? 0,
    tasksDueToday: tasksRes.count ?? 0,
    scheduledPosts: postsRes.count ?? 0,
  });
});
