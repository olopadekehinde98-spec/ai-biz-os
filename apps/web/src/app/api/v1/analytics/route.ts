import { getAuth, ok, fail, businessId } from '../_lib';

export async function GET(req: Request) {
  const { supabase, err } = await getAuth();
  if (err) return err;
  const bid = businessId(req);
  if (!bid) return fail('x-business-id header required');

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [leads, tickets, tasks, posts] = await Promise.all([
    supabase.from('leads').select('id, status, created_at').eq('business_id', bid),
    supabase.from('support_tickets').select('id, status, sentiment').eq('business_id', bid),
    supabase.from('tasks').select('id, status, due_date').eq('business_id', bid),
    supabase.from('content_posts').select('id, status').eq('business_id', bid),
  ]);

  const leadsData = leads.data ?? [];
  const ticketsData = tickets.data ?? [];
  const tasksData = tasks.data ?? [];
  const postsData = posts.data ?? [];

  const today = new Date().toDateString();

  return ok({
    leadsThisWeek: leadsData.filter(l => l.created_at >= weekAgo).length,
    totalLeads: leadsData.length,
    openTickets: ticketsData.filter(t => t.status === 'open').length,
    totalTickets: ticketsData.length,
    tasksDueToday: tasksData.filter(t => t.due_date && new Date(t.due_date).toDateString() === today && t.status !== 'done').length,
    scheduledPosts: postsData.filter(p => p.status === 'scheduled').length,
    leadsByStatus: {
      new: leadsData.filter(l => l.status === 'new').length,
      contacted: leadsData.filter(l => l.status === 'contacted').length,
      qualified: leadsData.filter(l => l.status === 'qualified').length,
      converted: leadsData.filter(l => l.status === 'converted').length,
      lost: leadsData.filter(l => l.status === 'lost').length,
    },
    ticketsByStatus: {
      open: ticketsData.filter(t => t.status === 'open').length,
      ai_replied: ticketsData.filter(t => t.status === 'ai_replied').length,
      escalated: ticketsData.filter(t => t.status === 'escalated').length,
      resolved: ticketsData.filter(t => t.status === 'resolved').length,
    },
  });
}
