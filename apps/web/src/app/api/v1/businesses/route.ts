import { getAuth, ok, fail } from '../_lib';

export async function GET() {
  const { supabase, user, err } = await getAuth();
  if (err) return err;
  const { data, error } = await supabase
    .from('businesses').select('*').eq('user_id', user!.id).order('created_at', { ascending: true });
  if (error) return fail(error.message);
  return ok(data);
}

export async function POST(req: Request) {
  const { supabase, user, err } = await getAuth();
  if (err) return err;
  const body = await req.json();
  if (!body.name?.trim()) return fail('Name is required');
  const { data, error } = await supabase
    .from('businesses').insert({ ...body, user_id: user!.id }).select().single();
  if (error) return fail(error.message);
  return ok(data, 201);
}
