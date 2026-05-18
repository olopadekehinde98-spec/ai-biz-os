import { getAuth, ok, fail } from '../../../../_lib';

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const { supabase, err } = await getAuth();
  if (err) return err;
  const body = await req.json();
  const { data, error } = await supabase
    .from('support_tickets').update(body).eq('id', params.id).select().single();
  if (error) return fail(error.message);
  return ok(data);
}
