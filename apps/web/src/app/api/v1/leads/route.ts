import { getAuth, ok, fail, businessId } from '../_lib';

export async function GET(req: Request) {
  const { supabase, err } = await getAuth();
  if (err) return err;
  const bid = businessId(req);
  if (!bid) return fail('x-business-id header required');
  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const search = url.searchParams.get('search');
  let q = supabase.from('leads').select('*').eq('business_id', bid).order('created_at', { ascending: false });
  if (status && status !== 'all') q = q.eq('status', status);
  if (search) q = q.ilike('name', `%${search}%`);
  const { data, error } = await q;
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
    .from('leads').insert({ ...body, business_id: bid }).select().single();
  if (error) return fail(error.message);
  return ok(data, 201);
}
