import { withAuth, ok, err } from '@/lib/api-handler';

export const GET = withAuth(async (_req, { supabase, userId, businessId }) => {
  if (!businessId) return err('x-business-id header required');
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact' })
    .eq('user_id', userId)
    .eq('business_id', businessId)
    .eq('read', false);
  if (error) return err(error.message);
  return ok({ count: count ?? 0 });
});
