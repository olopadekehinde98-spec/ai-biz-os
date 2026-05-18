import { getAuth, ok, fail } from '../../_lib';

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const { supabase, err } = await getAuth();
  if (err) return err;
  const body = await req.json();
  const { data, error } = await supabase.from('leads').update(body).eq('id', params.id).select().single();
  if (error) return fail(error.message);
  return ok(data);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const { supabase, err } = await getAuth();
  if (err) return err;
  const { error } = await supabase.from('leads').delete().eq('id', params.id);
  if (error) return fail(error.message);
  return ok({ success: true });
}
