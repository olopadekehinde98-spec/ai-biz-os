import { withAuth, ok, err } from '@/lib/api-handler';

export const PUT = withAuth(async (_req, { supabase, userId, businessId }) => {
  if (!businessId) return err('x-business-id header required');
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('business_id', businessId)
    .eq('read', false);
  if (error) return err(error.message);
  return ok({ success: true });
});
