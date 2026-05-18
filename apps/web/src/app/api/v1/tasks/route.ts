import { getAuth, ok, fail, businessId } from '../_lib';

export async function GET(req: Request) {
  const { supabase, err } = await getAuth();
  if (err) return err;
  const bid = businessId(req);
  if (!bid) return fail('x-business-id header required');
  const { data, error } = await supabase
    .from('tasks').select('*').eq('business_id', bid).order('created_at', { ascending: false });
  if (error) return fail(error.message);
  return ok(data);
}

export async function POST(req: Request) {
  const { supabase, err } = await getAuth();
  if (err) return err;
  const bid = businessId(req);
  if (!bid) return fail('x-business-id header required');
  const body = await req.json();
  const { data, error } = await supabase
    .from('tasks').insert({ ...body, business_id: bid }).select().single();
  if (error) return fail(error.message);
  return ok(data, 201);
}
