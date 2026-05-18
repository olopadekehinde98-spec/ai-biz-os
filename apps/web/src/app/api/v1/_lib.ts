import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function getAuth() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { supabase, user: null, err: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  return { supabase, user, err: null };
}

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function fail(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

export function businessId(req: Request) {
  return req.headers.get('x-business-id') ?? '';
}
