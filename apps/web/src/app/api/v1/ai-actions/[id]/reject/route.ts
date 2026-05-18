import { withAuth, ok, err } from '@/lib/api-handler';

export const PUT = withAuth(async (req, { supabase, businessId }, params) => {
  if (!businessId) return err('x-business-id header required');
  const body = await req.json().catch(() => ({}));
  const { data, error } = await supabase
    .from('ai_actions')
    .update({ status: 'rejected', rejection_reason: body.reason ?? null })
    .eq('id', params.id)
    .eq('business_id', businessId)
    .select()
    .single();
  if (error) return err(error.message);
  return ok(data);
});
