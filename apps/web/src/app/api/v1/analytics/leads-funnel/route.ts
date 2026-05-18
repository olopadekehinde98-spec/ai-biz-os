import { withAuth, ok, err } from '@/lib/api-handler';

export const GET = withAuth(async (_req, { supabase, businessId }) => {
  if (!businessId) return err('x-business-id header required');
  const { data, error } = await supabase
    .from('leads')
    .select('status')
    .eq('business_id', businessId);
  if (error) return err(error.message);

  const counts: Record<string, number> = { new: 0, contacted: 0, qualified: 0, converted: 0, lost: 0 };
  data.forEach(l => { counts[l.status] = (counts[l.status] ?? 0) + 1; });
  const total = data.length || 1;

  return ok([
    { stage: 'New', count: counts.new, pct: Math.round((counts.new / total) * 100) },
    { stage: 'Contacted', count: counts.contacted, pct: Math.round((counts.contacted / total) * 100) },
    { stage: 'Qualified', count: counts.qualified, pct: Math.round((counts.qualified / total) * 100) },
    { stage: 'Converted', count: counts.converted, pct: Math.round((counts.converted / total) * 100) },
  ]);
});
