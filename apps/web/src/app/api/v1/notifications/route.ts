import { getAuth, ok, fail, businessId } from '../_lib';

export async function GET(req: Request) {
  const { supabase, user, err } = await getAuth();
  if (err) return err;
  const bid = businessId(req);
  const { data, error } = await supabase
    .from('notifications').select('*').eq('user_id', user!.id)
    .order('created_at', { ascending: false }).limit(50);
  if (error) return fail(error.message);
  return ok(data);
}

export async function PUT(req: Request) {
  const { supabase, user, err } = await getAuth();
  if (err) return err;
  const url = new URL(req.url);
  if (url.searchParams.get('action') === 'read-all') {
    await supabase.from('notifications').update({ read: true }).eq('user_id', user!.id).eq('read', false);
    return ok({ success: true });
  }
  return fail('Unknown action');
}
