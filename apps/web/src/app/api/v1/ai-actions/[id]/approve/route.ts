import { withAuth, ok, err } from '@/lib/api-handler';

export const PUT = withAuth(async (_req, { supabase, businessId }, params) => {
  if (!businessId) return err('x-business-id header required');
  const { data, error } = await supabase
    .from('ai_actions')
    .update({ status: 'approved', executed_at: new Date().toISOString() })
    .eq('id', params.id)
    .eq('business_id', businessId)
    .select()
    .single();
  if (error) return err(error.message);
  return ok(data);
});
