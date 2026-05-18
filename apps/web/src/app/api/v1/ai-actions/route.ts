import { getAuth, ok, fail, businessId } from '../_lib';

export async function GET(req: Request) {
  const { supabase, err } = await getAuth();
  if (err) return err;
  const bid = businessId(req);
  if (!bid) return fail('x-business-id header required');
  const { data, error } = await supabase
    .from('ai_actions').select('*').eq('business_id', bid)
    .eq('status', 'pending_approval').order('created_at', { ascending: false });
  if (error) return fail(error.message);
  return ok(data);
}
