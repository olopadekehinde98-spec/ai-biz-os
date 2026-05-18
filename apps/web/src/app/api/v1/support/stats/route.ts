import { withAuth, ok, err } from '@/lib/api-handler';

export const GET = withAuth(async (_req, { supabase, businessId }) => {
  if (!businessId) return err('x-business-id header required');
  const { data, error } = await supabase
    .from('support_tickets')
    .select('status, sentiment')
    .eq('business_id', businessId);
  if (error) return err(error.message);

  const stats = {
    open: data.filter(t => t.status === 'open').length,
    ai_replied: data.filter(t => t.status === 'ai_replied').length,
    escalated: data.filter(t => t.status === 'escalated').length,
    angry: data.filter(t => t.sentiment === 'angry').length,
  };
  return ok(stats);
});
