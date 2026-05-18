import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export type RouteContext = {
  supabase: ReturnType<typeof createServerClient>;
  userId: string;
  businessId: string | null;
};

/**
 * Wraps a route handler with auth. Returns 401 if not logged in.
 * Passes supabase client, userId, and businessId (from x-business-id header).
 */
export function withAuth(
  handler: (req: NextRequest, ctx: RouteContext, params?: any) => Promise<NextResponse>,
) {
  return async (req: NextRequest, { params }: { params?: any } = {}) => {
    try {
      const cookieStore = await cookies();
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll: () => cookieStore.getAll(),
            setAll: (list) => {
              try {
                list.forEach(({ name, value, options }) =>
                  cookieStore.set(name, value, options),
                );
              } catch {}
            },
          },
        },
      );

      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const businessId = req.headers.get('x-business-id');
      return handler(req, { supabase, userId: user.id, businessId }, params);
    } catch (err: any) {
      console.error('API route error:', err);
      return NextResponse.json({ error: err.message ?? 'Internal server error' }, { status: 500 });
    }
  };
}

export function ok(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

export function err(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
